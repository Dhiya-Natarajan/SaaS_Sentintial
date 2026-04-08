import CostTrendChart from "@/components/CostTrendChart"
import EnforcementChart from "@/components/EnforcementChart"
import CostPieChart from "@/components/CostPieChart"
import ForecastChart from "@/components/ForecastChart"
import LiveMetricsStrip from "@/components/LiveMetricsStrip"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { fetchSentinelJson } from "@/lib/sentinel-api"
import type {
  ActivityLogDatum,
  AnomalyEventDatum,
  LiveMetricsDatum,
  PredictionAnalytics,
  ServiceBreakdownAnalytics,
  SummaryAnalytics,
  TrendAnalytics,
} from "@/lib/sentinel-types"
import {
  Activity,
  DollarSign,
  ShieldAlert,
  Layers,
  TrendingUp,
  PieChart,
  Zap,
  BarChart2,
} from "lucide-react"

export const dynamic = "force-dynamic"

const EMPTY_SUMMARY: SummaryAnalytics = {
  totalRequests: 0,
  totalCost: 0,
  servicesCount: 0,
  avgLatency: 0,
  successCount: 0,
  clientErrorCount: 0,
  serverErrorCount: 0,
  errorCount: 0,
}

const EMPTY_TREND: TrendAnalytics = {}
const EMPTY_SERVICES: ServiceBreakdownAnalytics = {}
const EMPTY_ANOMALIES: AnomalyEventDatum[] = []
const EMPTY_ACTIVITY: ActivityLogDatum[] = []
const EMPTY_LIVE_METRICS: LiveMetricsDatum = {
  reqPerMin: 0,
  avgLatency: 0,
  successRate: 0,
  activeServices: 0,
  lastUpdated: null,
}
const EMPTY_PREDICTIONS: PredictionAnalytics = {
  predictedRequestsNext24h: [],
  predictedCostNext24h: 0,
}

function mapTrend(trend: TrendAnalytics) {
  return Object.entries(trend)
    .map(([timestamp, requests]) => ({ timestamp, requests }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))
}

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "blue",
  delay = 0,
}: {
  label: string
  value: string
  sub: string
  icon: React.ElementType
  accent?: "blue" | "purple" | "red" | "green"
  delay?: number
}) {
  const a = {
    blue:   { text: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20",    glow: "border-glow-blue"   },
    purple: { text: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/20",  glow: "border-glow-purple" },
    red:    { text: "text-red-400",     bg: "bg-red-500/10",     border: "border-red-500/20",     glow: "border-glow-red"    },
    green:  { text: "text-green-400",   bg: "bg-green-500/10",   border: "border-green-500/20",   glow: ""                   },
  }[accent]

  return (
    <Card
      className={`relative overflow-hidden animate-in-up bg-card border ${a.border} ${a.glow} hover:bg-card/80 transition-colors`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`absolute top-0 left-0 h-[2px] w-full ${a.bg}`} />
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground">{label}</p>
        <div className={`p-1.5 rounded-md ${a.bg}`}>
          <Icon size={14} className={a.text} />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <p className={`font-mono text-3xl font-semibold tracking-tight ${a.text}`}>{value}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}

function ChartPanel({
  title,
  badge,
  badgeColor = "blue",
  icon: Icon,
  iconColor = "text-blue-400",
  glow = "border-glow-blue",
  delay = 0,
  children,
}: {
  title: string
  badge: string
  badgeColor?: "blue" | "red" | "purple" | "violet"
  icon: React.ElementType
  iconColor?: string
  glow?: string
  delay?: number
  children: React.ReactNode
}) {
  const badgeStyles = {
    blue:   "border-blue-500/20   text-blue-400   bg-blue-500/5",
    red:    "border-red-500/20    text-red-400    bg-red-500/5",
    purple: "border-purple-500/20 text-purple-400 bg-purple-500/5",
    violet: "border-violet-500/20 text-violet-400 bg-violet-500/5",
  }[badgeColor]

  return (
    <Card
      className={`animate-in-up bg-card border border-border ${glow} flex flex-col`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <CardHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <Icon size={16} className={iconColor} />
          <CardTitle className="font-display text-base font-semibold tracking-tight">{title}</CardTitle>
        </div>
        <Badge variant="outline" className={`font-mono text-[9px] tracking-[0.15em] uppercase ${badgeStyles}`}>
          {badge}
        </Badge>
      </CardHeader>
      <Separator className="bg-border/50" />
      <CardContent className="flex-1 p-4 pt-4">{children}</CardContent>
    </Card>
  )
}

function TopEndpoints({ activityLog }: { activityLog: ActivityLogDatum[] }) {
  const endpointMap = new Map<string, { path: string; method: string; requests: number }>()

  for (const row of activityLog) {
    const key = `${row.method}:${row.path}`
    const existing = endpointMap.get(key)

    if (existing) {
      existing.requests += 1
      continue
    }

    endpointMap.set(key, {
      path: row.path,
      method: row.method.toUpperCase(),
      requests: 1,
    })
  }

  const endpoints = Array.from(endpointMap.values())
    .sort((a, b) => b.requests - a.requests)
    .slice(0, 6)

  const max = endpoints[0]?.requests ?? 1

  if (endpoints.length === 0) {
    return (
      <div className="flex h-full min-h-48 items-center justify-center text-center font-mono text-sm text-muted-foreground">
        No recent endpoint activity
      </div>
    )
  }

  return (
    <div className="flex flex-col">
      {endpoints.map((endpoint, index) => (
        <div key={`${endpoint.path}:${index}`} className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-b-0">
          <span
            className={`font-mono text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${
              endpoint.method === "POST"
                ? "text-violet-400 border-violet-500/20 bg-violet-500/5"
                : "text-green-400 border-green-500/20 bg-green-500/5"
            }`}
          >
            {endpoint.method}
          </span>
          <span className="font-mono text-xs text-zinc-300 flex-1 truncate">{endpoint.path}</span>
          <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden shrink-0">
            <div
              className="h-full bg-purple-500/50 rounded-full"
              style={{ width: `${(endpoint.requests / max) * 100}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-muted-foreground w-6 text-right shrink-0">
            {endpoint.requests}
          </span>
        </div>
      ))}
    </div>
  )
}

export default async function DashboardPage() {
  const [summary, rawTrend, anomalies, services, activityLog, liveMetrics, predictions] = await Promise.all([
    fetchSentinelJson("/analytics/summary", EMPTY_SUMMARY),
    fetchSentinelJson("/analytics/trend", EMPTY_TREND),
    fetchSentinelJson("/analytics/anomalies", EMPTY_ANOMALIES),
    fetchSentinelJson("/analytics/service-breakdown", EMPTY_SERVICES),
    fetchSentinelJson("/analytics/activity?limit=100", EMPTY_ACTIVITY),
    fetchSentinelJson("/analytics/live", EMPTY_LIVE_METRICS),
    fetchSentinelJson("/analytics/predictions", EMPTY_PREDICTIONS),
  ])

  const trend = mapTrend(rawTrend)
  const pieData = Object.entries(services)
    .map(([name, data]) => ({ name, value: data.cost }))
    .filter((datum) => datum.value > 0)

  const formattedCost = Number(summary.totalCost).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  })
  const anomalyCount = anomalies.length
  const serviceCount = summary.servicesCount

  return (
    <div className="min-h-screen px-8 py-8 flex flex-col gap-6">
      <header className="flex items-end justify-between animate-in-up">
        <div>
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-1.5">
            API Cost Intelligence · Anomaly Detection
          </p>
          <h1 className="font-display text-[2rem] font-bold tracking-[-0.03em] text-foreground leading-none">
            SaaS Sentinel
            <span className="text-purple-500 ml-2.5 font-light tracking-[-0.02em]">Dashboard</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono text-[10px] tracking-widest uppercase gap-1.5 border-green-500/30 text-green-400 bg-green-500/5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-live inline-block" />
            Proxy Live
          </Badge>
          {anomalyCount > 0 ? (
            <Badge variant="outline" className="font-mono text-[10px] tracking-widest uppercase gap-1.5 border-red-500/30 text-red-400 bg-red-500/5">
              <ShieldAlert size={10} />
              {anomalyCount} Anomal{anomalyCount === 1 ? "y" : "ies"}
            </Badge>
          ) : null}
          <p className="font-mono text-[10px] text-muted-foreground hidden md:block">
            {new Date()
              .toLocaleString("en-IN", {
                timeZone: "Asia/Kolkata",
                day: "2-digit",
                month: "short",
                year: "numeric",
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
                hour12: false,
              })
              .toUpperCase() + " IST"}
          </p>
        </div>
      </header>

      <Separator className="bg-border/60" />

      <LiveMetricsStrip initialMetrics={liveMetrics} />

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Requests" value={summary.totalRequests.toLocaleString()} sub="proxied calls intercepted"   icon={Activity}    accent="blue"   delay={0}   />
        <KpiCard label="Total Cost"     value={formattedCost}                          sub="cumulative spend tracked"    icon={DollarSign}  accent="purple" delay={80}  />
        <KpiCard label="Anomalies"      value={String(anomalyCount)}                   sub="flagged enforcement events"  icon={ShieldAlert} accent={anomalyCount > 0 ? "red" : "green"} delay={160} />
        <KpiCard label="Services"       value={String(serviceCount)}                   sub="active integrations tracked" icon={Layers}      accent="green"  delay={240} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <ChartPanel title="Usage Trend" badge="Requests / Time" icon={TrendingUp} delay={300}>
            <CostTrendChart data={trend} />
          </ChartPanel>
        </div>
        <ChartPanel
          title="Cost Breakdown"
          badge="By Service"
          icon={PieChart}
          iconColor="text-purple-400"
          badgeColor="purple"
          glow="border-glow-purple"
          delay={350}
        >
          <CostPieChart data={pieData} />
        </ChartPanel>
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartPanel title="Top Endpoints" badge="By Volume" icon={BarChart2} delay={400}>
          <TopEndpoints activityLog={activityLog} />
        </ChartPanel>
        <ChartPanel
          title="Anomaly Actions"
          badge="Throttle / Downgrade / Block"
          icon={ShieldAlert}
          iconColor="text-red-400"
          badgeColor="red"
          glow="border-glow-red"
          delay={450}
        >
          <EnforcementChart data={anomalies} />
        </ChartPanel>
      </section>

      <ChartPanel
        title="Request Forecast"
        badge="24-Hour Projection"
        icon={Zap}
        iconColor="text-violet-400"
        badgeColor="violet"
        glow="border-glow-violet"
        delay={500}
      >
        <div className="flex items-center gap-6 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-blue-500 rounded" />
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Actual</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-px border-t border-dashed border-purple-400" />
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Forecast</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-purple-500/15 rounded" />
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Confidence band</span>
          </div>
        </div>
        <ForecastChart data={trend} predictions={predictions.predictedRequestsNext24h} />
      </ChartPanel>

      <footer className="flex items-center justify-between pt-2">
        <p className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
          SaaS Sentinel · All API traffic routed &amp; monitored
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">v0.1.0</p>
      </footer>
    </div>
  )
}