"use client"

import { useState } from "react"
import { Bell, Send, Clock, Loader2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

interface NotificacionResult {
  ok: boolean
  enviados: number
  sin_email: number
  errors?: string[]
  simulated?: boolean
}

export function NotificacionesDialog({ cadenaId }: { cadenaId: string }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<NotificacionResult | null>(null)

  async function handleEnviarAhora() {
    setLoading(true)
    setResult(null)
    try {
      const res = await fetch(`/api/cadenas/${cadenaId}/notificaciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "inmediata" }),
      })
      const data = (await res.json()) as NotificacionResult
      setResult(data)
    } catch {
      setResult({ ok: false, enviados: 0, sin_email: 0, errors: ["Error de red"] })
    } finally {
      setLoading(false)
    }
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      setResult(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button size="sm" variant="outline" />}>
        <Bell className="size-4 mr-1.5" />
        Notificaciones
      </DialogTrigger>

      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notificaciones a tenants</DialogTitle>
        </DialogHeader>

        <div className="flex flex-col gap-5">
          {/* Section 1 — Envío inmediato */}
          <div className="flex flex-col gap-3">
            <div>
              <p className="text-sm font-medium mb-1">Envío inmediato</p>
              <p className="text-sm text-muted-foreground">
                Envía un recordatorio por email a todos los tenants con permisos vencidos o
                próximos a vencer (90 días).
              </p>
            </div>

            <Button
              size="sm"
              onClick={handleEnviarAhora}
              disabled={loading}
              className="w-fit"
            >
              {loading ? (
                <Loader2 className="size-4 mr-1.5 animate-spin" />
              ) : (
                <Send className="size-4 mr-1.5" />
              )}
              {loading ? "Enviando..." : "Enviar ahora"}
            </Button>

            {result?.ok && (
              <div className="rounded-md bg-green-50 border border-green-200 px-3 py-2 text-sm text-green-800 flex items-center gap-1.5">
                <span>
                  ✓ {result.enviados} email{result.enviados !== 1 ? "s" : ""} enviado
                  {result.enviados !== 1 ? "s" : ""} · {result.sin_email} sin email
                  {result.simulated ? " (simulado)" : ""}
                </span>
              </div>
            )}

            {result && !result.ok && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
                Error al enviar notificaciones.
                {result.errors && result.errors.length > 0 && (
                  <ul className="mt-1 list-disc list-inside">
                    {result.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>

          <hr className="border-border" />

          {/* Section 2 — Recordatorios automáticos (visual only) */}
          <div className="flex flex-col gap-3 pointer-events-none select-none">
            <div className="flex items-center gap-2">
              <p className="text-sm font-medium text-muted-foreground">
                Recordatorios automáticos
              </p>
              <Badge variant="secondary" className="text-xs">
                Próximamente
              </Badge>
            </div>

            <div className="flex flex-col gap-2">
              {(["60 días antes", "30 días antes", "7 días antes"] as const).map(
                (label) => (
                  <div key={label} className="flex items-center gap-2.5 opacity-50">
                    <Checkbox id={label} checked={false} disabled />
                    <Clock className="size-3.5 text-muted-foreground" />
                    <label
                      htmlFor={label}
                      className="text-sm text-muted-foreground cursor-default"
                    >
                      {label}
                    </label>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Cerrar</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
