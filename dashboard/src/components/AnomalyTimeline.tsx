"use client"
// components/AnomalyTimeline.tsx
import {
  ResponsiveContainer, ComposedChart, Area, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine,
} from "recharts"

interface TrendPoint  { timestamp: string; requests: number }
interface AnomalyRow  { service: string; action: string; count: number; timestamp: string }

function padTs(ts: string) {
  return ts?.length <= 13 ? `${ts}:00:00` : ts
}

function fmtLabel(ts: string) {
  const d = new Date(padTs(ts))
  if (isNaN(d.getTime())) return ts
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}h`
}

function CustomTooltip({
  active, payload,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string; payload: { isAnomaly?: boolean; action?: string; service?: string } }>
}) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  const isAnomaly = p.payload?.isAnomaly

  return (
    <div className={`bg-zinc-900/95 border rounded-md px-3 py-2 shadow-xl backdrop-blur-sm ${isAnomaly ? "border-red-500/30" : "border-blue-500/30"}`}>
      {isAnomaly ? (
        <>
          <p className="font-mono text-[10px] tracking-widest uppercase text-red-400 mb-1">⚠ Anomaly</p>
          <p className="font-mono text-xs text-zinc-300 capitalize">{p.payload.service}</p>
          <p className="font-mono text-xs text-red-400 capitalize">{p.payload.action}</p>
        </>
      ) : (
        <>
          <p className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 mb-1">Traffic</p>
          <p className="font-mono text-sm font-semibold text-blue-400">
            {p.value} <span className="text-zinc-500 font-normal text-[11px]">requests</span>
          </p>
        </>
      )}
    </div>
  )
}

export default function AnomalyTimeline({
  trend, anomalies,
}: {
  trend: TrendPoint[]; anomalies: AnomalyRow[]
}) {
  if (!trend.length) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground font-mono text-sm">
        No trend data available
      </div>
    )
  }

  // Build unified chart data
  const chartData = trend.map(d => ({
    label:    fmtLabel(d.timestamp),
    requests: d.requests,
  }))

  // Map anomaly events onto closest trend point
  const anomalyPoints = anomalies.map(a => {
    const aLabel = fmtLabel(a.timestamp)
    const match  = chartData.find(d => d.label === aLabel) ?? chartData[0]
    return {
      label:     match.label,
      y:         match.requests,
      isAnomaly: true,
      action:    a.action,
      service:   a.service,
    }
  })

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={chartData} margin={{ top: 16, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="timelineGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis dataKey="label" tick={{ fill: "#52525b", fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={{ stroke: "rgba(255,255,255,0.06)" }} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fill: "#52525b", fontSize: 10, fontFamily: "IBM Plex Mono" }} axisLine={false} tickLine={false} />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(59,130,246,0.2)", strokeWidth: 1 }} />

        <Area type="monotone" dataKey="requests" stroke="#3b82f6" strokeWidth={2} fill="url(#timelineGrad)" dot={{ fill: "#3b82f6", r: 3, strokeWidth: 0 }} />

        {/* Anomaly reference lines */}
        {anomalyPoints.map((ap, i) => (
          <ReferenceLine key={i} x={ap.label} stroke="rgba(239,68,68,0.35)" strokeDasharray="3 3" />
        ))}

        {/* Anomaly scatter dots */}
        <Scatter
          data={anomalyPoints}
          dataKey="y"
          fill="#ef4444"
          shape={(props: { cx?: number; cy?: number }) => {
            const { cx = 0, cy = 0 } = props
            return (
              <g key={`${cx}-${cy}`}>
                <circle cx={cx} cy={cy} r={6} fill="rgba(239,68,68,0.15)" stroke="#ef4444" strokeWidth={1.5} />
                <circle cx={cx} cy={cy} r={2.5} fill="#ef4444" />
              </g>
            )
          }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}