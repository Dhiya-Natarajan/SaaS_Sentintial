import { prisma } from '../lib/prisma';

const COST_MAP: Record<string, number> = {
  openai: 0.002,
  anthropic: 0.003,
  stripe: 0.001
};

export interface AnomalyActionDatum {
  name: string;
  value: number;
}

function isPrismaTableMissing(error: unknown) {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'P2021'
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
    if (isPrismaTableMissing(error)) {
      console.warn(`${label} is unavailable because the database schema has not been pushed yet.`);
      return fallback;
    }

    throw error;
  }
}

function getMetricCost(metric: { service: string; cost: number }) {
  return metric.cost || COST_MAP[metric.service] || 0;
}

export async function getSummary() {
  const metrics = await withMissingTableFallback(
    'Summary analytics',
    () =>
      prisma.apiMetric.findMany({
        select: {
          service: true,
          cost: true
        }
      }),
    []
  );

  const totalCost = metrics.reduce((sum, metric) => sum + getMetricCost(metric), 0);

  return {
    totalRequests: metrics.length,
    totalCost
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

  const breakdown: Record<string, { requests: number; cost: number }> = {};

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

export async function getAnomalies(): Promise<AnomalyActionDatum[]> {
  const logs = await withMissingTableFallback(
    'Anomaly analytics',
    () =>
      prisma.enforcementLog.findMany({
        select: {
          action: true
        },
        orderBy: { timestamp: 'desc' }
      }),
    []
  );

  const actionCounts = new Map<string, number>();

  for (const log of logs) {
    for (const action of log.action.split(',').map(item => item.trim()).filter(Boolean)) {
      actionCounts.set(action, (actionCounts.get(action) || 0) + 1);
    }
  }

  return Array.from(actionCounts.entries()).map(([name, value]) => ({
    name,
    value
  }));
}
