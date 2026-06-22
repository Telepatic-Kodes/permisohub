"use client"

import { useCallback, useEffect, useState } from "react"
import { Sidebar } from "@/components/dashboard/sidebar"
import { CommandPalette } from "@/components/dashboard/command-palette"
import { cn } from "@/lib/utils"

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [collapsed, setCollapsed] = useState(false)

  // Persist sidebar state
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("ph_sidebar_collapsed")
      if (saved === "true") setCollapsed(true)
    } catch {
      // ignore
    }
  }, [])

  const handleToggle = useCallback(() => {
    setCollapsed((c) => {
      const next = !c
      try {
        window.localStorage.setItem("ph_sidebar_collapsed", String(next))
      } catch {
        // ignore
      }
      return next
    })
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <Sidebar
        collapsed={collapsed}
        onToggle={handleToggle}
      />

      <main
        className={cn(
          "flex min-h-screen flex-col overflow-auto transition-[padding-left] duration-200 ease-in-out bg-dot-grid",
          collapsed ? "pl-14" : "pl-60"
        )}
      >
        {children}
      </main>

      <CommandPalette />
    </div>
  )
}
