"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertCircle, CalendarClock, ChevronDown, ChevronRight, Loader2, Plus, Radar, ShieldAlert, TrendingDown, TrendingUp, Trash2 } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { TIPO_PROPIEDAD_LABEL, type OperacionMercadoLocal, type TipoPropiedadComercial } from "@/lib/scrapers/mercado-locales-common"
import { KpiCard } from "@/components/mercado-inmobiliario/charts/kpi-card"
import { DistribucionDonut } from "@/components/mercado-inmobiliario/charts/distribucion-donut"
import { DesviacionBar } from "@/components/mercado-inmobiliario/charts/desviacion-bar"
import { RankingBarChart } from "@/components/mercado-inmobiliario/charts/ranking-bar-chart"
import { calcularEstadoObligacion, type EstadoObligacion, type ObligacionRegulatoria } from "@/lib/obligaciones-regulatorias"

const TIPOS_PROPIEDAD: TipoPropiedadComercial[] = ["local_comercial", "oficina", "bodega", "industrial"]

const TIPO_PROPIEDAD_COLOR: Record<TipoPropiedadComercial, string> = {
  local_comercial: "var(--blueprint)",
  oficina: "color-mix(in oklch, var(--blueprint) 75%, var(--muted-foreground))",
  bodega: "color-mix(in oklch, var(--blueprint) 50%, var(--muted-foreground))",
  industrial: "color-mix(in oklch, var(--blueprint) 25%, var(--muted-foreground))",
}

interface Propiedad {
  id: string
  direccion: string
  comuna: string
  tipoPropiedad: TipoPropiedadComercial
  superficieM2: number | null
  operacion: OperacionMercadoLocal
  precioActualUf: number | null
  rolSii: string | null
  notas: string | null
  fechaVencimientoContrato: string | null
  tieneAscensor: boolean
  tieneGas: boolean
  siiDestino: string | null
  siiAvaluoFiscalUf: number | null
  siiConsultadoEl: string | null
  createdAt: string
}

interface ObligacionConEstado {
  obligacion: ObligacionRegulatoria
  fechaUltimoCumplimiento: string | null
  proximaFecha: string | null
  estado: EstadoObligacion
}

interface Comparacion {
  medianaUfM2: number | null
  muestraN: number
  usoFallback: boolean
  variacionPct: number | null
  veredicto: "bajo_mercado" | "a_mercado" | "sobre_mercado" | "sin_dato"
}

interface SenalExpansion {
  cadena: string
  fechaRegistro: string | null
}

interface TendenciaConstruccion {
  variacionPct: number | null
  tendencia: "creciente" | "estable" | "decreciente"
}

interface FilaPortafolio {
  propiedad: Propiedad
  comparacion: Comparacion
  senalExpansion: SenalExpansion | null
  tendenciaConstruccion: TendenciaConstruccion | null
  obligaciones: ObligacionConEstado[]
}

const ESTADO_OBLIGACION_CONFIG: Record<EstadoObligacion, { label: string; color: string }> = {
  vencido: { label: "Vencido", color: "var(--state-error, #dc2626)" },
  por_vencer: { label: "Por vencer", color: "var(--state-warn, #d97706)" },
  al_dia: { label: "Al día", color: "var(--state-ok, #16a34a)" },
  sin_registro: { label: "Sin registro", color: "var(--muted-foreground)" },
  verificar: { label: "Verificar con certificador", color: "var(--modulo-mercado)" },
}

const VEREDICTO_CONFIG: Record<Comparacion["veredicto"], { label: string; color: string }> = {
  bajo_mercado: { label: "Bajo mercado", color: "var(--state-warn, #d97706)" },
  a_mercado: { label: "A mercado", color: "var(--state-ok, #16a34a)" },
  sobre_mercado: { label: "Sobre mercado", color: "var(--blueprint)" },
  sin_dato: { label: "Sin dato suficiente para comparar", color: "var(--muted-foreground)" },
}

function formatUf(n: number): string {
  return n.toLocaleString("es-CL", { maximumFractionDigits: 2 })
}

function diasHasta(fechaIso: string): number {
  const hoy = new Date()
  hoy.setHours(0, 0, 0, 0)
  const fecha = new Date(`${fechaIso}T00:00:00`)
  return Math.round((fecha.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
}

function VencimientoBadge({ fecha }: { fecha: string }) {
  const dias = diasHasta(fecha)
  const fechaFormateada = new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Santiago" }).format(
    new Date(`${fecha}T00:00:00`)
  )

  let color = "var(--muted-foreground)"
  let texto = `Contrato vence ${fechaFormateada}`
  if (dias < 0) {
    color = "var(--state-error, #dc2626)"
    texto = `Contrato vencido (${fechaFormateada})`
  } else if (dias <= 60) {
    color = "var(--state-warn, #d97706)"
    texto = `Contrato vence en ${dias} días (${fechaFormateada})`
  }

  return (
    <span className="inline-flex items-center gap-1 rounded-[3px] border px-2 py-0.5 text-[10px] font-medium" style={{ color, borderColor: color }}>
      <CalendarClock className="size-2.5" />
      {texto}
    </span>
  )
}

function VeredictoMercado({ comparacion }: { comparacion: Comparacion }) {
  const cfg = VEREDICTO_CONFIG[comparacion.veredicto]
  return (
    <div className="flex items-center gap-2.5">
      <span
        className="inline-flex items-center gap-1.5 rounded-[3px] border px-2 py-0.5 text-[11px] font-medium"
        style={{ color: cfg.color, borderColor: cfg.color }}
      >
        <span className="size-1.5 rounded-full" style={{ background: cfg.color }} />
        {cfg.label}
      </span>
      {comparacion.veredicto !== "sin_dato" && comparacion.variacionPct !== null && (
        <>
          <DesviacionBar variacionPct={comparacion.variacionPct} color={cfg.color} />
          <span className="num text-xs text-muted-foreground">
            {comparacion.variacionPct >= 0 ? "+" : ""}
            {comparacion.variacionPct.toFixed(0)}% vs. mediana (N={comparacion.muestraN})
          </span>
        </>
      )}
    </div>
  )
}

interface ResumenPortafolio {
  total: number
  superficieTotalM2: number
  rentaMensualTotalUf: number
  bajoMercado: number
  aMercado: number
  sobreMercado: number
  contratosPorVencer: number
  contratosVencidos: number
  obligacionesVencidas: number
  obligacionesPorVencer: number
  porComuna: Record<string, number>
  porTipo: Record<TipoPropiedadComercial, number>
}

function calcularResumen(filas: FilaPortafolio[]): ResumenPortafolio {
  const resumen: ResumenPortafolio = {
    total: filas.length,
    superficieTotalM2: 0,
    rentaMensualTotalUf: 0,
    bajoMercado: 0,
    aMercado: 0,
    sobreMercado: 0,
    contratosPorVencer: 0,
    contratosVencidos: 0,
    obligacionesVencidas: 0,
    obligacionesPorVencer: 0,
    porComuna: {},
    porTipo: { local_comercial: 0, oficina: 0, bodega: 0, industrial: 0 },
  }

  for (const { propiedad, comparacion, obligaciones } of filas) {
    if (propiedad.superficieM2) resumen.superficieTotalM2 += propiedad.superficieM2
    if (propiedad.operacion === "arriendo" && propiedad.precioActualUf) resumen.rentaMensualTotalUf += propiedad.precioActualUf
    if (comparacion.veredicto === "bajo_mercado") resumen.bajoMercado++
    else if (comparacion.veredicto === "a_mercado") resumen.aMercado++
    else if (comparacion.veredicto === "sobre_mercado") resumen.sobreMercado++
    if (propiedad.fechaVencimientoContrato) {
      const dias = diasHasta(propiedad.fechaVencimientoContrato)
      if (dias < 0) resumen.contratosVencidos++
      else if (dias <= 60) resumen.contratosPorVencer++
    }
    for (const o of obligaciones) {
      if (o.estado === "vencido") resumen.obligacionesVencidas++
      else if (o.estado === "por_vencer") resumen.obligacionesPorVencer++
    }
    resumen.porComuna[propiedad.comuna] = (resumen.porComuna[propiedad.comuna] ?? 0) + 1
    resumen.porTipo[propiedad.tipoPropiedad] += 1
  }

  return resumen
}

function ResumenPortafolioStrip({ resumen }: { resumen: ResumenPortafolio }) {
  const contratosEnRiesgo = resumen.contratosVencidos + resumen.contratosPorVencer
  const obligacionesEnRiesgo = resumen.obligacionesVencidas + resumen.obligacionesPorVencer
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Propiedades" valor={String(resumen.total)} contexto={`${resumen.superficieTotalM2.toLocaleString("es-CL")} m² en total`} />
        <KpiCard label="Renta mensual" valor={`${formatUf(resumen.rentaMensualTotalUf)} UF`} contexto="solo activos arrendados" />
        <DistribucionDonut
          titulo="Vs. mercado"
          size={56}
          segmentos={[
            { label: "Bajo", valor: resumen.bajoMercado, color: "var(--state-warn, #d97706)" },
            { label: "A mercado", valor: resumen.aMercado, color: "var(--state-ok, #16a34a)" },
            { label: "Sobre", valor: resumen.sobreMercado, color: "var(--blueprint)" },
          ]}
        />
        <KpiCard
          label="Contratos en riesgo"
          valor={String(contratosEnRiesgo)}
          contexto={
            contratosEnRiesgo === 0
              ? "sin vencimientos próximos"
              : [
                  resumen.contratosVencidos > 0 ? `${resumen.contratosVencidos} vencidos` : null,
                  resumen.contratosPorVencer > 0 ? `${resumen.contratosPorVencer} por vencer (60d)` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
          }
        />
        <KpiCard
          label="Obligaciones regulatorias"
          valor={String(obligacionesEnRiesgo)}
          contexto={
            obligacionesEnRiesgo === 0
              ? "sin vencimientos regulatorios próximos"
              : [
                  resumen.obligacionesVencidas > 0 ? `${resumen.obligacionesVencidas} vencidas` : null,
                  resumen.obligacionesPorVencer > 0 ? `${resumen.obligacionesPorVencer} por vencer (30d)` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")
          }
        />
      </div>

      {resumen.total > 1 && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <RankingBarChart
            titulo="Exposición del portafolio por comuna"
            items={Object.entries(resumen.porComuna).map(([label, valor]) => ({ label, valor }))}
          />
          <DistribucionDonut
            titulo="Mezcla por tipo de propiedad"
            segmentos={(Object.keys(resumen.porTipo) as TipoPropiedadComercial[])
              .filter((t) => resumen.porTipo[t] > 0)
              .map((t) => ({ label: TIPO_PROPIEDAD_LABEL[t].singular, valor: resumen.porTipo[t], color: TIPO_PROPIEDAD_COLOR[t] }))}
          />
        </div>
      )}
    </div>
  )
}

function ObligacionesToggle({ obligaciones, expandido, onToggle }: { obligaciones: ObligacionConEstado[]; expandido: boolean; onToggle: () => void }) {
  const vencidas = obligaciones.filter((o) => o.estado === "vencido").length
  const porVencer = obligaciones.filter((o) => o.estado === "por_vencer").length
  const color = vencidas > 0 ? "var(--state-error, #dc2626)" : porVencer > 0 ? "var(--state-warn, #d97706)" : "var(--muted-foreground)"

  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-1 rounded-[3px] border px-2 py-0.5 text-[10px] font-medium transition-colors hover:bg-muted/50"
      style={{ color, borderColor: color }}
    >
      {expandido ? <ChevronDown className="size-2.5" /> : <ChevronRight className="size-2.5" />}
      <ShieldAlert className="size-2.5" />
      {vencidas > 0 || porVencer > 0
        ? `Obligaciones: ${[vencidas > 0 ? `${vencidas} vencidas` : null, porVencer > 0 ? `${porVencer} por vencer` : null].filter(Boolean).join(" · ")}`
        : `Obligaciones regulatorias (${obligaciones.length})`}
    </button>
  )
}

function ChecklistObligaciones({
  propiedadId,
  obligaciones,
  onRegistrar,
}: {
  propiedadId: string
  obligaciones: ObligacionConEstado[]
  onRegistrar: (propiedadId: string, slug: string, fecha: string) => void
}) {
  return (
    <ul className="mt-2.5 space-y-2 rounded-lg border border-line-fine bg-muted/20 p-3">
      {obligaciones.map(({ obligacion, fechaUltimoCumplimiento, proximaFecha, estado }) => {
        const cfg = ESTADO_OBLIGACION_CONFIG[estado]
        return (
          <li key={obligacion.slug} className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="min-w-0">
              <p className="font-medium text-foreground">{obligacion.nombre}</p>
              <p className="text-[10px] text-muted-foreground">
                {obligacion.baseLegal} · {obligacion.certificador}
                {obligacion.periodicidad.tipo === "variable" && ` · ${obligacion.periodicidad.nota}`}
              </p>
              {proximaFecha && <p className="text-[10px] text-muted-foreground">Próximo vencimiento: {proximaFecha}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span className="rounded-[3px] border px-1.5 py-0.5 text-[10px] font-medium" style={{ color: cfg.color, borderColor: cfg.color }}>
                {cfg.label}
              </span>
              <Input
                key={fechaUltimoCumplimiento ?? "sin-registro"}
                type="date"
                defaultValue={fechaUltimoCumplimiento ?? ""}
                onChange={(e) => e.target.value && onRegistrar(propiedadId, obligacion.slug, e.target.value)}
                className="h-7 w-[130px] text-[11px]"
              />
            </div>
          </li>
        )
      })}
    </ul>
  )
}

export default function MiCarteraPage() {
  const [filas, setFilas] = useState<FilaPortafolio[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [consultandoSii, setConsultandoSii] = useState<string | null>(null)
  const [mismatchSii, setMismatchSii] = useState<Record<string, boolean | null>>({})

  const resumen = useMemo(() => calcularResumen(filas), [filas])

  const [expandido, setExpandido] = useState<string | null>(null)

  const [form, setForm] = useState({
    direccion: "",
    comuna: "",
    tipoPropiedad: "local_comercial" as TipoPropiedadComercial,
    superficieM2: "",
    operacion: "arriendo" as OperacionMercadoLocal,
    precioActualUf: "",
    fechaVencimientoContrato: "",
    notas: "",
    tieneAscensor: false,
    tieneGas: false,
    rolSii: "",
  })

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [k]: v }))
  }

  async function cargar() {
    setLoading(true)
    try {
      const res = await fetch("/api/propiedades-portafolio")
      if (!res.ok) throw new Error("No se pudo cargar la cartera")
      const json = (await res.json()) as { data: FilaPortafolio[] }
      setFilas(json.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void cargar()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.direccion || !form.comuna) {
      setError("Dirección y comuna son requeridas")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const res = await fetch("/api/propiedades-portafolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direccion: form.direccion,
          comuna: form.comuna,
          tipoPropiedad: form.tipoPropiedad,
          superficieM2: form.superficieM2 ? Number(form.superficieM2) : undefined,
          operacion: form.operacion,
          precioActualUf: form.precioActualUf ? Number(form.precioActualUf) : undefined,
          fechaVencimientoContrato: form.fechaVencimientoContrato || undefined,
          notas: form.notas || undefined,
          tieneAscensor: form.tieneAscensor,
          tieneGas: form.tieneGas,
          rolSii: form.rolSii || undefined,
        }),
      })

      if (!res.ok) {
        const err = (await res.json()) as { error?: string }
        throw new Error(err.error ?? "Error del servidor")
      }

      setForm({ direccion: "", comuna: "", tipoPropiedad: "local_comercial", superficieM2: "", operacion: "arriendo", precioActualUf: "", fechaVencimientoContrato: "", notas: "", tieneAscensor: false, tieneGas: false, rolSii: "" })
      await cargar()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await fetch(`/api/propiedades-portafolio/${id}`, { method: "DELETE" })
      setFilas((prev) => prev.filter((f) => f.propiedad.id !== id))
    } catch {
      setError("No se pudo eliminar la propiedad")
    }
  }

  async function handleRegistrarObligacion(propiedadId: string, obligacionSlug: string, fecha: string) {
    try {
      const res = await fetch(`/api/propiedades-portafolio/${propiedadId}/obligaciones`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ obligacionSlug, fechaUltimoCumplimiento: fecha }),
      })
      if (!res.ok) throw new Error("No se pudo registrar la obligación")

      setFilas((prev) =>
        prev.map((f) =>
          f.propiedad.id !== propiedadId
            ? f
            : {
                ...f,
                obligaciones: f.obligaciones.map((o) =>
                  o.obligacion.slug !== obligacionSlug ? o : calcularEstadoObligacion(o.obligacion, fecha, new Date()),
                ),
              },
        ),
      )
    } catch {
      setError("No se pudo registrar la obligación")
    }
  }

  async function handleConsultarSII(propiedadId: string) {
    setConsultandoSii(propiedadId)
    setError(null)
    try {
      const res = await fetch(`/api/propiedades-portafolio/${propiedadId}/enriquecer-sii`, { method: "POST" })
      const json = (await res.json()) as { error?: string; destino?: string; avaluoFiscalUf?: number | null; coincideTipo?: boolean | null; consultadoEl?: string }
      if (!res.ok) throw new Error(json.error ?? "No se pudo consultar el SII")

      setFilas((prev) =>
        prev.map((f) =>
          f.propiedad.id !== propiedadId
            ? f
            : { ...f, propiedad: { ...f.propiedad, siiDestino: json.destino ?? null, siiAvaluoFiscalUf: json.avaluoFiscalUf ?? null, siiConsultadoEl: json.consultadoEl ?? null } },
        ),
      )
      setMismatchSii((prev) => ({ ...prev, [propiedadId]: json.coincideTipo ?? null }))
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo consultar el SII")
    } finally {
      setConsultandoSii(null)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="💼"
        title="Mi Cartera"
        subtitle="Propiedades propias o administradas — comparadas contra el mercado real, no una sola vez, siempre"
        breadcrumbs={[{ label: "Mi Cartera" }]}
      />

      <div className="flex-1 p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <form onSubmit={(e) => void handleSubmit(e)}>
            <Card className="rounded-lg border-line-fine">
              <CardHeader>
                <CardTitle className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Agregar propiedad
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Dirección *</Label>
                    <Input value={form.direccion} onChange={(e) => setField("direccion", e.target.value)} placeholder="ej: Av. Providencia 1234, local 5" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Comuna *</Label>
                    <Input value={form.comuna} onChange={(e) => setField("comuna", e.target.value)} placeholder="ej: Providencia" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo de propiedad</Label>
                    <select
                      className="flex h-9 w-full rounded-lg border border-line-fine bg-card px-3 py-1 text-sm"
                      value={form.tipoPropiedad}
                      onChange={(e) => setField("tipoPropiedad", e.target.value as TipoPropiedadComercial)}
                    >
                      {TIPOS_PROPIEDAD.map((t) => (
                        <option key={t} value={t}>{TIPO_PROPIEDAD_LABEL[t].singular}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Superficie (m²)</Label>
                    <Input type="number" value={form.superficieM2} onChange={(e) => setField("superficieM2", e.target.value)} placeholder="para poder comparar en UF/m²" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Estado actual</Label>
                    <select
                      className="flex h-9 w-full rounded-lg border border-line-fine bg-card px-3 py-1 text-sm"
                      value={form.operacion}
                      onChange={(e) => setField("operacion", e.target.value as OperacionMercadoLocal)}
                    >
                      <option value="arriendo">Arrendada — genera renta</option>
                      <option value="venta">En venta / valor de referencia</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>{form.operacion === "arriendo" ? "Renta actual (UF/mes)" : "Precio de referencia (UF)"}</Label>
                    <Input type="number" value={form.precioActualUf} onChange={(e) => setField("precioActualUf", e.target.value)} />
                  </div>
                  {form.operacion === "arriendo" && (
                    <div className="space-y-1.5">
                      <Label>Vencimiento del contrato</Label>
                      <Input type="date" value={form.fechaVencimientoContrato} onChange={(e) => setField("fechaVencimientoContrato", e.target.value)} />
                    </div>
                  )}
                  <div className="space-y-1.5">
                    <Label>Rol SII</Label>
                    <Input value={form.rolSii} onChange={(e) => setField("rolSii", e.target.value)} placeholder="ej: 1234-56 — habilita cruce con destino y avalúo fiscal" />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Notas</Label>
                    <Textarea value={form.notas} onChange={(e) => setField("notas", e.target.value)} placeholder="opcional — ej: contrato vence dic 2026" />
                  </div>
                  <div className="flex items-center gap-4 sm:col-span-2">
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input type="checkbox" checked={form.tieneAscensor} onChange={(e) => setField("tieneAscensor", e.target.checked)} className="size-3.5" />
                      Tiene ascensor
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <input type="checkbox" checked={form.tieneGas} onChange={(e) => setField("tieneGas", e.target.checked)} className="size-3.5" />
                      Tiene instalación de gas
                    </label>
                  </div>
                </div>

                <Button type="submit" disabled={saving} className="bg-primary text-white hover:bg-primary/90">
                  {saving ? (
                    <><Loader2 className="size-4 animate-spin" /> Agregando…</>
                  ) : (
                    <><Plus className="size-4" /> Agregar a mi cartera</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </form>

          {error && (
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {!loading && filas.length > 0 && <ResumenPortafolioStrip resumen={resumen} />}

          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Cargando cartera…
            </div>
          ) : filas.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-line-fine bg-card p-10 text-center">
              <TrendingDown className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Aún no agregas propiedades a tu cartera.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filas.map(({ propiedad, comparacion, senalExpansion, tendenciaConstruccion, obligaciones }) => (
                <div key={propiedad.id} className="rounded-lg border border-line-fine bg-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-primary">{propiedad.direccion}</p>
                      <p className="text-xs text-muted-foreground">
                        {propiedad.comuna} · {TIPO_PROPIEDAD_LABEL[propiedad.tipoPropiedad].singular}
                        {propiedad.superficieM2 ? ` · ${propiedad.superficieM2} m²` : ""}
                        {propiedad.precioActualUf ? ` · ${formatUf(propiedad.precioActualUf)} UF` : ""}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleDelete(propiedad.id)}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-red-100 hover:text-red-600"
                      aria-label="Eliminar"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>

                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                    <VeredictoMercado comparacion={comparacion} />
                    {propiedad.fechaVencimientoContrato && <VencimientoBadge fecha={propiedad.fechaVencimientoContrato} />}
                    <ObligacionesToggle
                      obligaciones={obligaciones}
                      expandido={expandido === propiedad.id}
                      onToggle={() => setExpandido((prev) => (prev === propiedad.id ? null : propiedad.id))}
                    />
                  </div>

                  {expandido === propiedad.id && (
                    <ChecklistObligaciones propiedadId={propiedad.id} obligaciones={obligaciones} onRegistrar={(id, slug, fecha) => void handleRegistrarObligacion(id, slug, fecha)} />
                  )}

                  {(senalExpansion || tendenciaConstruccion?.tendencia === "creciente") && (
                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {senalExpansion && (
                        <span className="inline-flex items-center gap-1 rounded-[3px] border border-modulo-mercado/20 bg-modulo-mercado-subtle px-2 py-0.5 text-[10px] text-modulo-mercado">
                          <Radar className="size-2.5" />
                          {senalExpansion.cadena} tiene sucursal en la comuna
                        </span>
                      )}
                      {tendenciaConstruccion?.tendencia === "creciente" && (
                        <span className="inline-flex items-center gap-1 rounded-[3px] border border-modulo-mercado/20 bg-modulo-mercado-subtle px-2 py-0.5 text-[10px] text-modulo-mercado">
                          <TrendingUp className="size-2.5" />
                          Actividad constructiva histórica en alza (INE, {tendenciaConstruccion.variacionPct?.toFixed(0)}%)
                        </span>
                      )}
                    </div>
                  )}

                  {propiedad.rolSii && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {propiedad.siiConsultadoEl ? (
                        <>
                          <span className="inline-flex items-center gap-1 rounded-[3px] border border-line-fine px-2 py-0.5 text-[10px] text-muted-foreground">
                            SII: {propiedad.siiDestino}
                            {propiedad.siiAvaluoFiscalUf !== null ? ` · avalúo fiscal ${formatUf(propiedad.siiAvaluoFiscalUf)} UF` : ""}
                          </span>
                          {mismatchSii[propiedad.id] === false && (
                            <span className="inline-flex items-center gap-1 rounded-[3px] border px-2 py-0.5 text-[10px] font-medium" style={{ color: "var(--state-warn, #d97706)", borderColor: "var(--state-warn, #d97706)" }}>
                              El destino SII no coincide con el tipo declarado
                            </span>
                          )}
                          <button type="button" onClick={() => void handleConsultarSII(propiedad.id)} className="text-[10px] text-muted-foreground underline hover:text-primary" disabled={consultandoSii === propiedad.id}>
                            {consultandoSii === propiedad.id ? "Consultando…" : "Volver a consultar"}
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleConsultarSII(propiedad.id)}
                          disabled={consultandoSii === propiedad.id}
                          className="inline-flex items-center gap-1 rounded-[3px] border border-line-fine px-2 py-0.5 text-[10px] text-muted-foreground transition-colors hover:bg-muted/50"
                        >
                          {consultandoSii === propiedad.id ? <><Loader2 className="size-2.5 animate-spin" /> Consultando SII…</> : "Consultar SII (destino y avalúo fiscal)"}
                        </button>
                      )}
                    </div>
                  )}

                  {propiedad.notas && <p className="mt-2 text-xs italic text-muted-foreground/80">{propiedad.notas}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
