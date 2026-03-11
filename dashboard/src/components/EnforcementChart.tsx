"use client"
import { PieChart, Pie, Tooltip } from "recharts"

export default function EnforcementChart({ data }: any) {
  const chartData = data.map((item: any) => ({
    name: item.actionTaken,
    value: 1
  }))

  return (
    <PieChart width={400} height={300}>
      <Pie
        data={chartData}
        dataKey="value"
        nameKey="name"
        outerRadius={100}
      />
      <Tooltip />
    </PieChart>
  )
}