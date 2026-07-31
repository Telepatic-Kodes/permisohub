"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { EstadoNormativo, type Veredicto } from "@/components/arch/estado"

interface UsoCompatibleCheckProps {
  proyectoId: string
}

type CompatEstado = "permitido" | "no_permitido" | "no_especificado"

const COMPAT_LABEL: Record<CompatEstado, string> = {
  permitido: "Permitido",
  no_permitido: "No permitido",
  no_especificado: "No especificado (requiere revisión)",
}
const COMPAT_TO_VEREDICTO: Record<CompatEstado, Veredicto> = {
  permitido: "cumple",
  no_permitido: "rechaza",
  no_especificado: "observa",
}

export function UsoCompatibleCheck({ proyectoId }: UsoCompatibleCheckProps) {
  const [uso, setUso] = useState("")
  const [loading, setLoading] = useState(false)
  const [resultado, setResultado] = useState<{ estado: CompatEstado; justificacion: string } | null>(null)

  async function handleVerificar() {
    if (!uso.trim()) return
    setLoading(true)
    setResultado(null)
    try {
      const res = await fetch(`/api/proyectos/${proyectoId}/compatibilidad`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usoPretendido: uso.trim() }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error ?? "No se pudo verificar la compatibilidad")
        return
      }
      setResultado({ estado: data.estado, justificacion: data.justificacion })
    } catch {
      toast.error("No se pudo verificar la compatibilidad")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2 border-t border-dashed border-border/60 pt-3">
      <p className="text-xs font-medium text-primary">Compatibilidad de uso</p>
      <div className="flex gap-2">
        <Input
          value={uso}
          onChange={(e) => setUso(e.target.value)}
          placeholder="Uso pretendido (ej: veterinaria)"
          className="h-8 text-xs"
        />
        <Button
          size="sm"
          className="h-8 shrink-0 text-xs"
          disabled={!uso.trim() || loading}
          onClick={() => void handleVerificar()}
        >
          {loading ? "Verificando…" : "Verificar compatibilidad"}
        </Button>
      </div>
      {resultado && (
        <div className="space-y-1">
          <EstadoNormativo estado={COMPAT_TO_VEREDICTO[resultado.estado]} label={COMPAT_LABEL[resultado.estado]} />
          <p className="text-[11px] text-muted-foreground">{resultado.justificacion}</p>
        </div>
      )}
    </div>
  )
}
