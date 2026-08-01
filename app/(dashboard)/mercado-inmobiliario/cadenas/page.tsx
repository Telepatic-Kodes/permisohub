import { Radar, AlertTriangle } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import {
  obtenerResumenExpansionCadenas,
  obtenerSucursalesRecientes,
} from "@/lib/cadenas-sucursales-server"
import { CADENAS_RUT_CONOCIDOS } from "@/lib/scrapers/sii-nomina-sucursales"

export const dynamic = "force-dynamic"

function formatFecha(iso: string | null): string {
  if (!iso) return "Sin fecha registrada"
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(`${iso}T00:00:00`)
  )
}

export default async function ExpansionCadenasPage() {
  const pendientes = CADENAS_RUT_CONOCIDOS.filter((c) => c.estado === "needs-decision")

  let resumen: Awaited<ReturnType<typeof obtenerResumenExpansionCadenas>> = []
  let recientes: Awaited<ReturnType<typeof obtenerSucursalesRecientes>> = []
  let errorMsg: string | null = null

  try {
    ;[resumen, recientes] = await Promise.all([
      obtenerResumenExpansionCadenas(),
      obtenerSucursalesRecientes(15),
    ])
  } catch {
    errorMsg = "No se pudo cargar la expansión de cadenas — intenta de nuevo en unos minutos."
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="📡"
        title="Expansión de Cadenas"
        subtitle="Nuevas sucursales de cadenas comerciales, detectadas vía la nómina nacional del SII — no depende de anuncios de prensa"
        breadcrumbs={[{ label: "Expansión de Cadenas" }]}
      />

      <div className="flex-1 p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          {errorMsg && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{errorMsg}</div>
          )}

          {pendientes.length > 0 && (
            <div className="flex gap-3 rounded-[4px] border border-amber-200 bg-amber-50 p-4">
              <AlertTriangle className="size-5 shrink-0 text-amber-600" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">
                  {pendientes.length} cadena{pendientes.length > 1 ? "s" : ""} sin datos todavía
                </p>
                <ul className="mt-1 space-y-0.5">
                  {pendientes.map((c) => (
                    <li key={c.rut}>
                      <span className="font-medium">{c.cadena}</span> — {c.nota}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {!errorMsg && resumen.length === 0 && (
            <div className="flex flex-col items-center gap-3 rounded-[4px] border border-line-fine bg-card p-10 text-center">
              <Radar className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                Sin datos todavía — la nómina del SII se sincroniza el día 2 de cada mes.
              </p>
            </div>
          )}

          {resumen.length > 0 && (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {resumen.map((r) => (
                <div key={r.cadena} className="rounded-[4px] border border-line-fine bg-card p-4">
                  <p className="text-sm font-semibold text-primary">{r.cadena}</p>
                  <p className="num mt-1 text-2xl font-light">{r.sucursalesActivas}</p>
                  <p className="text-xs text-muted-foreground">
                    sucursales activas en {r.comunas.length} comuna{r.comunas.length !== 1 ? "s" : ""}
                  </p>
                </div>
              ))}
            </div>
          )}

          {recientes.length > 0 && (
            <div>
              <p className="mb-2 font-technical text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                Sucursales registradas más recientemente
              </p>
              <div className="space-y-2">
                {recientes.map((s, i) => (
                  <div
                    key={`${s.cadena}-${s.calle}-${i}`}
                    className="flex items-center justify-between gap-3 rounded-[4px] border border-line-fine bg-card px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">{s.calle}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.comuna}
                        {s.region ? ` · ${s.region}` : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-semibold text-primary">{s.cadena}</p>
                      <p className="text-[11px] text-muted-foreground">{formatFecha(s.fechaRegistro)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-center text-[11px] text-muted-foreground/60">
            Fuente: Nómina nacional de direcciones del SII (actualizada mensualmente). La fecha mostrada es la de
            registro de la dirección ante el SII, no necesariamente la fecha de apertura al público. "Vigente" es un
            estado administrativo-tributario, no una confirmación de que el local sigue abierto — una dirección
            puede quedar "no vigente" por una corrección de registro sin que la tienda haya cerrado, y una tienda
            real puede seguir sin desregistrarse tras cerrar. Tratar como señal indicativa, no como conteo exacto.
          </p>
        </div>
      </div>
    </div>
  )
}
