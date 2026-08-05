"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Users } from "lucide-react"
import type { ConsumoEstimadoResultado } from "@/lib/consumo-macro-zona"
import type { PoblacionCensoResultado } from "@/lib/censo-manzana-server"
import { KpiCard } from "@/components/mercado-inmobiliario/charts/kpi-card"
import { RankingBarChart } from "@/components/mercado-inmobiliario/charts/ranking-bar-chart"

// ---------------------------------------------------------------------------
// Conecta a la UI (04-08) las dos funciones de demografía/consumo de la
// Fase 17 (obtenerPoblacionEnPoligono, obtenerConsumoEstimado) — terminadas
// y probadas desde el 03-08 pero sin ningún caller hasta ahora, porque el
// plan original (17-03) las iba a mostrar dentro del tab "Cabida Comercial",
// gateado por la isócrona real de la Fase 16 (bloqueada por el 403 de
// ORS/HeiGIT, pausada por decisión del usuario). Acá se usa un radio fijo
// de 1km en vez de esperar esa isócrona — SIEMPRE declarado como tal, nunca
// presentado con la precisión de una ruta de caminata/manejo real.
//
// Reusa las piezas de "Tema Consultora" (KpiCard, RankingBarChart) en vez de
// texto plano — verificado=true en los KpiCard porque son datos reales
// (Censo/CASEN transcritos), no estimaciones del modelo.
// ---------------------------------------------------------------------------

/** Metadatos de la isócrona sin la geometría — la API la omite a propósito. */
interface IsocronaMeta {
  metodo: "red_vial" | "circulo_equivalente"
  modo: "caminando" | "auto"
  minutos: number
  proveedor: string | null
}

interface DemografiaConsumoResponse {
  ok: boolean
  consumo: ConsumoEstimadoResultado
  poblacion: PoblacionCensoResultado | null
  isocrona: IsocronaMeta | null
}

const NUM = new Intl.NumberFormat("es-CL")
const PCT = new Intl.NumberFormat("es-CL", { style: "percent", maximumFractionDigits: 1 })

// Nombres largos de categoría EPF (ej. "Vivienda, agua, electricidad, gas y
// combustibles") no caben en el eje Y del ranking — se abrevian solo para el
// gráfico, el nombre completo sigue disponible en el texto de abajo.
function etiquetaCorta(nombre: string): string {
  if (nombre.length <= 16) return nombre
  return nombre.split(",")[0].split(" y ")[0]
}

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

  const { consumo, poblacion, isocrona } = data
  const categoriasConDato = consumo.categorias.filter((c) => c.participacionPct !== null)
  const esRedVial = isocrona?.metodo === "red_vial"
  const modoLabel = isocrona?.modo === "auto" ? "en auto" : "caminando"

  return (
    <div className="space-y-4">
      {poblacion && isocrona && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
            <Users className="size-3.5" /> Población a {isocrona.minutos} min {modoLabel}
          </p>
          {poblacion.ok ? (
            <div className="grid grid-cols-2 gap-2">
              <KpiCard
                label="Personas"
                valor={NUM.format(poblacion.totalPersonas)}
                verificado
                contexto={`${poblacion.manzanasIntersectadas} manzana(s), Censo ${poblacion.censoAno}`}
              />
              <KpiCard
                label="Viviendas"
                valor={NUM.format(poblacion.totalViviendas)}
                verificado
                contexto={poblacion.fuente}
              />
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No se pudo consultar el censo para este punto.</p>
          )}
          {esRedVial ? (
            <p className="mt-2 text-[10px] leading-snug text-muted-foreground">
              Isócrona real de red vial ({isocrona.minutos} min {modoLabel}, vía {isocrona.proveedor}) — el área sigue
              las calles efectivamente transitables, no un radio en línea recta.
            </p>
          ) : (
            <p className="mt-2 flex items-start gap-1 text-[10px] leading-snug text-muted-foreground">
              <AlertTriangle className="mt-0.5 size-2.5 shrink-0" />
              No se pudo calcular la isócrona real: se usó un círculo equivalente en línea recta, que sobreestima el
              área alcanzable porque ninguna red vial permite avanzar en todas las direcciones. Trátalo como una
              aproximación gruesa.
            </p>
          )}
        </div>
      )}

      <div>
        <p className="mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">Consumo estimado del sector</p>

        {consumo.tasaPobrezaComunal !== null ? (
          <KpiCard
            label="Tasa de pobreza comunal"
            valor={PCT.format(consumo.tasaPobrezaComunal / 100)}
            verificado
            contexto={`CASEN ${consumo.casenAno} SAE`}
          />
        ) : (
          <p className="text-xs text-muted-foreground">Sin dato CASEN transcrito para esta comuna todavía.</p>
        )}

        {categoriasConDato.length > 0 && (
          <RankingBarChart
            titulo={`Participación en gasto de hogar — IX EPF ${consumo.epfAno}`}
            items={categoriasConDato.map((c) => ({
              label: etiquetaCorta(c.nombre),
              valor: (c.participacionPct as number) * 100,
            }))}
            formatValor={(n) => `${n.toFixed(1)}%`}
            className="mt-2"
          />
        )}

        {consumo.categoriasPendientes.length > 0 && (
          <p className="mt-2 text-[10px] text-muted-foreground">
            Sin dato disponible todavía: {consumo.categoriasPendientes.join(", ")}.
          </p>
        )}
        <p className="mt-1 text-[10px] leading-snug text-muted-foreground">{consumo.disclosure}</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">{consumo.fuente}</p>
      </div>
    </div>
  )
}
