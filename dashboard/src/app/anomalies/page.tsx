// app/anomalies/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import AnomalyTimeline from "@/components/AnomalyTimeline"
import {
  ShieldAlert, ShieldCheck, ShieldX, Zap,
  ArrowRightLeft, Ban, Gauge, Clock,
} from "lucide-react"

async function getAnomalies() {
  const res = await fetch("http://localhost:3001/analytics/anomalies", { cache: "no-store" })
  return res.json()
}
async function getTrend() {
  const res = await fetch("http://localhost:3001/analytics/trend", { cache: "no-store" })
  return res.json()
}

// ── Helpers ───────────────────────────────────────────────────────────────────
type Severity = "critical" | "high" | "medium" | "low"

function getSeverity(action: string, count: number): Severity {
  if (action === "block"    || count > 10) return "critical"
  if (action === "reroute"  || count > 5)  return "high"
  if (action === "throttle" || count > 2)  return "medium"
  return "low"
}

const severityConfig: Record<Severity, { label: string; text: string; bg: string; border: string; icon: React.ElementType }> = {
  critical: { label: "Critical", text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/25",    icon: ShieldX     },
  high:     { label: "High",     text: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/25",  icon: ShieldAlert },
  medium:   { label: "Medium",   text: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/25", icon: Zap         },
  low:      { label: "Low",      text: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/25",   icon: ShieldCheck },
}

const actionConfig: Record<string, { text: string; bg: string; border: string; icon: React.ElementType }> = {
  block:    { text: "text-red-400",    bg: "bg-red-500/10",    border: "border-red-500/20",    icon: Ban           },
  reroute:  { text: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20",  icon: ArrowRightLeft },
  throttle: { text: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20",   icon: Gauge         },
}

function getActionStyle(action: string) {
  return actionConfig[action] ?? { text: "text-zinc-400", bg: "bg-zinc-500/10", border: "border-zinc-500/20", icon: Clock }
}

interface AnomalyRow {
  service:   string
  action:    string
  count:     number
  timestamp: string
  reason?:   string
}

// ── Summary KPI ───────────────────────────────────────────────────────────────
function SummaryKpi({
  label, value, icon: Icon, text, bg, border,
}: {
  label: string; value: string; icon: React.ElementType
  text: string; bg: string; border: string
}) {
  return (
    <Card className={`relative overflow-hidden bg-card border ${border}`}>
      <div className={`absolute top-0 left-0 h-[2px] w-full ${bg}`} />
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground">{label}</p>
        <div className={`p-1.5 rounded-md ${bg}`}><Icon size={14} className={text} /></div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <p className={`font-mono text-3xl font-semibold ${text}`}>{value}</p>
      </CardContent>
    </Card>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function AnomaliesPage() {
  const [anomalies, rawTrend] = await Promise.all([getAnomalies(), getTrend()])

  const rows: AnomalyRow[] = Array.isArray(anomalies) ? anomalies : []

  const trend = Object.entries(rawTrend as Record<string, number>)
    .map(([timestamp, requests]) => ({ timestamp, requests }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  // Severity counts
  const counts = rows.reduce(
    (acc, r) => {
      acc[getSeverity(r.action, r.count)]++
      return acc
    },
    { critical: 0, high: 0, medium: 0, low: 0 } as Record<Severity, number>
  )

  // Action counts
  const actionCounts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.action] = (acc[r.action] ?? 0) + 1
    return acc
  }, {})

  return (
    <div className="min-h-screen px-8 py-8 flex flex-col gap-6">

      {/* ── Header ──────────────────────────────────────── */}
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
          <p className="font-mono text-[10px] text-muted-foreground hidden md:block">
            {new Date().toUTCString()}
          </p>
        </div>
      </header>

      <Separator className="bg-border/60" />

      {/* ── Severity KPIs ───────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-in-up delay-100">
        <SummaryKpi label="Critical" value={String(counts.critical)} icon={ShieldX}     text="text-red-400"    bg="bg-red-500/10"    border="border-red-500/20 border-glow-red"   />
        <SummaryKpi label="High"     value={String(counts.high)}     icon={ShieldAlert} text="text-amber-400"  bg="bg-amber-500/10"  border="border-amber-500/20 border-glow-amber" />
        <SummaryKpi label="Medium"   value={String(counts.medium)}   icon={Zap}         text="text-yellow-400" bg="bg-yellow-500/10" border="border-yellow-500/20"                  />
        <SummaryKpi label="Low"      value={String(counts.low)}      icon={ShieldCheck} text="text-blue-400"   bg="bg-blue-500/10"   border="border-blue-500/20 border-glow-blue"   />
      </section>

      {/* ── Action summary strip ────────────────────────── */}
      <Card className="animate-in-up delay-200 bg-card border border-border">
        <CardContent className="flex items-center divide-x divide-border/40 p-0">
          {Object.entries(actionCounts).length > 0
            ? Object.entries(actionCounts).map(([action, count]) => {
                const s = getActionStyle(action)
                const ActionIcon = s.icon
                return (
                  <div key={action} className="flex items-center gap-3 px-6 py-4 flex-1">
                    <div className={`p-1.5 rounded-md ${s.bg} border ${s.border}`}>
                      <ActionIcon size={13} className={s.text} />
                    </div>
                    <div>
                      <p className={`font-mono text-xl font-semibold ${s.text}`}>{count}</p>
                      <p className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground capitalize">{action}</p>
                    </div>
                  </div>
                )
              })
            : (
              <div className="px-6 py-4 text-muted-foreground font-mono text-sm">
                No enforcement actions recorded
              </div>
            )}
        </CardContent>
      </Card>

      {/* ── Timeline ────────────────────────────────────── */}
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

      {/* ── Detected anomalies table ────────────────────── */}
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
            <table className="w-full">
              <thead>
                <tr className="border-b border-border/60">
                  {["Severity", "Service", "Action", "Event Count", "Reason", "Timestamp"].map(h => (
                    <th key={h} className="text-left py-3 px-6 font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground font-normal">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => {
                  const sev       = getSeverity(row.action, row.count)
                  const sevCfg    = severityConfig[sev]
                  const SevIcon   = sevCfg.icon
                  const actStyle  = getActionStyle(row.action)
                  const ActIcon   = actStyle.icon
                  const padded    = row.timestamp?.length <= 13 ? `${row.timestamp}:00:00` : row.timestamp
                  const date      = new Date(padded)
                  const dateStr   = isNaN(date.getTime()) ? row.timestamp : date.toLocaleString("en-US", {
                    month: "short", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })

                  return (
                    <tr key={i} className="border-b border-border/30 hover:bg-white/[0.02] transition-colors">

                      {/* Severity */}
                      <td className="py-4 px-6">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${sevCfg.bg} ${sevCfg.border}`}>
                          <SevIcon size={11} className={sevCfg.text} />
                          <span className={`font-mono text-[10px] tracking-widest uppercase ${sevCfg.text}`}>
                            {sevCfg.label}
                          </span>
                        </div>
                      </td>

                      {/* Service */}
                      <td className="py-4 px-6">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded bg-zinc-800 border border-border flex items-center justify-center font-mono text-[10px] text-zinc-400">
                            {row.service.slice(0, 2).toUpperCase()}
                          </div>
                          <span className="font-display text-sm capitalize text-foreground">{row.service}</span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-4 px-6">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md border ${actStyle.bg} ${actStyle.border}`}>
                          <ActIcon size={11} className={actStyle.text} />
                          <span className={`font-mono text-[10px] tracking-widest uppercase ${actStyle.text}`}>
                            {row.action}
                          </span>
                        </div>
                      </td>

                      {/* Count */}
                      <td className="py-4 px-6">
                        <span className="font-mono text-sm text-foreground">{row.count}</span>
                      </td>

                      {/* Reason */}
                      <td className="py-4 px-6">
                        <span className="font-mono text-xs text-muted-foreground">
                          {row.reason ?? "Threshold exceeded"}
                        </span>
                      </td>

                      {/* Timestamp */}
                      <td className="py-4 px-6">
                        <span className="font-mono text-xs text-muted-foreground">{dateStr}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="flex items-center justify-between pt-2">
        <p className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
          SaaS Sentinel · All API traffic routed &amp; monitored
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">v0.1.0</p>
      </footer>
    </div>
  )
}