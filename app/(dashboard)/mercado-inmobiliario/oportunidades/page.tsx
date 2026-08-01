import { TrendingDown } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { obtenerOportunidadesMercadoLocales } from "@/lib/mercado-locales-server"
import type { OperacionMercadoLocal } from "@/lib/scrapers/mercado-locales-common"

export const dynamic = "force-dynamic"

const REASON_LABEL: Record<string, string> = {
  below_p25_ufm2: "Bajo P25 por m² — entre los más baratos de su comuna",
  below_p25_uf: "Bajo P25 — entre los más baratos de su comuna",
  price_drop_7d: "Bajó de precio en los últimos 7 días",
}

function formatUf(n: number): string {
  return n.toLocaleString("es-CL", { maximumFractionDigits: 2 })
}

interface OportunidadesPageProps {
  searchParams: Promise<{ comuna?: string; operacion?: string }>
}

export default async function OportunidadesPage({ searchParams }: OportunidadesPageProps) {
  const { comuna, operacion: operacionRaw } = await searchParams
  const operacion: OperacionMercadoLocal = operacionRaw === "venta" ? "venta" : "arriendo"

  let oportunidades: Awaited<ReturnType<typeof obtenerOportunidadesMercadoLocales>> = []
  let errorMsg: string | null = null

  try {
    oportunidades = await obtenerOportunidadesMercadoLocales(operacion, { comuna: comuna || undefined, limit: 30 })
  } catch {
    errorMsg = "No se pudieron cargar las oportunidades — intenta de nuevo en unos minutos."
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="🎯"
        title="Oportunidades de Mercado"
        subtitle="Locales comerciales bajo el P25 de su cohorte, o con baja de precio reciente — datos reales, no estimados"
        breadcrumbs={[{ label: "Mercado Inmobiliario" }, { label: "Oportunidades" }]}
      />

      <div className="flex-1 p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <Card className="rounded-[4px] border-line-fine">
            <CardContent className="p-4">
              <form method="GET" className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[160px] space-y-1.5">
                  <label className="font-technical text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Comuna</label>
                  <Input name="comuna" placeholder="opcional — ej: Providencia" defaultValue={comuna ?? ""} />
                </div>
                <div className="flex-1 min-w-[160px] space-y-1.5">
                  <label className="font-technical text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Operación</label>
                  <select
                    name="operacion"
                    defaultValue={operacion}
                    className="flex h-9 w-full rounded-[4px] border border-line-fine bg-card px-3 py-1 text-sm"
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
            <div className="flex flex-col items-center gap-3 rounded-[4px] border border-line-fine bg-card p-10 text-center">
              <TrendingDown className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No hay oportunidades hoy con las bandas actuales{comuna ? ` para "${comuna}"` : ""}. El motor de bandas corre a diario.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {oportunidades.map((o) => (
              <div key={o.id} className="rounded-[4px] border border-line-fine bg-card p-4">
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
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
