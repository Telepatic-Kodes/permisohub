"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Check, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Items del checklist de setup
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------

export function SetupChecklist() {
  // `null` = aún no leímos localStorage (evita parpadeo / mismatch SSR).
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

  // No renderizar nada hasta saber el estado, ni si ya completó el onboarding.
  if (done === null || done) {
    return null
  }

  // En el MVP los items no tienen seguimiento individual de completado.
  const completados = 0
  const total = CHECKLIST_ITEMS.length

  return (
    <div className="rounded-xl border-2 border-[#1A3328]/30 bg-white p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-[#1A3328]">
          Completa tu configuración
        </h2>
        <span className="text-sm font-medium text-muted-foreground">
          {completados}/{total}
        </span>
      </div>

      <ul className="mt-4 space-y-2">
        {CHECKLIST_ITEMS.map((item, index) => {
          const isDone = index < completados
          return (
            <li key={item.label}>
              <Link
                href={item.href}
                className="group flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-[#F9F7F3]"
              >
                <div
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                    isDone
                      ? "border-[#1A3328] bg-[#1A3328] text-[#F9F7F3]"
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
                      : "text-[#1A3328]",
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
