"use client"

import { use, useState, useEffect } from 'react'
import Link from 'next/link'
import { CheckCircle2, XCircle, MinusCircle, ClipboardCheck } from 'lucide-react'
import { MOCK_LOCALES, MOCK_CENTROS, MOCK_CADENAS } from '@/lib/mock-data'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ChecklistItemDef = {
  id: string
  categoria: string
  item: string
  obligatorio: boolean
}

type EstadoItem = 'conforme' | 'no_conforme' | 'no_aplica'

type ItemState = {
  estado: EstadoItem | null
  nota: string
}

type InspeccionData = {
  ok: true
  local: {
    id: string
    numero: string
    nombre_negocio: string | null
    uso: string | null
    area_m2: number | null
  }
  centro: { nombre: string; municipio: string; direccion?: string }
  cadena: { nombre: string }
  checklist: ChecklistItemDef[]
  ultima_inspeccion: {
    fecha: string
    inspector: string
    resultado: 'conforme' | 'no_conforme' | 'con_observaciones'
  } | null
}

type LocalBrief = {
  id: string
  numero: string
  nombre_negocio: string | null
  centro_id: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RESULTADO_LABELS: Record<'conforme' | 'no_conforme' | 'con_observaciones', string> = {
  conforme: 'Conforme',
  no_conforme: 'No conforme',
  con_observaciones: 'Con observaciones',
}

const RESULTADO_COLORS: Record<'conforme' | 'no_conforme' | 'con_observaciones', string> = {
  conforme: 'text-green-700',
  no_conforme: 'text-red-700',
  con_observaciones: 'text-amber-700',
}

// ---------------------------------------------------------------------------
// Sub-component: LocalSelector
// ---------------------------------------------------------------------------

function LocalSelector({
  centroId,
  cadenaId,
}: {
  centroId: string
  cadenaId: string
}) {
  const [locales, setLocales] = useState<LocalBrief[]>([])
  const [centrNombre, setCentrNombre] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/centros/${centroId}`)
      .then(r => r.json())
      .then((d: { centro?: { nombre: string; locales?: LocalBrief[] } }) => {
        if (d.centro) {
          setCentrNombre(d.centro.nombre)
          setLocales(d.centro.locales ?? [])
        }
      })
      .catch(() => {
        // fallback mock
        const centro = MOCK_CENTROS.find(cc => cc.id === centroId)
        if (centro) {
          setCentrNombre(centro.nombre)
          const mockLocales = MOCK_LOCALES.filter(l => l.centro_id === centroId).map(l => ({
            id: l.id,
            numero: l.numero,
            nombre_negocio: l.nombre_negocio ?? null,
            centro_id: l.centro_id,
          }))
          setLocales(mockLocales)
        }
      })
      .finally(() => setLoading(false))
  }, [centroId])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Cargando locales…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3 mb-1">
          <ClipboardCheck className="size-5 text-slate-600 shrink-0" />
          <h1 className="text-base font-semibold text-slate-900 truncate">Receptor de Obras</h1>
        </div>
        <p className="text-xs text-slate-500 ml-8">{centrNombre || 'Centro comercial'}</p>
      </div>

      {/* Body */}
      <div className="px-4 py-6 space-y-3 max-w-lg mx-auto">
        <p className="text-sm text-slate-600 font-medium mb-4">Selecciona el local a inspeccionar:</p>
        {locales.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-10">No hay locales registrados en este centro.</p>
        )}
        {locales.map(local => (
          <Link
            key={local.id}
            href={`/cadenas-comerciales/${cadenaId}/centros/${centroId}/receptor?localId=${local.id}`}
            className="flex items-center justify-between bg-white rounded-xl shadow-sm p-4 border border-slate-100 hover:border-slate-300 active:bg-slate-50 transition-colors min-h-[64px]"
          >
            <div>
              <p className="font-mono font-semibold text-slate-900 text-sm">{local.numero}</p>
              {local.nombre_negocio && (
                <p className="text-xs text-slate-500 mt-0.5">{local.nombre_negocio}</p>
              )}
            </div>
            <ClipboardCheck className="size-4 text-slate-400 shrink-0" />
          </Link>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: EstadoButton
// ---------------------------------------------------------------------------

function EstadoButton({
  value,
  current,
  onClick,
}: {
  value: EstadoItem
  current: EstadoItem | null
  onClick: () => void
}) {
  const isActive = current === value

  const styles: Record<EstadoItem, { base: string; active: string; icon: React.ReactNode }> = {
    conforme: {
      base: 'border-slate-200 text-slate-600 hover:border-green-400 hover:bg-green-50',
      active: 'bg-green-100 text-green-700 border-green-600',
      icon: <CheckCircle2 className="size-4 shrink-0" />,
    },
    no_conforme: {
      base: 'border-slate-200 text-slate-600 hover:border-red-400 hover:bg-red-50',
      active: 'bg-red-100 text-red-700 border-red-600',
      icon: <XCircle className="size-4 shrink-0" />,
    },
    no_aplica: {
      base: 'border-slate-200 text-slate-600 hover:border-slate-400 hover:bg-slate-100',
      active: 'bg-slate-100 text-slate-600 border-slate-400',
      icon: <MinusCircle className="size-4 shrink-0" />,
    },
  }

  const labels: Record<EstadoItem, string> = {
    conforme: 'Conforme',
    no_conforme: 'No conforme',
    no_aplica: 'No aplica',
  }

  const s = styles[value]

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-colors min-h-[48px] flex-1 justify-center ${
        isActive ? s.active : s.base
      }`}
    >
      {s.icon}
      <span className="hidden sm:inline">{labels[value]}</span>
      <span className="sm:hidden">{value === 'no_conforme' ? 'No conf.' : labels[value]}</span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Sub-component: ChecklistView
// ---------------------------------------------------------------------------

function ChecklistView({
  localId,
  centroId,
  cadenaId,
}: {
  localId: string
  centroId: string
  cadenaId: string
}) {
  const [data, setData] = useState<InspeccionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [itemStates, setItemStates] = useState<Record<string, ItemState>>({})
  const [inspectorNombre, setInspectorNombre] = useState('')
  const [observacionesGenerales, setObservacionesGenerales] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [resultado, setResultado] = useState<{ inspeccion_id: string; resultado: 'conforme' | 'no_conforme' | 'con_observaciones' } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/receptor/${localId}`)
      .then(r => r.json())
      .then((d: InspeccionData | { error: string }) => {
        if ('error' in d) {
          setError(d.error)
          return
        }
        setData(d)
        const initial: Record<string, ItemState> = {}
        d.checklist.forEach(item => {
          initial[item.id] = { estado: null, nota: '' }
        })
        setItemStates(initial)
      })
      .catch(() => setError('Error al cargar el checklist. Intenta nuevamente.'))
      .finally(() => setLoading(false))
  }, [localId])

  function setEstado(itemId: string, estado: EstadoItem) {
    setItemStates(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], estado },
    }))
  }

  function setNota(itemId: string, nota: string) {
    setItemStates(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], nota },
    }))
  }

  async function handleSubmit() {
    if (!data) return
    if (!inspectorNombre.trim()) {
      setError('Ingresa el nombre del inspector antes de registrar.')
      return
    }

    const unanswered = data.checklist.filter(item => item.obligatorio && itemStates[item.id]?.estado === null)
    if (unanswered.length > 0) {
      setError(`Faltan ${unanswered.length} item(s) obligatorio(s) por responder.`)
      return
    }

    setError(null)
    setSubmitting(true)

    const items = data.checklist.map(item => ({
      id: item.id,
      estado: (itemStates[item.id]?.estado ?? 'no_aplica') as EstadoItem,
      nota: itemStates[item.id]?.nota || undefined,
    }))

    try {
      const res = await fetch(`/api/receptor/${localId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          inspector_nombre: inspectorNombre.trim(),
          observaciones_generales: observacionesGenerales.trim() || undefined,
        }),
      })
      const json = await res.json() as { ok: boolean; inspeccion_id: string; resultado: 'conforme' | 'no_conforme' | 'con_observaciones' }
      if (json.ok) {
        setResultado({ inspeccion_id: json.inspeccion_id, resultado: json.resultado })
      } else {
        setError('Error al registrar la inspección.')
      }
    } catch {
      setError('Error de conexión. Intenta nuevamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 text-sm">Cargando checklist…</p>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4 px-6">
        <XCircle className="size-10 text-red-400" />
        <p className="text-slate-600 text-sm text-center">{error ?? 'Local no encontrado.'}</p>
        <Link
          href={`/cadenas-comerciales/${cadenaId}/centros/${centroId}/receptor`}
          className="text-xs text-blue-600 underline"
        >
          Volver a selección de locales
        </Link>
      </div>
    )
  }

  // ---- Success screen ----
  if (resultado) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-6 px-6">
        <CheckCircle2 className="size-16 text-green-500" />
        <div className="text-center space-y-1">
          <p className="text-lg font-semibold text-slate-900">Inspección registrada</p>
          <p className="text-sm text-slate-500">
            Local <span className="font-mono font-semibold">{data.local.numero}</span>
            {data.local.nombre_negocio && ` · ${data.local.nombre_negocio}`}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 w-full max-w-sm text-center space-y-1">
          <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Resultado</p>
          <p className={`text-xl font-bold ${RESULTADO_COLORS[resultado.resultado]}`}>
            {RESULTADO_LABELS[resultado.resultado]}
          </p>
          <p className="text-xs text-slate-400 font-mono mt-2">{resultado.inspeccion_id}</p>
        </div>
        <Link
          href={`/cadenas-comerciales/${cadenaId}/centros/${centroId}`}
          className="mt-2 inline-flex items-center justify-center h-12 px-6 rounded-xl bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
        >
          Volver a centros
        </Link>
      </div>
    )
  }

  // Group checklist by categoria
  const categorias = Array.from(new Set(data.checklist.map(i => i.categoria)))
  const byCategoria: Record<string, ChecklistItemDef[]> = {}
  for (const cat of categorias) {
    byCategoria[cat] = data.checklist.filter(i => i.categoria === cat)
  }

  const totalItems = data.checklist.filter(i => i.obligatorio).length
  const respondidos = data.checklist.filter(i => i.obligatorio && itemStates[i.id]?.estado !== null).length

  return (
    <div className="min-h-screen bg-slate-50 pb-40">
      {/* Header */}
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="size-5 text-slate-600 shrink-0" />
          <div className="min-w-0">
            <h1 className="text-base font-semibold text-slate-900 truncate">
              {data.local.numero}
              {data.local.nombre_negocio && ` · ${data.local.nombre_negocio}`}
            </h1>
            <p className="text-xs text-slate-500 truncate">
              {data.centro.nombre} &middot; {data.centro.municipio}
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-3">
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Progreso obligatorios</span>
            <span>{respondidos}/{totalItems}</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-blue-500 rounded-full transition-all"
              style={{ width: totalItems > 0 ? `${(respondidos / totalItems) * 100}%` : '0%' }}
            />
          </div>
        </div>
      </div>

      {/* Ultima inspección badge */}
      {data.ultima_inspeccion && (
        <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-xs text-amber-800">
          <span className="font-medium">Última inspección:</span>{' '}
          {new Date(data.ultima_inspeccion.fecha).toLocaleDateString('es-CL')} &middot;{' '}
          {data.ultima_inspeccion.inspector} &middot;{' '}
          <span className="font-semibold">{RESULTADO_LABELS[data.ultima_inspeccion.resultado]}</span>
        </div>
      )}

      {/* Checklist sections */}
      <div className="px-4 mt-4 space-y-4 max-w-lg mx-auto">
        {categorias.map(cat => (
          <div key={cat} className="bg-white rounded-xl shadow-sm overflow-hidden">
            {/* Category header */}
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700">{cat}</p>
            </div>
            {/* Items */}
            <div className="divide-y divide-slate-50">
              {byCategoria[cat].map(item => {
                const state = itemStates[item.id] ?? { estado: null, nota: '' }
                return (
                  <div key={item.id} className="px-4 py-4 space-y-3">
                    <div className="flex items-start gap-2">
                      <p className="text-sm text-slate-800 flex-1 leading-snug">{item.item}</p>
                      {item.obligatorio && (
                        <span className="text-[10px] text-red-500 font-medium shrink-0 mt-0.5">*</span>
                      )}
                    </div>
                    {/* Estado buttons */}
                    <div className="flex gap-2">
                      <EstadoButton
                        value="conforme"
                        current={state.estado}
                        onClick={() => setEstado(item.id, 'conforme')}
                      />
                      <EstadoButton
                        value="no_conforme"
                        current={state.estado}
                        onClick={() => setEstado(item.id, 'no_conforme')}
                      />
                      <EstadoButton
                        value="no_aplica"
                        current={state.estado}
                        onClick={() => setEstado(item.id, 'no_aplica')}
                      />
                    </div>
                    {/* Nota field when no_conforme */}
                    {state.estado === 'no_conforme' && (
                      <textarea
                        className="w-full rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm placeholder-red-300 text-red-900 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
                        rows={2}
                        placeholder="Describe la no conformidad…"
                        value={state.nota}
                        onChange={e => setNota(item.id, e.target.value)}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {/* Observaciones generales */}
        <div className="bg-white rounded-xl shadow-sm p-4 space-y-2">
          <p className="text-sm font-semibold text-slate-700">Observaciones generales</p>
          <textarea
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
            rows={3}
            placeholder="Observaciones adicionales (opcional)…"
            value={observacionesGenerales}
            onChange={e => setObservacionesGenerales(e.target.value)}
          />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 inset-x-0 bg-white border-t shadow-lg p-4 z-20">
        <div className="max-w-lg mx-auto space-y-3">
          <input
            type="text"
            className="w-full h-12 rounded-xl border border-slate-200 px-4 text-sm placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Nombre del inspector *"
            value={inspectorNombre}
            onChange={e => setInspectorNombre(e.target.value)}
          />
          <button
            type="button"
            onClick={() => { void handleSubmit() }}
            disabled={submitting}
            className="w-full h-12 rounded-xl bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800 active:bg-slate-950 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? 'Registrando…' : 'Registrar Inspección'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReceptorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; centroId: string }>
  searchParams: Promise<{ localId?: string }>
}) {
  const { id, centroId } = use(params)
  const { localId } = use(searchParams)

  if (localId) {
    return (
      <ChecklistView
        localId={localId}
        centroId={centroId}
        cadenaId={id}
      />
    )
  }

  return (
    <LocalSelector
      centroId={centroId}
      cadenaId={id}
    />
  )
}
