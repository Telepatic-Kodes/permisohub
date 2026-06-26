"use client"

import { cn } from '@/lib/utils'
import type { ObservacionesResult } from '../copiloto-drawer'

interface TabObservacionesProps {
  data: ObservacionesResult
}

const RIESGO_CONFIG = {
  BAJO: { label: 'Riesgo Bajo', className: 'bg-green-100 text-green-800 border-green-200' },
  MEDIO: { label: 'Riesgo Medio', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  ALTO: { label: 'Riesgo Alto', className: 'bg-red-100 text-red-800 border-red-200' },
}

const FRECUENCIA_DOT: Record<string, string> = {
  alta: 'bg-red-500',
  media: 'bg-amber-500',
  baja: 'bg-green-500',
}

export function TabObservaciones({ data }: TabObservacionesProps) {
  const riesgoCfg = RIESGO_CONFIG[data.riesgoGlobal]

  return (
    <div className="space-y-4 px-4">
      <div className="flex items-center gap-3">
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold',
            riesgoCfg.className,
          )}
        >
          {riesgoCfg.label}
        </span>
      </div>

      <p className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
        {data.resumen}
      </p>

      <div className="space-y-3">
        {data.predicciones.map((pred, idx) => (
          <div key={idx} className="rounded-xl border border-border bg-white p-4">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-medium">{pred.categoria}</p>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className={cn('size-2 rounded-full', FRECUENCIA_DOT[pred.frecuencia] ?? 'bg-slate-400')} />
                <span className="text-xs capitalize text-muted-foreground">{pred.frecuencia}</span>
              </div>
            </div>

            <div className="mt-3 space-y-2 text-xs">
              <div>
                <p className="text-muted-foreground">Por qué este proyecto</p>
                <p className="mt-0.5 leading-relaxed">{pred.triggerEspecifico}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Acción preventiva</p>
                <p className="mt-0.5 leading-relaxed text-primary">{pred.accionPreventiva}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
