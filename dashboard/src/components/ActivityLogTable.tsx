"use client"
// components/ActivityLogTable.tsx
import { useState, useMemo } from "react"
import { ArrowUpDown, Search } from "lucide-react"

interface LogRow {
  id:        string
  timestamp: string
  service:   string
  method:    "GET" | "POST" | "PUT" | "DELETE"
  path:      string
  status:    number
  latency:   number
  cost:      number
}

function padTs(ts: string) {
  return ts?.length <= 13 ? `${ts}:00:00` : ts
}

function fmtTime(ts: string) {
  const d = new Date(padTs(ts))
  if (isNaN(d.getTime())) return ts
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  })
}

function StatusBadge({ status }: { status: number }) {
  const cfg =
    status < 300 ? { text: "text-green-400",  bg: "bg-green-500/10",  border: "border-green-500/20"  } :
    status < 500 ? { text: "text-amber-400",  bg: "bg-amber-500/10",  border: "border-amber-500/20"  } :
                   { text: "text-red-400",     bg: "bg-red-500/10",    border: "border-red-500/20"    }
  return (
    <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded border ${cfg.text} ${cfg.bg} ${cfg.border}`}>
      {status}
    </span>
  )
}

function MethodBadge({ method }: { method: string }) {
  const cfg: Record<string, string> = {
    GET:    "text-green-400 bg-green-500/10 border-green-500/20",
    POST:   "text-blue-400 bg-blue-500/10 border-blue-500/20",
    PUT:    "text-amber-400 bg-amber-500/10 border-amber-500/20",
    DELETE: "text-red-400 bg-red-500/10 border-red-500/20",
  }
  return (
    <span className={`font-mono text-[9px] px-1.5 py-0.5 rounded border ${cfg[method] ?? "text-zinc-400 bg-zinc-500/10 border-zinc-500/20"}`}>
      {method}
    </span>
  )
}

type SortKey = "timestamp" | "service" | "status" | "latency" | "cost"

export default function ActivityLogTable({ rows }: { rows: LogRow[] }) {
  const [search,  setSearch]  = useState("")
  const [filter,  setFilter]  = useState<"all" | "2xx" | "4xx" | "5xx">("all")
  const [sortKey, setSortKey] = useState<SortKey>("timestamp")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === "asc" ? "desc" : "asc")
    else { setSortKey(key); setSortDir("desc") }
  }

  const filtered = useMemo(() => {
    return rows
      .filter(r => {
        const matchSearch =
          r.service.toLowerCase().includes(search.toLowerCase()) ||
          r.path.toLowerCase().includes(search.toLowerCase())
        const matchFilter =
          filter === "all"  ? true :
          filter === "2xx"  ? r.status < 300 :
          filter === "4xx"  ? r.status >= 400 && r.status < 500 :
          r.status >= 500
        return matchSearch && matchFilter
      })
      .sort((a, b) => {
        let va: string | number = a[sortKey]
        let vb: string | number = b[sortKey]
        if (typeof va === "string") va = va.toLowerCase()
        if (typeof vb === "string") vb = vb.toLowerCase()
        const cmp = va < vb ? -1 : va > vb ? 1 : 0
        return sortDir === "asc" ? cmp : -cmp
      })
  }, [rows, search, filter, sortKey, sortDir])

  const SortBtn = ({ col }: { col: SortKey }) => (
    <button onClick={() => toggleSort(col)} className="ml-1 opacity-40 hover:opacity-100 transition-opacity">
      <ArrowUpDown size={10} />
    </button>
  )

  const filterBtns: { key: typeof filter; label: string }[] = [
    { key: "all", label: "All"  },
    { key: "2xx", label: "2xx"  },
    { key: "4xx", label: "4xx"  },
    { key: "5xx", label: "5xx"  },
  ]

  return (
    <div className="flex flex-col">
      {/* ── Toolbar ── */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border/40">
        {/* Search */}
        <div className="relative flex-1 max-w-xs">
          <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter by service or path..."
            className="
              w-full h-8 pl-8 pr-3 rounded-md text-xs font-mono
              bg-zinc-900 border border-border text-foreground
              placeholder:text-muted-foreground
              focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50
              transition-colors
            "
          />
        </div>

        {/* Status filter pills */}
        <div className="flex items-center gap-1 p-1 rounded-lg bg-zinc-900 border border-border">
          {filterBtns.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`
                px-2.5 py-1 rounded-md font-mono text-[10px] tracking-wider uppercase transition-all
                ${filter === key
                  ? "bg-blue-600 text-white shadow-[0_0_8px_rgba(59,130,246,0.3)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }
              `}
            >
              {label}
            </button>
          ))}
        </div>

        <span className="font-mono text-[10px] text-muted-foreground ml-auto">
          {filtered.length} results
        </span>
      </div>

      {/* ── Table ── */}
      <div className="overflow-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border/60">
              {[
                { label: "Time",    col: "timestamp" as SortKey },
                { label: "Service", col: "service"   as SortKey },
                { label: "Method",  col: null },
                { label: "Path",    col: null },
                { label: "Status",  col: "status"  as SortKey },
                { label: "Latency", col: "latency" as SortKey },
                { label: "Cost",    col: "cost"    as SortKey },
              ].map(({ label, col }) => (
                <th key={label} className="text-left py-3 px-4 font-mono text-[10px] tracking-[0.18em] uppercase text-muted-foreground font-normal whitespace-nowrap">
                  {label}{col && <SortBtn col={col} />}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center font-mono text-sm text-muted-foreground">
                  No matching requests
                </td>
              </tr>
            ) : filtered.map((row) => (
              <tr key={row.id} className="border-b border-border/20 hover:bg-white/[0.02] transition-colors">
                <td className="py-3 px-4 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                  {fmtTime(row.timestamp)}
                </td>
                <td className="py-3 px-4">
                  <span className="font-display text-xs capitalize text-foreground">{row.service}</span>
                </td>
                <td className="py-3 px-4">
                  <MethodBadge method={row.method} />
                </td>
                <td className="py-3 px-4 max-w-[200px]">
                  <span className="font-mono text-[11px] text-zinc-400 truncate block">{row.path}</span>
                </td>
                <td className="py-3 px-4">
                  <StatusBadge status={row.status} />
                </td>
                <td className="py-3 px-4">
                  <span className={`font-mono text-xs ${row.latency > 100 ? "text-amber-400" : "text-foreground"}`}>
                    {row.latency}ms
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="font-mono text-xs text-amber-400">
                    ${row.cost.toFixed(6)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}