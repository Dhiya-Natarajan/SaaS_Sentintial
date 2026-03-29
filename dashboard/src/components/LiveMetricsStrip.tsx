"use client"
// components/LiveMetricsStrip.tsx
import { useEffect, useState } from "react"
import { Activity, Clock, CheckCircle, Users } from "lucide-react"

interface LiveMetrics {
  reqPerMin:   number
  avgLatency:  number
  successRate: number
  activeUsers: number
}

async function fetchLiveMetrics(): Promise<LiveMetrics> {
  // Derive from summary — replace with a dedicated /analytics/live endpoint if available
  const [summary, trend] = await Promise.all([
    fetch("/api/proxy/analytics/summary").then(r => r.json()).catch(() => ({})),
    fetch("/api/proxy/analytics/trend").then(r => r.json()).catch(() => ({})),
  ])

  const trendValues = Object.values(trend as Record<string, number>)
  const recent = trendValues.slice(-5)
  const reqPerMin = recent.length
    ? Math.round(recent.reduce((a: number, b) => a + (b as number), 0) / recent.length)
    : 0

  return {
    reqPerMin,
    avgLatency:  Math.floor(Math.random() * 80) + 40,   // replace with real latency endpoint
    successRate: 94 + Math.random() * 5,                // replace with real success endpoint
    activeUsers: Math.floor(Math.random() * 8) + 2,     // replace with real users endpoint
  }
}

interface MetricTileProps {
  label: string
  value: string
  sub: string
  icon: React.ElementType
  color: string
  pulse?: boolean
}

function MetricTile({ label, value, sub, icon: Icon, color, pulse }: MetricTileProps) {
  return (
    <div className={`flex items-center gap-3 px-5 py-3 border-r border-border/40 last:border-r-0`}>
      <div className={`p-1.5 rounded-md ${color.replace("text-", "bg-").replace("400", "500/10")}`}>
        <Icon size={13} className={color} />
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <span className={`font-mono text-base font-semibold ${color}`}>{value}</span>
          {pulse && <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-live" />}
        </div>
        <p className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

export default function LiveMetricsStrip() {
  const [metrics, setMetrics] = useState<LiveMetrics>({
    reqPerMin: 0, avgLatency: 0, successRate: 0, activeUsers: 0,
  })
  const [lastUpdated, setLastUpdated] = useState<string>("")

  const refresh = async () => {
    const m = await fetchLiveMetrics()
    setMetrics(m)
    setLastUpdated(new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" }))
  }

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, 30_000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="flex items-center justify-between bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center divide-x divide-border/40 flex-1">
        <MetricTile
          label="Req / Min"
          value={String(metrics.reqPerMin)}
          sub="requests per minute"
          icon={Activity}
          color="text-blue-400"
          pulse
        />
        <MetricTile
          label="Avg Latency"
          value={`${metrics.avgLatency}ms`}
          sub="response time"
          icon={Clock}
          color={metrics.avgLatency > 100 ? "text-amber-400" : "text-green-400"}
        />
        <MetricTile
          label="Success Rate"
          value={`${metrics.successRate.toFixed(1)}%`}
          sub="2xx responses"
          icon={CheckCircle}
          color={metrics.successRate < 95 ? "text-amber-400" : "text-green-400"}
        />
        <MetricTile
          label="Active Users"
          value={String(metrics.activeUsers)}
          sub="current sessions"
          icon={Users}
          color="text-purple-400"
        />
      </div>
      {lastUpdated && (
        <p className="font-mono text-[9px] text-muted-foreground px-4 whitespace-nowrap">
          updated {lastUpdated}
        </p>
      )}
    </div>
  )
}