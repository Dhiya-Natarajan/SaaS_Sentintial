"use client"
// components/StatusBreakdownChart.tsx
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"

interface StatusSlice {
  name:  string
  value: number
  color: string
}

function CustomTooltip({
  active, payload,
}: {
  active?: boolean
  payload?: Array<{ name: string; value: number; payload: { color: string; percent: number } }>
}) {
  if (!active || !payload?.length) return null
  const p = payload[0]
  return (
    <div className="bg-zinc-900/95 border border-zinc-700 rounded-md px-3 py-2 shadow-xl backdrop-blur-sm">
      <p className="font-mono text-[10px] tracking-widest uppercase mb-1" style={{ color: p.payload.color }}>
        {p.name}
      </p>
      <p className="font-mono text-sm font-semibold text-foreground">
        {p.value.toLocaleString()}
        <span className="text-muted-foreground font-normal text-[11px] ml-1">
          ({(p.payload.percent * 100).toFixed(1)}%)
        </span>
      </p>
    </div>
  )
}

export default function StatusBreakdownChart({
  data, total,
}: {
  data: StatusSlice[]; total: number
}) {
  if (!data?.length || total === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground font-mono text-sm">
        No status data available
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Donut */}
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={48}
            outerRadius={72}
            paddingAngle={3}
            dataKey="value"
            startAngle={90}
            endAngle={-270}
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} opacity={0.85} stroke="transparent" />
            ))}
          </Pie>
          <Tooltip content={<CustomTooltip />} />
        </PieChart>
      </ResponsiveContainer>

      {/* Legend rows */}
      <div className="flex flex-col gap-2 px-1">
        {data.map((d, i) => {
          const pct = ((d.value / total) * 100).toFixed(1)
          return (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                <span className="font-mono text-[11px] text-muted-foreground">{d.name}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-foreground">{d.value.toLocaleString()}</span>
                <span className="font-mono text-[10px] text-muted-foreground w-10 text-right">{pct}%</span>
              </div>
            </div>
          )
        })}

        {/* Bar breakdown */}
        <div className="mt-1 flex h-1.5 rounded-full overflow-hidden gap-px">
          {data.map((d, i) => (
            <div
              key={i}
              style={{
                width:           `${(d.value / total) * 100}%`,
                backgroundColor: d.color,
                opacity:         0.8,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}