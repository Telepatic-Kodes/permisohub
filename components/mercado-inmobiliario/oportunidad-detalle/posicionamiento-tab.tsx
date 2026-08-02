import { GaugeArc } from "@/components/mercado-inmobiliario/charts/gauge-arc"
import { DesviacionBar } from "@/components/mercado-inmobiliario/charts/desviacion-bar"
import type { OportunidadDetalle, BandasMercadoLocal } from "@/lib/mercado-locales-server"

interface PosicionamientoTabProps {
  oportunidad: OportunidadDetalle
  bandasArriendo: BandasMercadoLocal | null
  bandasVenta: BandasMercadoLocal | null
}

const MIN_COHORT_SIZE = 15 // mismo umbral que lib/mercado-locales-server.ts — solo para texto del banner, no para lógica (usoFallback ya viene calculado)

function fmt(n: number | null): string {
  return n === null ? "—" : n.toLocaleString("es-CL", { maximumFractionDigits: 2 })
}

export function PosicionamientoTab({ oportunidad, bandasArriendo, bandasVenta }: PosicionamientoTabProps) {
  const bandas = oportunidad.bandas
  const color = "var(--modulo-mercado)"

  return (
    <div className="space-y-5">
      {!bandas && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="mt-0.5 text-amber-500">⚠</span>
          <div className="text-sm">
            <span className="font-semibold text-amber-800">Sin banda de mercado</span>
            <span className="ml-1 text-amber-700">
              Todavía no hay bandas calculadas para {oportunidad.comuna} / {oportunidad.tipoPropiedad} / {oportunidad.operacion}.
              El motor de bandas corre a diario — vuelve a intentar mañana.
            </span>
          </div>
        </div>
      )}

      {bandas?.usoFallback && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <span className="mt-0.5 text-amber-500">⚠</span>
          <div className="text-sm">
            <span className="font-semibold text-amber-800">Muestra insuficiente en la comuna</span>
            <span className="ml-1 text-amber-700">
              {oportunidad.comuna} solo tiene N={bandas.muestraNComuna} avisos (mínimo {MIN_COHORT_SIZE} para confiar en su propia
              banda) — se muestran las cifras metropolitanas (N={bandas.muestraN}) en su lugar.
            </span>
          </div>
        </div>
      )}

      <div className="rounded-lg border border-line-fine bg-card p-4">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
          Muestra de la cohorte{bandas?.usoFallback ? " (metropolitana)" : ""}
        </p>
        <p className="num text-xl font-semibold text-primary">N={bandas ? bandas.muestraN : "—"}</p>
      </div>

      {bandas && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <GaugeArc
            value={oportunidad.precioUfNormalizado}
            max={Math.max(bandas.p75Uf ?? oportunidad.precioUfNormalizado, oportunidad.precioUfNormalizado)}
            label="Precio vs. P75 de la cohorte (UF)"
            valueLabel={`${fmt(oportunidad.precioUfNormalizado)} UF`}
            color={color}
          />
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-line-fine bg-card p-4">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">% vs. mediana de la cohorte</p>
            {bandas.medianaUf !== null && bandas.medianaUf > 0 ? (
              <DesviacionBar
                variacionPct={((oportunidad.precioUfNormalizado - bandas.medianaUf) / bandas.medianaUf) * 100}
                color={color}
              />
            ) : (
              <p className="text-xs text-muted-foreground">Sin mediana UF disponible en esta banda.</p>
            )}
          </div>
        </div>
      )}

      {bandas && (
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="rounded-lg border border-line-fine bg-card p-3">
            <p className="text-[10px] uppercase text-muted-foreground">P25</p>
            <p className="num text-sm font-semibold">{fmt(bandas.p25Uf)} UF</p>
            <p className="num text-[11px] text-muted-foreground">{fmt(bandas.p25UfM2)} UF/m²</p>
          </div>
          <div className="rounded-lg border border-line-fine bg-card p-3">
            <p className="text-[10px] uppercase text-muted-foreground">Mediana</p>
            <p className="num text-sm font-semibold">{fmt(bandas.medianaUf)} UF</p>
            <p className="num text-[11px] text-muted-foreground">{fmt(bandas.medianaUfM2)} UF/m²</p>
          </div>
          <div className="rounded-lg border border-line-fine bg-card p-3">
            <p className="text-[10px] uppercase text-muted-foreground">P75</p>
            <p className="num text-sm font-semibold">{fmt(bandas.p75Uf)} UF</p>
            <p className="num text-[11px] text-muted-foreground">{fmt(bandas.p75UfM2)} UF/m²</p>
          </div>
        </div>
      )}
    </div>
  )
}
