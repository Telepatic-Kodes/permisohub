import { LineChart } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

interface IndicadorRow {
  fecha_captura: string
  uf: number
  ipc: number | null
  tpm: number | null
  dolar: number | null
}

function formatFecha(iso: string): string {
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso))
}

function formatNum(n: number | null, opts?: Intl.NumberFormatOptions): string {
  if (n === null) return "—"
  return n.toLocaleString("es-CL", opts)
}

export default async function MacroPage() {
  let filas: IndicadorRow[] = []
  let errorMsg: string | null = null

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from("indicadores_macro_historial")
      .select("fecha_captura, uf, ipc, tpm, dolar")
      .order("fecha_captura", { ascending: false })
      .limit(30)

    if (error) throw error
    filas = (data ?? []) as IndicadorRow[]
  } catch {
    errorMsg = "No se pudo cargar el historial de indicadores — intenta de nuevo en unos minutos."
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="📈"
        title="Indicadores Macro"
        subtitle="UF, IPC, TPM y dólar — historial diario"
        breadcrumbs={[{ label: "Mercado Inmobiliario" }, { label: "Macro" }]}
      />

      <div className="flex-1 p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMsg}</div>
          )}

          {!errorMsg && filas.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-[4px] border border-line-fine bg-card p-10 text-center">
              <LineChart className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Aún no hay historial — la ingesta corre a diario vía{" "}
                <code className="text-xs">/api/cron/noticias-macro</code>.
              </p>
            </div>
          )}

          {!errorMsg && filas.length > 0 && (
            <div className="overflow-x-auto rounded-[4px] border border-line-fine bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line-fine text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    <th className="px-4 py-3 text-left font-technical font-medium">Fecha</th>
                    <th className="px-4 py-3 text-right font-technical font-medium">UF</th>
                    <th className="px-4 py-3 text-right font-technical font-medium">IPC</th>
                    <th className="px-4 py-3 text-right font-technical font-medium">TPM</th>
                    <th className="px-4 py-3 text-right font-technical font-medium">Dólar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-fine">
                  {filas.map((f) => (
                    <tr key={f.fecha_captura}>
                      <td className="px-4 py-2.5 text-muted-foreground">{formatFecha(f.fecha_captura)}</td>
                      <td className="num px-4 py-2.5 text-right font-medium text-primary">
                        ${formatNum(f.uf, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="num px-4 py-2.5 text-right text-muted-foreground">{formatNum(f.ipc, { maximumFractionDigits: 1 })}%</td>
                      <td className="num px-4 py-2.5 text-right text-muted-foreground">{formatNum(f.tpm, { maximumFractionDigits: 2 })}%</td>
                      <td className="num px-4 py-2.5 text-right text-muted-foreground">${formatNum(f.dolar, { maximumFractionDigits: 0 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
