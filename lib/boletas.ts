import type {
  EstadoBoleta,
  TipoServicioBasico,
  TramiteBoleta,
  ProveedorServicio,
} from '@/types'
import { Droplets, Zap, Flame } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// ── Proveedores por tipo de servicio ─────────────────────────────────────────

export const PROVEEDORES_POR_SERVICIO: Record<
  TipoServicioBasico,
  { value: ProveedorServicio | string; label: string }[]
> = {
  agua: [
    { value: 'aguas_andinas',  label: 'Aguas Andinas (RM)' },
    { value: 'essbio',         label: 'Essbio (Bío-Bío, O\'Higgins)' },
    { value: 'esval',          label: 'Esval (Valparaíso)' },
    { value: 'smapa',          label: 'SMAPA (Maipú)' },
    { value: 'aguas_del_valle',label: 'Aguas del Valle (Coquimbo)' },
  ],
  electricidad: [
    { value: 'enel',      label: 'Enel (RM y Coquimbo)' },
    { value: 'cge',       label: 'CGE (resto del país)' },
    { value: 'chilquinta',label: 'Chilquinta (Valparaíso)' },
    { value: 'frontel',   label: 'Frontel (Araucanía)' },
    { value: 'saesa',     label: 'Saesa (Los Lagos, Los Ríos)' },
    { value: 'luz_osorno',label: 'Luz Osorno' },
  ],
  gas: [
    { value: 'metrogas', label: 'Metrogas (RM)' },
    { value: 'gasco',    label: 'Gasco' },
    { value: 'lipigas',  label: 'Lipigas' },
    { value: 'abastible',label: 'Abastible' },
  ],
}

// ── Config visual por servicio ────────────────────────────────────────────────

export const SERVICIO_CONFIG: Record<
  TipoServicioBasico,
  { label: string; icon: LucideIcon; color: string; iconBg: string; badgeBg: string }
> = {
  agua: {
    label:   'Agua',
    icon:    Droplets,
    color:   'text-blue-600',
    iconBg:  'bg-blue-100',
    badgeBg: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  electricidad: {
    label:   'Electricidad',
    icon:    Zap,
    color:   'text-amber-600',
    iconBg:  'bg-amber-100',
    badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  gas: {
    label:   'Gas',
    icon:    Flame,
    color:   'text-orange-600',
    iconBg:  'bg-orange-100',
    badgeBg: 'bg-orange-50 text-orange-700 border-orange-200',
  },
}

// ── Trámites que requieren cada boleta ───────────────────────────────────────

export const TRAMITES_POR_SERVICIO: Record<TipoServicioBasico, TramiteBoleta[]> = {
  agua:         ['informe_sanitario', 'autorizacion_sanitaria_alimentos'],
  electricidad: ['patente_comercial'],
  gas:          ['patente_comercial'],
}

export const TRAMITE_LABELS: Record<TramiteBoleta, string> = {
  informe_sanitario:             'Informe Sanitario SEREMI',
  autorizacion_sanitaria_alimentos: 'Autorización Sanitaria Alimentos',
  patente_comercial:             'Patente Comercial',
  otro:                          'Otro trámite',
}

// ── Cálculo de estado ─────────────────────────────────────────────────────────

export function calcularEstadoBoleta(fechaVencimiento: string | null | undefined): EstadoBoleta {
  if (!fechaVencimiento) return 'pendiente'
  const hoy  = new Date()
  const venc = new Date(fechaVencimiento)
  const diffDays = Math.ceil((venc.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0)   return 'vencida'
  if (diffDays <= 30) return 'por_vencer'
  return 'vigente'
}

// ── Formato de período ────────────────────────────────────────────────────────

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]

export function formatPeriodo(periodo: string): string {
  const [year, month] = periodo.split('-')
  const mes = MESES[parseInt(month, 10) - 1] ?? month
  return `${mes} ${year}`
}

export function getPeriodoActual(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function getPeriodoAnterior(): string {
  const now = new Date()
  now.setMonth(now.getMonth() - 1)
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

// ── Estado config UI ──────────────────────────────────────────────────────────

export const ESTADO_BOLETA_CONFIG: Record<
  EstadoBoleta,
  { label: string; className: string; dot: string }
> = {
  vigente:    { label: 'Vigente',     className: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  por_vencer: { label: 'Por vencer',  className: 'bg-amber-50  text-amber-700  border-amber-200',    dot: 'bg-amber-400'   },
  vencida:    { label: 'Vencida',     className: 'bg-red-50    text-red-700    border-red-200',       dot: 'bg-red-500'     },
  pendiente:  { label: 'Sin boleta',  className: 'bg-neutral-50 text-neutral-500 border-neutral-200', dot: 'bg-neutral-300' },
}

// ── Cálculo de cumplimiento ───────────────────────────────────────────────────

export function calcularCumplimientoPct(
  agua: EstadoBoleta,
  electricidad: EstadoBoleta,
  gas: EstadoBoleta,
): number {
  const score = [agua, electricidad, gas].filter((e) => e === 'vigente').length
  return Math.round((score / 3) * 100)
}
