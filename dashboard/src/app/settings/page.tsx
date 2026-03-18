"use client"
// app/settings/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { ThemeToggle } from "@/components/ThemeToggle"
import {
  Shield, Bell, Sliders, Server,
  AlertTriangle, Mail, Webhook, Palette,
} from "lucide-react"

// ── Reusable primitives ───────────────────────────────────────────────────────
function SettingsSection({
  title, description, icon: Icon, iconColor = "text-blue-400", children,
}: {
  title: string; description: string; icon: React.ElementType
  iconColor?: string; children: React.ReactNode
}) {
  return (
    <Card className="bg-card border border-border">
      <CardHeader className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-1.5 rounded-md bg-white/5 border border-border">
            <Icon size={14} className={iconColor} />
          </div>
          <CardTitle className="font-display text-base font-semibold tracking-tight">{title}</CardTitle>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground ml-9">{description}</p>
      </CardHeader>
      <Separator className="bg-border/50" />
      <CardContent className="px-6 py-5 flex flex-col gap-5">{children}</CardContent>
    </Card>
  )
}

function FieldRow({
  label, description, children,
}: {
  label: string; description?: string; children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-8">
      <div className="flex-1 min-w-0">
        <p className="font-mono text-xs text-foreground">{label}</p>
        {description && (
          <p className="font-mono text-[10px] text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}

function TextInput({
  defaultValue, placeholder, mono = true,
}: {
  defaultValue?: string; placeholder?: string; mono?: boolean
}) {
  return (
    <input
      defaultValue={defaultValue}
      placeholder={placeholder}
      className={`
        h-8 px-3 rounded-md text-xs bg-input border border-border
        text-foreground placeholder:text-muted-foreground
        focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50
        transition-colors w-56
        ${mono ? "font-mono" : "font-display"}
      `}
    />
  )
}

function NumberInput({
  defaultValue, min, max, unit,
}: {
  defaultValue?: number; min?: number; max?: number; unit?: string
}) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="number"
        defaultValue={defaultValue}
        min={min}
        max={max}
        className="
          h-8 px-3 rounded-md text-xs font-mono bg-input border border-border
          text-foreground placeholder:text-muted-foreground
          focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50
          transition-colors w-28
        "
      />
      {unit && <span className="font-mono text-[10px] text-muted-foreground">{unit}</span>}
    </div>
  )
}

function SelectInput({
  defaultValue, options,
}: {
  defaultValue?: string; options: { value: string; label: string }[]
}) {
  return (
    <select
      defaultValue={defaultValue}
      className="
        h-8 px-3 rounded-md text-xs font-mono bg-input border border-border
        text-foreground focus:outline-none focus:ring-1 focus:ring-blue-500/50
        focus:border-blue-500/50 transition-colors w-40
      "
    >
      {options.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  )
}

function Toggle({ defaultChecked = false }: { defaultChecked?: boolean }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer">
      <input type="checkbox" defaultChecked={defaultChecked} className="sr-only peer" />
      <div className="
        w-9 h-5 rounded-full bg-input border border-border
        peer-checked:bg-blue-600 peer-checked:border-blue-500
        after:content-[''] after:absolute after:top-[3px] after:left-[3px]
        after:w-3.5 after:h-3.5 after:rounded-full after:bg-white
        dark:after:bg-zinc-200
        after:transition-all peer-checked:after:translate-x-4
        transition-colors
      " />
    </label>
  )
}

function ServiceThresholdRow({
  service, color, defaultCost, defaultReq,
}: {
  service: string; color: string; defaultCost: number; defaultReq: number
}) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-border/30 last:border-b-0">
      <div className={`w-7 h-7 rounded-md flex items-center justify-center font-mono text-[10px] font-semibold border ${color}`}>
        {service.slice(0, 2).toUpperCase()}
      </div>
      <span className="font-display text-sm capitalize text-foreground flex-1">{service}</span>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">Cost limit</span>
        <NumberInput defaultValue={defaultCost} min={0} unit="$/day" />
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-muted-foreground">Req limit</span>
        <NumberInput defaultValue={defaultReq} min={0} unit="req/min" />
      </div>
      <SelectInput
        defaultValue="throttle"
        options={[
          { value: "throttle", label: "Throttle" },
          { value: "reroute",  label: "Reroute"  },
          { value: "block",    label: "Block"     },
        ]}
      />
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  return (
    <div className="min-h-screen px-8 py-8 flex flex-col gap-6">

      {/* ── Header ──────────────────────────────────────── */}
      <header className="flex items-end justify-between animate-in-up">
        <div>
          <p className="font-mono text-[10px] tracking-[0.25em] uppercase text-muted-foreground mb-1.5">
            API Cost Intelligence · Anomaly Detection
          </p>
          <h1 className="font-display text-[2rem] font-bold tracking-[-0.03em] text-foreground leading-none">
            SaaS Sentinel
            <span className="text-zinc-400 ml-2.5 font-light tracking-[-0.02em]">Settings</span>
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="font-mono text-[10px] tracking-widest uppercase gap-1.5 border-green-500/30 text-green-400 bg-green-500/5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-live inline-block" />
            Proxy Live
          </Badge>
        </div>
      </header>

      <Separator className="bg-border/60" />

      {/* ── Appearance ──────────────────────────────────── */}
      <SettingsSection
        title="Appearance"
        description="Customise the visual theme of the SaaS Sentinel interface"
        icon={Palette}
        iconColor="text-purple-400"
      >
        <FieldRow
          label="Theme"
          description="Choose between light, dark, or follow your system preference"
        >
          <ThemeToggle />
        </FieldRow>
      </SettingsSection>

            {/* ── Proxy Configuration ─────────────────────────── */}
      <SettingsSection
        title="Proxy Configuration"
        description="Core settings for the API proxy layer routing and interception"
        icon={Server}
        iconColor="text-blue-400"
      >
        <FieldRow label="Proxy Base URL" description="The base URL your applications route API calls through">
          <TextInput defaultValue="http://localhost:3001/proxy" />
        </FieldRow>
        <Separator className="bg-border/30" />
        <FieldRow label="Backend Analytics Port" description="Port on which the analytics service listens">
          <TextInput defaultValue="3001" />
        </FieldRow>
        <Separator className="bg-border/30" />
        <FieldRow label="Request Timeout" description="Maximum time before a proxied request is aborted">
          <NumberInput defaultValue={30} min={1} max={120} unit="seconds" />
        </FieldRow>
        <Separator className="bg-border/30" />
        <FieldRow label="Enable Request Logging" description="Log all proxied requests to the analytics store">
          <Toggle defaultChecked={true} />
        </FieldRow>
        <Separator className="bg-border/30" />
        <FieldRow label="Enable Cost Tracking" description="Calculate and record per-request cost estimates">
          <Toggle defaultChecked={true} />
        </FieldRow>
      </SettingsSection>

      {/* ── Anomaly Detection ───────────────────────────── */}
      <SettingsSection
        title="Anomaly Detection"
        description="Configure thresholds and sensitivity for anomaly flagging"
        icon={Shield}
        iconColor="text-red-400"
      >
        <FieldRow label="Detection Sensitivity" description="How aggressively the system flags unusual patterns">
          <SelectInput
            defaultValue="medium"
            options={[
              { value: "low",    label: "Low"    },
              { value: "medium", label: "Medium" },
              { value: "high",   label: "High"   },
            ]}
          />
        </FieldRow>
        <Separator className="bg-border/30" />
        <FieldRow label="Cost Spike Threshold" description="Flag if cost exceeds this multiple of the rolling average">
          <NumberInput defaultValue={3} min={1} max={20} unit="× baseline" />
        </FieldRow>
        <Separator className="bg-border/30" />
        <FieldRow label="Request Rate Threshold" description="Flag if requests per minute exceed this value">
          <NumberInput defaultValue={100} min={1} unit="req/min" />
        </FieldRow>
        <Separator className="bg-border/30" />
        <FieldRow label="Anomaly Window" description="Rolling window used to calculate baseline averages">
          <SelectInput
            defaultValue="24h"
            options={[
              { value: "1h",  label: "1 Hour"   },
              { value: "6h",  label: "6 Hours"  },
              { value: "24h", label: "24 Hours" },
              { value: "7d",  label: "7 Days"   },
            ]}
          />
        </FieldRow>
        <Separator className="bg-border/30" />
        <FieldRow label="Auto-Reroute on Anomaly" description="Automatically reroute requests when an anomaly is detected">
          <Toggle defaultChecked={true} />
        </FieldRow>
        <Separator className="bg-border/30" />
        <FieldRow label="Auto-Block Critical Anomalies" description="Block all requests from a service flagged as critical">
          <Toggle defaultChecked={false} />
        </FieldRow>
      </SettingsSection>

      {/* ── Per-Service Thresholds ──────────────────────── */}
      <SettingsSection
        title="Per-Service Thresholds"
        description="Set individual cost and rate limits per integrated service"
        icon={Sliders}
        iconColor="text-amber-400"
      >
        <div className="flex items-center gap-3 mb-1">
          <AlertTriangle size={12} className="text-amber-400" />
          <p className="font-mono text-[10px] text-amber-400/80">
            Enforcement action applies when either limit is exceeded
          </p>
        </div>
        <ServiceThresholdRow service="openai"    color="text-blue-400 bg-blue-500/10 border-blue-500/20"     defaultCost={5}   defaultReq={50}  />
        <ServiceThresholdRow service="anthropic" color="text-purple-400 bg-purple-500/10 border-purple-500/20" defaultCost={3}   defaultReq={30}  />
        <ServiceThresholdRow service="stripe"    color="text-green-400 bg-green-500/10 border-green-500/20"   defaultCost={1}   defaultReq={20}  />
      </SettingsSection>

      {/* ── Notifications ───────────────────────────────── */}
      <SettingsSection
        title="Notifications"
        description="Configure alerting channels for anomaly events"
        icon={Bell}
        iconColor="text-purple-400"
      >
        <FieldRow label="Email Alerts" description="Send email when a high or critical anomaly is detected">
          <div className="flex items-center gap-3">
            <Toggle defaultChecked={false} />
            <Mail size={14} className="text-muted-foreground" />
          </div>
        </FieldRow>
        <Separator className="bg-border/30" />
        <FieldRow label="Alert Email Address" description="Recipient for anomaly notification emails">
          <TextInput placeholder="ops@yourcompany.com" mono={false} />
        </FieldRow>
        <Separator className="bg-border/30" />
        <FieldRow label="Webhook Alerts" description="POST anomaly payloads to an external endpoint">
          <div className="flex items-center gap-3">
            <Toggle defaultChecked={false} />
            <Webhook size={14} className="text-muted-foreground" />
          </div>
        </FieldRow>
        <Separator className="bg-border/30" />
        <FieldRow label="Webhook URL" description="Endpoint to receive anomaly event payloads">
          <TextInput placeholder="https://hooks.yourapp.com/..." />
        </FieldRow>
        <Separator className="bg-border/30" />
        <FieldRow label="Minimum Severity" description="Only alert for anomalies at or above this severity">
          <SelectInput
            defaultValue="high"
            options={[
              { value: "low",      label: "Low+"      },
              { value: "medium",   label: "Medium+"   },
              { value: "high",     label: "High+"     },
              { value: "critical", label: "Critical"  },
            ]}
          />
        </FieldRow>
      </SettingsSection>

      {/* ── Save bar ────────────────────────────────────── */}
      <div className="flex items-center justify-between py-4 px-6 bg-card border border-border rounded-lg animate-in-up">
        <p className="font-mono text-[11px] text-muted-foreground">
          Changes are applied immediately to the proxy layer
        </p>
        <div className="flex items-center gap-3">
          <button className="
            h-8 px-4 rounded-md font-mono text-xs text-muted-foreground
            border border-border hover:bg-muted transition-colors
          ">
            Reset defaults
          </button>
          <button className="
            h-8 px-4 rounded-md font-mono text-xs font-semibold
            bg-blue-600 hover:bg-blue-500 text-white border border-blue-500
            transition-colors shadow-[0_0_12px_rgba(59,130,246,0.25)]
          ">
            Save settings
          </button>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer className="flex items-center justify-between pt-2">
        <p className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
          SaaS Sentinel · All API traffic routed &amp; monitored
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">v0.1.0</p>
      </footer>
    </div>
  )
}