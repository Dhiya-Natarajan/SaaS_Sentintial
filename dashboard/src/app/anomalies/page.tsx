import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import AnomalyTimeline from "@/components/AnomalyTimeline"
import { fetchSentinelJson } from "@/lib/sentinel-api"
import type { AnomalyEventDatum, TrendAnalytics } from "@/lib/sentinel-types"
import {
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Zap,
  ArrowRightLeft,
  Ban,
  Gauge,
  Clock,
} from "lucide-react"

export const dynamic = "force-dynamic"

type Severity = "critical" | "high" | "medium" | "low"
type ActionFilter = "all" | "block" | "throttle" | "reroute" | "downgrade"

const EMPTY_ANOMALIES: AnomalyEventDatum[] = []
const EMPTY_TREND: TrendAnalytics = {}
const ANOMALY_FETCH_LIMIT = 500
const ACTION_ORDER = ["block", "throttle", "reroute", "downgrade"] as const
const ACTION_FILTERS: ActionFilter[] = ["all", "block", "throttle", "reroute", "downgrade"]

function normalizeSeverity(value: string): Severity {
  switch (value.toLowerCase()) {
    case "high":
      return "high"
    case "medium":
      return "medium"
    case "low":
      return "low"
    case "critical":
      return "critical"
    default:
      return "low"
  }
}

const severityConfig: Record<
  Severity,
  { label: string; text: string; bg: string; border: string; icon: React.ElementType }
> = {
  critical: { label: "Critical", text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/25", icon: ShieldX },
  high: { label: "High", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/25", icon: ShieldAlert },
  medium: { label: "Medium", text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/25", icon: Zap },
  low: { label: "Low", text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/25", icon: ShieldCheck },
}

const actionConfig: Record<string, { label: string; text: string; bg: string; border: string; icon: React.ElementType }> = {
  block: { label: "Blocked Requests", text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", icon: Ban },
  reroute: { label: "Rerouted", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", icon: ArrowRightLeft },
  throttle: { label: "Throttled", text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", icon: Gauge },
  downgrade: { label: "Downgraded", text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20", icon: Zap },
}

function getActionStyle(action: string) {
  return actionConfig[action] ?? {
    label: action,
    text: "text-zinc-400",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/20",
    icon: Clock,
  }
}

function SummaryKpi({
  label,
  value,
  icon: Icon,
  text,
  bg,
  border,
}: {
  label: string
  value: string
  icon: React.ElementType
  text: string
  bg: string
  border: string
}) {
  return (
    <Card className={`relative overflow-hidden bg-card border ${border}`}>
      <div className={`absolute top-0 left-0 h-[2px] w-full ${bg}`} />
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground">{label}</p>
        <div className={`p-1.5 rounded-md ${bg}`}>
          <Icon size={14} className={text} />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <p className={`font-mono text-3xl font-semibold ${text}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return timestamp
  }

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function normalizeActionFilter(value: string | string[] | undefined): ActionFilter {
  const candidate = Array.isArray(value) ? value[0] : value

  if (!candidate) {
    return "all"
  }

  const normalized = candidate.toLowerCase()
  return ACTION_FILTERS.includes(normalized as ActionFilter)
    ? (normalized as ActionFilter)
    : "all"
}

function getActionFilterHref(filter: ActionFilter) {
  return filter === "all" ? "/anomalies" : `/anomalies?action=${filter}`
}

export default async function AnomaliesPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>> | Record<string, string | string[] | undefined>
}) {
  const resolvedSearchParams = searchParams ? await searchParams : {}
  const selectedAction = normalizeActionFilter(resolvedSearchParams?.action)
  const anomaliesPath =
    selectedAction === "all"
      ? `/analytics/anomalies?limit=${ANOMALY_FETCH_LIMIT}`
      : `/analytics/anomalies?limit=${ANOMALY_FETCH_LIMIT}&action=${selectedAction}`

  const [anomalies, rawTrend] = await Promise.all([
    fetchSentinelJson(anomaliesPath, EMPTY_ANOMALIES),
    fetchSentinelJson("/analytics/trend", EMPTY_TREND),
  ])

  const rows = anomalies
  const trend = Object.entries(rawTrend)
    .map(([timestamp, requests]) => ({ timestamp, requests }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  const counts = rows.reduce(
    (accumulator, row) => {
      accumulator[normalizeSeverity(row.severity)] += 1
      return accumulator
    },
    { critical: 0, high: 0, medium: 0, low: 0 } as Record<Severity, number>
  )

  const actionCounts = rows.reduce<Record<string, number>>((accumulator, row) => {
    accumulator[row.action] = (accumulator[row.action] ?? 0) + 1
    return accumulator
  }, {})
  const blockedCount = actionCounts.block ?? 0

  return (
    <div className="min-h-screen px-8 py-8 flex flex-col gap-6">
      <header className="flex items-end justify-between animate-in-up">
        <div>
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-1.5">
            API Cost Intelligence · Anomaly Detection
          </p>
          <h1 className="font-display text-[2rem] font-bold tracking-[-0.03em] text-foreground leading-none">
            SaaS Sentinel
            <span className="text-red-500 ml-2.5 font-light tracking-[-0.02em]">Anomalies</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          {rows.length > 0 ? (
            <Badge variant="outline" className="font-mono text-[10px] tracking-widest uppercase gap-1.5 border-red-500/30 text-red-400 bg-red-500/5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-live inline-block" />
              {rows.length} Detected
            </Badge>
          ) : (
            <Badge variant="outline" className="font-mono text-[10px] tracking-widest uppercase gap-1.5 border-green-500/30 text-green-400 bg-green-500/5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-live inline-block" />
              All Clear
            </Badge>
          )}
          <Badge variant="outline" className="font-mono text-[10px] tracking-widest uppercase gap-1.5 border-red-500/30 text-red-400 bg-red-500/5">
            <Ban size={10} />
            {blockedCount} Blocked
          </Badge>
          <Badge variant="outline" className="font-mono text-[10px] tracking-widest uppercase gap-1.5 border-zinc-500/30 text-zinc-300 bg-zinc-500/5">
            Last {ANOMALY_FETCH_LIMIT}
          </Badge>
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

      <div className="flex flex-wrap items-center gap-2 animate-in-up delay-50">
        {ACTION_FILTERS.map((filter) => {
          const isActive = filter === selectedAction
          const label = filter === "all" ? "All Actions" : getActionStyle(filter).label

          return (
            <Badge
              key={filter}
              variant="outline"
              asChild
              className={
                isActive
                  ? "font-mono text-[10px] tracking-widest uppercase border-red-500/30 text-red-400 bg-red-500/5"
                  : "font-mono text-[10px] tracking-widest uppercase border-border/60 text-muted-foreground bg-transparent"
              }
            >
              <a href={getActionFilterHref(filter)}>{label}</a>
            </Badge>
          )
        })}
      </div>

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in-up delay-100">
        <SummaryKpi label="Critical" value={String(counts.critical)} icon={ShieldX} text="text-red-400" bg="bg-red-500/10" border="border-red-500/20 border-glow-red" />
        <SummaryKpi label="High" value={String(counts.high)} icon={ShieldAlert} text="text-amber-400" bg="bg-amber-500/10" border="border-amber-500/20 border-glow-amber" />
        <SummaryKpi label="Medium" value={String(counts.medium)} icon={Zap} text="text-yellow-400" bg="bg-yellow-500/10" border="border-yellow-500/20" />
        <SummaryKpi label="Low" value={String(counts.low)} icon={ShieldCheck} text="text-blue-400" bg="bg-blue-500/10" border="border-blue-500/20 border-glow-blue" />
      </section>

      <Card className="animate-in-up delay-200 bg-card border border-border">
        <CardContent className="p-0">
          <div className="border-b border-border/40 px-6 py-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-red-400">
              Block Semantics
            </p>
            <p className="mt-1 font-mono text-[11px] leading-5 text-muted-foreground">
              A <span className="text-red-400">BLOCK</span> action means the proxy returned HTTP 403 because a request hit a high-severity overload threshold.
            </p>
            <p className="mt-1 font-mono text-[11px] leading-5 text-muted-foreground/80">
              Showing the latest {ANOMALY_FETCH_LIMIT} enforcement events{selectedAction === "all" ? "" : ` filtered to ${selectedAction.toUpperCase()}`}.
            </p>
          </div>
          <div className="flex items-center divide-x divide-border/40">
            {ACTION_ORDER.map((action) => {
              const actionStyle = getActionStyle(action)
              const ActionIcon = actionStyle.icon
              const count = actionCounts[action] ?? 0

              return (
                <div key={action} className="flex items-center gap-3 px-6 py-4 flex-1">
                  <div className={`p-1.5 rounded-md ${actionStyle.bg} border ${actionStyle.border}`}>
                    <ActionIcon size={13} className={actionStyle.text} />
                  </div>
                  <div>
                    <p className={`font-mono text-xl font-semibold ${actionStyle.text}`}>{count}</p>
                    <p className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground">{actionStyle.label}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="animate-in-up delay-300 bg-card border border-border border-glow-red flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <ShieldAlert size={16} className="text-red-400" />
            <CardTitle className="font-display text-base font-semibold tracking-tight">Anomaly Timeline</CardTitle>
          </div>
          <Badge variant="outline" className="font-mono text-[9px] tracking-[0.15em] uppercase border-red-500/20 text-red-400 bg-red-500/5">
            Overlaid on Traffic
          </Badge>
        </CardHeader>
        <Separator className="bg-border/50" />
        <CardContent className="p-4 pt-4">
          <AnomalyTimeline trend={trend} anomalies={rows} />
        </CardContent>
      </Card>

      <Card className="animate-in-up delay-400 bg-card border border-border border-glow-red flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <ShieldX size={16} className="text-red-400" />
            <CardTitle className="font-display text-base font-semibold tracking-tight">Detected Anomalies</CardTitle>
          </div>
          <Badge variant="outline" className="font-mono text-[9px] tracking-[0.15em] uppercase border-red-500/20 text-red-400 bg-red-500/5">
            {rows.length} Events
          </Badge>
        </CardHeader>
        <Separator className="bg-border/50" />

        <CardContent className="p-0">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <ShieldCheck size={32} className="text-green-500 opacity-60" />
              <p className="font-mono text-sm text-muted-foreground">No anomalies detected</p>
              <p className="font-mono text-[11px] text-muted-foreground/60">All services operating within normal thresholds</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[420px] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border/60">
                    {["Severity", "Service", "Action", "Path", "Reason", "Timestamp"].map((header) => (
                      <th key={header} className="text-left py-3 px-6 font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground font-normal">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const severity = normalizeSeverity(row.severity)
                  const severityStyle = severityConfig[severity]
                  const SeverityIcon = severityStyle.icon
                  const actionStyle = getActionStyle(row.action)
                  const ActionIcon = actionStyle.icon

                  return (
                    <tr key={row.id} className="border-b border-border/30 hover:bg-white/[0.02] transition-colors">
                      <td className="py-4 px-6">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${severityStyle.bg} ${severityStyle.border}`}>
                          <SeverityIcon size={11} className={severityStyle.text} />
                          <span className={`font-mono text-[10px] tracking-widest uppercase ${severityStyle.text}`}>
                            {severityStyle.label}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-zinc-800 border border-border flex items-center justify-center font-mono text-[10px] text-zinc-400">
                            {row.service.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-display text-sm capitalize text-foreground">{row.service}</span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${actionStyle.bg} ${actionStyle.border}`}>
                          <ActionIcon size={11} className={actionStyle.text} />
                          <span className={`font-mono text-[10px] tracking-widest uppercase ${actionStyle.text}`}>
                            {row.action}
                          </span>
                        </div>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-mono text-xs text-zinc-300">{row.endpoint}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-mono text-xs text-muted-foreground">{row.reason}</span>
                      </td>
                      <td className="py-4 px-6">
                        <span className="font-mono text-xs text-muted-foreground">{formatTimestamp(row.timestamp)}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          )}
        </CardContent>
      </Card>

      <footer className="flex items-center justify-between pt-2">
        <p className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
          SaaS Sentinel · All API traffic routed &amp; monitored
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">v0.1.0</p>
      </footer>
    </div>
  )
}
