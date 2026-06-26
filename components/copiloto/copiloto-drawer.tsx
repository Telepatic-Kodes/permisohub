"use client"

import { useState, useCallback } from 'react'
import { Bot, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { TabOguc } from '@/components/copiloto/tabs/tab-oguc'
import { TabObservaciones } from '@/components/copiloto/tabs/tab-observaciones'
import { TabChecklist } from '@/components/copiloto/tabs/tab-checklist'
import { TabEstimacion } from '@/components/copiloto/tabs/tab-estimacion'
import type { Proyecto } from '@/types'

export type TabId = 'oguc' | 'observaciones' | 'checklist' | 'estimacion'
type DrawerState = 'idle' | 'loading' | 'loaded' | 'error'

export interface OgucArticulo {
  numero: string
  titulo: string
  formula: string
  valor_normativo: string
  valor_proyecto: string
  cumple: boolean | null
  observacion?: string
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
  estado: 'pendiente' | 'ok'
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

const SKILL_CARDS: { id: TabId; title: string; description: string; icon: string }[] = [
  {
    id: 'oguc',
    title: 'Diagnóstico OGUC',
    description: 'Verifica FOT, FOS, rasantes y distanciamientos con artículos citados',
    icon: '⚖️',
  },
  {
    id: 'observaciones',
    title: 'Predicción de Observaciones',
    description: 'Anticípate a las observaciones más probables de la DOM con acciones preventivas',
    icon: '🔮',
  },
  {
    id: 'checklist',
    title: 'Checklist de Documentos',
    description: 'Lista completa de documentos requeridos, con seguimiento de estado',
    icon: '📋',
  },
  {
    id: 'estimacion',
    title: 'Estimación de Plazo',
    description: 'Días hábiles y derechos municipales en CLP y UF para este proyecto',
    icon: '📅',
  },
]

const TABS: { id: TabId; label: string }[] = [
  { id: 'oguc', label: 'OGUC' },
  { id: 'observaciones', label: 'Observaciones' },
  { id: 'checklist', label: 'Checklist' },
  { id: 'estimacion', label: 'Estimación' },
]

interface CopilotoDrawerProps {
  open: boolean
  proyecto: Pick<Proyecto, 'id' | 'nombre' | 'municipio' | 'tipo' | 'estado'> | null
  onClose: () => void
}

export function CopilotoDrawer({ open, proyecto, onClose }: CopilotoDrawerProps) {
  const [drawerState, setDrawerState] = useState<DrawerState>('idle')
  const [activeTab, setActiveTab] = useState<TabId>('oguc')
  const [result, setResult] = useState<CopilotoResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  // Cache by proyectoId to avoid re-fetching on tab switch or re-open
  const [cache, setCache] = useState<Map<string, CopilotoResult>>(new Map())

  const handleCardClick = useCallback(async (tabId: TabId) => {
    if (!proyecto) return

    // Use cache if available — instant result display
    const cached = cache.get(proyecto.id)
    if (cached) {
      setResult(cached)
      setDrawerState('loaded')
      setActiveTab(tabId)
      return
    }

    setDrawerState('loading')
    setActiveTab(tabId)
    setErrorMsg(null)

    try {
      const res = await fetch('/api/ai/copiloto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ proyectoId: proyecto.id }),
      })
      const json = await res.json() as { ok?: boolean; error?: string } & Partial<CopilotoResult>

      if (!json.ok || !json.oguc) {
        throw new Error(json.error ?? 'Error al cargar análisis')
      }

      const data: CopilotoResult = {
        oguc: json.oguc,
        observaciones: json.observaciones!,
        checklist: json.checklist!,
        estimacion: json.estimacion!,
      }

      setCache((prev) => new Map(prev).set(proyecto.id, data))
      setResult(data)
      setDrawerState('loaded')
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error desconocido')
      setDrawerState('error')
    }
  }, [proyecto, cache])

  const handleItemToggle = useCallback((itemKey: string, newEstado: 'pendiente' | 'ok') => {
    if (!result || !proyecto) return
    const updated: CopilotoResult = {
      ...result,
      checklist: {
        items: result.checklist.items.map((it) =>
          it.item_key === itemKey ? { ...it, estado: newEstado } : it
        ),
      },
    }
    setResult(updated)
    setCache((prev) => new Map(prev).set(proyecto.id, updated))
  }, [result, proyecto])

  function handleOpenChange(isOpen: boolean) {
    if (!isOpen) {
      onClose()
      // Reset to idle so next open starts with skill cards
      // Cache is preserved — reopening same project will hit cache instantly
      setDrawerState('idle')
      setResult(null)
    }
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="right" className="w-[480px] sm:max-w-[480px] overflow-y-auto p-0">
        <SheetHeader className="border-b border-border px-6 py-4">
          <div className="flex items-center gap-2">
            <Bot className="size-5 text-primary" />
            <SheetTitle>Copiloto IA</SheetTitle>
          </div>
          {proyecto && (
            <SheetDescription className="text-left">
              {proyecto.nombre} · {proyecto.municipio}
            </SheetDescription>
          )}
        </SheetHeader>

        <div className="px-6 py-4">
          {/* IDLE: show 4 skill cards — never blank */}
          {drawerState === 'idle' && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Selecciona un análisis para iniciar. Todos los datos provienen del expediente — no necesitas ingresar información adicional.
              </p>
              <div className="grid grid-cols-1 gap-2.5">
                {SKILL_CARDS.map((card) => (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => void handleCardClick(card.id)}
                    className="flex items-start gap-3 rounded-xl border border-border bg-white px-4 py-3 text-left transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm"
                  >
                    <span className="mt-0.5 text-xl leading-none">{card.icon}</span>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{card.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{card.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* LOADING */}
          {drawerState === 'loading' && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <Loader2 className="size-8 animate-spin text-primary" />
              <p className="text-sm font-medium">Analizando expediente…</p>
              <p className="text-xs text-muted-foreground">
                Ejecutando 4 análisis con GPT-4o. Esto toma 20–40 segundos.
              </p>
            </div>
          )}

          {/* ERROR */}
          {drawerState === 'error' && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              <p className="font-medium">Error al analizar</p>
              <p className="mt-1 text-xs">{errorMsg}</p>
              <button
                type="button"
                onClick={() => setDrawerState('idle')}
                className="mt-3 text-xs underline hover:no-underline"
              >
                Volver a intentar
              </button>
            </div>
          )}

          {/* LOADED: tab nav + tab content */}
          {drawerState === 'loaded' && result && (
            <div className="space-y-4">
              {/* Tab navigation — plain controlled buttons (NOT shadcn Tabs) */}
              <div className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
                {TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={cn(
                      'flex-1 rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                      activeTab === tab.id
                        ? 'bg-white text-primary shadow-sm'
                        : 'text-muted-foreground hover:text-foreground',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              {activeTab === 'oguc' && <TabOguc data={result.oguc} />}
              {activeTab === 'observaciones' && <TabObservaciones data={result.observaciones} />}
              {activeTab === 'checklist' && (
                <TabChecklist data={result.checklist} onToggle={handleItemToggle} />
              )}
              {activeTab === 'estimacion' && <TabEstimacion data={result.estimacion} />}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
