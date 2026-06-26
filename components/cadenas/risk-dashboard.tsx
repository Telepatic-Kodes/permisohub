"use client"

import { useEffect, useState } from "react"
import { ShieldAlert, AlertTriangle, TrendingUp, CheckCircle, Minus } from "lucide-react"

type NivelRiesgo = 'critico' | 'alto' | 'medio' | 'bajo'

type Factores = {
  sin_permiso: boolean
  dias_para_vencimiento: number | null
  especialidades_pendientes: number
  observaciones_abiertas: number
  municipio_enforcement: 'alto' | 'medio' | 'bajo'
}

type LocalRiesgo = {
  local_id: string
  local_numero: string
  local_nombre: string
  centro_nombre: string
  municipio: string
  score: number
  nivel: NivelRiesgo
  factores: Factores
}

type Resumen = {
  criticos: number
  altos: number
  medios: number
  bajos: number
  score_promedio: number
}

type RiskData = {
  ok: boolean
  locales: LocalRiesgo[]
  resumen: Resumen
}

interface RiskDashboardProps {
  cadenaId: string
}

const NIVEL_CONFIG: Record<
  NivelRiesgo,
  { label: string; badgeClass: string; barColor: string; kpiColor: string }
> = {
  critico: {
    label: 'Crítico',
    badgeClass: 'bg-red-100 text-red-700 border border-red-200',
    barColor: 'bg-red-500',
    kpiColor: 'text-red-600',
  },
  alto: {
    label: 'Alto',
    badgeClass: 'bg-orange-100 text-orange-700 border border-orange-200',
    barColor: 'bg-orange-500',
    kpiColor: 'text-orange-600',
  },
  medio: {
    label: 'Medio',
    badgeClass: 'bg-amber-100 text-amber-700 border border-amber-200',
    barColor: 'bg-amber-400',
    kpiColor: 'text-amber-600',
  },
  bajo: {
    label: 'Bajo',
    badgeClass: 'bg-green-100 text-green-700 border border-green-200',
    barColor: 'bg-green-500',
    kpiColor: 'text-green-600',
  },
}

type FiltroNivel = 'todos' | NivelRiesgo

function SkeletonLoader() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-16 rounded-lg bg-gray-100 animate-pulse" />
      ))}
    </div>
  )
}

function KpiCard({
  label,
  count,
  nivel,
  icon,
}: {
  label: string
  count: number
  nivel: NivelRiesgo
  icon: React.ReactNode
}) {
  const cfg = NIVEL_CONFIG[nivel]
  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</span>
        <span className="text-gray-400">{icon}</span>
      </div>
      <span className={`text-3xl font-bold ${cfg.kpiColor}`}>{count}</span>
    </div>
  )
}

function FactoresPanel({ factores }: { factores: Factores }) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-gray-600 pl-2 border-l-2 border-gray-200">
      <span>
        Sin permiso:{' '}
        <span className={factores.sin_permiso ? 'text-red-600 font-semibold' : 'text-green-600'}>
          {factores.sin_permiso ? 'Sí' : 'No'}
        </span>
      </span>
      <span>
        Especialidades pendientes:{' '}
        <span className="font-semibold">{factores.especialidades_pendientes}</span>
      </span>
      <span>
        Días para vencimiento:{' '}
        <span className="font-semibold">
          {factores.dias_para_vencimiento !== null ? factores.dias_para_vencimiento : '—'}
        </span>
      </span>
      <span>
        Observaciones abiertas:{' '}
        <span className="font-semibold">{factores.observaciones_abiertas}</span>
      </span>
      <span className="col-span-2">
        Enforcement municipal:{' '}
        <span
          className={
            factores.municipio_enforcement === 'alto'
              ? 'text-red-600 font-semibold'
              : factores.municipio_enforcement === 'medio'
              ? 'text-amber-600 font-semibold'
              : 'text-green-600 font-semibold'
          }
        >
          {factores.municipio_enforcement.charAt(0).toUpperCase() +
            factores.municipio_enforcement.slice(1)}
        </span>
      </span>
    </div>
  )
}

function LocalRow({ local }: { local: LocalRiesgo }) {
  const [open, setOpen] = useState(false)
  const cfg = NIVEL_CONFIG[local.nivel]

  return (
    <div className="rounded-lg border bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-semibold text-sm text-gray-900 truncate">
                {local.local_numero} — {local.local_nombre}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.badgeClass}`}
              >
                {cfg.label}
              </span>
            </div>
            <p className="text-xs text-gray-500 truncate">
              {local.centro_nombre} · {local.municipio}
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="w-32 hidden sm:block">
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className={`h-full rounded-full ${cfg.barColor} transition-all`}
                  style={{ width: `${local.score}%` }}
                />
              </div>
            </div>
            <span className="text-sm font-mono font-semibold text-gray-700 w-16 text-right">
              {local.score}/100
            </span>
          </div>
        </div>
      </button>
      {open && (
        <div className="px-4 pb-3 border-t border-gray-100 bg-gray-50">
          <FactoresPanel factores={local.factores} />
        </div>
      )}
    </div>
  )
}

const FILTROS: { value: FiltroNivel; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'critico', label: 'Críticos' },
  { value: 'alto', label: 'Altos' },
  { value: 'medio', label: 'Medios' },
  { value: 'bajo', label: 'Bajos' },
]

export function RiskDashboard({ cadenaId }: RiskDashboardProps) {
  const [data, setData] = useState<RiskData | null>(null)
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<FiltroNivel>('todos')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/cadenas/${cadenaId}/risk-scores`)
      .then((r) => r.json())
      .then((json: RiskData) => {
        if (!cancelled) setData(json)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [cadenaId])

  const localesFiltrados =
    data?.locales.filter((l) => filtro === 'todos' || l.nivel === filtro) ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-5 w-5 text-red-500" />
        <h2 className="text-lg font-semibold text-gray-900">Análisis de Riesgo de Portfolio</h2>
      </div>

      {loading ? (
        <SkeletonLoader />
      ) : data ? (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard
              label="Críticos"
              count={data.resumen.criticos}
              nivel="critico"
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <KpiCard
              label="Altos"
              count={data.resumen.altos}
              nivel="alto"
              icon={<TrendingUp className="h-4 w-4" />}
            />
            <KpiCard
              label="Medios"
              count={data.resumen.medios}
              nivel="medio"
              icon={<Minus className="h-4 w-4" />}
            />
            <KpiCard
              label="Bajos"
              count={data.resumen.bajos}
              nivel="bajo"
              icon={<CheckCircle className="h-4 w-4" />}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {FILTROS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setFiltro(f.value)}
                className={`rounded-full px-3 py-1 text-xs font-medium border transition-colors ${
                  filtro === f.value
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {localesFiltrados.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">
                No hay locales con nivel &ldquo;{NIVEL_CONFIG[filtro as NivelRiesgo]?.label ?? filtro}&rdquo;.
              </p>
            ) : (
              localesFiltrados.map((local) => (
                <LocalRow key={local.local_id} local={local} />
              ))
            )}
          </div>

          <p className="text-xs text-gray-400 text-center pt-2">
            Scores actualizados en tiempo real · Metodología basada en historial municipal y estado
            de permisos
          </p>
        </>
      ) : (
        <p className="text-sm text-red-500">Error cargando datos de riesgo.</p>
      )}
    </div>
  )
}
