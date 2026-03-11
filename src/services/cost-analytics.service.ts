import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const COST_MAP: Record<string, number> = {
  openai: 0.002,
  anthropic: 0.003,
  stripe: 0.001
}

export async function getSummary() {

  const metrics = await prisma.apiMetric.findMany()

  let totalCost = 0

  metrics.forEach(metric => {

    const cost = COST_MAP[metric.service] || 0

    totalCost += cost
  })

  return {
    totalRequests: metrics.length,
    totalCost
  }
}

export async function getServiceBreakdown() {

  const metrics = await prisma.apiMetric.findMany()

  const breakdown: Record<string, { requests: number; cost: number }> = {}

  metrics.forEach(metric => {

    const service = metric.service
    const cost = COST_MAP[service] || 0

    if (!breakdown[service]) {
      breakdown[service] = { requests: 0, cost: 0 }
    }

    breakdown[service].requests += 1
    breakdown[service].cost += cost
  })

  return breakdown
}

export async function getTrend() {

  const metrics = await prisma.apiMetric.findMany({
    orderBy: { timestamp: 'asc' }
  })

  const trend: Record<string, number> = {}

  metrics.forEach(metric => {

    const hour = metric.timestamp
      .toISOString()
      .slice(0, 13)

    trend[hour] = (trend[hour] || 0) + 1
  })

  return trend
}

export async function getAnomalies() {

  return prisma.apiMetric.findMany({
    where: {
      actionTaken: {
        not: null
      }
    }
  })
}