"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams, useRouter, useSearchParams } from "next/navigation"
import { ExternalLink, MapPin, Search, Store } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EstadoNormativo, type Veredicto } from "@/components/arch/estado"
import { PageHeader } from "@/components/dashboard/page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatoComercial, FORMATO_COMERCIAL_LABEL } from "@/lib/terrenos-comercial"
import { fixMojibakeArcGIS } from "@/lib/zonificacion-format"
import { REASON_LABEL, type OportunidadBusqueda, type OportunidadDetalle } from "@/lib/mercado-locales-server"
import { TIPO_PROPIEDAD_LABEL } from "@/lib/scrapers/mercado-locales-common"
import { UF_FALLBACK_CLP, type UfData } from "@/lib/uf"
import type { Terreno } from "@/types"

// ---------------------------------------------------------------------------
// Comparador terreno-vs-local (04-08, backlog "identificar terrenos y
// locales comerciales"): un terreno vacante y un local ya construido son
// alternativas para la MISMA decisión de negocio, pero estructuralmente
// distintas — no hay capa normativa del lado de mercado_locales_listings
// (verificado: sin columna de zona/uso), y un terreno necesita tramitación
// antes de operar mientras un local ya está habilitado. La tabla nunca
// finge que ambos lados son directamente equivalentes fila por fila: donde
// no hay dato real de un lado, se dice explícitamente en vez de omitirlo o
// inventarlo. No reusa /oportunidades/comparar — su validador COMPA-03
// bloquea a propósito mezclar tipo/operación, que es justo lo que esto hace.
// ---------------------------------------------------------------------------

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })
const UF_FMT = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 })

type UsoComercialStatus = NonNullable<Terreno["uso_comercial_status"]>

const USO_COMERCIAL_LABEL: Record<UsoComercialStatus, string> = {
  pendiente: "Sin evaluar todavía",
  permitido: "Permitido",
  no_permitido: "No permitido",
  no_especificado: "No especificado",
}

const USO_COMERCIAL_VEREDICTO: Record<UsoComercialStatus, Veredicto> = {
  pendiente: "neutro",
  permitido: "cumple",
  no_permitido: "rechaza",
  no_especificado: "observa",
}

export default function CompararLocalPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const oportunidadId = searchParams.get("oportunidadId")

  const [terreno, setTerreno] = useState<Terreno | null>(null)
  const [loadingTerreno, setLoadingTerreno] = useState(true)
  const [ufActual, setUfActual] = useState<UfData>({ valor: UF_FALLBACK_CLP, fecha: null, fallback: true })

  const [candidatos, setCandidatos] = useState<OportunidadBusqueda[] | null>(null)
  const [loadingCandidatos, setLoadingCandidatos] = useState(false)

  const [oportunidad, setOportunidad] = useState<OportunidadDetalle | null>(null)
  const [loadingOportunidad, setLoadingOportunidad] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetch(`/api/terrenos/${params.id}`)
      .then((r) => r.json())
      .then((d: { terreno?: Terreno }) => { if (!cancelled) setTerreno(d.terreno ?? null) })
      .finally(() => { if (!cancelled) setLoadingTerreno(false) })
    return () => { cancelled = true }
  }, [params.id])

  useEffect(() => {
    let cancelled = false
    fetch("/api/utils/uf")
      .then((r) => r.json() as Promise<UfData & { ok: boolean }>)
      .then((d) => { if (!cancelled) setUfActual({ valor: d.valor, fecha: d.fecha, fallback: d.fallback ?? false }) })
      .catch(() => { if (!cancelled) setUfActual({ valor: UF_FALLBACK_CLP, fecha: null, fallback: true }) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!terreno || oportunidadId) return
    let cancelled = false
    setLoadingCandidatos(true)
    fetch(`/api/mercado-locales/buscar?comuna=${encodeURIComponent(terreno.comuna)}`)
      .then((r) => r.json())
      .then((d: { data?: OportunidadBusqueda[] }) => { if (!cancelled) setCandidatos(d.data ?? []) })
      .catch(() => { if (!cancelled) setCandidatos([]) })
      .finally(() => { if (!cancelled) setLoadingCandidatos(false) })
    return () => { cancelled = true }
  }, [terreno, oportunidadId])

  useEffect(() => {
    if (!oportunidadId) { setOportunidad(null); return }
    let cancelled = false
    setLoadingOportunidad(true)
    fetch(`/api/mercado-locales/${oportunidadId}`)
      .then((r) => r.json())
      .then((d: { oportunidad?: OportunidadDetalle }) => { if (!cancelled) setOportunidad(d.oportunidad ?? null) })
      .finally(() => { if (!cancelled) setLoadingOportunidad(false) })
    return () => { cancelled = true }
  }, [oportunidadId])

  const elegir = useCallback((id: string) => {
    router.push(`/terrenos/${params.id}/comparar-local?oportunidadId=${id}`)
  }, [router, params.id])

  if (loadingTerreno) {
    return <p className="p-8 text-sm text-muted-foreground">Cargando terreno…</p>
  }
  if (!terreno) {
    return <p className="p-8 text-sm text-muted-foreground">Terreno no encontrado.</p>
  }

  const usoComercial = terreno.uso_comercial_status ?? "pendiente"
  const formato = formatoComercial(terreno.superficie_lote_m2)
  const nombreZona = fixMojibakeArcGIS(terreno.zona_nombre)

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title="Comparar con local del mercado"
        subtitle={`${terreno.direccion} — ${terreno.comuna}`}
        breadcrumbs={[
          { label: "Terrenos", href: "/terrenos" },
          { label: terreno.direccion, href: `/terrenos/${terreno.id}` },
          { label: "Comparar con local" },
        ]}
      />
      <div className="flex-1 overflow-auto p-8">
        {!oportunidadId ? (
          <div className="mx-auto max-w-2xl">
            <p className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground">
              <Search className="size-4" /> Locales comerciales activos en {terreno.comuna} para comparar con este terreno
            </p>
            {loadingCandidatos ? (
              <p className="text-sm text-muted-foreground">Buscando locales…</p>
            ) : !candidatos || candidatos.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                No hay locales de mercado activos en {terreno.comuna} todavía — la cobertura de{" "}
                <Link href="/mercado-inmobiliario/oportunidades" className="underline">
                  Mercado Inmobiliario
                </Link>{" "}
                es independiente de la de Terrenos.
              </div>
            ) : (
              <div className="space-y-2">
                {candidatos.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => elegir(c.id)}
                    className="flex w-full items-start justify-between gap-3 rounded-lg border border-border bg-card p-3 text-left text-sm transition-colors hover:border-[var(--blueprint)]/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-medium">{c.titulo}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {TIPO_PROPIEDAD_LABEL[c.tipoPropiedad].singular} · {c.operacion} ·{" "}
                        {c.superficieM2 ? `${c.superficieM2.toLocaleString("es-CL")} m²` : "superficie no informada"}
                      </p>
                    </div>
                    <p className="shrink-0 text-xs font-medium text-muted-foreground">
                      {c.precioMonto
                        ? c.precioMoneda === "UF"
                          ? `${UF_FMT.format(c.precioMonto)} UF`
                          : CLP.format(c.precioMonto)
                        : "—"}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : loadingOportunidad ? (
          <p className="text-sm text-muted-foreground">Cargando local…</p>
        ) : !oportunidad ? (
          <p className="text-sm text-muted-foreground">Local no encontrado.</p>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              className="mb-4 text-xs text-muted-foreground"
              onClick={() => router.push(`/terrenos/${params.id}/comparar-local`)}
            >
              ← Elegir otro local
            </Button>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-40">Métrica</TableHead>
                  <TableHead>
                    <span className="flex items-center gap-1.5">
                      <MapPin className="size-3.5" /> Terreno vacante
                    </span>
                  </TableHead>
                  <TableHead>
                    <span className="flex items-center gap-1.5">
                      <Store className="size-3.5" /> Local ya construido
                    </span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-xs text-muted-foreground">Identificación</TableCell>
                  <TableCell>
                    <Link href={`/terrenos/${terreno.id}`} className="font-medium hover:underline">
                      {terreno.direccion}
                    </Link>
                    <p className="text-xs text-muted-foreground">{terreno.comuna}</p>
                  </TableCell>
                  <TableCell>
                    <a href={oportunidad.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium hover:underline">
                      {oportunidad.titulo} <ExternalLink className="size-3" />
                    </a>
                    <p className="text-xs text-muted-foreground">
                      {oportunidad.comuna} · {TIPO_PROPIEDAD_LABEL[oportunidad.tipoPropiedad].singular} en {oportunidad.operacion}
                      {oportunidad.status === "dado_de_baja" && " · aviso dado de baja"}
                    </p>
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell className="text-xs text-muted-foreground">Precio</TableCell>
                  <TableCell className="text-sm">
                    {terreno.precio_clp ? (
                      <>
                        {CLP.format(terreno.precio_clp)}
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          ({UF_FMT.format(terreno.precio_clp / ufActual.valor)} UF)
                        </span>
                      </>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {oportunidad.precioValido ? (
                      <>
                        {CLP.format(oportunidad.precioUfNormalizado * ufActual.valor)}
                        <span className="ml-1.5 text-xs text-muted-foreground">
                          ({UF_FMT.format(oportunidad.precioUfNormalizado)} UF)
                        </span>
                      </>
                    ) : "—"}
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell className="text-xs text-muted-foreground">Precio / m²</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {terreno.precio_clp && terreno.superficie_lote_m2
                      ? `${CLP.format(terreno.precio_clp / terreno.superficie_lote_m2)} (${UF_FMT.format((terreno.precio_clp / terreno.superficie_lote_m2) / ufActual.valor)} UF/m²)`
                      : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {oportunidad.precioUfM2Normalizado
                      ? `${CLP.format(oportunidad.precioUfM2Normalizado * ufActual.valor)} (${UF_FMT.format(oportunidad.precioUfM2Normalizado)} UF/m²)`
                      : "—"}
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell className="text-xs text-muted-foreground">Superficie</TableCell>
                  <TableCell className="text-sm">
                    {terreno.superficie_lote_m2 ? `${terreno.superficie_lote_m2.toLocaleString("es-CL")} m²` : "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {oportunidad.superficieM2 ? `${oportunidad.superficieM2.toLocaleString("es-CL")} m²` : "—"}
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell className="text-xs text-muted-foreground">Formato / tipo</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formato ? `Potencial: ${FORMATO_COMERCIAL_LABEL[formato]}` : "Superficie fuera de los rangos definidos"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {TIPO_PROPIEDAD_LABEL[oportunidad.tipoPropiedad].singular}
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell className="text-xs text-muted-foreground">Uso normativo (PRC)</TableCell>
                  <TableCell className="text-sm">
                    {terreno.zona_status === "encontrado" ? (
                      <>
                        <p className="font-medium">{terreno.zona_codigo ?? nombreZona ?? "—"}</p>
                        <div className="mt-1">
                          <EstadoNormativo estado={USO_COMERCIAL_VEREDICTO[usoComercial]} label={USO_COMERCIAL_LABEL[usoComercial]} />
                        </div>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Zonificación sin resolver</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    N/A — ya opera como {TIPO_PROPIEDAD_LABEL[oportunidad.tipoPropiedad].singular.toLowerCase()}, sin dato normativo en esta fuente.
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell className="text-xs text-muted-foreground">Señales de mercado</TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-wrap gap-1">
                      {terreno.ubicacion_status === "resuelto" && terreno.cerca_avenida_principal && (
                        <span className="rounded-[3px] border border-line-med px-1.5 py-0.5 text-muted-foreground">Cerca de avenida</span>
                      )}
                      {terreno.ubicacion_status === "resuelto" && (terreno.anchors_comerciales_cercanos ?? 0) > 0 && (
                        <span className="rounded-[3px] border border-line-med px-1.5 py-0.5 text-muted-foreground">
                          {terreno.anchors_comerciales_cercanos} anchor(s) a 1km
                        </span>
                      )}
                      {terreno.ubicacion_status !== "resuelto" && (
                        <span className="text-muted-foreground">Señales de ubicación sin resolver</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">
                    <div className="flex flex-wrap gap-1">
                      {oportunidad.reasonCodes.length > 0 ? (
                        oportunidad.reasonCodes.map((c) => (
                          <span key={c} className="rounded-[3px] border border-line-med px-1.5 py-0.5 text-muted-foreground">
                            {REASON_LABEL[c] ?? c}
                          </span>
                        ))
                      ) : (
                        <span className="text-muted-foreground">Sin señal de precio bajo mercado</span>
                      )}
                    </div>
                  </TableCell>
                </TableRow>

                <TableRow>
                  <TableCell className="text-xs text-muted-foreground">Tiempo a operar</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    Requiere diseño, permiso de edificación y construcción antes de operar — meses a años, según vía de tramitación.
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    Disponible para operar de inmediato, sujeto a {oportunidad.operacion === "arriendo" ? "arriendo" : "compra"} y eventual remodelación menor.
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
            <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
              Comparación orientativa entre dos tipos de activo distintos — un terreno vacante y un local ya
              construido no son sustitutos directos. Verifica siempre la normativa vigente contra el CIP oficial y
              las condiciones reales del aviso antes de decidir.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
