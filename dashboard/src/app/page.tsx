import Link from "next/link"

export default function Home() {
  return (
    <div style={{ padding: "40px" }}>
      <h1>SaaS Sentinel Dashboard</h1>
      <ul>
        <li>
          <Link href="/dashboard">Dashboard</Link>
        </li>
        <li>
          <Link href="/services">Services</Link>
        </li>
        <li>
          <Link href="/anomalies">Anomalies</Link>
        </li>
        <li>
          <Link href="/settings">Settings</Link>
        </li>
      </ul>
    </div>
  )
}