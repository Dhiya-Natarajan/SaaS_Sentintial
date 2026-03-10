import { PrismaClient } from '@prisma/client';
import {
  AnomalySeverity,
  detectUsageAnomaly
} from '../ml/detect-anomaly';
import type { ProviderService } from '../providers/provider-routing';

const prisma = new PrismaClient();

const THROTTLE_MS_BY_SEVERITY: Record<AnomalySeverity, number> = {
  NONE: 0,
  LOW: 200,
  MEDIUM: 500,
  HIGH: 1000
};

const DEFAULT_FALLBACK_CONFIGS: Array<{
  primaryService: ProviderService;
  fallbackService: ProviderService;
}> = [
  { primaryService: 'openai', fallbackService: 'anthropic' }
];

const DEFAULT_MODEL_DOWNGRADES = [
  { service: 'openai', sourceModel: 'gpt-4', targetModel: 'gpt-3.5-turbo' },
  { service: 'openai', sourceModel: 'gpt-4o', targetModel: 'gpt-4o-mini' },
  { service: 'anthropic', sourceModel: 'claude-3-opus-20240229', targetModel: 'claude-3-haiku-20240307' }
];

export type ControlReason = 'NONE' | 'OVERLOAD' | 'SECURITY_POLICY';
export type ControlAction = 'THROTTLE' | 'REROUTE' | 'DOWNGRADE' | 'BLOCK';

export interface PolicySignal {
  block: boolean;
  details?: string;
}

export interface ControlDecisionInput {
  service: ProviderService;
  endpoint: string;
  method: string;
  currentUsage: number;
  requestBody?: unknown;
  availableServices: ProviderService[];
  requestKind?: string;
  rerouteEligible?: boolean;
  policySignal?: PolicySignal;
}

export interface ControlDecision {
  service: ProviderService;
  routedService: ProviderService;
  endpoint: string;
  method: string;
  isAnomaly: boolean;
  reason: ControlReason;
  severity: AnomalySeverity;
  throttleMs: number;
  actions: ControlAction[];
  currentUsage: number;
  anomalyThreshold: number;
  anomalyMultiplier: number;
  modelDowngrade?: {
    from: string;
    to: string;
  };
  modifiedBody?: unknown;
}

type PrismaLike = Pick<
  PrismaClient,
  'fallbackConfig' | 'modelDowngradeMapping' | 'enforcementLog'
>;

interface ControlEngineDependencies {
  prisma?: PrismaLike;
  detectUsage?: typeof detectUsageAnomaly;
}

export class ControlEngineService {
  private defaultsInitialized = false;
  private prisma: PrismaLike;
  private detectUsage: typeof detectUsageAnomaly;

  constructor(dependencies: ControlEngineDependencies = {}) {
    this.prisma = dependencies.prisma || prisma;
    this.detectUsage = dependencies.detectUsage || detectUsageAnomaly;
  }

  async evaluate(input: ControlDecisionInput): Promise<ControlDecision> {
    await this.ensureDefaults();

    const usageAnomaly = this.detectUsage(input.currentUsage);
    const isSecurityBlock = input.policySignal?.block === true;
    const reason: ControlReason = isSecurityBlock
      ? 'SECURITY_POLICY'
      : usageAnomaly.isAnomaly
        ? 'OVERLOAD'
        : 'NONE';
    const throttleMs = reason === 'OVERLOAD'
      ? THROTTLE_MS_BY_SEVERITY[usageAnomaly.severity]
      : 0;
    const actions: ControlAction[] = [];

    if (isSecurityBlock) {
      actions.push('BLOCK');
    } else if (throttleMs > 0) {
      actions.push('THROTTLE');
    }

    let routedService = input.service;
    if (
      reason === 'OVERLOAD' &&
      usageAnomaly.severity === 'HIGH' &&
      input.rerouteEligible
    ) {
      const fallback = await this.getFallbackService(input.service);
      if (
        fallback &&
        fallback !== input.service &&
        input.availableServices.includes(fallback)
      ) {
        routedService = fallback;
        actions.push('REROUTE');
      }
    }

    let modifiedBody = input.requestBody;
    let modelDowngrade: ControlDecision['modelDowngrade'];

    if (
      reason === 'OVERLOAD' &&
      (usageAnomaly.severity === 'MEDIUM' || usageAnomaly.severity === 'HIGH')
    ) {
      const sourceModel = this.extractModel(input.requestBody);
      if (sourceModel) {
        const mapping =
          (await this.getDowngradeMapping(routedService, sourceModel)) ||
          (routedService !== input.service
            ? await this.getDowngradeMapping(input.service, sourceModel)
            : null);

        if (mapping && mapping.targetModel !== sourceModel) {
          modifiedBody = this.withModel(input.requestBody, mapping.targetModel);
          modelDowngrade = { from: sourceModel, to: mapping.targetModel };
          actions.push('DOWNGRADE');
        }
      }
    }

    const decision: ControlDecision = {
      service: input.service,
      routedService,
      endpoint: input.endpoint,
      method: input.method,
      isAnomaly: usageAnomaly.isAnomaly,
      reason,
      severity: usageAnomaly.severity,
      throttleMs,
      actions,
      currentUsage: input.currentUsage,
      anomalyThreshold: usageAnomaly.threshold,
      anomalyMultiplier: usageAnomaly.multiplier,
      modelDowngrade,
      modifiedBody
    };

    if (actions.length > 0) {
      await this.logEnforcement(decision, input.policySignal?.details);
    }

    return decision;
  }

  async getEnforcementLogs(filters: {
    limit?: number;
    service?: string;
    severity?: AnomalySeverity;
  }) {
    const where: Record<string, string> = {};
    if (filters.service) where.service = filters.service;
    if (filters.severity) where.severity = filters.severity;

    const limit = Math.min(Math.max(filters.limit ?? 50, 1), 200);

    try {
      return await this.prisma.enforcementLog.findMany({
        where,
        take: limit,
        orderBy: { timestamp: 'desc' }
      });
    } catch (error) {
      console.error('Failed to fetch enforcement logs:', error);
      return [];
    }
  }

  private async ensureDefaults() {
    if (this.defaultsInitialized) {
      return;
    }

    try {
      await Promise.all([
        ...DEFAULT_FALLBACK_CONFIGS.map((entry) =>
          this.prisma.fallbackConfig.upsert({
            where: { primaryService: entry.primaryService },
            update: {},
            create: {
              primaryService: entry.primaryService,
              fallbackService: entry.fallbackService,
              enabled: true
            }
          })
        ),
        ...DEFAULT_MODEL_DOWNGRADES.map((entry) =>
          this.prisma.modelDowngradeMapping.upsert({
            where: {
              service_sourceModel: {
                service: entry.service,
                sourceModel: entry.sourceModel
              }
            },
            update: {},
            create: {
              service: entry.service,
              sourceModel: entry.sourceModel,
              targetModel: entry.targetModel
            }
          })
        )
      ]);

      this.defaultsInitialized = true;
    } catch (error) {
      // This can fail before the new schema is pushed; keep runtime alive.
      console.error('Failed to initialize default control configs:', error);
    }
  }

  private async getFallbackService(primaryService: ProviderService): Promise<ProviderService | null> {
    try {
      const config = await this.prisma.fallbackConfig.findUnique({
        where: { primaryService }
      });

      if (!config || config.enabled === false) {
        return null;
      }

      return (config.fallbackService as ProviderService) || null;
    } catch (error) {
      console.error('Failed to load fallback config:', error);
      return null;
    }
  }

  private async getDowngradeMapping(service: string, sourceModel: string) {
    try {
      return await this.prisma.modelDowngradeMapping.findUnique({
        where: {
          service_sourceModel: {
            service,
            sourceModel
          }
        }
      });
    } catch (error) {
      console.error('Failed to load model downgrade mapping:', error);
      return null;
    }
  }

  private extractModel(requestBody?: unknown): string | null {
    if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody)) {
      return null;
    }

    const model = (requestBody as Record<string, unknown>).model;
    return typeof model === 'string' ? model : null;
  }

  private withModel(requestBody: unknown, model: string): unknown {
    if (!requestBody || typeof requestBody !== 'object' || Array.isArray(requestBody)) {
      return requestBody;
    }

    return {
      ...(requestBody as Record<string, unknown>),
      model
    };
  }

  private async logEnforcement(decision: ControlDecision, policyDetails?: string) {
    const details = [
      decision.modelDowngrade
        ? `Model downgraded from ${decision.modelDowngrade.from} to ${decision.modelDowngrade.to}`
        : null,
      policyDetails || null
    ].filter(Boolean).join(' | ') || null;

    try {
      await this.prisma.enforcementLog.create({
        data: {
          service: decision.service,
          routedService: decision.routedService,
          endpoint: decision.endpoint,
          method: decision.method,
          reason: decision.reason,
          severity: decision.severity,
          action: decision.actions.join(','),
          throttleMs: decision.throttleMs,
          currentUsage: decision.currentUsage,
          anomalyThreshold: Number.isFinite(decision.anomalyThreshold)
            ? decision.anomalyThreshold
            : null,
          anomalyMultiplier: Number.isFinite(decision.anomalyMultiplier)
            ? decision.anomalyMultiplier
            : null,
          details
        }
      });
    } catch (error) {
      console.error('Failed to write enforcement log:', error);
    }
  }
}

export const controlEngine = new ControlEngineService();
