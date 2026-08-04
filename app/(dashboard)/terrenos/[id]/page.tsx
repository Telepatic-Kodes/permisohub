"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { AlertTriangle, ArrowRight, Landmark, Loader2, MapPinned, RefreshCw, ShieldCheck, TrendingDown } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { EstadoNormativo, type Veredicto } from "@/components/arch/estado"
import { PageHeader } from "@/components/dashboard/page-header"
import { PredioMap } from "@/components/proyecto/predio-map"
import { ZonificacionMapa, type ZonaPolygon } from "@/components/proyecto/zonificacion-mapa"
import { UsoCompatibleCheck } from "@/components/proyecto/uso-compatible-check"
import { fixMojibakeArcGIS } from "@/lib/zonificacion-format"
import { nombresComunasConCobertura } from "@/lib/zonificacion-comunas"
import { formatoComercial, FORMATO_COMERCIAL_LABEL } from "@/lib/terrenos-comercial"
import type { Terreno } from "@/types"

function listaConY(items: string[]): string {
  if (items.length <= 1) return items.join("")
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`
}

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

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })

interface ZonaGeoResponse {
  ok: boolean
  lat: number | null
  lng: number | null
  geometria: ZonaPolygon | null
}

export default function TerrenoDetailPage() {
  const params = useParams<{ id: string }>()
  const [terreno, setTerreno] = useState<Terreno | null>(null)
  const [geo, setGeo] = useState<ZonaGeoResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [actualizando, setActualizando] = useState(false)

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/terrenos/${params.id}`)
    const data = await res.json() as { terreno?: Terreno }
    if (data.terreno) setTerreno(data.terreno)
  }, [params.id])

  useEffect(() => {
    setLoading(true)
    cargar().finally(() => setLoading(false))
  }, [cargar])

  useEffect(() => {
    if (!params.id) return
    let cancelled = false
    fetch(`/api/terrenos/${params.id}/zonificacion`)
      .then((r) => r.json())
      .then((data: ZonaGeoResponse) => { if (!cancelled) setGeo(data) })
      .catch(() => undefined)
    return () => { cancelled = true }
    // terreno?.zona_consultada_el en las deps: re-fetch tras "Actualizar" o el
    // enriquecimiento inicial, igual que ZonificacionCard hace para Proyecto —
    // sin esto el mapa queda con el polígono viejo (o vacío) para siempre.
  }, [params.id, terreno?.zona_consultada_el])

  async function handleActualizar() {
    setActualizando(true)
    try {
      const res = await fetch(`/api/terrenos/${params.id}/enriquecer?force=true`, { method: "POST" })
      const data = await res.json()
      if (!res.ok || data.error) {
        toast.error(data.error ?? "No se pudo actualizar la viabilidad")
        return
      }
      await cargar()
      toast.success("Viabilidad actualizada")
    } catch {
      toast.error("No se pudo actualizar la viabilidad")
    } finally {
      setActualizando(false)
    }
  }

  if (loading) {
    return <p className="p-8 text-sm text-muted-foreground">Cargando terreno…</p>
  }
  if (!terreno) {
    return <p className="p-8 text-sm text-muted-foreground">Terreno no encontrado.</p>
  }

  const status = terreno.zona_status ?? "pendiente"
  const nombreZona = fixMojibakeArcGIS(terreno.zona_nombre)
  const uperm = fixMojibakeArcGIS(terreno.zona_uperm)
  const uproh = fixMojibakeArcGIS(terreno.zona_uproh)
  const usoComercial = terreno.uso_comercial_status ?? "pendiente"
  const formato = formatoComercial(terreno.superficie_lote_m2)

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="🗺️"
        title={terreno.direccion}
        subtitle={terreno.comuna}
        breadcrumbs={[
          { label: "Terrenos", href: "/terrenos" },
          { label: terreno.direccion },
        ]}
        action={
          <div className="flex items-center gap-2">
            <Link
              href={`/mercado-inmobiliario/tasacion?direccion=${encodeURIComponent(terreno.direccion)}&comuna=${encodeURIComponent(terreno.comuna)}${terreno.rol_sii ? `&rolSii=${encodeURIComponent(terreno.rol_sii)}` : ""}`}
            >
              <Button variant="outline" size="sm" className="gap-1.5">
                <Landmark className="size-3.5" /> Ver tasación
              </Button>
            </Link>
            <Link
              href={`/mercado-inmobiliario/due-diligence?direccion=${encodeURIComponent(terreno.direccion)}&comuna=${encodeURIComponent(terreno.comuna)}${terreno.rol_sii ? `&rolSii=${encodeURIComponent(terreno.rol_sii)}` : ""}`}
            >
              <Button variant="outline" size="sm" className="gap-1.5">
                <ShieldCheck className="size-3.5" /> Due diligence
              </Button>
            </Link>
            <Link href={`/proyectos/nuevo?municipio=${encodeURIComponent(terreno.comuna)}&direccion=${encodeURIComponent(terreno.direccion)}`}>
              <Button variant="outline" size="sm" className="gap-1.5">
                Promover a proyecto <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>
        }
      />
      <div className="flex-1 overflow-auto p-8">
        <div className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="text-sm">Predio</CardTitle></CardHeader>
              <CardContent className="space-y-3 text-sm">
                <PredioMap direccion={terreno.direccion} municipio={terreno.comuna} lat={terreno.lat} lng={terreno.lng} />
                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                  {terreno.precio_clp && (
                    <>
                      <span className="text-muted-foreground">Precio</span>
                      <span className="font-medium">
                        {CLP.format(terreno.precio_clp)}
                        {terreno.precio_clp_anterior != null && terreno.precio_clp < terreno.precio_clp_anterior && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] font-medium" style={{ color: "var(--state-ok)" }}>
                            <TrendingDown className="size-3" /> antes {CLP.format(terreno.precio_clp_anterior)}
                          </span>
                        )}
                      </span>
                    </>
                  )}
                  {terreno.superficie_lote_m2 && (
                    <>
                      <span className="text-muted-foreground">Sup. lote</span>
                      <span>{terreno.superficie_lote_m2.toLocaleString("es-CL")} m²</span>
                    </>
                  )}
                  {formato && (
                    <>
                      <span className="text-muted-foreground">Formato comercial</span>
                      <span>{FORMATO_COMERCIAL_LABEL[formato]}</span>
                    </>
                  )}
                  {terreno.rol_sii && (
                    <>
                      <span className="text-muted-foreground">Rol SII</span>
                      <span className="font-mono">{terreno.rol_sii}</span>
                    </>
                  )}
                  {terreno.avaluo_fiscal_clp && (
                    <>
                      <span className="text-muted-foreground">Avalúo fiscal</span>
                      <span>{CLP.format(terreno.avaluo_fiscal_clp)}</span>
                    </>
                  )}
                  {terreno.destino_sii && (
                    <>
                      <span className="text-muted-foreground">Destino SII</span>
                      <span className="capitalize">{terreno.destino_sii.toLowerCase()}</span>
                    </>
                  )}
                  {terreno.url_aviso && (
                    <>
                      <span className="text-muted-foreground">Aviso</span>
                      <a href={terreno.url_aviso} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                        Ver publicación
                      </a>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {terreno.ubicacion_status === "resuelto" && (
              <Card>
                <CardHeader><CardTitle className="text-sm">Señales de ubicación</CardTitle></CardHeader>
                <CardContent className="space-y-2 text-xs">
                  <p className="flex items-center gap-1.5">
                    <MapPinned className="size-3.5 shrink-0 text-muted-foreground" />
                    {terreno.cerca_avenida_principal
                      ? "Cerca de una avenida principal (≤300 m)"
                      : "Sin avenida principal cercana (≤300 m)"}
                  </p>
                  <p className="flex items-center gap-1.5">
                    <MapPinned className="size-3.5 shrink-0 text-muted-foreground" />
                    {terreno.anchors_comerciales_cercanos ?? 0} anchor(s) comercial(es) (mall/supermercado/tienda por
                    departamento) a menos de 1 km
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Fuente: OpenStreetMap (Overpass API) — cobertura de comercio puede ser incompleta fuera de zonas
                    bien mapeadas.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>

          <Card>
            <CardHeader className="flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm">Viabilidad normativa (PRC)</CardTitle>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => void handleActualizar()} disabled={actualizando}>
                {actualizando ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Actualizar
              </Button>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {status === "pendiente" && (
                <p className="text-xs text-muted-foreground">Consultando zonificación…</p>
              )}

              {status === "sin_cobertura" && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                  <p className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="size-3.5" /> Sin cobertura automática
                  </p>
                  <p className="mt-1">
                    La comuna &quot;{terreno.comuna}&quot; no tiene capa PRC integrada todavía — la zonificación
                    automática hoy cubre {listaConY(nombresComunasConCobertura())}. Verifica manualmente
                    contra el Certificado de Informaciones Previas (CIP) de la municipalidad.
                  </p>
                </div>
              )}

              {status === "error" && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                  <p className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="size-3.5" /> No se pudo determinar la zona
                  </p>
                  <p className="mt-1">Verifica la dirección o intenta Actualizar.</p>
                </div>
              )}

              {status === "encontrado" && (
                <>
                  <div>
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Zona</p>
                    <p className="font-semibold text-primary">
                      {terreno.zona_codigo ? `${terreno.zona_codigo} — ` : ""}
                      {nombreZona ?? "—"}
                    </p>
                    {terreno.zona_sector && (
                      <p className="text-[11px] text-muted-foreground">{terreno.zona_sector}</p>
                    )}
                  </div>

                  {terreno.zona_precision === "centroide_comuna" && (
                    <p className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-800">
                      <AlertTriangle className="mt-0.5 size-3 shrink-0" />
                      <span>
                        Zona aproximada: la dirección de este terreno no se pudo geocodificar con precisión, así
                        que se usó el centroide de la comuna. En comunas con más de una zona PRC, esta puede no
                        ser la zona real del predio — verifica contra el CIP oficial.
                      </span>
                    </p>
                  )}

                  <ZonificacionMapa lat={geo?.lat ?? null} lng={geo?.lng ?? null} geometria={geo?.geometria ?? null} />

                  <div className="space-y-1 rounded-lg border border-line-strong p-3">
                    <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Potencial comercial (local / strip center / power center)
                    </p>
                    <EstadoNormativo estado={USO_COMERCIAL_VEREDICTO[usoComercial]} label={USO_COMERCIAL_LABEL[usoComercial]} />
                    {terreno.uso_comercial_justificacion && (
                      <p className="text-[11px] text-muted-foreground">{terreno.uso_comercial_justificacion}</p>
                    )}
                  </div>

                  {terreno.zona_usos_disponibles === false ? (
                    <p className="text-xs text-muted-foreground">
                      Usos permitidos/prohibidos no disponibles en la fuente para esta zona.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <div>
                        <p className="text-xs font-medium text-primary">Usos permitidos</p>
                        <p className="text-xs text-muted-foreground">{uperm ?? "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-primary">Usos prohibidos</p>
                        <p className="text-xs text-muted-foreground">{uproh ?? "—"}</p>
                      </div>
                    </div>
                  )}

                  <UsoCompatibleCheck
                    endpoint="/api/terrenos/compatibilidad"
                    extraBody={{
                      uperm: terreno.zona_uperm ?? null,
                      uproh: terreno.zona_uproh ?? null,
                      usosDisponibles: terreno.zona_usos_disponibles ?? false,
                    }}
                  />

                  <p className="text-[11px] text-muted-foreground">
                    Fuente: capa cartográfica de terceros (Observatorio de Ciudades UC / MINVU) — verificar
                    siempre contra el CIP oficial de la municipalidad antes de decidir.
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
