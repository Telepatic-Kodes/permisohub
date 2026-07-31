"use client"

import { CheckCircle2, XCircle, Minus } from 'lucide-react'
import type { OgucResult } from '@/components/copiloto/tipos'

interface TabOgucProps {
  data: OgucResult
}

export function TabOguc({ data }: TabOgucProps) {
  return (
    <div className="space-y-4">
      <p className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
        {data.resumen}
      </p>

      <div className="space-y-3">
        {data.articulos.map((art, idx) => (
          // Cuadro de artículo: cabecera y, debajo, las tres magnitudes en
          // celdas divididas por línea fina, como el cuadro de una lámina. En
          // el cajón de 480 px esto se apilaba y el texto normativo se partía
          // palabra por palabra; a ancho de página se lee como una fila.
          <div key={`${art.numero}-${idx}`} className="rotulo overflow-hidden bg-card">
            <div className="flex items-start gap-2.5 px-4 py-3">
              {art.cumple === true && (
                <CheckCircle2 className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--state-ok)' }} />
              )}
              {art.cumple === false && (
                <XCircle className="mt-0.5 size-4 shrink-0" style={{ color: 'var(--state-error)' }} />
              )}
              {art.cumple === null && (
                <Minus className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <span className="num text-[11px] font-semibold text-muted-foreground">
                  {art.numero}
                </span>
                <p className="font-technical text-sm font-semibold leading-snug">{art.titulo}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 divide-y divide-line-fine border-t border-line-fine sm:grid-cols-3 sm:divide-x sm:divide-y-0">
              <div className="min-w-0 px-4 py-2.5">
                <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Fórmula
                </p>
                <p className="num text-[13px] leading-snug">{art.formula}</p>
              </div>
              <div className="min-w-0 px-4 py-2.5">
                <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Normativa
                </p>
                <p className="num text-[13px] leading-snug">{art.valor_normativo}</p>
              </div>
              <div className="min-w-0 px-4 py-2.5">
                <p className="mb-0.5 text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Valor del proyecto
                </p>
                <p
                  className="num text-[13px] font-semibold leading-snug"
                  style={{
                    color:
                      art.cumple === false
                        ? 'var(--state-error)'
                        : art.cumple === true
                          ? 'var(--state-ok)'
                          : undefined,
                  }}
                >
                  {art.valor_proyecto}
                </p>
              </div>
            </div>

            {art.observacion && (
              <p
                className="border-t border-line-fine px-4 py-2.5 text-xs leading-5"
                style={{
                  color: 'var(--state-warn)',
                  background: 'color-mix(in oklch, var(--state-warn) 8%, transparent)',
                }}
              >
                {art.observacion}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
