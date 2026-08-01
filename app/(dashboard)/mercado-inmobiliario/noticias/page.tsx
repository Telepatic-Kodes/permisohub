import { Newspaper } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

interface NoticiaRow {
  id: string
  fuente: string
  fuente_tipo: "rss" | "scrape"
  url: string
  titulo: string
  resumen: string | null
  publicado_el: string | null
  comunas: string[]
  tipos_propiedad: string[]
}

const FUENTE_TIPO_LABEL: Record<NoticiaRow["fuente_tipo"], string> = {
  rss: "RSS",
  scrape: "Scraping",
}

function formatFecha(iso: string | null): string {
  if (!iso) return "Sin fecha"
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso))
}

interface NoticiasPageProps {
  searchParams: Promise<{ comuna?: string; tipo?: string }>
}

export default async function NoticiasPage({ searchParams }: NoticiasPageProps) {
  const { comuna, tipo } = await searchParams

  let noticias: NoticiaRow[] = []
  let errorMsg: string | null = null

  try {
    const supabase = await createClient()
    let query = supabase
      .from("noticias_mercado")
      .select("*")
      .order("publicado_el", { ascending: false, nullsFirst: false })
      .order("ingerido_el", { ascending: false })
      .limit(50)

    if (comuna) query = query.contains("comunas", [comuna])
    if (tipo) query = query.contains("tipos_propiedad", [tipo])

    const { data, error } = await query
    if (error) throw error
    noticias = (data ?? []) as NoticiaRow[]
  } catch {
    errorMsg = "No se pudo cargar el feed de noticias — intenta de nuevo en unos minutos."
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="📰"
        title="Noticias de Mercado"
        subtitle="Hechos esenciales CMF, prensa de Parque Arauco y señales de retail — actualizado a diario"
        breadcrumbs={[{ label: "Noticias" }]}
      />

      <div className="flex-1 p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <Card className="rounded-[4px] border-line-fine">
            <CardContent className="p-4">
              <form method="GET" className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[160px] space-y-1.5">
                  <label className="font-technical text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Comuna</label>
                  <Input name="comuna" placeholder="ej: Providencia" defaultValue={comuna ?? ""} />
                </div>
                <div className="flex-1 min-w-[160px] space-y-1.5">
                  <label className="font-technical text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Tipo</label>
                  <Input name="tipo" placeholder="retail, oficina, bodega, industrial" defaultValue={tipo ?? ""} />
                </div>
                <Button type="submit" variant="outline">Filtrar</Button>
              </form>
            </CardContent>
          </Card>

          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMsg}</div>
          )}

          {!errorMsg && noticias.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-[4px] border border-line-fine bg-card p-10 text-center">
              <Newspaper className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Aún no hay noticias {comuna || tipo ? "con ese filtro" : "ingeridas"}. La ingesta corre a diario vía{" "}
                <code className="text-xs">/api/cron/noticias-macro</code>.
              </p>
            </div>
          )}

          <div className="space-y-3">
            {noticias.map((n) => (
              <div key={n.id} className="rounded-[4px] border border-line-fine bg-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <a href={n.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-primary hover:underline">
                    {n.titulo}
                  </a>
                  <span className="shrink-0 text-[11px] text-muted-foreground/60">{formatFecha(n.publicado_el)}</span>
                </div>
                {n.resumen && <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">{n.resumen}</p>}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-[3px] border border-line-fine bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{n.fuente}</span>
                  <span className="rounded-[3px] border border-line-fine px-2 py-0.5 text-[10px] text-muted-foreground/70">{FUENTE_TIPO_LABEL[n.fuente_tipo]}</span>
                  {[...n.comunas, ...n.tipos_propiedad].map((tag) => (
                    <a
                      key={tag}
                      href={n.comunas.includes(tag) ? `?comuna=${encodeURIComponent(tag)}` : `?tipo=${encodeURIComponent(tag)}`}
                      className="rounded-[3px] border border-line-fine px-2 py-0.5 text-[10px] text-primary hover:bg-[var(--blueprint)]/[0.05]"
                    >
                      {tag}
                    </a>
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
