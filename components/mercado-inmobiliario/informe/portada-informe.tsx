import { formatTimestampCorto } from "@/lib/formato-fecha"
import { PreparadoPorPara } from "./preparado-por-para"

interface PortadaInformeProps {
  titulo: string
  subtitulo: string
  generadoEl: Date
}

/**
 * Portada compartida entre los informes de esta fase (Plan 15-02 individual,
 * Plan 15-03 comparación). Embebe PreparadoPorPara directamente para que
 * INFO-04 quede satisfecho por construcción — ningún consumidor puede
 * olvidar renderizar el campo.
 */
export function PortadaInforme({ titulo, subtitulo, generadoEl }: PortadaInformeProps) {
  return (
    <header className="border-b border-line-fine pb-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        PermisoHub · Mercado Inmobiliario
      </p>
      <h1 className="mt-1 text-3xl font-bold text-primary">{titulo}</h1>
      <p className="mt-1 text-base text-muted-foreground">{subtitulo}</p>
      <p className="mt-3 text-xs text-muted-foreground">Generado el {formatTimestampCorto(generadoEl.toISOString())}</p>
      <PreparadoPorPara />
    </header>
  )
}
