"use client"

import { useSyncExternalStore } from "react"
import { useTheme } from "next-themes"
import { Sun, Moon, Monitor } from "lucide-react"

type ThemeOption = "light" | "dark" | "system"

const options: { value: ThemeOption; icon: React.ElementType; label: string }[] = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "dark", icon: Moon, label: "Dark" },
  { value: "system", icon: Monitor, label: "System" },
]

function subscribe() {
  return () => {}
}

function getClientSnapshot() {
  return true
}

function getServerSnapshot() {
  return false
}

function useHasMounted() {
  return useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot)
}

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const mounted = useHasMounted()

  if (!mounted) {
    return <div className="h-9 w-52 rounded-lg bg-zinc-800/60 border border-border animate-pulse" />
  }

  return (
    <div className="flex items-center gap-1 p-1 rounded-lg bg-muted border border-border">
      {options.map(({ value, icon: Icon, label }) => {
        const active = theme === value

        return (
          <button
            key={value}
            onClick={() => setTheme(value)}
            className={`relative flex items-center gap-1.5 rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-wider transition-all duration-200 ${
              active
                ? "bg-blue-600 text-white shadow-[0_0_10px_rgba(59,130,246,0.3)]"
                : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
            }`}
          >
            <Icon size={12} />
            {label}
          </button>
        )
      })}
    </div>
  )
}

export function ThemeIconToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useHasMounted()

  if (!mounted) {
    return <div className="w-10 h-10 rounded-md bg-zinc-800 animate-pulse" />
  }

  const isDark = resolvedTheme === "dark"

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className="flex h-10 w-10 items-center justify-center rounded-md text-zinc-500 transition-all duration-150 hover:bg-white/5 hover:text-zinc-200"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
    </button>
  )
}
