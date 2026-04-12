import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import ActivityLogTable from "@/components/ActivityLogTable"
import ResponseTimeChart from "@/components/ResponseTimeChart"
import StatusBreakdownChart from "@/components/StatusBreakdownChart"
import { fetchSentinelJson } from "@/lib/sentinel-api"
import type { ActivityLogDatum, SummaryAnalytics, TrendAnalytics } from "@/lib/sentinel-types"
import {
  Activity,
  CheckCircle,
  XCircle,
  Clock,
  ArrowDownUp,
  Zap,
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
const EMPTY_ACTIVITY: ActivityLogDatum[] = []

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
  accent?: "blue" | "amber" | "red" | "green"
  delay?: number
}) {
  const a = {
    blue: { text: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20", glow: "border-glow-blue" },
    amber: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", glow: "border-glow-amber" },
    red: { text: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/20", glow: "border-glow-red" },
    green: { text: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", glow: "" },
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

export default async function ActivityPage() {
  const [rawTrend, summary, activityLog] = await Promise.all([
    fetchSentinelJson("/analytics/trend", EMPTY_TREND),
    fetchSentinelJson("/analytics/summary", EMPTY_SUMMARY),
    fetchSentinelJson("/analytics/activity?limit=100", EMPTY_ACTIVITY),
  ])

  const trend = Object.entries(rawTrend)
    .map(([timestamp, requests]) => ({ timestamp, requests }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  const totalRequests = summary.totalRequests
  const successCount = summary.successCount
  const errorCount = summary.errorCount
  const avgLatency = summary.avgLatency

  const statusBreakdown = [
    { name: "Success", value: successCount, color: "#22c55e" },
    { name: "4xx Client", value: summary.clientErrorCount, color: "#f59e0b" },
    { name: "5xx Server", value: summary.serverErrorCount, color: "#ef4444" },
  ].filter((datum) => datum.value > 0)

  return (
    <div className="min-h-screen px-8 py-8 flex flex-col gap-6">
      <header className="flex items-end justify-between animate-in-up">
        <div>
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-1.5">
            API Cost Intelligence · Anomaly Detection
          </p>
          <h1 className="font-display text-[2rem] font-bold tracking-[-0.03em] text-foreground leading-none">
            SaaS Sentinel
            <span className="text-blue-500 ml-2.5 font-light tracking-[-0.02em]">Activity</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono text-[10px] tracking-widest uppercase gap-1.5 border-green-500/30 text-green-400 bg-green-500/5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-live inline-block" />
            Live Feed
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

      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Requests" value={totalRequests.toLocaleString()} sub="all proxied calls" icon={Activity} accent="blue" delay={0} />
        <KpiCard
          label="Success Rate"
          value={`${((successCount / Math.max(totalRequests, 1)) * 100).toFixed(1)}%`}
          sub="requests completed successfully"
          icon={CheckCircle}
          accent="green"
          delay={80}
        />
        <KpiCard label="Error Count" value={errorCount.toLocaleString()} sub="4xx + 5xx responses" icon={XCircle} accent={errorCount > 0 ? "red" : "green"} delay={160} />
        <KpiCard label="Avg Latency" value={`${avgLatency}ms`} sub="mean response time" icon={Clock} accent="amber" delay={240} />
      </section>

      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <Card className="xl:col-span-2 animate-in-up delay-300 bg-card border border-border border-glow-blue flex flex-col">
          <CardHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <Zap size={16} className="text-blue-400" />
              <CardTitle className="font-display text-base font-semibold tracking-tight">
                Request Volume Over Time
              </CardTitle>
            </div>
            <Badge variant="outline" className="font-mono text-[9px] tracking-[0.15em] uppercase border-blue-500/20 text-blue-400 bg-blue-500/5">
              Requests / Period
            </Badge>
          </CardHeader>
          <Separator className="bg-border/50" />
          <CardContent className="flex-1 p-4 pt-4">
            <ResponseTimeChart data={trend} />
          </CardContent>
        </Card>

        <Card className="animate-in-up delay-350 bg-card border border-border border-glow-green flex flex-col" style={{ animationDelay: "350ms" }}>
          <CardHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-4">
            <div className="flex items-center gap-3">
              <CheckCircle size={16} className="text-green-400" />
              <CardTitle className="font-display text-base font-semibold tracking-tight">
                Status Breakdown
              </CardTitle>
            </div>
            <Badge variant="outline" className="font-mono text-[9px] tracking-[0.15em] uppercase border-green-500/20 text-green-400 bg-green-500/5">
              HTTP Codes
            </Badge>
          </CardHeader>
          <Separator className="bg-border/50" />
          <CardContent className="flex-1 p-4 pt-4">
            <StatusBreakdownChart data={statusBreakdown} total={totalRequests} />
          </CardContent>
        </Card>
      </section>

      <Card className="animate-in-up delay-400 bg-card border border-border border-glow-blue flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <ArrowDownUp size={16} className="text-blue-400" />
            <CardTitle className="font-display text-base font-semibold tracking-tight">
              Request Log
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono text-[9px] tracking-[0.15em] uppercase border-blue-500/20 text-blue-400 bg-blue-500/5">
              Last {activityLog.length} Requests
            </Badge>
          </div>
        </CardHeader>
        <Separator className="bg-border/50" />
        <CardContent className="p-0">
          <ActivityLogTable rows={activityLog} />
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
