export interface SummaryAnalytics {
  totalRequests: number
  totalCost: number
  servicesCount: number
  avgLatency: number
  successCount: number
  clientErrorCount: number
  serverErrorCount: number
  errorCount: number
}

export type TrendAnalytics = Record<string, number>

export interface ServiceBreakdownDatum {
  requests: number
  cost: number
}

export type ServiceBreakdownAnalytics = Record<string, ServiceBreakdownDatum>

export interface ActivityLogDatum {
  id: string
  timestamp: string
  service: string
  method: string
  path: string
  status: number
  latency: number
  cost: number
}

export interface LiveMetricsDatum {
  reqPerMin: number
  avgLatency: number
  successRate: number
  activeServices: number
  lastUpdated: string | null
}

export interface AnomalyEventDatum {
  id: string
  service: string
  routedService: string
  action: string
  severity: string
  reason: string
  details: string | null
  endpoint: string
  method: string
  timestamp: string
  count: number
}

export interface PredictionAnalytics {
  predictedRequestsNext24h: number[]
  predictedCostNext24h: number
}
