"use client"

import { Clock, DollarSign, AlertTriangle, Lightbulb } from 'lucide-react'
import type { EstimacionResult } from '../copiloto-drawer'

const CLP = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
})

interface TabEstimacionProps {
  data: EstimacionResult
}

export function TabEstimacion({ data }: TabEstimacionProps) {
  return (
    <div className="space-y-4 px-4">
      {/* Plazo */}
      <div className="rounded-xl border border-border bg-white p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Clock className="size-4 text-primary" />
          Plazo estimado
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums text-primary">
            {data.plazoMinDias}–{data.plazoMaxDias}
          </span>
          <span className="text-sm text-muted-foreground">días hábiles</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          ≈ {Math.round(data.plazoMinDias / 5)}–{Math.round(data.plazoMaxDias / 5)} semanas calendario
        </p>

        {data.factores.length > 0 && (
          <div className="mt-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Factores</p>
            <ul className="space-y-1">
              {data.factores.map((f, idx) => (
                <li key={idx} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                  <span className="mt-1 size-1.5 shrink-0 rounded-full bg-muted-foreground/40" />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Derechos */}
      <div className="rounded-xl border border-border bg-white p-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <DollarSign className="size-4 text-primary" />
          Derechos municipales
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-3xl font-semibold tabular-nums text-primary">
            {CLP.format(data.derechosCLP)}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{data.derechosUF} UF al valor actual</p>

        {data.derechosDetalle.length > 0 && (
          <div className="mt-3 space-y-1">
            {data.derechosDetalle.map((d, idx) => (
              <p key={idx} className="text-xs text-muted-foreground">{d}</p>
            ))}
          </div>
        )}
      </div>

      {/* Advertencias */}
      {data.derechosAdvertencias.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-800">
            <AlertTriangle className="size-4" />
            Advertencias
          </div>
          <ul className="mt-2 space-y-1">
            {data.derechosAdvertencias.map((adv, idx) => (
              <li key={idx} className="text-xs text-amber-700">{adv}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recomendación */}
      {data.recomendacion && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Lightbulb className="size-4" />
            Recomendación
          </div>
          <p className="mt-2 text-xs leading-relaxed text-primary/80">{data.recomendacion}</p>
        </div>
      )}
    </div>
  )
}
