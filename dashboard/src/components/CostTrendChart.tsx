"use client"
import { LineChart, Line, XAxis, YAxis, Tooltip } from "recharts"

export default function CostTrendChart({ data }: any) {
  const chartData = Object.entries(data).map(([time, value]) => ({
    time,
    requests: value
  }))

  return (
    <LineChart width={700} height={300} data={chartData}>
      <XAxis dataKey="time" />
      <YAxis />
      <Tooltip />
      <Line
        type="monotone"
        dataKey="requests"
        stroke="#4f46e5"
      />
    </LineChart>
  )
}