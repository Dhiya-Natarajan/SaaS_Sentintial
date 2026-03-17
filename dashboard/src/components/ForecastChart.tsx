"use client"
// components/ForecastChart.tsx
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
  Legend,
} from "recharts"

interface TrendPoint {
  timestamp: string
  requests: number
}

interface ForecastPoint {
  label: string
  actual?: number
  forecast?: number
  upper?: number
  lower?: number
  isForecast?: boolean
}

function buildForecast(data: TrendPoint[]): ForecastPoint[] {
  if (!data.length) return []

  // Simple linear regression for forecasting
  const n = data.length
  const xMean = (n - 1) / 2
  const yMean = data.reduce((s, d) => s + d.requests, 0) / n
  const slope =
    data.reduce((s, d, i) => s + (i - xMean) * (d.requests - yMean), 0) /
    data.reduce((s, _, i) => s + Math.pow(i - xMean, 2), 0)
  const intercept = yMean - slope * xMean

  const formatLabel = (ts: string) => {
    const padded = ts.length <= 13 ? `${ts}:00:00` : ts
    const d = new Date(padded)
    return isNaN(d.getTime()) ? ts : `${d.getMonth() + 1}/${d.getDate()}`
  }

  const historical: ForecastPoint[] = data.map((d, i) => ({
    label: formatLabel(d.timestamp),
    actual: d.requests,
    forecast: Math.max(0, Math.round(intercept + slope * i)),
  }))

  // Project 4 future points
  const future: ForecastPoint[] = Array.from({ length: 4 }, (_, i) => {
    const idx = n + i
    const projected = Math.max(0, intercept + slope * idx)
    const variance = Math.max(1, projected * 0.2)
    return {
      label: `+${i + 1}d`,
      forecast: Math.round(projected),
      upper: Math.round(projected + variance),
      lower: Math.round(Math.max(0, projected - variance)),
      isForecast: true,
    }
  })

  return [...historical, ...future]
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; color: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900/95 border border-blue-500/30 rounded-md px-3 py-2 shadow-xl backdrop-blur-sm min-w-[140px]">
      <p className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 mb-2">{label}</p>
      {payload.map((p, i) => (
        <p key={i} className="font-mono text-xs font-semibold" style={{ color: p.color }}>
          {p.value}
          <span className="text-zinc-500 font-normal ml-1">{p.name}</span>
        </p>
      ))}
    </div>
  )
}

export default function ForecastChart({ data }: { data: TrendPoint[] }) {
  const chartData = buildForecast(data)
  const splitIndex = data.length - 1

  if (!chartData.length) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground font-mono text-sm">
        Insufficient data for forecast
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={240}>
      <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#3b82f6" stopOpacity={0.2} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}   />
          </linearGradient>
          <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%"  stopColor="#f59e0b" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}    />
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

        <Tooltip content={<CustomTooltip />} cursor={{ stroke: "rgba(59,130,246,0.2)", strokeWidth: 1 }} />

        {/* Confidence band */}
        <Area type="monotone" dataKey="upper"    fill="url(#forecastGrad)" stroke="transparent" legendType="none" />
        <Area type="monotone" dataKey="lower"    fill="#09090b"            stroke="transparent" legendType="none" />

        {/* Actual */}
        <Area type="monotone" dataKey="actual"   fill="url(#actualGrad)"  stroke="#3b82f6" strokeWidth={2} dot={{ fill: "#3b82f6", r: 3, strokeWidth: 0 }} name="actual" />

        {/* Forecast line */}
        <Line type="monotone" dataKey="forecast" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 4" dot={false} name="forecast" />

        {/* Split marker */}
        <ReferenceLine
          x={chartData[splitIndex]?.label}
          stroke="rgba(255,255,255,0.1)"
          strokeDasharray="4 4"
          label={{ value: "NOW", position: "top", fill: "#52525b", fontSize: 9, fontFamily: "IBM Plex Mono" }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  )
}