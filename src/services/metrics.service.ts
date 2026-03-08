import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
type MetricsPrismaLike = Pick<PrismaClient, 'apiMetric'>;

export interface ApiMetric {
    service: string;
    endpoint: string;
    method: string;
    statusCode: number;
    latencyMs: number;
    timestamp: string;
}

export const logMetric = async (metric: ApiMetric) => {
    try {
        await prisma.apiMetric.create({
            data: {
                service: metric.service,
                endpoint: metric.endpoint,
                method: metric.method,
                statusCode: metric.statusCode,
                latencyMs: metric.latencyMs,
                timestamp: new Date(metric.timestamp),
                cost: calculateCost(metric)
            }
        });
        console.log(`📊 Metric Stored in DB: ${metric.service} ${metric.method} ${metric.statusCode}`);
    } catch (error: any) {
        console.error('Failed to store metric in DB:', error.message);
    }
};

const calculateCost = (metric: ApiMetric) => {
    // Basic cost estimation logic
    if (metric.service === 'openai') return 0.002; // Placeholder
    if (metric.service === 'anthropic') return 0.01; // Placeholder
    return 0.0;
};

export const getStats = async (db: MetricsPrismaLike = prisma) => {
    const totalCalls = await db.apiMetric.count();
    const serviceGroups = await db.apiMetric.groupBy({
        by: ['service'],
        _count: {
            _all: true
        },
        _sum: {
            latencyMs: true,
            cost: true
        }
    });

    return {
        totalCalls,
        breakdown: serviceGroups.map(g => ({
            service: g.service,
            calls: g._count._all,
            totalLatency: g._sum.latencyMs ?? 0,
            totalCost: g._sum.cost ?? 0
        }))
    };
};
