"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

interface ChecklistItem {
  label: string
  href: string
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  { label: "Completa tu perfil de arquitecta", href: "/onboarding" },
  { label: "Crea tu primer proyecto", href: "/proyectos/nuevo" },
  { label: "Prueba el Chat OGUC", href: "/herramientas/oguc-chat" },
  { label: "Configura WhatsApp", href: "/configuracion/whatsapp" },
]

export function SetupChecklist() {
  const [done, setDone] = useState<boolean | null>(null)

  useEffect(() => {
    try {
      setDone(
        window.localStorage.getItem("permisohub_onboarding_done") === "true",
      )
    } catch {
      setDone(false)
    }
  }, [])

  if (done === null || done) {
    return null
  }

  const completados = 0
  const total = CHECKLIST_ITEMS.length

  return (
    <div className="mb-8 rounded-xl border border-border border-l-4 border-l-primary/50 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-primary">
          Completa tu configuración
        </h2>
        <span className="text-xs font-medium text-muted-foreground">
          {completados}/{total}
        </span>
      </div>

      <ul className="mt-3 space-y-1">
        {CHECKLIST_ITEMS.map((item, index) => {
          const isDone = index < completados
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-background"
              >
                <div
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                    isDone
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-white",
                  )}
                >
                  {isDone && <Check className="size-3.5" />}
                </div>
                <span
                  className={cn(
                    "flex-1 text-sm",
                    isDone
                      ? "text-muted-foreground line-through"
                      : "text-foreground",
                  )}
                >
                  {item.label}
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
