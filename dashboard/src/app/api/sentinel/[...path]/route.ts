import { NextRequest, NextResponse } from "next/server"

import { buildSentinelUrl } from "@/lib/sentinel-config"

const SENTINEL_PROXY_TIMEOUT_MS = 5_000
const warnedProxyTargets = new Set<string>()

export const dynamic = "force-dynamic"

type RouteContext = {
  params: Promise<{
    path: string[]
  }>
}

function getErrorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("cause" in error)) {
    return undefined
  }

  const cause = (error as { cause?: { code?: string } }).cause
  return cause?.code
}

function warnProxyUnavailableOnce(targetUrl: string) {
  if (warnedProxyTargets.has(targetUrl)) {
    return
  }

  warnedProxyTargets.add(targetUrl)
  console.warn(
    `SaaS Sentinel backend is unavailable at ${targetUrl}. Start the proxy server with PORT=3001 bun run dev.`
  )
}

async function proxy(request: NextRequest, context: RouteContext) {
  const { path } = await context.params
  const targetUrl = new URL(buildSentinelUrl(path.join("/")))
  targetUrl.search = request.nextUrl.search

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      cache: "no-store",
      signal: AbortSignal.timeout(SENTINEL_PROXY_TIMEOUT_MS),
    })

    const body = await response.text()
    const headers = new Headers()
    const contentType = response.headers.get("content-type")

    if (contentType) {
      headers.set("content-type", contentType)
    }

    return new NextResponse(body, {
      status: response.status,
      headers,
    })
  } catch (error) {
    if (getErrorCode(error) === "ECONNREFUSED") {
      warnProxyUnavailableOnce(targetUrl.toString())
    } else {
      console.error(`Failed to proxy ${targetUrl.toString()}:`, error)
    }

    return NextResponse.json(
      { error: "Failed to reach the SaaS Sentinel backend." },
      { status: 502 }
    )
  }
}

export { proxy as GET }
