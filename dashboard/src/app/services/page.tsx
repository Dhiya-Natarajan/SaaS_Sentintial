async function getServices() {
  const res = await fetch(
    "http://localhost:3001/analytics/service-breakdown",
    { cache: "no-store" }
  )
  return res.json()
}

export default async function ServicesPage() {
  const services = await getServices()
  return (
    <div style={{ padding: 40 }}>
      <h1>Service Usage</h1>
      <table border={1} cellPadding={10}>
        <thead>
          <tr>
            <th>Service</th>
            <th>Requests</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(services).map(([service, data]: any) => (
            <tr key={service}>
              <td>{service}</td>
              <td>{data.requests}</td>
              <td>${data.cost}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}