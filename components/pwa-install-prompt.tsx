"use client"

import { useState, useEffect } from "react"
import { X, Download } from "lucide-react"

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

export function PwaInstallPrompt() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallEvent(e as BeforeInstallPromptEvent)
    }
    window.addEventListener("beforeinstallprompt", handler)
    // Si ya está instalada, no mostrar
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setDismissed(true)
    }
    return () => window.removeEventListener("beforeinstallprompt", handler)
  }, [])

  if (!installEvent || dismissed) return null

  const handleInstall = async () => {
    await installEvent.prompt()
    const { outcome } = await installEvent.userChoice
    if (outcome === "accepted") setDismissed(true)
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-sm rounded-xl border border-border bg-white p-4 shadow-lg md:left-auto md:right-4 md:max-w-xs">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#1A3328] text-sm font-bold text-white">
          P
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-[#1A3328]">
            Instalar PermisoHub
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Accede rápido desde tu móvil
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="shrink-0 text-muted-foreground hover:text-foreground"
          aria-label="Cerrar"
        >
          <X className="size-4" />
        </button>
      </div>
      <button
        onClick={handleInstall}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-[#1A3328] px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-[#1A3328]/90"
      >
        <Download className="size-4" />
        Instalar app
      </button>
    </div>
  )
}
