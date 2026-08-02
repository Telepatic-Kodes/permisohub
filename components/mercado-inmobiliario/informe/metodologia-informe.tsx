import { formatFechaCorta } from "@/lib/formato-fecha"
import { TIPO_PROPIEDAD_LABEL, type OperacionMercadoLocal, type TipoPropiedadComercial } from "@/lib/scrapers/mercado-locales-common"
import type { BandasMercadoLocal } from "@/lib/mercado-locales-server"

export interface FuenteMetodologia {
  comuna: string
  operacion: OperacionMercadoLocal
  tipoPropiedad: TipoPropiedadComercial
  bandas: BandasMercadoLocal | null
}

interface MetodologiaInformeProps {
  fuentes: FuenteMetodologia[]
}

/**
 * Sección de metodología/fuentes compartida entre los informes de esta fase
 * (Plan 15-02 pasa un solo elemento, Plan 15-03 uno por comuna distinta).
 * bandas.statsDate es DATE-ONLY (Pitfall 3) — usa formatFechaCorta, no
 * formatTimestampCorto (a diferencia de generadoEl en PortadaInforme).
 */
export function MetodologiaInforme({ fuentes }: MetodologiaInformeProps) {
  return (
    <section className="mt-8 border-t border-line-fine pt-6 text-sm">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Metodología y fuentes</h2>
      <p className="mt-2 text-muted-foreground">
        Datos de PortalInmobiliario recolectados por el motor de mercado de PermisoHub. Bandas de precio (P25/mediana/P75)
        recalculadas diariamente por comuna, tipo de propiedad y operación sobre listados activos.
      </p>
      <ul className="mt-3 space-y-2">
        {fuentes.map((f, i) => (
          <li key={`${f.comuna}-${f.operacion}-${f.tipoPropiedad}-${i}`}>
            {f.bandas ? (
              <>
                <span className="font-medium text-foreground">{f.comuna}</span>
                {" "}({TIPO_PROPIEDAD_LABEL[f.tipoPropiedad].singular}, {f.operacion === "venta" ? "venta" : "arriendo"}):
                {" "}muestra n={f.bandas.muestraN}
                {f.bandas.usoFallback ? ` (fallback citywide — comuna real n=${f.bandas.muestraNComuna})` : ""}
                {", "}UF usado {f.bandas.ufValorUsado}
                {", "}banda vigente al {formatFechaCorta(f.bandas.statsDate)}
              </>
            ) : (
              <span className="text-amber-700">
                {f.comuna}: sin banda de mercado disponible para esta combinación — sin comparación de cohorte.
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
