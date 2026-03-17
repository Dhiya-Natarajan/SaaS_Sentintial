import type { Metadata } from "next"
import { DM_Sans, IBM_Plex_Mono } from "next/font/google"
import "./globals.css"
import SidebarNav from "@/components/SidebarNav"

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["300", "400", "500", "600", "700"],
})

const ibmMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
})

export const metadata: Metadata = {
  title: "SaaS Sentinel",
  description: "API Cost Intelligence & Anomaly Detection",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${dmSans.variable} ${ibmMono.variable}`}>
      <body className="flex h-screen overflow-hidden bg-background">
        <SidebarNav />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  )
}