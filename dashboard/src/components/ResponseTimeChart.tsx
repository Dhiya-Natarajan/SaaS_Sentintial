"use client"
// components/ResponseTimeChart.tsx
import {
  ResponsiveContainer, ComposedChart, Bar, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts"

interface TrendPoint { timestamp: string; requests: number }

function padTs(ts: string) {
  return ts?.length <= 13 ? `${ts}:00:00` : ts
}

function fmtLabel(ts: string) {
  const d = new Date(padTs(ts))
  if (isNaN(d.getTime())) return ts
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}h`
}

function CustomTooltip({
  active, payload, label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900/95 border border-blue-500/30 rounded-md px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-mono text-sm font-semibold text-blue-400">
          {p.value}
          <span className="text-zinc-500 font-normal text-[11px] ml-1">
            {p.dataKey === "requests" ? "requests" : "avg"}
          </span>
        </p>
      ))}
    </div>
  )
}

// Color bars by relative volume
function barColor(value: number, max: number) {
  const ratio = value / max
  if (ratio > 0.75) return "#3b82f6"
  if (ratio > 0.4)  return "#60a5fa"
  return "#93c5fd"
}

export default function ResponseTimeChart({ data }: { data: TrendPoint[] }) {
  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground font-mono text-sm">
        No activity data available
      </div>
    )
  }

  const chartData = data.map(d => ({
    label:    fmtLabel(d.timestamp),
    requests: d.requests,
  }))
  const max = Math.max(...chartData.map(d => d.requests))

  return (
    <ResponsiveContainer width="100%" height={230}>
      <ComposedChart data={chartData} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="#3b82f6" stopOpacity={0.9} />
            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.4} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: "#52525b", fontSize: 10, fontFamily: "IBM Plex Mono" }}
          axisLine={{ stroke: "rgba(255,255,255,0.06)" }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fill: "#52525b", fontSize: 10, fontFamily: "IBM Plex Mono" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />

        <Bar dataKey="requests" radius={[3, 3, 0, 0]} maxBarSize={40}>
          {chartData.map((d, i) => (
            <Cell key={i} fill={barColor(d.requests, max)} />
          ))}
        </Bar>

        {/* Rolling average line */}
        <Line
          type="monotone"
          dataKey="requests"
          stroke="#f59e0b"
          strokeWidth={1.5}
          strokeDasharray="4 3"
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}