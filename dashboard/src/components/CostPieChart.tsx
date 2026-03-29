"use client"
// components/CostPieChart.tsx
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"

interface CostPieChartProps {
  data: { name: string; value: number }[]
}

const COLORS = ["#3b82f6", "#a855f7", "#22c55e", "#f59e0b", "#ef4444", "#06b6d4"]

function CustomTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { percent: number } }>
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-zinc-900/95 border border-blue-500/30 rounded-md px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="font-mono text-[10px] tracking-widest uppercase text-zinc-500 mb-1">
        {payload[0].name}
      </p>
      <p className="font-mono text-sm font-semibold text-blue-400">
        ${payload[0].value.toFixed(6)}
        <span className="text-zinc-500 font-normal text-[11px] ml-2">
          ({(payload[0].payload.percent * 100).toFixed(1)}%)
        </span>
      </p>
    </div>
  )
}

function CustomLegend({ payload }: { payload?: Array<{ value: string; color: string }> }) {
  if (!payload) return null
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-2 justify-center mt-2">
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground capitalize">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function CostPieChart({ data }: CostPieChartProps) {
  if (!data?.length) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground font-mono text-sm">
        No cost data available
      </div>
    )
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="45%"
          innerRadius={60}
          outerRadius={95}
          paddingAngle={3}
          dataKey="value"
        >
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={COLORS[i % COLORS.length]}
              opacity={0.85}
              stroke="transparent"
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend content={<CustomLegend />} />
      </PieChart>
    </ResponsiveContainer>
  )
}