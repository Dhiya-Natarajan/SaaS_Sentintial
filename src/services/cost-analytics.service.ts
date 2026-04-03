import { prisma } from '../lib/prisma';

const COST_MAP: Record<string, number> = {
  openai: 0.002,
  anthropic: 0.003,
  stripe: 0.001
};

const LIVE_WINDOW_MINUTES = 5;
const DEFAULT_ACTIVITY_LIMIT = 100;
const DEFAULT_ANOMALY_LIMIT = 500;

export interface SummaryAnalytics {
  totalRequests: number;
  totalCost: number;
  servicesCount: number;
  avgLatency: number;
  successCount: number;
  clientErrorCount: number;
  serverErrorCount: number;
  errorCount: number;
}

export interface ServiceBreakdownDatum {
  requests: number;
  cost: number;
}

export interface ActivityLogDatum {
  id: string;
  timestamp: string;
  service: string;
  method: string;
  path: string;
  status: number;
  latency: number;
  cost: number;
}

export interface LiveMetricsDatum {
  reqPerMin: number;
  avgLatency: number;
  successRate: number;
  activeServices: number;
  lastUpdated: string | null;
}

export interface AnomalyEventDatum {
  id: string;
  service: string;
  routedService: string;
  action: string;
  severity: string;
  reason: string;
  details: string | null;
  endpoint: string;
  method: string;
  timestamp: string;
  count: number;
}

function isPrismaTableMissing(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2021'
  );
}

function isPrismaUnavailable(error: unknown) {
  if (isPrismaTableMissing(error)) {
    return true;
  }

  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const prismaError = error as {
    code?: string;
    name?: string;
    message?: string;
  };

  return (
    prismaError.code === 'P1001' ||
    prismaError.name === 'PrismaClientInitializationError' ||
    prismaError.message?.includes("Can't reach database server") === true
  );
}

async function withMissingTableFallback<T>(
  label: string,
  query: () => Promise<T>,
  fallback: T
) {
  try {
    return await query();
  } catch (error) {
    if (isPrismaUnavailable(error)) {
      console.warn(`${label} is unavailable because the analytics database is not ready.`);
      return fallback;
    }

    throw error;
  }
}

function getMetricCost(metric: { service: string; cost: number }) {
  return typeof metric.cost === 'number'
    ? metric.cost
    : COST_MAP[metric.service] || 0;
}

function getActivityWindowStart(minutes: number) {
  return new Date(Date.now() - minutes * 60 * 1000);
}

function normalizeAction(action: string) {
  return action.trim().toLowerCase();
}

export async function getSummary(): Promise<SummaryAnalytics> {
  const metrics = await withMissingTableFallback(
    'Summary analytics',
    () =>
      prisma.apiMetric.findMany({
        select: {
          service: true,
          cost: true,
          statusCode: true,
          latencyMs: true
        }
      }),
    []
  );

  const serviceNames = new Set<string>();
  let totalCost = 0;
  let totalLatency = 0;
  let successCount = 0;
  let clientErrorCount = 0;
  let serverErrorCount = 0;

  for (const metric of metrics) {
    serviceNames.add(metric.service);
    totalCost += getMetricCost(metric);
    totalLatency += metric.latencyMs;

    if (metric.statusCode < 400) {
      successCount += 1;
      continue;
    }

    if (metric.statusCode < 500) {
      clientErrorCount += 1;
      continue;
    }

    serverErrorCount += 1;
  }

  const totalRequests = metrics.length;

  return {
    totalRequests,
    totalCost,
    servicesCount: serviceNames.size,
    avgLatency: totalRequests > 0 ? Math.round(totalLatency / totalRequests) : 0,
    successCount,
    clientErrorCount,
    serverErrorCount,
    errorCount: clientErrorCount + serverErrorCount
  };
}

export async function getServiceBreakdown() {
  const metrics = await withMissingTableFallback(
    'Service breakdown analytics',
    () =>
      prisma.apiMetric.findMany({
        select: {
          service: true,
          cost: true
        }
      }),
    []
  );

  const breakdown: Record<string, ServiceBreakdownDatum> = {};

  for (const metric of metrics) {
    const service = metric.service;
    const cost = getMetricCost(metric);

    if (!breakdown[service]) {
      breakdown[service] = { requests: 0, cost: 0 };
    }

    breakdown[service].requests += 1;
    breakdown[service].cost += cost;
  }

  return breakdown;
}

export async function getTrend() {
  const metrics = await withMissingTableFallback(
    'Trend analytics',
    () =>
      prisma.apiMetric.findMany({
        select: {
          timestamp: true
        },
        orderBy: { timestamp: 'asc' }
      }),
    []
  );

  const trend: Record<string, number> = {};

  for (const metric of metrics) {
    const hour = metric.timestamp.toISOString().slice(0, 13);
    trend[hour] = (trend[hour] || 0) + 1;
  }

  return trend;
}

export async function getRecentActivity(limit = DEFAULT_ACTIVITY_LIMIT): Promise<ActivityLogDatum[]> {
  const metrics = await withMissingTableFallback(
    'Activity analytics',
    () =>
      prisma.apiMetric.findMany({
        take: Math.min(Math.max(limit, 1), 500),
        orderBy: { timestamp: 'desc' },
        select: {
          id: true,
          timestamp: true,
          service: true,
          endpoint: true,
          method: true,
          statusCode: true,
          latencyMs: true,
          cost: true
        }
      }),
    []
  );

  return metrics.map((metric) => ({
    id: metric.id,
    timestamp: metric.timestamp.toISOString(),
    service: metric.service,
    method: metric.method,
    path: metric.endpoint,
    status: metric.statusCode,
    latency: metric.latencyMs,
    cost: getMetricCost(metric)
  }));
}

export async function getLiveMetrics(): Promise<LiveMetricsDatum> {
  const recentMetrics = await withMissingTableFallback(
    'Live analytics',
    () =>
      prisma.apiMetric.findMany({
        where: {
          timestamp: {
            gte: getActivityWindowStart(LIVE_WINDOW_MINUTES)
          }
        },
        orderBy: { timestamp: 'desc' },
        select: {
          timestamp: true,
          service: true,
          statusCode: true,
          latencyMs: true
        }
      }),
    []
  );

  if (recentMetrics.length === 0) {
    return {
      reqPerMin: 0,
      avgLatency: 0,
      successRate: 0,
      activeServices: 0,
      lastUpdated: null
    };
  }

  let totalLatency = 0;
  let successCount = 0;
  const serviceNames = new Set<string>();

  for (const metric of recentMetrics) {
    totalLatency += metric.latencyMs;
    serviceNames.add(metric.service);

    if (metric.statusCode < 400) {
      successCount += 1;
    }
  }

  return {
    reqPerMin: Math.round(recentMetrics.length / LIVE_WINDOW_MINUTES),
    avgLatency: Math.round(totalLatency / recentMetrics.length),
    successRate: Number(((successCount / recentMetrics.length) * 100).toFixed(1)),
    activeServices: serviceNames.size,
    lastUpdated: recentMetrics[0]?.timestamp.toISOString() || null
  };
}

export async function getAnomalies(options?: {
  limit?: number;
  action?: string;
}): Promise<AnomalyEventDatum[]> {
  const limit = Math.min(Math.max(options?.limit ?? DEFAULT_ANOMALY_LIMIT, 1), 1000);
  const actionFilter = options?.action ? normalizeAction(options.action) : null;
  const logs = await withMissingTableFallback(
    'Anomaly analytics',
    () =>
      prisma.enforcementLog.findMany({
        take: limit,
        select: {
          id: true,
          timestamp: true,
          service: true,
          routedService: true,
          endpoint: true,
          method: true,
          reason: true,
          severity: true,
          action: true,
          details: true
        },
        orderBy: { timestamp: 'desc' }
      }),
    []
  );

  return logs.flatMap((log) =>
    log.action
      .split(',')
      .map(normalizeAction)
      .filter((action) => {
        if (!action) {
          return false;
        }

        if (!actionFilter) {
          return true;
        }

        return action === actionFilter;
      })
      .map((action) => ({
        id: `${log.id}:${action}`,
        service: log.service,
        routedService: log.routedService,
        action,
        severity: log.severity.toLowerCase(),
        reason: log.reason,
        details: log.details,
        endpoint: log.endpoint,
        method: log.method,
        timestamp: log.timestamp.toISOString(),
        count: 1
      }))
  );
}
