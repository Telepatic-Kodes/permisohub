"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { TrendingUp, Radar } from "lucide-react"

import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { REASON_LABEL, type obtenerOportunidadesMercadoLocales } from "@/lib/mercado-locales-server"
import type { SenalExpansionComuna } from "@/lib/cadenas-sucursales-server"
import type { TendenciaConstruccionComuna } from "@/lib/ine-permisos-server"
import { formatFechaCorta } from "@/lib/formato-fecha"

const MAX_SELECCION = 5

function formatUf(n: number): string {
  return n.toLocaleString("es-CL", { maximumFractionDigits: 2 })
}

interface SelectorComparacionProps {
  oportunidades: Awaited<ReturnType<typeof obtenerOportunidadesMercadoLocales>>
  senalesExpansion: Record<string, SenalExpansionComuna>
  tendenciasConstruccion: Record<string, TendenciaConstruccionComuna>
}

export function SelectorComparacion({ oportunidades, senalesExpansion, tendenciasConstruccion }: SelectorComparacionProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const router = useRouter()

  function toggle(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id)
      if (prev.length >= MAX_SELECCION) return prev
      return [...prev, id]
    })
  }

  return (
    <div className="space-y-3 pb-20">
      {oportunidades.map((o) => {
        const senal = senalesExpansion[o.comuna]
        const tendencia = tendenciasConstruccion[o.comuna]
        const checked = selectedIds.includes(o.id)
        const disabled = !checked && selectedIds.length >= MAX_SELECCION

        return (
          <div key={o.id} className="rounded-lg border border-line-fine bg-card p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                checked={checked}
                onCheckedChange={() => toggle(o.id)}
                disabled={disabled}
                className="mt-0.5"
              />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-3">
                  <a href={o.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline">
                    {o.titulo}
                  </a>
                  <span className="num shrink-0 text-sm font-semibold text-primary">{formatUf(o.precioUfNormalizado)} UF</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {o.comuna}
                  {o.superficieM2 ? ` · ${o.superficieM2} m²` : ""}
                  {o.precioUfM2Normalizado ? ` · ${formatUf(o.precioUfM2Normalizado)} UF/m²` : ""}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {o.reasonCodes.map((code) => (
                    <span key={code} className="rounded-[3px] border border-[var(--blueprint-soft)] bg-[var(--blueprint-soft)] px-2 py-0.5 text-[10px] text-[var(--blueprint)]">
                      {REASON_LABEL[code] ?? code}
                    </span>
                  ))}
                  {senal && (
                    <span className="inline-flex items-center gap-1 rounded-[3px] border border-modulo-mercado/20 bg-modulo-mercado-subtle px-2 py-0.5 text-[10px] text-modulo-mercado">
                      <Radar className="size-2.5" />
                      {senal.cadena} tiene sucursal en la comuna
                      {senal.fechaRegistro && formatFechaCorta(senal.fechaRegistro)
                        ? ` (registrada ${formatFechaCorta(senal.fechaRegistro)})`
                        : ""}
                    </span>
                  )}
                  {tendencia?.tendencia === "creciente" && (
                    <span className="inline-flex items-center gap-1 rounded-[3px] border border-modulo-mercado/20 bg-modulo-mercado-subtle px-2 py-0.5 text-[10px] text-modulo-mercado">
                      <TrendingUp className="size-2.5" />
                      Actividad constructiva histórica en alza (INE, {tendencia.variacionPct?.toFixed(0)}%)
                    </span>
                  )}
                </div>
                <div className="mt-2.5">
                  <Link
                    href={`/mercado-inmobiliario/oportunidades/${o.id}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Ver ficha completa →
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {selectedIds.length >= 2 && (
        <div className="fixed bottom-6 right-6 z-10">
          <Button
            className="rounded-lg shadow-lg"
            onClick={() => router.push(`/mercado-inmobiliario/oportunidades/comparar?ids=${selectedIds.join(",")}`)}
          >
            Comparar ({selectedIds.length})
          </Button>
        </div>
      )}
    </div>
  )
}
