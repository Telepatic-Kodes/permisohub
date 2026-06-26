"use client"

import { useState, useEffect, useCallback } from "react"
import {
  ClipboardList,
  Building2,
  ShieldCheck,
  HeartPulse,
  Receipt,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

type EstadoItem = 'pendiente' | 'en_tramite' | 'completado' | 'no_aplica'

type ItemOnboarding = {
  id: string
  nombre: string
  descripcion: string
  plazo_dias: number
  requerido: boolean
  estado: EstadoItem
  orden: number
  categoria: 'permisos' | 'certificados' | 'sanitario' | 'comercial'
}

type GetResponse = {
  ok: boolean
  checklist: ItemOnboarding[]
  local_nombre: string
  municipio: string
  progreso: number
}

interface OnboardingWizardProps {
  localId: string
  localNombre: string
  municipio: string
}

const ESTADO_CYCLE: Record<EstadoItem, EstadoItem> = {
  pendiente: 'en_tramite',
  en_tramite: 'completado',
  completado: 'no_aplica',
  no_aplica: 'pendiente',
}

const ESTADO_STYLES: Record<EstadoItem, string> = {
  pendiente: 'bg-amber-100 text-amber-700 border-amber-200',
  en_tramite: 'bg-blue-100 text-blue-700 border-blue-200',
  completado: 'bg-green-100 text-green-700 border-green-200',
  no_aplica: 'bg-slate-100 text-slate-500 border-slate-200',
}

const ESTADO_LABELS: Record<EstadoItem, string> = {
  pendiente: 'Pendiente',
  en_tramite: 'En trámite',
  completado: 'Completado',
  no_aplica: 'No aplica',
}

const CATEGORIA_LABELS: Record<ItemOnboarding['categoria'], string> = {
  permisos: 'Permisos',
  certificados: 'Certificados',
  sanitario: 'Sanitario',
  comercial: 'Comercial',
}

const CATEGORIA_ICONS: Record<ItemOnboarding['categoria'], React.ReactNode> = {
  permisos: <Building2 className="h-4 w-4" />,
  certificados: <ShieldCheck className="h-4 w-4" />,
  sanitario: <HeartPulse className="h-4 w-4" />,
  comercial: <Receipt className="h-4 w-4" />,
}

const CATEGORIAS: ItemOnboarding['categoria'][] = ['permisos', 'certificados', 'sanitario', 'comercial']

export function OnboardingWizard({ localId, localNombre, municipio }: OnboardingWizardProps) {
  const [open, setOpen] = useState(false)
  const [checklist, setChecklist] = useState<ItemOnboarding[]>([])
  const [progreso, setProgreso] = useState(0)
  const [loading, setLoading] = useState(false)
  const [updatingId, setUpdatingId] = useState<string | null>(null)

  const fetchChecklist = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/locales/${localId}/onboarding`)
      const data = (await res.json()) as GetResponse
      if (data.ok) {
        setChecklist(data.checklist)
        setProgreso(data.progreso)
      }
    } catch {
      // silent
    } finally {
      setLoading(false)
    }
  }, [localId])

  useEffect(() => {
    if (open) {
      void fetchChecklist()
    }
  }, [open, fetchChecklist])

  async function handleEstadoClick(item: ItemOnboarding) {
    const nextEstado = ESTADO_CYCLE[item.estado]
    setUpdatingId(item.id)
    try {
      const res = await fetch(`/api/locales/${localId}/onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId: item.id, estado: nextEstado }),
      })
      const data = (await res.json()) as { ok: boolean; item?: ItemOnboarding }
      if (data.ok) {
        setChecklist((prev) => {
          const updated = prev.map((i) =>
            i.id === item.id ? { ...i, estado: nextEstado } : i
          )
          const completados = updated.filter((i) => i.estado === 'completado').length
          setProgreso(Math.round((completados / updated.length) * 100))
          return updated
        })
      }
    } catch {
      // silent
    } finally {
      setUpdatingId(null)
    }
  }

  function handleOpenChange(value: boolean) {
    setOpen(value)
    if (!value) {
      setChecklist([])
      setProgreso(0)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <ClipboardList className="mr-2 h-4 w-4" />
        Onboarding
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Onboarding — {localNombre}</DialogTitle>
          <p className="text-sm text-muted-foreground">{municipio}</p>
        </DialogHeader>

        <div className="space-y-5 py-2">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progreso</span>
              <span className="font-medium">{progreso}% completado</span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-300"
                style={{ width: `${progreso}%` }}
              />
            </div>
          </div>

          {loading && (
            <div className="space-y-3">
              {[1, 2, 3, 4].map((n) => (
                <div key={n} className="h-14 rounded-lg bg-slate-100 animate-pulse" />
              ))}
            </div>
          )}

          {!loading && checklist.length > 0 && (
            <div className="space-y-5">
              {CATEGORIAS.map((cat) => {
                const items = checklist.filter((i) => i.categoria === cat)
                if (items.length === 0) return null
                return (
                  <div key={cat} className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {CATEGORIA_ICONS[cat]}
                      <span>{CATEGORIA_LABELS[cat]}</span>
                    </div>
                    <div className="space-y-2">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-start justify-between gap-3 rounded-lg border border-border p-3"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-snug">
                              {item.nombre}
                              {!item.requerido && (
                                <span className="ml-1.5 text-xs text-muted-foreground font-normal">
                                  (opcional)
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                              {item.descripcion}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Plazo estimado: {item.plazo_dias} días
                            </p>
                          </div>
                          <button
                            onClick={() => void handleEstadoClick(item)}
                            disabled={updatingId === item.id}
                            className={[
                              'shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-opacity cursor-pointer',
                              ESTADO_STYLES[item.estado],
                              updatingId === item.id ? 'opacity-50 cursor-not-allowed' : 'hover:opacity-80',
                            ].join(' ')}
                          >
                            {ESTADO_LABELS[item.estado]}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
