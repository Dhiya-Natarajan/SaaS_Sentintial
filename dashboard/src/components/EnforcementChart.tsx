"use client"
// components/EnforcementChart.tsx
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts"

interface AnomalyPoint {
  service:   string
  action:    string
  count:     number
  timestamp: string
}

interface AggregatedPoint {
  service: string
  count:   number
  action:  string
}

// ── Custom Tooltip ─────────────────────────────────────────────────────────
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

  return (
    <div className="bg-zinc-900/95 border border-red-500/30 rounded-md px-3 py-2 shadow-xl shadow-black/40 backdrop-blur-sm">
      <p className="text-[10px] font-mono tracking-widest uppercase text-zinc-500 mb-1">
        {label}
      </p>
      <p className="font-mono text-sm font-semibold text-red-400">
        {payload[0].value}{" "}
        <span className="text-zinc-500 font-normal text-[11px]">events</span>
      </p>
    </div>
  )
}

// ── Action badge colour ────────────────────────────────────────────────────
function actionClass(action: string) {
  switch (action) {
    case "block":    return "bg-red-500/10 text-red-400"
    case "reroute":  return "bg-amber-500/10 text-amber-400"
    case "throttle": return "bg-blue-500/10 text-blue-400"
    default:         return "bg-zinc-500/10 text-zinc-400"
  }
}

function barColor(action: string) {
  switch (action) {
    case "block":    return "#ef4444"
    case "reroute":  return "#f59e0b"
    case "throttle": return "#3b82f6"
    default:         return "#71717a"
  }
}

// ── Raw table ─────────────────────────────────────────────────────────────
function AnomalyTable({ data }: { data: AnomalyPoint[] }) {
  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border">
            {["Service", "Action", "Count", "Time"].map((h) => (
              <th
                key={h}
                className="text-left py-2 px-3 font-mono text-[10px] tracking-widest uppercase text-muted-foreground font-normal"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, i) => (
            <tr
              key={i}
              className="border-b border-border/40 hover:bg-white/[0.02] transition-colors"
            >
              <td className="py-2.5 px-3 font-mono text-xs text-foreground">{row.service}</td>
              <td className="py-2.5 px-3">
                <span className={`font-mono text-[10px] tracking-widest uppercase px-2 py-0.5 rounded ${actionClass(row.action)}`}>
                  {row.action}
                </span>
              </td>
              <td className="py-2.5 px-3 font-mono text-xs text-foreground">{row.count}</td>
              <td className="py-2.5 px-3 font-mono text-[10px] text-muted-foreground">
                {new Date(row.timestamp).toLocaleString("en-US", {
                  month: "short", day: "numeric",
                  hour: "2-digit", minute: "2-digit",
                })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Component ──────────────────────────────────────────────────────────────
export default function EnforcementChart({ data }: { data: AnomalyPoint[] }) {
  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground font-mono text-sm">
        No anomalies detected
      </div>
    )
  }

  // Aggregate by service for bar chart
  const aggregated: AggregatedPoint[] = Object.values(
    data.reduce<Record<string, AggregatedPoint>>((acc, row) => {
      if (!acc[row.service]) {
        acc[row.service] = { service: row.service, count: 0, action: row.action }
      }
      acc[row.service].count += row.count ?? 1
      return acc
    }, {})
  )

  return (
    <div className="flex flex-col gap-4">
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={aggregated} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}>
          <defs>
            {aggregated.map((d, i) => (
              <linearGradient key={i} id={`bar-${i}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={barColor(d.action)} stopOpacity={0.9} />
                <stop offset="100%" stopColor={barColor(d.action)} stopOpacity={0.4} />
              </linearGradient>
            ))}
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.04)"
            vertical={false}
          />
          <XAxis
            dataKey="service"
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
            cursor={{ fill: "rgba(255,255,255,0.03)" }}
          />
          <Bar dataKey="count" radius={[3, 3, 0, 0]}>
            {aggregated.map((_d, i) => (
              <Cell key={i} fill={`url(#bar-${i})`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <AnomalyTable data={data} />
    </div>
  )
}