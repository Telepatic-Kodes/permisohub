"use client"

import { GaugeArc } from "@/components/mercado-inmobiliario/charts/gauge-arc"
import { DesviacionBar } from "@/components/mercado-inmobiliario/charts/desviacion-bar"
import { RankingBarChart } from "@/components/mercado-inmobiliario/charts/ranking-bar-chart"
import { Badge } from "@/components/ui/badge"
import { calcularCapRate } from "@/lib/calculadora-inversion"
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

  const arriendoUfM2 = bandasArriendo?.medianaUfM2 ?? null
  const ventaUfM2 = bandasVenta?.medianaUfM2 ?? null
  const rentabilidad = arriendoUfM2 !== null && ventaUfM2 !== null && ventaUfM2 > 0
    ? calcularCapRate({ rentaMensual: arriendoUfM2, precioVenta: ventaUfM2 })
    : null

  // precioValido no basta: un CLP sin banda de conversión del día queda con
  // precioUfNormalizado=0 (ver construirOportunidadDetalle en
  // mercado-locales-server.ts) — comparar ese 0 contra la cohorte fabricaría
  // una posición ("más barato que todo el mercado") que no es real.
  const precioComparable = oportunidad.precioValido && oportunidad.precioUfNormalizado > 0

  const itemsBandaUf = bandas
    ? [
        { label: "P25", valor: bandas.p25Uf ?? 0 },
        { label: "Mediana", valor: bandas.medianaUf ?? 0 },
        { label: "P75", valor: bandas.p75Uf ?? 0 },
        ...(precioComparable ? [{ label: "Este aviso", valor: oportunidad.precioUfNormalizado, color }] : []),
      ].filter((item) => item.valor > 0)
    : []
  const itemsBandaUfM2 = bandas
    ? [
        { label: "P25", valor: bandas.p25UfM2 ?? 0 },
        { label: "Mediana", valor: bandas.medianaUfM2 ?? 0 },
        { label: "P75", valor: bandas.p75UfM2 ?? 0 },
        ...(precioComparable && oportunidad.precioUfM2Normalizado !== null
          ? [{ label: "Este aviso", valor: oportunidad.precioUfM2Normalizado, color }]
          : []),
      ].filter((item) => item.valor > 0)
    : []
  // Las bandas de UF total (no por m²) pueden venir vacías para venta —
  // varían demasiado por tamaño de lote para bandear de forma confiable — en
  // ese caso se usa UF/m², que sí suele tener datos, en vez de dejar el
  // gráfico vacío.
  const usarBandaUfM2 = itemsBandaUf.length < 2 && itemsBandaUfM2.length >= 2
  const itemsBanda = usarBandaUfM2 ? itemsBandaUfM2 : itemsBandaUf
  const unidadBanda = usarBandaUfM2 ? "UF/m²" : "UF"

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
        precioComparable ? (
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
        ) : (
          <div className="rounded-lg border border-line-fine bg-card p-4 text-center text-xs text-muted-foreground">
            {oportunidad.precioValido
              ? "No se pudo convertir el precio a UF (sin banda de conversión del día para esta comuna/tipo) — no se puede comparar contra la cohorte."
              : "Precio no disponible en moneda reconocida — no se puede comparar contra la cohorte."}
          </div>
        )
      )}

      {bandas && (
        <div>
          {itemsBanda.length > 0 ? (
            <RankingBarChart
              titulo={`Posición del precio vs. bandas de la cohorte (${unidadBanda})`}
              items={itemsBanda}
              formatValor={(n) => `${fmt(n)} ${unidadBanda}`}
            />
          ) : (
            <div className="rounded-lg border border-line-fine bg-card p-4 text-center text-xs text-muted-foreground">
              Sin banda de precio suficiente para graficar en {oportunidad.comuna} / {oportunidad.tipoPropiedad}.
            </div>
          )}
          {!usarBandaUfM2 && (
            <div className="mt-2 grid grid-cols-3 gap-3 text-center text-[11px] text-muted-foreground">
              <p>P25 <span className="num">{fmt(bandas.p25UfM2)}</span> UF/m²</p>
              <p>Mediana <span className="num">{fmt(bandas.medianaUfM2)}</span> UF/m²</p>
              <p>P75 <span className="num">{fmt(bandas.p75UfM2)}</span> UF/m²</p>
            </div>
          )}
        </div>
      )}

      <div className="rounded-lg border border-line-fine bg-card p-4">
        <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">
          Rentabilidad implícita de zona ({oportunidad.comuna} / {oportunidad.tipoPropiedad})
        </p>

        {rentabilidad ? (
          <>
            <div className="flex items-center gap-2">
              <p className="num text-2xl font-semibold text-primary">{rentabilidad.capNeto.toFixed(1)}%</p>
              <Badge className="border border-violet-200 bg-violet-100 text-violet-800">Estimado de zona</Badge>
            </div>
            <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
              Cap rate neto estimado (vacancia 7% / opex 15% genéricos) a partir de la mediana UF/m² de arriendo vs. venta de
              la zona — NO es la rentabilidad del activo específico de esta ficha, que es {oportunidad.operacion} y no tiene
              su contraparte real ({oportunidad.operacion === "venta" ? "arriendo" : "venta"}) del mismo inmueble.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Banda arriendo UF/m²</p>
                <p className="num font-medium">
                  {fmt(arriendoUfM2)} (N={bandasArriendo?.muestraN}{bandasArriendo?.usoFallback ? ", metropolitana" : ""})
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Banda venta UF/m²</p>
                <p className="num font-medium">
                  {fmt(ventaUfM2)} (N={bandasVenta?.muestraN}{bandasVenta?.usoFallback ? ", metropolitana" : ""})
                </p>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {arriendoUfM2 === null && ventaUfM2 === null
              ? `Sin datos de arriendo NI de venta suficientes en ${oportunidad.comuna} / ${oportunidad.tipoPropiedad} todavía — no se puede estimar.`
              : arriendoUfM2 === null
                ? `Sin datos de arriendo suficientes en ${oportunidad.comuna} / ${oportunidad.tipoPropiedad} — no se puede estimar la rentabilidad de zona.`
                : `Sin datos de venta suficientes en ${oportunidad.comuna} / ${oportunidad.tipoPropiedad} — no se puede estimar la rentabilidad de zona.`}
          </p>
        )}
      </div>
    </div>
  )
}
