import "server-only"

import { buildSentinelUrl } from "@/lib/sentinel-config"

const SENTINEL_REQUEST_TIMEOUT_MS = 5_000
const warnedBackendTargets = new Set<string>()

function getErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("cause" in error)) {
    return undefined
  }

  const cause = (error as { cause?: { code?: string } }).cause
  return cause?.code
}

function warnBackendUnavailableOnce(targetUrl: string) {
  if (warnedBackendTargets.has(targetUrl)) {
    return
  }

  warnedBackendTargets.add(targetUrl)
  console.warn(
    `SaaS Sentinel backend is unavailable at ${targetUrl}. Start the proxy server with PORT=3001 bun run dev.`
  )
}

export async function fetchSentinelJson<T>(
  path: string,
  fallback: T,
  init: RequestInit = {}
): Promise<T> {
  const targetUrl = buildSentinelUrl(path)

  try {
    const response = await fetch(targetUrl, {
      ...init,
      cache: "no-store",
      signal: init.signal ?? AbortSignal.timeout(SENTINEL_REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      throw new Error(`SaaS Sentinel API responded with ${response.status}`)
    }

    return (await response.json()) as T
  } catch (error) {
    const errorCode = getErrorCode(error)

    if (errorCode === "ECONNREFUSED") {
      warnBackendUnavailableOnce(targetUrl)
      return fallback
    }

    console.error(`Failed to fetch ${path} from SaaS Sentinel API:`, error)
    return fallback
  }
}
