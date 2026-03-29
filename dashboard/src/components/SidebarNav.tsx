"use client"
// components/SidebarNav.tsx
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { ThemeIconToggle } from "@/components/ThemeToggle"
import {
  LayoutDashboard,
  Layers,
  ShieldAlert,
  Settings,
  Activity,
  Hexagon,
} from "lucide-react"

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/services",  icon: Layers,          label: "Services"  },
  { href: "/anomalies", icon: ShieldAlert,      label: "Anomalies", badge: true },
  { href: "/activity",  icon: Activity,         label: "Activity"  },
  { href: "/settings",  icon: Settings,         label: "Settings"  },
]

export default function SidebarNav() {
  const pathname = usePathname()

  return (
    <TooltipProvider delayDuration={100}>
      <aside className="
        flex flex-col w-[60px] h-screen
        bg-card border-r border-border
        py-4 items-center gap-1
        shrink-0
      ">
        {/* Logo */}
        <div className="mb-3 flex flex-col items-center">
          <Hexagon
            className="text-blue-500 glow-blue"
            size={28}
            strokeWidth={1.5}
            fill="rgba(59,130,246,0.1)"
          />
        </div>

        <Separator className="w-8 mb-2" />

        {/* Nav links */}
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map(({ href, icon: Icon, label, badge }) => {
            const active = pathname?.startsWith(href)
            return (
              <Tooltip key={href}>
                <TooltipTrigger asChild>
                  <Link
                    href={href}
                    className={cn(
                      "relative flex items-center justify-center w-10 h-10 rounded-md transition-all duration-150",
                      active
                        ? "bg-blue-500/10 text-blue-400 border border-blue-500/30 shadow-[0_0_12px_rgba(59,130,246,0.15)]"
                        : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                    )}
                  >
                    <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                    {badge && (
                      <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-red-500 animate-live" />
                    )}
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-mono text-xs tracking-widest uppercase bg-zinc-900 text-zinc-100 border-zinc-700">
                  {label}
                </TooltipContent>
              </Tooltip>
            )
          })}
        </nav>

        {/* Bottom status */}
        <Separator className="w-8 mt-2 mb-3" />
        <Tooltip>
          <TooltipTrigger asChild>
            <ThemeIconToggle />
          </TooltipTrigger>
          <TooltipContent side="right" className="font-mono text-xs bg-zinc-900 text-zinc-100 border-zinc-700">Toggle theme</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className="flex flex-col items-center gap-1 cursor-default">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-live" />
            </div>
          </TooltipTrigger>
          <TooltipContent side="right" className="font-mono text-xs bg-zinc-900 text-zinc-100 border-zinc-700">
            Proxy Online
          </TooltipContent>
        </Tooltip>
      </aside>
    </TooltipProvider>
  )
}