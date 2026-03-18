"use client"
// components/ThemeToggle.tsx
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"
import { Sun, Moon, Monitor } from "lucide-react"

type ThemeOption = "light" | "dark" | "system"

const options: { value: ThemeOption; icon: React.ElementType; label: string }[] = [
  { value: "light",  icon: Sun,     label: "Light"  },
  { value: "dark",   icon: Moon,    label: "Dark"   },
  { value: "system", icon: Monitor, label: "System" },
]

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch
  useEffect(() => setMounted(true), [])
  if (!mounted) return (
    <div className="h-9 w-52 rounded-lg bg-zinc-800/60 border border-border animate-pulse" />
  )

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-muted border border-border">
      {options.map(({ value, icon: Icon, label }) => {
        const active = theme === value
        return (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={`
              relative flex items-center gap-1.5 px-3 py-1.5 rounded-md
              font-mono text-[11px] tracking-wider uppercase
              transition-all duration-200
              ${active
                ? "bg-blue-600 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
              }
            `}
          >
            <Icon size={12} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

// ── Compact icon-only toggle for the sidebar ──────────────────────────────────
export function ThemeIconToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="w-10 h-10 rounded-md bg-zinc-800 animate-pulse" />

  const isDark = resolvedTheme === "dark"

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="
        flex items-center justify-center w-10 h-10 rounded-md
        text-zinc-500 hover:text-zinc-200 hover:bg-white/5
        transition-all duration-150
      "
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark
        ? <Sun  size={16} strokeWidth={1.5} />
        : <Moon size={16} strokeWidth={1.5} />
      }
    </button>
  )
}