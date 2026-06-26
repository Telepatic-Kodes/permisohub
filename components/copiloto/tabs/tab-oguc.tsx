"use client"

import { CheckCircle2, XCircle, Minus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { OgucResult } from '../copiloto-drawer'

interface TabOgucProps {
  data: OgucResult
}

export function TabOguc({ data }: TabOgucProps) {
  return (
    <div className="space-y-4 px-4">
      <p className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
        {data.resumen}
      </p>

      <div className="space-y-3">
        {data.articulos.map((art, idx) => (
          <div
            key={`${art.numero}-${idx}`}
            className="rounded-xl border border-border bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-semibold text-primary">{art.numero}</span>
                  {art.cumple === true && (
                    <CheckCircle2 className="size-4 shrink-0 text-green-500" />
                  )}
                  {art.cumple === false && (
                    <XCircle className="size-4 shrink-0 text-red-500" />
                  )}
                  {art.cumple === null && (
                    <Minus className="size-4 shrink-0 text-muted-foreground" />
                  )}
                </div>
                <p className="mt-0.5 text-sm font-medium">{art.titulo}</p>
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="space-y-1">
                <p className="text-muted-foreground">Fórmula</p>
                <p className="font-mono">{art.formula}</p>
              </div>
              <div className="space-y-1">
                <p className="text-muted-foreground">Normativa</p>
                <p className="font-mono">{art.valor_normativo}</p>
              </div>
              <div className="col-span-2 space-y-1">
                <p className="text-muted-foreground">Valor del proyecto</p>
                <p
                  className={cn(
                    'font-mono font-medium',
                    art.cumple === false ? 'text-red-600' : art.cumple === true ? 'text-green-600' : ''
                  )}
                >
                  {art.valor_proyecto}
                </p>
              </div>
            </div>

            {art.observacion && (
              <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {art.observacion}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
