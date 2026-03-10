import { PrismaClient } from '@prisma/client'
import { forecastNextHours } from '../ml/forecast-cost'

const prisma = new PrismaClient()

const COST_MAP: Record<string, number> = {
  openai: 0.002,
  anthropic: 0.003,
  stripe: 0.001
}

export async function predictCost() {

  const metrics = await prisma.apiMetric.findMany({
    orderBy: { timestamp: 'asc' }
  })

  const hourlyUsage: Record<string, number> = {}

  metrics.forEach(metric => {

    const hour =
      metric.timestamp.toISOString().slice(0, 13)

    hourlyUsage[hour] = (hourlyUsage[hour] || 0) + 1
  })

  const usageArray = Object.values(hourlyUsage)

  const predictions = forecastNextHours(usageArray, 24)

  const avgCostPerRequest =
    Object.values(COST_MAP).reduce((a, b) => a + b, 0) /
    Object.keys(COST_MAP).length

  const predictedCost =
    predictions.reduce((sum, v) => sum + v * avgCostPerRequest, 0)

  return {
    predictedRequestsNext24h: predictions,
    predictedCostNext24h: predictedCost
  }
}