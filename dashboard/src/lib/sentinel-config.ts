const DEFAULT_SENTINEL_API_BASE_URL = "http://127.0.0.1:3001"

export function getSentinelApiBaseUrl() {
  const configuredBaseUrl =
    process.env.SENTINEL_API_BASE_URL ||
    process.env.NEXT_PUBLIC_SENTINEL_API_BASE_URL ||
    DEFAULT_SENTINEL_API_BASE_URL

  return configuredBaseUrl.replace(/\/+$/, "")
}

export function buildSentinelUrl(path: string) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`
  return `${getSentinelApiBaseUrl()}${normalizedPath}`
}
