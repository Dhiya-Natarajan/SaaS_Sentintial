import { PrismaClient } from '@prisma/client';
import {
  AnomalySeverity,
  detectUsageAnomaly
} from '../ml/detect-anomaly';

const prisma = new PrismaClient();

const THROTTLE_MS_BY_SEVERITY: Record<AnomalySeverity, number> = {
  NONE: 0,
  LOW: 200,
  MEDIUM: 500,
  HIGH: 1000
};

const DEFAULT_FALLBACK_CONFIGS = [
  { primaryService: 'openai', fallbackService: 'anthropic' }
];

const DEFAULT_MODEL_DOWNGRADES = [
  { service: 'openai', sourceModel: 'gpt-4', targetModel: 'gpt-3.5-turbo' },
  { service: 'openai', sourceModel: 'gpt-4o', targetModel: 'gpt-4o-mini' },
  { service: 'anthropic', sourceModel: 'claude-3-opus-20240229', targetModel: 'claude-3-haiku-20240307' }
];

export interface ControlDecisionInput {
  service: string;
  endpoint: string;
  method: string;
  currentUsage: number;
  requestBody?: unknown;
  availableServices: string[];
}

export interface ControlDecision {
  service: string;
  routedService: string;
  endpoint: string;
  method: string;
  isAnomaly: boolean;
  severity: AnomalySeverity;
  throttleMs: number;
  actions: string[];
  currentUsage: number;
  anomalyThreshold: number;
  anomalyMultiplier: number;
  modelDowngrade?: {
    from: string;
    to: string;
  };
  modifiedBody?: unknown;
}

class ControlEngineService {
  private defaultsInitialized = false;

  async evaluate(input: ControlDecisionInput): Promise<ControlDecision> {
    await this.ensureDefaults();

    const usageAnomaly = detectUsageAnomaly(input.currentUsage);
    const throttleMs = THROTTLE_MS_BY_SEVERITY[usageAnomaly.severity];
    const actions: string[] = [];

    if (throttleMs > 0) {
      actions.push('THROTTLE');
    }

    let routedService = input.service;
    if (usageAnomaly.severity === 'HIGH') {
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

    if (usageAnomaly.severity === 'MEDIUM' || usageAnomaly.severity === 'HIGH') {
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
      await this.logEnforcement(decision);
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
      return await (prisma as any).enforcementLog.findMany({
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
          (prisma as any).fallbackConfig.upsert({
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
          (prisma as any).modelDowngradeMapping.upsert({
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

  private async getFallbackService(primaryService: string): Promise<string | null> {
    try {
      const config = await (prisma as any).fallbackConfig.findUnique({
        where: { primaryService }
      });

      if (!config || config.enabled === false) {
        return null;
      }

      return config.fallbackService || null;
    } catch (error) {
      console.error('Failed to load fallback config:', error);
      return null;
    }
  }

  private async getDowngradeMapping(service: string, sourceModel: string) {
    try {
      return await (prisma as any).modelDowngradeMapping.findUnique({
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

  private async logEnforcement(decision: ControlDecision) {
    const details = decision.modelDowngrade
      ? `Model downgraded from ${decision.modelDowngrade.from} to ${decision.modelDowngrade.to}`
      : null;

    try {
      await (prisma as any).enforcementLog.create({
        data: {
          service: decision.service,
          routedService: decision.routedService,
          endpoint: decision.endpoint,
          method: decision.method,
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
