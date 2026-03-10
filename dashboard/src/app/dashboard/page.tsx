import CostTrendChart from "@/components/CostTrendChart"
import EnforcementChart from "@/components/EnforcementChart"

async function getSummary() {
  const res = await fetch("http://localhost:3001/analytics/summary", {
    cache: "no-store"
  })
  return res.json()
}

async function getTrend() {
  const res = await fetch("http://localhost:3001/analytics/trend", {
    cache: "no-store"
  })
  return res.json()
}

async function getAnomalies() {
  const res = await fetch("http://localhost:3001/analytics/anomalies", {
    cache: "no-store"
  })
  return res.json()
}

export default async function DashboardPage() {
  const summary = await getSummary()
  const trend = await getTrend()
  const anomalies = await getAnomalies()

  return (
    <div style={{ padding: 40 }}>
      <h1>SaaS Sentinel Dashboard</h1>
      <div style={{ display: "flex", gap: 20, marginTop: 30 }}>
        <div style={{ border: "1px solid #ddd", padding: 20 }}>
          <h3>Total Requests</h3>
          <p>{summary.totalRequests}</p>
        </div>
        <div style={{ border: "1px solid #ddd", padding: 20 }}>
          <h3>Total Cost</h3>
          <p>${summary.totalCost}</p>
        </div>
      </div>
      <h2 style={{ marginTop: 40 }}>Usage Trend</h2>
      <CostTrendChart data={trend} />
      <h2 style={{ marginTop: 40 }}>Anomaly Actions</h2>
      <EnforcementChart data={anomalies} />
    </div>
  )
}