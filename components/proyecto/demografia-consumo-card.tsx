"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Users } from "lucide-react"
import type { ConsumoEstimadoResultado } from "@/lib/consumo-macro-zona"
import type { PoblacionCensoResultado } from "@/lib/censo-manzana-server"

// ---------------------------------------------------------------------------
// Conecta a la UI (04-08) las dos funciones de demografía/consumo de la
// Fase 17 (obtenerPoblacionEnPoligono, obtenerConsumoEstimado) — terminadas
// y probadas desde el 03-08 pero sin ningún caller hasta ahora, porque el
// plan original (17-03) las iba a mostrar dentro del tab "Cabida Comercial",
// gateado por la isócrona real de la Fase 16 (bloqueada por el 403 de
// ORS/HeiGIT, pausada por decisión del usuario). Acá se usa un radio fijo
// de 1km en vez de esperar esa isócrona — SIEMPRE declarado como tal, nunca
// presentado con la precisión de una ruta de caminata/manejo real.
// ---------------------------------------------------------------------------

interface DemografiaConsumoResponse {
  ok: boolean
  consumo: ConsumoEstimadoResultado
  poblacion: PoblacionCensoResultado | null
  radioMetros: number | null
}

const NUM = new Intl.NumberFormat("es-CL")
const PCT = new Intl.NumberFormat("es-CL", { style: "percent", maximumFractionDigits: 1 })

export function DemografiaConsumoCard({ comuna, lat, lng }: { comuna: string; lat?: number | null; lng?: number | null }) {
  const [data, setData] = useState<DemografiaConsumoResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    const params = new URLSearchParams({ comuna })
    if (lat != null && lng != null) {
      params.set("lat", String(lat))
      params.set("lng", String(lng))
    }
    fetch(`/api/demografia-consumo?${params.toString()}`)
      .then((r) => r.json())
      .then((d: DemografiaConsumoResponse) => { if (!cancelled) setData(d.ok ? d : null) })
      .catch(() => { if (!cancelled) setData(null) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [comuna, lat, lng])

  if (loading) {
    return <p className="text-xs text-muted-foreground">Cargando demografía y consumo…</p>
  }
  if (!data) {
    return null // best-effort, igual que otros bloques opcionales de este tipo de página
  }

  const { consumo, poblacion, radioMetros } = data
  const categoriasConDato = consumo.categorias.filter((c) => c.participacionPct !== null)

  return (
    <div className="space-y-3">
      {poblacion && (
        <div>
          <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Users className="size-3.5" /> Población en {NUM.format(radioMetros ?? 0)} m a la redonda
          </p>
          {poblacion.ok ? (
            <>
              <p className="mt-0.5 text-sm">
                <span className="num font-semibold text-primary">{NUM.format(poblacion.totalPersonas)}</span> personas ·{" "}
                <span className="num font-semibold text-primary">{NUM.format(poblacion.totalViviendas)}</span> viviendas
              </p>
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                {poblacion.manzanasIntersectadas} manzana(s), Censo {poblacion.censoAno} — {poblacion.fuente}
              </p>
            </>
          ) : (
            <p className="mt-0.5 text-xs text-muted-foreground">No se pudo consultar el censo para este punto.</p>
          )}
          <p className="mt-1 flex items-start gap-1 text-[10px] leading-snug text-muted-foreground">
            <AlertTriangle className="mt-0.5 size-2.5 shrink-0" />
            Radio fijo de {NUM.format(radioMetros ?? 0)} m en línea recta — no una ruta de caminata o manejo real
            (esa función depende de un proveedor de isócronas hoy pausado). Trátalo como una aproximación gruesa.
          </p>
        </div>
      )}

      <div>
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Consumo estimado del sector</p>
        {consumo.tasaPobrezaComunal !== null ? (
          <p className="mt-0.5 text-sm">
            Tasa de pobreza comunal: <span className="num font-semibold text-primary">{PCT.format(consumo.tasaPobrezaComunal / 100)}</span>
            <span className="ml-1 text-[10px] text-muted-foreground">(CASEN {consumo.casenAno})</span>
          </p>
        ) : (
          <p className="mt-0.5 text-xs text-muted-foreground">Sin dato CASEN transcrito para esta comuna todavía.</p>
        )}
        {categoriasConDato.length > 0 && (
          <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
            {categoriasConDato.map((c) => (
              <li key={c.nombre} className="flex items-center justify-between gap-2">
                <span>{c.nombre}</span>
                <span className="num">{PCT.format((c.participacionPct as number))}</span>
              </li>
            ))}
          </ul>
        )}
        {consumo.categoriasPendientes.length > 0 && (
          <p className="mt-1 text-[10px] text-muted-foreground">
            Sin dato disponible todavía: {consumo.categoriasPendientes.join(', ')}.
          </p>
        )}
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{consumo.disclosure}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{consumo.fuente}</p>
      </div>
    </div>
  )
}
