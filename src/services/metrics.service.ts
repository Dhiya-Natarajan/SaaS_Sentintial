import { PrismaClient } from '@prisma/client';
import { prisma } from '../lib/prisma';

type MetricsPrismaLike = Pick<PrismaClient, 'apiMetric' | 'pricingRule'>;

export interface ApiMetric {
    service: string;
    endpoint: string;
    method: string;
    statusCode: number;
    latencyMs: number;
    timestamp: string;
}

interface PricingRuleSeed {
    code: string;
    service: string;
    method?: string;
    endpointPattern?: string;
    model?: string;
    billingUnit: string;
    flatRate: number;
    currency: string;
}

const DEFAULT_PRICING_RULES: PricingRuleSeed[] = [
    {
        code: 'openai-default-request',
        service: 'openai',
        billingUnit: 'REQUEST',
        flatRate: 0.002,
        currency: 'USD'
    },
    {
        code: 'anthropic-default-request',
        service: 'anthropic',
        billingUnit: 'REQUEST',
        flatRate: 0.01,
        currency: 'USD'
    },
    {
        code: 'stripe-default-request',
        service: 'stripe',
        billingUnit: 'REQUEST',
        flatRate: 0.0,
        currency: 'USD'
    }
];

let pricingDefaultsInitialized = false;

function isPrismaTableMissing(error: unknown) {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        (error as { code?: string }).code === 'P2021'
    );
}

function getLegacyDefaultCost(service: string) {
    if (service === 'openai') return 0.002;
    if (service === 'anthropic') return 0.01;
    return 0.0;
}

export const ensureDefaultPricingRules = async (db: MetricsPrismaLike = prisma) => {
    if (pricingDefaultsInitialized && db === prisma) {
        return;
    }

    try {
        await Promise.all(
            DEFAULT_PRICING_RULES.map((rule) =>
                db.pricingRule.upsert({
                    where: { code: rule.code },
                    update: {
                        service: rule.service,
                        method: rule.method,
                        endpointPattern: rule.endpointPattern,
                        model: rule.model,
                        billingUnit: rule.billingUnit,
                        flatRate: rule.flatRate,
                        currency: rule.currency,
                        active: true,
                        effectiveTo: null
                    },
                    create: {
                        code: rule.code,
                        service: rule.service,
                        method: rule.method,
                        endpointPattern: rule.endpointPattern,
                        model: rule.model,
                        billingUnit: rule.billingUnit,
                        flatRate: rule.flatRate,
                        currency: rule.currency,
                        active: true
                    }
                })
            )
        );

        if (db === prisma) {
            pricingDefaultsInitialized = true;
        }
    } catch (error) {
        if (!isPrismaTableMissing(error)) {
            console.error('Failed to initialize pricing rules:', error);
        }
    }
};

function matchesPricingRule(
    rule: {
        method: string | null;
        endpointPattern: string | null;
        model: string | null;
    },
    metric: ApiMetric
) {
    const methodMatches =
        !rule.method || rule.method.toUpperCase() === metric.method.toUpperCase();
    const endpointMatches =
        !rule.endpointPattern || metric.endpoint.startsWith(rule.endpointPattern);
    const modelMatches = !rule.model;

    return methodMatches && endpointMatches && modelMatches;
}

async function findPricingRule(metric: ApiMetric, db: MetricsPrismaLike = prisma) {
    const metricTimestamp = new Date(metric.timestamp);

    try {
        await ensureDefaultPricingRules(db);

        const rules = await db.pricingRule.findMany({
            where: {
                service: metric.service,
                active: true,
                effectiveFrom: { lte: metricTimestamp },
                OR: [
                    { effectiveTo: null },
                    { effectiveTo: { gt: metricTimestamp } }
                ]
            },
            orderBy: [
                { effectiveFrom: 'desc' },
                { createdAt: 'desc' }
            ]
        });

        return rules.find((rule) => matchesPricingRule(rule, metric)) || null;
    } catch (error) {
        if (!isPrismaTableMissing(error)) {
            console.error('Failed to load pricing rule:', error);
        }

        return null;
    }
}

export const getPricingRules = async (db: MetricsPrismaLike = prisma) => {
    try {
        await ensureDefaultPricingRules(db);

        return await db.pricingRule.findMany({
            orderBy: [
                { service: 'asc' },
                { effectiveFrom: 'desc' }
            ]
        });
    } catch (error) {
        if (!isPrismaTableMissing(error)) {
            console.error('Failed to fetch pricing rules:', error);
        }

        return [];
    }
};

export const logMetric = async (metric: ApiMetric, db: MetricsPrismaLike = prisma) => {
    try {
        await db.apiMetric.create({
            data: {
                service: metric.service,
                endpoint: metric.endpoint,
                method: metric.method,
                statusCode: metric.statusCode,
                latencyMs: metric.latencyMs,
                timestamp: new Date(metric.timestamp),
                cost: await calculateCost(metric, db)
            }
        });
        console.log(`📊 Metric Stored in DB: ${metric.service} ${metric.method} ${metric.statusCode}`);
    } catch (error: any) {
        console.error('Failed to store metric in DB:', error.message);
    }
};

const calculateCost = async (metric: ApiMetric, db: MetricsPrismaLike = prisma) => {
    const pricingRule = await findPricingRule(metric, db);

    if (pricingRule) {
        return pricingRule.flatRate;
    }

    return getLegacyDefaultCost(metric.service);
};

export const getStats = async (db: MetricsPrismaLike = prisma) => {
    await ensureDefaultPricingRules(db);

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
