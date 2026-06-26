"use client"

import { useState } from 'react'
import { CheckSquare, Square } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChecklistResult } from '../copiloto-drawer'

interface TabChecklistProps {
  data: ChecklistResult
  onToggle: (itemKey: string, newEstado: 'pendiente' | 'ok') => void
}

export function TabChecklist({ data, onToggle }: TabChecklistProps) {
  const [toggling, setToggling] = useState<string | null>(null)

  const doneCount = data.items.filter(it => it.estado === 'ok').length

  async function handleToggle(item: ChecklistResult['items'][number]) {
    if (toggling) return
    const newEstado: 'pendiente' | 'ok' = item.estado === 'ok' ? 'pendiente' : 'ok'

    // Optimistic update via parent state
    onToggle(item.item_key, newEstado)

    if (!item.id) return

    setToggling(item.item_key)
    try {
      const res = await fetch(`/api/ai/copiloto/checklist/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: newEstado }),
      })
      if (!res.ok) {
        // Revert on PATCH error
        onToggle(item.item_key, item.estado)
      }
    } catch {
      onToggle(item.item_key, item.estado)
    } finally {
      setToggling(null)
    }
  }

  return (
    <div className="space-y-4 px-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {doneCount} de {data.items.length} documentos listos
        </p>
        <div className="h-2 w-32 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all duration-300"
            style={{ width: `${data.items.length ? (doneCount / data.items.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      <div className="space-y-2">
        {data.items.map((item) => {
          const isDone = item.estado === 'ok'
          return (
            <button
              key={item.item_key}
              type="button"
              onClick={() => void handleToggle(item)}
              disabled={toggling === item.item_key}
              className={cn(
                'flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors hover:bg-muted/30',
                isDone ? 'border-green-200 bg-green-50/50' : 'border-border bg-white',
                toggling === item.item_key && 'opacity-60',
              )}
            >
              {isDone ? (
                <CheckSquare className="mt-0.5 size-4 shrink-0 text-green-500" />
              ) : (
                <Square className="mt-0.5 size-4 shrink-0 text-muted-foreground/50" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className={cn('text-sm font-medium', isDone && 'line-through text-muted-foreground')}>
                    {item.nombre}
                  </p>
                  {item.obligatorio && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                      Obligatorio
                    </span>
                  )}
                </div>
                <p className="mt-0.5 font-mono text-[10px] text-muted-foreground">{item.articulo_normativo}</p>
                {!isDone && (
                  <p className="mt-1 text-xs text-muted-foreground/70">{item.descripcion}</p>
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
