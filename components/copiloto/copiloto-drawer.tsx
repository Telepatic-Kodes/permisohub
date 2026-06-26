"use client"

import { useState, useCallback } from 'react'
import { X, Bot, Loader2, AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { TabOguc } from './tabs/tab-oguc'
import { TabObservaciones } from './tabs/tab-observaciones'
import { TabChecklist } from './tabs/tab-checklist'
import { TabEstimacion } from './tabs/tab-estimacion'
import type { Proyecto } from '@/types'

export interface OgucArticulo {
  numero: string
  titulo: string
  formula: string
  valor_normativo: string
  valor_proyecto: string
  cumple: boolean | null
  observacion: string
}

export interface OgucResult {
  articulos: OgucArticulo[]
  resumen: string
}

export interface ObservacionPrediccion {
  categoria: string
  frecuencia: 'alta' | 'media' | 'baja'
  triggerEspecifico: string
  accionPreventiva: string
}

export interface ObservacionesResult {
  riesgoGlobal: 'BAJO' | 'MEDIO' | 'ALTO'
  predicciones: ObservacionPrediccion[]
  resumen: string
}

export interface ChecklistItem {
  id?: string
  item_key: string
  nombre: string
  articulo_normativo: string
  descripcion: string
  obligatorio: boolean
  estado: string
}

export interface ChecklistResult {
  items: ChecklistItem[]
}

export interface EstimacionResult {
  plazoMinDias: number
  plazoMaxDias: number
  factores: string[]
  recomendacion: string
  derechosCLP: number
  derechosUF: number
  derechosDetalle: string[]
  derechosAdvertencias: string[]
}

export interface CopilotoResult {
  oguc: OgucResult
  observaciones: ObservacionesResult
  checklist: ChecklistResult
  estimacion: EstimacionResult
}

type Tab = 'oguc' | 'observaciones' | 'checklist' | 'estimacion'
type DrawerState = 'idle' | 'loading' | 'loaded' | 'error'

type ProyectoLike = Pick<Proyecto, 'id' | 'nombre' | 'municipio' | 'tipo' | 'estado'>

interface CopilotoDrawerProps {
  proyecto: ProyectoLike | null
  open: boolean
  onClose: () => void
}

const TABS: { id: Tab; label: string }[] = [
  { id: 'oguc', label: 'OGUC' },
  { id: 'observaciones', label: 'Observaciones' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'estimacion', label: 'Plazos y derechos' },
]

export function CopilotoDrawer({ proyecto, open, onClose }: CopilotoDrawerProps) {
  const [tab, setTab] = useState<Tab>('oguc')
  const [state, setState] = useState<DrawerState>('idle')
  const [error, setError] = useState<string | null>(null)
  const [cache, setCache] = useState<Map<string, CopilotoResult>>(new Map())
  const [current, setCurrent] = useState<CopilotoResult | null>(null)

  const runAnalysis = useCallback(async (proyectoId: string) => {
    const cached = cache.get(proyectoId)
    if (cached) {
      setCurrent(cached)
      setState('loaded')
      return
    }

    setState('loading')
    setError(null)
    setTab('oguc')

    try {
      const res = await fetch('/api/ai/copiloto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyectoId }),
      })
      const data = await res.json() as { ok?: boolean; error?: string } & Partial<CopilotoResult>

      if (!res.ok || data.error) {
        throw new Error(data.error ?? 'Error al analizar el proyecto')
      }

      const result = data as CopilotoResult
      setCache(prev => new Map(prev).set(proyectoId, result))
      setCurrent(result)
      setState('loaded')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido')
      setState('error')
    }
  }, [cache])

  const handleOpenChange = useCallback((isOpen: boolean) => {
    if (!isOpen) {
      onClose()
    } else if (proyecto) {
      void runAnalysis(proyecto.id)
    }
  }, [onClose, proyecto, runAnalysis])

  const handleRetry = useCallback(() => {
    if (proyecto) void runAnalysis(proyecto.id)
  }, [proyecto, runAnalysis])

  const handleItemToggle = useCallback((itemKey: string, newEstado: string) => {
    if (!current || !proyecto) return
    const updated: CopilotoResult = {
      ...current,
      checklist: {
        items: current.checklist.items.map(it =>
          it.item_key === itemKey ? { ...it, estado: newEstado } : it
        ),
      },
    }
    setCurrent(updated)
    setCache(prev => new Map(prev).set(proyecto.id, updated))
  }, [current, proyecto])

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col sm:max-w-xl">
        <SheetHeader className="flex-row items-center justify-between border-b pb-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10">
              <Bot className="size-4 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-base">Copiloto IA</SheetTitle>
              {proyecto && (
                <p className="text-xs text-muted-foreground">{proyecto.nombre}</p>
              )}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="size-8 p-0">
            <X className="size-4" />
          </Button>
        </SheetHeader>

        {/* Tab nav */}
        <div className="flex gap-1 border-b px-1 pb-0 pt-2">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`rounded-t-md px-3 py-2 text-xs font-medium transition-colors ${
                tab === t.id
                  ? 'bg-primary/8 text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto py-4">
          {state === 'loading' && (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Analizando con IA…</p>
              <p className="text-xs text-muted-foreground/60">Puede tomar hasta 30 segundos</p>
            </div>
          )}

          {state === 'error' && (
            <div className="flex h-full flex-col items-center justify-center gap-4">
              <AlertCircle className="size-8 text-destructive" />
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" size="sm" onClick={handleRetry}>
                <RefreshCw className="size-3.5" />
                Reintentar
              </Button>
            </div>
          )}

          {state === 'loaded' && current && (
            <>
              {tab === 'oguc' && <TabOguc data={current.oguc} />}
              {tab === 'observaciones' && <TabObservaciones data={current.observaciones} />}
              {tab === 'checklist' && (
                <TabChecklist
                  data={current.checklist}
                  onToggle={handleItemToggle}
                />
              )}
              {tab === 'estimacion' && <TabEstimacion data={current.estimacion} />}
            </>
          )}

          {state === 'idle' && (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <Bot className="size-8 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Selecciona un proyecto para analizar</p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
