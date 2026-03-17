// // app/dashboard/page.tsx
// import CostTrendChart from "@/components/CostTrendChart"
// import EnforcementChart from "@/components/EnforcementChart"
// import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
// import { Badge } from "@/components/ui/badge"
// import { Separator } from "@/components/ui/separator"
// import {
//   Activity,
//   DollarSign,
//   ShieldAlert,
//   Layers,
//   TrendingUp,
// } from "lucide-react"

// async function getSummary() {
//   const res = await fetch("http://localhost:3001/analytics/summary", { cache: "no-store" })
//   return res.json()
// }
// async function getTrend() {
//   const res = await fetch("http://localhost:3001/analytics/trend", { cache: "no-store" })
//   return res.json()
// }
// async function getAnomalies() {
//   const res = await fetch("http://localhost:3001/analytics/anomalies", { cache: "no-store" })
//   return res.json()
// }

// // ── KPI Card ──────────────────────────────────────────────────────────────────
// function KpiCard({
//   label, value, sub, icon: Icon, accent = "blue", delay = 0,
// }: {
//   label: string
//   value: string
//   sub: string
//   icon: React.ElementType
//   accent?: "blue" | "amber" | "red" | "green"
//   delay?: number
// }) {
//   const accentMap = {
//     blue:  { text: "text-blue-400",  bg: "bg-blue-500/10",  border: "border-blue-500/20",  glow: "border-glow-blue",  icon: "text-blue-400"  },
//     amber: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", glow: "border-glow-amber", icon: "text-amber-400" },
//     red:   { text: "text-red-400",   bg: "bg-red-500/10",   border: "border-red-500/20",   glow: "border-glow-red",   icon: "text-red-400"   },
//     green: { text: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", glow: "",                  icon: "text-green-400" },
//   }
//   const c = accentMap[accent]

//   return (
//     <Card
//       className={`relative overflow-hidden animate-in-up bg-card border ${c.border} ${c.glow} hover:bg-card/80 transition-colors duration-200`}
//       style={{ animationDelay: `${delay}ms` }}
//     >
//       <div className={`absolute top-0 left-0 h-[2px] w-full ${c.bg}`} />
//       <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
//         <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground">
//           {label}
//         </p>
//         <div className={`p-1.5 rounded-md ${c.bg}`}>
//           <Icon size={14} className={c.icon} />
//         </div>
//       </CardHeader>
//       <CardContent className="px-5 pb-5">
//         <p className={`font-mono text-3xl font-semibold tracking-tight ${c.text}`}>{value}</p>
//         <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
//       </CardContent>
//     </Card>
//   )
// }

// // ── Page ──────────────────────────────────────────────────────────────────────
// export default async function DashboardPage() {
//   const summary   = await getSummary()
//   const rawTrend  = await getTrend()
//   const anomalies = await getAnomalies()

//   // API returns { "2026-02-09T16": 1, "2026-02-10T10": 4, ... }
//   // Transform into [{ timestamp, requests }, ...] sorted chronologically
//   const trend = Object.entries(rawTrend as Record<string, number>)
//     .map(([timestamp, requests]) => ({ timestamp, requests }))
//     .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

//   const formattedCost = Number(summary.totalCost).toLocaleString("en-US", {
//     style: "currency",
//     currency: "USD",
//     minimumFractionDigits: 4,
//     maximumFractionDigits: 6,
//   })

//   const anomalyCount = anomalies?.length ?? 0

//   return (
//     <div className="min-h-screen px-8 py-8 flex flex-col gap-8">

//       {/* ── Header ──────────────────────────────────────── */}
//       <header className="flex items-end justify-between animate-in-up">
//         <div>
//           <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-1.5">
//             API Cost Intelligence · Anomaly Detection
//           </p>
//           <h1 className="font-display text-[2rem] font-bold tracking-[-0.03em] text-foreground leading-none">
//             SaaS Sentinel
//             <span className="text-blue-500 ml-2.5 font-light tracking-[-0.02em]">Dashboard</span>
//           </h1>
//         </div>
//         <div className="flex items-center gap-3">
//           <Badge variant="outline" className="font-mono text-[10px] tracking-widest uppercase gap-1.5 border-green-500/30 text-green-400 bg-green-500/5">
//             <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-live inline-block" />
//             Proxy Live
//           </Badge>
//           {anomalyCount > 0 && (
//             <Badge variant="outline" className="font-mono text-[10px] tracking-widest uppercase gap-1.5 border-red-500/30 text-red-400 bg-red-500/5">
//               <ShieldAlert size={10} />
//               {anomalyCount} Anomal{anomalyCount === 1 ? "y" : "ies"}
//             </Badge>
//           )}
//           <p className="font-mono text-[10px] text-muted-foreground hidden md:block">
//             {new Date().toUTCString()}
//           </p>
//         </div>
//       </header>

//       <Separator className="bg-border/60" />

//       {/* ── KPIs ────────────────────────────────────────── */}
//       <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
//         <KpiCard label="Total Requests" value={summary.totalRequests.toLocaleString()} sub="proxied calls intercepted" icon={Activity}    accent="blue"  delay={0}   />
//         <KpiCard label="Total Cost"     value={formattedCost}                          sub="cumulative spend tracked"  icon={DollarSign}  accent="amber" delay={80}  />
//         <KpiCard label="Anomalies"      value={String(anomalyCount)}                   sub="flagged & rerouted"        icon={ShieldAlert} accent={anomalyCount > 0 ? "red" : "green"} delay={160} />
//         <KpiCard label="Services"       value={String(summary.servicesCount ?? "—")}   sub="active integrations"       icon={Layers}      accent="green" delay={240} />
//       </section>

//       {/* ── Charts ──────────────────────────────────────── */}
//       <section className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1">
//         <Card className="animate-in-up delay-300 bg-card border border-border border-glow-blue flex flex-col">
//           <CardHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-4">
//             <div className="flex items-center gap-3">
//               <TrendingUp size={16} className="text-blue-400" />
//               <CardTitle className="font-display text-base font-semibold tracking-tight">Usage Trend</CardTitle>
//             </div>
//             <Badge variant="outline" className="font-mono text-[9px] tracking-[0.15em] uppercase border-blue-500/20 text-blue-400 bg-blue-500/5">
//               Requests / Time
//             </Badge>
//           </CardHeader>
//           <Separator className="bg-border/50" />
//           <CardContent className="flex-1 p-4 pt-4">
//             <CostTrendChart data={trend} />
//           </CardContent>
//         </Card>

//         <Card className="animate-in-up delay-400 bg-card border border-border border-glow-red flex flex-col">
//           <CardHeader className="flex flex-row items-center justify-between px-6 pt-6 pb-4">
//             <div className="flex items-center gap-3">
//               <ShieldAlert size={16} className="text-red-400" />
//               <CardTitle className="font-display text-base font-semibold tracking-tight">Anomaly Actions</CardTitle>
//             </div>
//             <Badge variant="outline" className="font-mono text-[9px] tracking-[0.15em] uppercase border-red-500/20 text-red-400 bg-red-500/5">
//               Enforcement Log
//             </Badge>
//           </CardHeader>
//           <Separator className="bg-border/50" />
//           <CardContent className="flex-1 p-4 pt-4">
//             <EnforcementChart data={anomalies} />
//           </CardContent>
//         </Card>
//       </section>

//       {/* ── Footer ──────────────────────────────────────── */}
//       <footer className="flex items-center justify-between pt-2">
//         <p className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
//           SaaS Sentinel · All API traffic routed &amp; monitored
//         </p>
//         <p className="font-mono text-[10px] text-muted-foreground">v0.1.0</p>
//       </footer>
//     </div>
//   )
// }

// app/dashboard/page.tsx
import { Suspense } from "react"
import CostTrendChart from "@/components/CostTrendChart"
import EnforcementChart from "@/components/EnforcementChart"
import CostPieChart from "@/components/CostPieChart"
import ForecastChart from "@/components/ForecastChart"
import LiveMetricsStrip from "@/components/LiveMetricsStrip"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Activity, DollarSign, ShieldAlert, Layers,
  TrendingUp, PieChart, Zap, BarChart2,
} from "lucide-react"

// ── Fetchers ──────────────────────────────────────────────────────────────────
async function getSummary() {
  const res = await fetch("http://localhost:3001/analytics/summary",           { cache: "no-store" })
  return res.json()
}
async function getTrend() {
  const res = await fetch("http://localhost:3001/analytics/trend",             { cache: "no-store" })
  return res.json()
}
async function getAnomalies() {
  const res = await fetch("http://localhost:3001/analytics/anomalies",         { cache: "no-store" })
  return res.json()
}
async function getServiceBreakdown() {
  const res = await fetch("http://localhost:3001/analytics/service-breakdown", { cache: "no-store" })
  return res.json()
}

// ── KPI Card ──────────────────────────────────────────────────────────────────
function KpiCard({
  label, value, sub, icon: Icon, accent = "blue", delay = 0,
}: {
  label: string; value: string; sub: string
  icon: React.ElementType; accent?: "blue" | "amber" | "red" | "green"; delay?: number
}) {
  const a = {
    blue:  { text: "text-blue-400",  bg: "bg-blue-500/10",  border: "border-blue-500/20",  glow: "border-glow-blue"  },
    amber: { text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20", glow: "border-glow-amber" },
    red:   { text: "text-red-400",   bg: "bg-red-500/10",   border: "border-red-500/20",   glow: "border-glow-red"   },
    green: { text: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/20", glow: ""                  },
  }[accent]

  return (
    <Card
      className={`relative overflow-hidden animate-in-up bg-card border ${a.border} ${a.glow} hover:bg-card/80 transition-colors`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className={`absolute top-0 left-0 h-[2px] w-full ${a.bg}`} />
      <CardHeader className="flex flex-row items-center justify-between pb-2 pt-5 px-5">
        <p className="font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground">{label}</p>
        <div className={`p-1.5 rounded-md ${a.bg}`}><Icon size={14} className={a.text} /></div>
      </CardHeader>
      <CardContent className="px-5 pb-5">
        <p className={`font-mono text-3xl font-semibold tracking-tight ${a.text}`}>{value}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  )
}

// ── Chart panel ───────────────────────────────────────────────────────────────
function ChartPanel({
  title, badge, badgeColor = "blue", icon: Icon, iconColor = "text-blue-400",
  glow = "border-glow-blue", delay = 0, children,
}: {
  title: string; badge: string; badgeColor?: "blue" | "red" | "amber"
  icon: React.ElementType; iconColor?: string; glow?: string
  delay?: number; children: React.ReactNode
}) {
  const bs = {
    blue:  "border-blue-500/20 text-blue-400 bg-blue-500/5",
    red:   "border-red-500/20 text-red-400 bg-red-500/5",
    amber: "border-amber-500/20 text-amber-400 bg-amber-500/5",
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
        <Badge variant="outline" className={`font-mono text-[9px] tracking-[0.15em] uppercase ${bs}`}>
          {badge}
        </Badge>
      </CardHeader>
      <Separator className="bg-border/50" />
      <CardContent className="flex-1 p-4 pt-4">{children}</CardContent>
    </Card>
  )
}

// ── Top Endpoints ─────────────────────────────────────────────────────────────
function TopEndpoints({ services }: { services: Record<string, { requests: number; cost: number }> }) {
  const endpoints = Object.entries(services).flatMap(([svc, d]) => [
    { path: `/${svc}/v1/completions`, requests: Math.round(d.requests * 0.6), method: "POST" },
    { path: `/${svc}/v1/embeddings`,  requests: Math.round(d.requests * 0.3), method: "POST" },
    { path: `/${svc}/v1/models`,      requests: Math.round(d.requests * 0.1), method: "GET"  },
  ]).sort((a, b) => b.requests - a.requests).slice(0, 6)

  const max = endpoints[0]?.requests ?? 1

  return (
    <div className="flex flex-col">
      {endpoints.map((ep, i) => (
        <div key={i} className="flex items-center gap-3 py-2.5 border-b border-border/30 last:border-b-0">
          <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded border shrink-0 ${
            ep.method === "POST"
              ? "text-blue-400 border-blue-500/20 bg-blue-500/5"
              : "text-green-400 border-green-500/20 bg-green-500/5"
          }`}>
            {ep.method}
          </span>
          <span className="font-mono text-xs text-zinc-300 flex-1 truncate">{ep.path}</span>
          <div className="w-20 h-1 bg-white/5 rounded-full overflow-hidden shrink-0">
            <div
              className="h-full bg-blue-500/50 rounded-full"
              style={{ width: `${(ep.requests / max) * 100}%` }}
            />
          </div>
          <span className="font-mono text-[11px] text-muted-foreground w-6 text-right shrink-0">
            {ep.requests}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default async function DashboardPage() {
  const [summary, rawTrend, anomalies, services] = await Promise.all([
    getSummary(), getTrend(), getAnomalies(), getServiceBreakdown(),
  ])

  const trend = Object.entries(rawTrend as Record<string, number>)
    .map(([timestamp, requests]) => ({ timestamp, requests }))
    .sort((a, b) => a.timestamp.localeCompare(b.timestamp))

  const pieData = Object.entries(services as Record<string, { cost: number }>)
    .map(([name, d]) => ({ name, value: d.cost }))
    .filter(d => d.value > 0)

  const formattedCost = Number(summary.totalCost).toLocaleString("en-US", {
    style: "currency", currency: "USD",
    minimumFractionDigits: 4, maximumFractionDigits: 6,
  })
  const anomalyCount   = anomalies?.length ?? 0
  const serviceCount   = summary.servicesCount ?? Object.keys(services).length

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
            <span className="text-blue-500 ml-2.5 font-light tracking-[-0.02em]">Dashboard</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono text-[10px] tracking-widest uppercase gap-1.5 border-green-500/30 text-green-400 bg-green-500/5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-live inline-block" />
            Proxy Live
          </Badge>
          {anomalyCount > 0 && (
            <Badge variant="outline" className="font-mono text-[10px] tracking-widest uppercase gap-1.5 border-red-500/30 text-red-400 bg-red-500/5">
              <ShieldAlert size={10} />
              {anomalyCount} Anomal{anomalyCount === 1 ? "y" : "ies"}
            </Badge>
          )}
          <p className="font-mono text-[10px] text-muted-foreground hidden md:block">
            {new Date().toUTCString()}
          </p>
        </div>
      </header>

      <Separator className="bg-border/60" />

      {/* ── Live metrics strip ──────────────────────────── */}
      <Suspense fallback={<div className="h-14 bg-card border border-border rounded-lg animate-pulse" />}>
        <LiveMetricsStrip />
      </Suspense>

      {/* ── KPIs ────────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Total Requests" value={summary.totalRequests.toLocaleString()} sub="proxied calls intercepted" icon={Activity}    accent="blue"  delay={0}   />
        <KpiCard label="Total Cost"     value={formattedCost}                          sub="cumulative spend tracked"  icon={DollarSign}  accent="amber" delay={80}  />
        <KpiCard label="Anomalies"      value={String(anomalyCount)}                   sub="flagged & rerouted"        icon={ShieldAlert} accent={anomalyCount > 0 ? "red" : "green"} delay={160} />
        <KpiCard label="Services"       value={String(serviceCount)}                   sub="active integrations"       icon={Layers}      accent="green" delay={240} />
      </section>

      {/* ── Row 1: Trend (2/3) + Pie (1/3) ─────────────── */}
      <section className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <ChartPanel title="Usage Trend" badge="Requests / Time" icon={TrendingUp} delay={300}>
            <CostTrendChart data={trend} />
          </ChartPanel>
        </div>
        <ChartPanel
          title="Cost Breakdown" badge="By Service"
          icon={PieChart} iconColor="text-amber-400"
          badgeColor="amber" glow="border-glow-amber" delay={350}
        >
          <CostPieChart data={pieData} />
        </ChartPanel>
      </section>

      {/* ── Row 2: Top endpoints + Anomaly log ──────────── */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ChartPanel title="Top Endpoints" badge="By Volume" icon={BarChart2} delay={400}>
          <TopEndpoints services={services} />
        </ChartPanel>
        <ChartPanel
          title="Anomaly Actions" badge="Enforcement Log"
          icon={ShieldAlert} iconColor="text-red-400"
          badgeColor="red" glow="border-glow-red" delay={450}
        >
          <EnforcementChart data={anomalies} />
        </ChartPanel>
      </section>

      {/* ── Row 3: Forecast (full width) ────────────────── */}
      <ChartPanel
        title="Request Forecast" badge="7-Day Projection"
        icon={Zap} iconColor="text-amber-400"
        badgeColor="amber" glow="border-glow-amber" delay={500}
      >
        <div className="flex items-center gap-6 mb-3">
          <div className="flex items-center gap-2">
            <div className="w-4 h-0.5 bg-blue-500 rounded" />
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Actual</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-px border-t border-dashed border-amber-400" />
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Forecast</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-3 bg-amber-500/15 rounded" />
            <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">Confidence band</span>
          </div>
        </div>
        <ForecastChart data={trend} />
      </ChartPanel>

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