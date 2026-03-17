// app/services/page.tsx
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Layers, DollarSign, Activity, TrendingUp, TrendingDown, Minus } from "lucide-react"

interface ServiceData {
  requests: number
  cost: number
}

async function getServices(): Promise<Record<string, ServiceData>> {
  const res = await fetch("http://localhost:3001/analytics/service-breakdown", {
    cache: "no-store",
  })
  return res.json()
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatCost(cost: number) {
  if (cost === 0) return "$0.0000"
  if (cost < 0.0001) return `$${cost.toExponential(2)}`
  return cost.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  })
}

function serviceInitial(name: string) {
  return name.slice(0, 2).toUpperCase()
}

const SERVICE_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  openai:    { text: "text-blue-400",   bg: "bg-blue-500/10",   border: "border-blue-500/20"   },
  anthropic: { text: "text-purple-400", bg: "bg-purple-500/10", border: "border-purple-500/20" },
  stripe:    { text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20"  },
}

function getServiceColor(name: string) {
  return SERVICE_COLORS[name.toLowerCase()] ?? {
    text: "text-zinc-400",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/20",
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function ServicesPage() {
  const services = await getServices()
  const entries = Object.entries(services) as [string, ServiceData][]

  const totalRequests = entries.reduce((s, [, d]) => s + d.requests, 0)
  const totalCost     = entries.reduce((s, [, d]) => s + d.cost, 0)
  const topService    = entries.sort((a, b) => b[1].requests - a[1].requests)[0]?.[0]

  return (
    <div className="min-h-screen px-8 py-8 flex flex-col gap-8">

      {/* ── Header ──────────────────────────────────────── */}
      <header className="flex items-end justify-between animate-in-up">
        <div>
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-1.5">
            API Cost Intelligence · Anomaly Detection
          </p>
          <h1 className="font-display text-[2rem] font-bold tracking-[-0.03em] text-foreground leading-none">
            SaaS Sentinel
            <span className="text-blue-500 ml-2.5 font-light tracking-[-0.02em]">Services</span>
          </h1>
        </div>
        <Badge
          variant="outline"
          className="font-mono text-[10px] tracking-widest uppercase gap-1.5 border-green-500/30 text-green-400 bg-green-500/5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-live inline-block" />
          Proxy Live
        </Badge>
      </header>

      <Separator className="bg-border/60" />

      {/* ── Summary KPIs ────────────────────────────────── */}
      <section className="grid grid-cols-3 gap-4 animate-in-up delay-100">
        {/* Total Requests */}
        <Card className="relative overflow-hidden bg-card border border-blue-500/20 border-glow-blue">
          <div className="absolute top-0 left-0 h-[2px] w-full bg-blue-500/10" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
            <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground">Total Requests</p>
            <div className="p-1.5 rounded-md bg-blue-500/10">
              <Activity size={14} className="text-blue-400" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <p className="font-mono text-3xl font-semibold tracking-tight text-blue-400">
              {totalRequests.toLocaleString()}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">across {entries.length} services</p>
          </CardContent>
        </Card>

        {/* Total Cost */}
        <Card className="relative overflow-hidden bg-card border border-amber-500/20 border-glow-amber">
          <div className="absolute top-0 left-0 h-[2px] w-full bg-amber-500/10" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
            <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground">Total Cost</p>
            <div className="p-1.5 rounded-md bg-amber-500/10">
              <DollarSign size={14} className="text-amber-400" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <p className="font-mono text-3xl font-semibold tracking-tight text-amber-400">
              {formatCost(totalCost)}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">cumulative spend</p>
          </CardContent>
        </Card>

        {/* Top Service */}
        <Card className="relative overflow-hidden bg-card border border-zinc-500/20">
          <div className="absolute top-0 left-0 h-[2px] w-full bg-zinc-500/10" />
          <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
            <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground">Top Service</p>
            <div className="p-1.5 rounded-md bg-zinc-500/10">
              <Layers size={14} className="text-zinc-400" />
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            <p className="font-mono text-3xl font-semibold tracking-tight text-zinc-200 capitalize">
              {topService ?? "—"}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">highest request volume</p>
          </CardContent>
        </Card>
      </section>

      {/* ── Service Table ────────────────────────────────── */}
      <Card className="animate-in-up delay-200 bg-card border border-border border-glow-blue flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-4">
          <div className="flex items-center gap-3">
            <Layers size={16} className="text-blue-400" />
            <CardTitle className="font-display text-base font-semibold tracking-tight">
              Service Breakdown
            </CardTitle>
          </div>
          <Badge
            variant="outline"
            className="font-mono text-[9px] tracking-[0.15em] uppercase border-blue-500/20 text-blue-400 bg-blue-500/5"
          >
            {entries.length} Active
          </Badge>
        </CardHeader>
        <Separator className="bg-border/50" />

        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/60">
                <th className="text-left py-3 px-6 font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground font-normal">
                  Service
                </th>
                <th className="text-left py-3 px-6 font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground font-normal">
                  Requests
                </th>
                <th className="text-left py-3 px-6 font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground font-normal">
                  Cost
                </th>
                <th className="text-left py-3 px-6 font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground font-normal">
                  Share
                </th>
                <th className="text-left py-3 px-6 font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground font-normal">
                  Cost / Req
                </th>
                <th className="text-right py-3 px-6 font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground font-normal">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map(([service, data], i) => {
                const color       = getServiceColor(service)
                const share       = totalRequests > 0 ? (data.requests / totalRequests) * 100 : 0
                const costPerReq  = data.requests > 0 ? data.cost / data.requests : 0
                const isTop       = service === topService

                return (
                  <tr
                    key={service}
                    className="border-b border-border/30 hover:bg-white/[0.02] transition-colors group"
                    style={{ animationDelay: `${(i + 3) * 80}ms` }}
                  >
                    {/* Service name */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center text-[11px] font-mono font-semibold ${color.bg} ${color.text} border ${color.border}`}>
                          {serviceInitial(service)}
                        </div>
                        <div>
                          <p className={`font-display text-sm font-medium capitalize ${color.text}`}>
                            {service}
                          </p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {service.toLowerCase()}.api
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Requests */}
                    <td className="py-4 px-6">
                      <p className="font-mono text-sm text-foreground">
                        {data.requests.toLocaleString()}
                      </p>
                    </td>

                    {/* Cost */}
                    <td className="py-4 px-6">
                      <p className="font-mono text-sm text-amber-400">
                        {formatCost(data.cost)}
                      </p>
                    </td>

                    {/* Share bar */}
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2 min-w-[100px]">
                        <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${color.bg} border-0`}
                            style={{
                              width: `${share}%`,
                              backgroundColor: color.text.replace("text-", "").includes("blue")
                                ? "rgba(59,130,246,0.6)"
                                : color.text.includes("purple")
                                ? "rgba(168,85,247,0.6)"
                                : color.text.includes("green")
                                ? "rgba(34,197,94,0.6)"
                                : "rgba(113,113,122,0.6)",
                            }}
                          />
                        </div>
                        <span className="font-mono text-[11px] text-muted-foreground w-10 text-right">
                          {share.toFixed(1)}%
                        </span>
                      </div>
                    </td>

                    {/* Cost per request */}
                    <td className="py-4 px-6">
                      <p className="font-mono text-sm text-zinc-400">
                        {formatCost(costPerReq)}
                      </p>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-6 text-right">
                      {isTop ? (
                        <Badge
                          variant="outline"
                          className="font-mono text-[9px] tracking-widest uppercase border-amber-500/30 text-amber-400 bg-amber-500/5 gap-1"
                        >
                          <TrendingUp size={9} />
                          High
                        </Badge>
                      ) : share < 10 ? (
                        <Badge
                          variant="outline"
                          className="font-mono text-[9px] tracking-widest uppercase border-zinc-500/30 text-zinc-500 bg-zinc-500/5 gap-1"
                        >
                          <Minus size={9} />
                          Low
                        </Badge>
                      ) : (
                        <Badge
                          variant="outline"
                          className="font-mono text-[9px] tracking-widest uppercase border-green-500/30 text-green-400 bg-green-500/5 gap-1"
                        >
                          <TrendingDown size={9} />
                          Normal
                        </Badge>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {/* Totals footer */}
            <tfoot>
              <tr className="border-t border-border/60 bg-white/[0.01]">
                <td className="py-3 px-6 font-mono text-[10px] tracking-widest uppercase text-muted-foreground">
                  Total
                </td>
                <td className="py-3 px-6 font-mono text-sm font-semibold text-foreground">
                  {totalRequests.toLocaleString()}
                </td>
                <td className="py-3 px-6 font-mono text-sm font-semibold text-amber-400">
                  {formatCost(totalCost)}
                </td>
                <td className="py-3 px-6 font-mono text-[11px] text-muted-foreground">100%</td>
                <td className="py-3 px-6" />
                <td className="py-3 px-6" />
              </tr>
            </tfoot>
          </table>
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