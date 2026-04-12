"use client"

import { useEffect, useEffectEvent, useState } from "react"
import { Activity, Clock, CheckCircle, Layers } from "lucide-react"

import type { LiveMetricsDatum } from "@/lib/sentinel-types"

interface MetricTileProps {
  label: string
  value: string
  sub: string
  icon: React.ElementType
  color: string
  pulse?: boolean
}

function formatUpdatedTime(timestamp: string | null) {
  if (!timestamp) {
    return ""
  }

  const date = new Date(timestamp)
  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return date.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

async function fetchLiveMetrics() {
  const response = await fetch("/api/sentinel/analytics/live", {
    cache: "no-store",
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch live metrics: ${response.status}`)
  }

  return (await response.json()) as LiveMetricsDatum
}

function MetricTile({ label, value, sub, icon: Icon, color, pulse }: MetricTileProps) {
  return (
    <div
      className="flex items-center gap-3 px-5 py-3 border-r border-border/40 last:border-r-0"
      title={sub}
    >
      <div className={`p-1.5 rounded-md ${color.replace("text-", "bg-").replace("400", "500/10")}`}>
        <Icon size={13} className={color} />
      </div>
      <div>
        <div className="flex items-center gap-1.5">
          <span className={`font-mono text-base font-semibold ${color}`}>{value}</span>
          {pulse ? <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-live" /> : null}
        </div>
        <p className="font-mono text-[9px] tracking-widest uppercase text-muted-foreground">{label}</p>
      </div>
    </div>
  )
}

export default function LiveMetricsStrip({
  initialMetrics,
}: {
  initialMetrics: LiveMetricsDatum
}) {
  const [metrics, setMetrics] = useState(initialMetrics)

  const refresh = useEffectEvent(async () => {
    try {
      const nextMetrics = await fetchLiveMetrics()
      setMetrics(nextMetrics)
    } catch (error) {
      console.error("Failed to refresh live metrics:", error)
    }
  })

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refresh()
    }, 30_000)

    return () => window.clearInterval(interval)
  }, [])

  const lastUpdated = formatUpdatedTime(metrics.lastUpdated)

  return (
    <div className="flex items-center justify-between bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center divide-x divide-border/40 flex-1">
        <MetricTile
          label="Req / Min"
          value={String(metrics.reqPerMin)}
          sub="Average requests per minute over the recent activity window"
          icon={Activity}
          color="text-blue-400"
          pulse
        />
        <MetricTile
          label="Avg Latency"
          value={`${metrics.avgLatency}ms`}
          sub="Average response latency across recent requests"
          icon={Clock}
          color={metrics.avgLatency > 100 ? "text-amber-400" : "text-green-400"}
        />
        <MetricTile
          label="Success Rate"
          value={`${metrics.successRate.toFixed(1)}%`}
          sub="Recent requests completed without 4xx or 5xx errors"
          icon={CheckCircle}
          color={metrics.successRate < 95 ? "text-amber-400" : "text-green-400"}
        />
        <MetricTile
          label="Active Services"
          value={String(metrics.activeServices)}
          sub="Distinct upstream services active in the recent window"
          icon={Layers}
          color="text-purple-400"
        />
      </div>
      {lastUpdated ? (
        <p className="font-mono text-[9px] text-muted-foreground px-4 whitespace-nowrap">
          updated {lastUpdated}
        </p>
      ) : null}
    </div>
  )
}
