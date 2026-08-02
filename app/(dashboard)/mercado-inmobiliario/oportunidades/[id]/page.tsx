import { notFound } from "next/navigation"
import Link from "next/link"
import { ExternalLink, Printer } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  obtenerOportunidadPorId,
  obtenerComparablesOportunidad,
  obtenerHistorialPrecioListing,
  obtenerBandasMercadoLocales,
} from "@/lib/mercado-locales-server"
import { obtenerSenalesExpansionPorComuna } from "@/lib/cadenas-sucursales-server"
import { obtenerTendenciasConstruccionPorComuna } from "@/lib/ine-permisos-server"
import { TIPO_PROPIEDAD_LABEL } from "@/lib/scrapers/mercado-locales-common"
import { PosicionamientoTab } from "@/components/mercado-inmobiliario/oportunidad-detalle/posicionamiento-tab"
import { ResumenTab } from "@/components/mercado-inmobiliario/oportunidad-detalle/resumen-tab"
import { HistorialTab } from "@/components/mercado-inmobiliario/oportunidad-detalle/historial-tab"
import { ComparablesTab } from "@/components/mercado-inmobiliario/oportunidad-detalle/comparables-tab"
import type { ResumenOportunidadContexto } from "@/lib/resumen-oportunidad-prompts"
import { calcularCapRate } from "@/lib/calculadora-inversion"

export const dynamic = "force-dynamic"

function fmt(n: number): string {
  return n.toLocaleString("es-CL", { maximumFractionDigits: 2 })
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function OportunidadDetallePage({ params }: Props) {
  const { id } = await params
  const oportunidad = await obtenerOportunidadPorId(id)
  if (!oportunidad) notFound()

  const [bandasArriendo, bandasVenta, comparables, historial, senalesExpansion, tendenciasConstruccion] = await Promise.all([
    obtenerBandasMercadoLocales(oportunidad.comuna, "arriendo", oportunidad.tipoPropiedad),
    obtenerBandasMercadoLocales(oportunidad.comuna, "venta", oportunidad.tipoPropiedad),
    obtenerComparablesOportunidad({
      comuna: oportunidad.comuna,
      operacion: oportunidad.operacion,
      tipoPropiedad: oportunidad.tipoPropiedad,
      excludeId: oportunidad.id,
      precioUfM2Objetivo: oportunidad.precioUfM2Normalizado,
      precioUfObjetivo: oportunidad.precioUfNormalizado,
    }),
    obtenerHistorialPrecioListing(oportunidad.id),
    obtenerSenalesExpansionPorComuna([oportunidad.comuna]).catch(() => new Map()),
    obtenerTendenciasConstruccionPorComuna([oportunidad.comuna]).catch(() => new Map()),
  ])

  const tipoPropiedadLabel = TIPO_PROPIEDAD_LABEL[oportunidad.tipoPropiedad].singular
  const diasPublicado = Math.floor((Date.now() - new Date(oportunidad.primeraVezVistoEl).getTime()) / 86400000)

  const arriendoUfM2 = bandasArriendo?.medianaUfM2 ?? null
  const ventaUfM2 = bandasVenta?.medianaUfM2 ?? null
  const rentabilidadZonaPct =
    arriendoUfM2 !== null && ventaUfM2 !== null && ventaUfM2 > 0
      ? calcularCapRate({ rentaMensual: arriendoUfM2, precioVenta: ventaUfM2 }).capNeto
      : null

  const historialResumen =
    historial.length === 0
      ? "sin cambios de precio registrados"
      : `${historial.length} punto(s) registrado(s), el más reciente: ${fmt(historial[historial.length - 1].precioMonto)} ${historial[historial.length - 1].precioMoneda}`

  const resumenContexto: ResumenOportunidadContexto = {
    titulo: oportunidad.titulo,
    comuna: oportunidad.comuna,
    tipoPropiedadLabel,
    operacion: oportunidad.operacion,
    precioUf: oportunidad.precioUfNormalizado,
    precioUfM2: oportunidad.precioUfM2Normalizado,
    reasonCodes: oportunidad.reasonCodes,
    muestraN: oportunidad.bandas?.muestraN ?? 0,
    muestraNComuna: oportunidad.bandas?.muestraNComuna ?? 0,
    usoFallback: oportunidad.bandas?.usoFallback ?? false,
    p25Uf: oportunidad.bandas?.p25Uf ?? null,
    medianaUf: oportunidad.bandas?.medianaUf ?? null,
    p75Uf: oportunidad.bandas?.p75Uf ?? null,
    p25UfM2: oportunidad.bandas?.p25UfM2 ?? null,
    medianaUfM2: oportunidad.bandas?.medianaUfM2 ?? null,
    p75UfM2: oportunidad.bandas?.p75UfM2 ?? null,
    diasPublicado,
    historialResumen,
    comparables: comparables.map((c) => ({
      titulo: c.titulo,
      comuna: c.comuna,
      precioUf: c.precioUfNormalizado,
      precioUfM2: c.precioUfM2Normalizado,
    })),
    rentabilidadZonaPct,
    senalExpansion: senalesExpansion.get(oportunidad.comuna)
      ? `${senalesExpansion.get(oportunidad.comuna)!.cadena} tiene sucursal registrada`
      : null,
    tendenciaConstruccion:
      tendenciasConstruccion.get(oportunidad.comuna)?.tendencia === "creciente"
        ? `alza de ${tendenciasConstruccion.get(oportunidad.comuna)!.variacionPct?.toFixed(0)}% en construcción no habitacional (INE, histórico)`
        : null,
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="📄"
        title={oportunidad.titulo}
        subtitle={`${oportunidad.comuna} · ${tipoPropiedadLabel} · ${oportunidad.operacion === "venta" ? "Venta" : "Arriendo"}`}
        breadcrumbs={[
          { label: "Oportunidades", href: "/mercado-inmobiliario/oportunidades" },
          { label: oportunidad.titulo },
        ]}
      />

      <div className="flex-1 p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {oportunidad.status === "dado_de_baja" && (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <span className="mt-0.5 text-red-500">⚠</span>
              <div className="text-sm">
                <span className="font-semibold text-red-800">Aviso dado de baja</span>
                <span className="ml-1 text-red-700">
                  Este aviso ya no está activo en el portal de origen — los datos que ves son los últimos capturados antes de darse de baja.
                </span>
              </div>
            </div>
          )}

          <div className="rounded-lg border border-line-fine bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-2xl font-semibold text-primary num">
                  {oportunidad.precioValido ? `${fmt(oportunidad.precioUfNormalizado)} UF` : "Precio no disponible en moneda reconocida"}
                </p>
                {oportunidad.precioUfM2Normalizado !== null && (
                  <p className="num text-sm text-muted-foreground">{fmt(oportunidad.precioUfM2Normalizado)} UF/m²</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <a
                  href={oportunidad.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  Ver aviso original <ExternalLink className="size-3.5" />
                </a>
                <Link
                  href={`/mercado-inmobiliario/oportunidades/${oportunidad.id}/informe`}
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Printer className="size-3.5" /> Exportar informe
                </Link>
              </div>
            </div>
          </div>

          <Tabs defaultValue="posicionamiento">
            <TabsList>
              <TabsTrigger value="posicionamiento">Posicionamiento</TabsTrigger>
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="historial">Historial</TabsTrigger>
              <TabsTrigger value="comparables">Comparables</TabsTrigger>
            </TabsList>

            <TabsContent value="posicionamiento">
              <PosicionamientoTab oportunidad={oportunidad} bandasArriendo={bandasArriendo} bandasVenta={bandasVenta} />
            </TabsContent>

            <TabsContent value="resumen">
              <ResumenTab contexto={resumenContexto} />
            </TabsContent>

            <TabsContent value="historial">
              <HistorialTab
                oportunidad={oportunidad}
                historial={historial}
                senalExpansion={senalesExpansion.get(oportunidad.comuna) ?? null}
                tendenciaConstruccion={tendenciasConstruccion.get(oportunidad.comuna) ?? null}
              />
            </TabsContent>

            <TabsContent value="comparables">
              <ComparablesTab comparables={comparables} comuna={oportunidad.comuna} tipoPropiedadLabel={tipoPropiedadLabel} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
