"use client"
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"

interface TrendPoint {
  timestamp: string
  requests:  number
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  const padded = label && label.length <= 13 ? `${label}:00:00` : label
  const date = padded ? new Date(padded) : null
  const formatted =
    date && !isNaN(date.getTime())
      ? date.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : label

  return (
    <div className="bg-zinc-900/95 border border-blue-500/30 rounded-md px-3 py-2 shadow-xl shadow-black/40 backdrop-blur-sm">
      <p className="text-[10px] font-mono tracking-widest uppercase text-zinc-500 mb-1">
        {formatted}
      </p>
      <p className="font-mono text-sm font-semibold text-blue-400">
        {payload[0].value}{" "}
        <span className="text-zinc-500 font-normal text-[11px]">requests</span>
      </p>
    </div>
  )
}

export default function CostTrendChart({ data }: { data: TrendPoint[] }) {
  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground font-mono text-sm">
        No trend data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.25} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}    />
          </linearGradient>
        </defs>

        <CartesianGrid
          strokeDasharray="3 3"
          stroke="rgba(255,255,255,0.04)"
          vertical={false}
        />

        <XAxis
          dataKey="timestamp"
          tickFormatter={(v: string) => {
            const padded = v.length <= 13 ? `${v}:00:00` : v
            const d = new Date(padded)
            if (isNaN(d.getTime())) return v
            return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}h`
          }}
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

        <Tooltip
          content={<CustomTooltip />}
          cursor={{ stroke: "rgba(59,130,246,0.25)", strokeWidth: 1 }}
        />

        <Area
          type="monotone"
          dataKey="requests"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#blueGrad)"
          dot={{ fill: "#3b82f6", r: 3, strokeWidth: 0 }}
          activeDot={{ fill: "#93c5fd", r: 5, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}