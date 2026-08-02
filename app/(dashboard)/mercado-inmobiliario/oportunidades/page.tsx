import { TrendingDown } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { obtenerOportunidadesMercadoLocales } from "@/lib/mercado-locales-server"
import { obtenerSenalesExpansionPorComuna } from "@/lib/cadenas-sucursales-server"
import { obtenerTendenciasConstruccionPorComuna } from "@/lib/ine-permisos-server"
import { TIPO_PROPIEDAD_LABEL, type OperacionMercadoLocal, type TipoPropiedadComercial } from "@/lib/scrapers/mercado-locales-common"
import { Histograma } from "@/components/mercado-inmobiliario/charts/histograma"
import { SelectorComparacion } from "@/components/mercado-inmobiliario/selector-comparacion"

const TIPOS_PROPIEDAD_VALIDOS: TipoPropiedadComercial[] = ["local_comercial", "oficina", "bodega", "industrial"]

export const dynamic = "force-dynamic"

interface OportunidadesPageProps {
  searchParams: Promise<{ comuna?: string; operacion?: string; tipoPropiedad?: string }>
}

export default async function OportunidadesPage({ searchParams }: OportunidadesPageProps) {
  const { comuna, operacion: operacionRaw, tipoPropiedad: tipoPropiedadRaw } = await searchParams
  const operacion: OperacionMercadoLocal = operacionRaw === "venta" ? "venta" : "arriendo"
  const tipoPropiedad: TipoPropiedadComercial = TIPOS_PROPIEDAD_VALIDOS.includes(tipoPropiedadRaw as TipoPropiedadComercial)
    ? (tipoPropiedadRaw as TipoPropiedadComercial)
    : "local_comercial"

  let oportunidades: Awaited<ReturnType<typeof obtenerOportunidadesMercadoLocales>> = []
  let errorMsg: string | null = null

  try {
    oportunidades = await obtenerOportunidadesMercadoLocales(operacion, { comuna: comuna || undefined, limit: 30, tipoPropiedad })
  } catch {
    errorMsg = "No se pudieron cargar las oportunidades — intenta de nuevo en unos minutos."
  }

  // Cruce con expansión de cadenas (Torre de Control) — la señal vive en su
  // propio panel (/mercado-inmobiliario/cadenas), pero un dato correcto que
  // nadie ve en el momento de decidir no cambia ninguna decisión. Best-effort:
  // si esto falla, las oportunidades se siguen mostrando igual, solo sin badge.
  const comunasPresentes = Array.from(new Set(oportunidades.map((o) => o.comuna)))
  const senalesExpansion = await obtenerSenalesExpansionPorComuna(comunasPresentes).catch(() => new Map())

  // Actividad constructiva histórica del INE (2010-2022, CC BY-SA — atribuir
  // "INE") como segunda señal honesta: solo se muestra cuando la comuna tuvo
  // un alza real (+15% o más) de superficie no-habitacional/mixta en sus
  // últimos años con dato — nunca "estable"/"decreciente", eso sería ruido
  // para una lista de oportunidades, no una señal de interés.
  const tendenciasConstruccion = await obtenerTendenciasConstruccionPorComuna(comunasPresentes).catch(
    () => new Map(),
  )

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="🎯"
        title="Oportunidades de Mercado"
        subtitle="Locales comerciales bajo el P25 de su cohorte, o con baja de precio reciente — datos reales, no estimados"
        breadcrumbs={[{ label: "Oportunidades" }]}
      />

      <div className="flex-1 p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <Card className="rounded-lg border-line-fine">
            <CardContent className="p-4">
              <form method="GET" className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[160px] space-y-1.5">
                  <label className="font-technical text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Comuna</label>
                  <Input name="comuna" placeholder="opcional — ej: Providencia" defaultValue={comuna ?? ""} />
                </div>
                <div className="flex-1 min-w-[160px] space-y-1.5">
                  <label className="font-technical text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Tipo de propiedad</label>
                  <select
                    name="tipoPropiedad"
                    defaultValue={tipoPropiedad}
                    className="flex h-9 w-full rounded-lg border border-line-fine bg-card px-3 py-1 text-sm"
                  >
                    {TIPOS_PROPIEDAD_VALIDOS.map((t) => (
                      <option key={t} value={t}>{TIPO_PROPIEDAD_LABEL[t].singular}</option>
                    ))}
                  </select>
                </div>
                <div className="flex-1 min-w-[160px] space-y-1.5">
                  <label className="font-technical text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Operación</label>
                  <select
                    name="operacion"
                    defaultValue={operacion}
                    className="flex h-9 w-full rounded-lg border border-line-fine bg-card px-3 py-1 text-sm"
                  >
                    <option value="arriendo">Arriendo</option>
                    <option value="venta">Venta</option>
                  </select>
                </div>
                <Button type="submit" variant="outline">Filtrar</Button>
              </form>
            </CardContent>
          </Card>

          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMsg}</div>
          )}

          {!errorMsg && oportunidades.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-lg border border-line-fine bg-card p-10 text-center">
              <TrendingDown className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No hay oportunidades hoy con las bandas actuales{comuna ? ` para "${comuna}"` : ""}. El motor de bandas corre a diario.
              </p>
            </div>
          )}

          {oportunidades.length > 1 && (
            <Histograma titulo="Distribución de precios (UF)" valores={oportunidades.map((o) => o.precioUfNormalizado)} />
          )}

          <SelectorComparacion
            oportunidades={oportunidades}
            senalesExpansion={Object.fromEntries(senalesExpansion)}
            tendenciasConstruccion={Object.fromEntries(tendenciasConstruccion)}
          />
        </div>
      </div>
    </div>
  )
}
