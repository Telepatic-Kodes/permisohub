import { Radar, TrendingUp } from "lucide-react"
import type { OportunidadDetalle, PuntoHistorialPrecio } from "@/lib/mercado-locales-server"
import { REASON_LABEL_DETALLE } from "@/lib/mercado-locales-server"
import type { SenalExpansionComuna } from "@/lib/cadenas-sucursales-server"
import type { TendenciaConstruccionComuna } from "@/lib/ine-permisos-server"
import { formatFechaCorta } from "@/lib/formato-fecha"

interface HistorialTabProps {
  oportunidad: OportunidadDetalle
  historial: PuntoHistorialPrecio[]
  senalExpansion: SenalExpansionComuna | null
  tendenciaConstruccion: TendenciaConstruccionComuna | null
}

function formatMonto(precioMonto: number, precioMoneda: string): string {
  return `${precioMonto.toLocaleString("es-CL", { maximumFractionDigits: precioMoneda === "UF" ? 2 : 0 })} ${precioMoneda}`
}

// primera_vez_visto_el/ultima_vez_visto_el/capturado_el son timestamptz — se
// formatean con new Date(iso) directo, SIN el sufijo T00:00:00 que usa
// formatFechaCorta (esa función es solo para campos date-only como
// stats_date). Ver lib/formato-fecha.ts.
function formatTimestamp(iso: string): string {
  return new Intl.DateTimeFormat("es-CL", { day: "2-digit", month: "short", year: "numeric", timeZone: "America/Santiago" }).format(
    new Date(iso),
  )
}

export function HistorialTab({ oportunidad, historial, senalExpansion, tendenciaConstruccion }: HistorialTabProps) {
  const diasPublicado = Math.floor((Date.now() - new Date(oportunidad.primeraVezVistoEl).getTime()) / 86400000)

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-line-fine bg-card p-4">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Publicado hace</p>
        <p className="num text-xl font-semibold text-primary">{diasPublicado} {diasPublicado === 1 ? "día" : "días"}</p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          Primera vez visto: {formatTimestamp(oportunidad.primeraVezVistoEl)} · Última actualización: {formatTimestamp(oportunidad.ultimaVezVistoEl)}
        </p>
        {oportunidad.status === "dado_de_baja" && oportunidad.dadoDeBajaEl && (
          <p className="mt-1 text-[11px] font-medium text-red-700">Dado de baja el {formatTimestamp(oportunidad.dadoDeBajaEl)}</p>
        )}
      </div>

      <div className="rounded-lg border border-line-fine bg-card p-4">
        <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">Historial de precio</p>
        {historial.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin cambios de precio registrados desde que se detectó este aviso.</p>
        ) : (
          <ul className="space-y-1.5">
            {historial.map((p, i) => (
              <li key={`${p.capturadoEl}-${i}`} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{formatTimestamp(p.capturadoEl)}</span>
                <span className="num font-medium text-primary">{formatMonto(p.precioMonto, p.precioMoneda)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-line-fine bg-card p-4">
        <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">Señales detectadas</p>
        {oportunidad.reasonCodes.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Este aviso no calificó como oportunidad por precio bajo ni por baja reciente — si llegaste aquí desde comparables,
            es un dato real de la cohorte, no una oportunidad flageada.
          </p>
        ) : (
          <ul className="space-y-2">
            {oportunidad.reasonCodes.map((code) => (
              <li key={code} className="text-sm leading-snug text-foreground">
                <span className="font-medium">{REASON_LABEL_DETALLE[code] ?? code}</span>
              </li>
            ))}
          </ul>
        )}

        {(senalExpansion || tendenciaConstruccion?.tendencia === "creciente") && (
          <div className="mt-3 space-y-1.5 border-t border-line-fine pt-3">
            {senalExpansion && (
              <p className="inline-flex items-start gap-1.5 text-[11px] text-modulo-mercado">
                <Radar className="mt-0.5 size-3 shrink-0" />
                {senalExpansion.cadena} tiene sucursal registrada en {oportunidad.comuna}
                {formatFechaCorta(senalExpansion.fechaRegistro) ? ` (registrada ${formatFechaCorta(senalExpansion.fechaRegistro)})` : ""}
              </p>
            )}
            {tendenciaConstruccion?.tendencia === "creciente" && (
              <p className="inline-flex items-start gap-1.5 text-[11px] text-modulo-mercado">
                <TrendingUp className="mt-0.5 size-3 shrink-0" />
                Actividad constructiva histórica en alza en {oportunidad.comuna} (INE, {tendenciaConstruccion.variacionPct?.toFixed(0)}%)
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
