// Catálogo de obligaciones regulatorias RECURRENTES de un edificio ya en
// operación (distinto del checklist de expediente del Copiloto, que es para
// permisos en trámite — este es para lo que hay que mantener al día una vez
// que el edificio ya opera). Investigado explícitamente para no fabricar
// requisitos: cada ítem tiene base legal real y fuente verificada (2026-08-01).
// Se excluyeron a propósito ítems sin una obligación periódica confirmada
// (recepción definitiva, TE1, fondo de reserva, libro de actas — son
// trámites únicos o cargos estructurales, no vencimientos).
export type AplicabilidadObligacion = 'siempre' | 'ascensor' | 'gas'

export type PeriodicidadObligacion =
  | { tipo: 'fija'; meses: number }
  // Ascensores: la periodicidad real varía según destino/capacidad del
  // equipo y no hay una cifra única confirmada en el reglamento — mostrar
  // una fecha calculada sería fabricar precisión que no existe.
  | { tipo: 'variable'; nota: string }

export interface ObligacionRegulatoria {
  slug: string
  nombre: string
  baseLegal: string
  certificador: string
  aplicabilidad: AplicabilidadObligacion
  periodicidad: PeriodicidadObligacion
}

export const OBLIGACIONES_REGULATORIAS: ObligacionRegulatoria[] = [
  {
    slug: 'certificacion-ascensores',
    nombre: 'Certificación periódica de ascensores/montacargas',
    baseLegal: 'Ley N°20.296 y su reglamento (DS N°37/2015, MINVU)',
    certificador: 'Organismo de certificación acreditado (Registro Nacional MINVU)',
    aplicabilidad: 'ascensor',
    periodicidad: { tipo: 'variable', nota: 'Cada 1 o 2 años según destino y capacidad del equipo — confirmar con el organismo certificador, no hay un ciclo único fijo por reglamento.' },
  },
  {
    slug: 'plan-emergencia-evacuacion',
    nombre: 'Plan de emergencia y evacuación',
    baseLegal: 'Ley N°21.442 de Copropiedad Inmobiliaria, Art. 40',
    certificador: 'Ingeniero en prevención de riesgos — entregado a Carabineros y Bomberos',
    aplicabilidad: 'siempre',
    periodicidad: { tipo: 'fija', meses: 12 },
  },
  {
    slug: 'asamblea-ordinaria',
    nombre: 'Asamblea ordinaria — rendición de cuentas',
    baseLegal: 'Ley N°21.442 de Copropiedad Inmobiliaria, Art. 14',
    certificador: 'Administración del condominio',
    aplicabilidad: 'siempre',
    periodicidad: { tipo: 'fija', meses: 12 },
  },
  {
    slug: 'seguro-incendio-comun',
    nombre: 'Seguro colectivo contra incendio de bienes comunes',
    baseLegal: 'Ley N°21.442 de Copropiedad Inmobiliaria, Art. 43',
    certificador: 'Compañía de seguros / corredor regulado por la CMF',
    aplicabilidad: 'siempre',
    periodicidad: { tipo: 'fija', meses: 12 },
  },
  {
    slug: 'inspeccion-gas-sello-verde',
    nombre: 'Inspección periódica de instalaciones de gas (Sello Verde)',
    baseLegal: 'DS N°66/2007 (Energía) + Res. Exenta N°1.250/2009, SEC',
    certificador: 'Organismo de certificación de gas autorizado por la SEC',
    aplicabilidad: 'gas',
    periodicidad: { tipo: 'fija', meses: 24 },
  },
  {
    slug: 'mantencion-extintores',
    nombre: 'Mantención y recarga anual de extintores',
    baseLegal: 'DS N°44/2018 (Economía) — NCh 2056',
    certificador: 'Servicio Técnico de Extintores (STE) certificado ante el INN',
    aplicabilidad: 'siempre',
    periodicidad: { tipo: 'fija', meses: 12 },
  },
]

export function obligacionesAplicables(tieneAscensor: boolean, tieneGas: boolean): ObligacionRegulatoria[] {
  return OBLIGACIONES_REGULATORIAS.filter((o) => {
    if (o.aplicabilidad === 'ascensor') return tieneAscensor
    if (o.aplicabilidad === 'gas') return tieneGas
    return true
  })
}

export type EstadoObligacion = 'vencido' | 'por_vencer' | 'al_dia' | 'sin_registro' | 'verificar'

export interface ObligacionConEstado {
  obligacion: ObligacionRegulatoria
  fechaUltimoCumplimiento: string | null
  proximaFecha: string | null // null cuando la periodicidad es variable — no se fabrica una fecha
  estado: EstadoObligacion
}

const DIAS_ALERTA_POR_VENCER = 30

export function calcularEstadoObligacion(
  obligacion: ObligacionRegulatoria,
  fechaUltimoCumplimiento: string | null,
  hoy: Date,
): ObligacionConEstado {
  if (!fechaUltimoCumplimiento) {
    return { obligacion, fechaUltimoCumplimiento: null, proximaFecha: null, estado: 'sin_registro' }
  }

  if (obligacion.periodicidad.tipo === 'variable') {
    return { obligacion, fechaUltimoCumplimiento, proximaFecha: null, estado: 'verificar' }
  }

  const ultima = new Date(`${fechaUltimoCumplimiento}T00:00:00`)
  const proxima = new Date(ultima)
  proxima.setMonth(proxima.getMonth() + obligacion.periodicidad.meses)

  const diasHastaProxima = Math.round((proxima.getTime() - hoy.getTime()) / (1000 * 60 * 60 * 24))
  const estado: EstadoObligacion = diasHastaProxima < 0 ? 'vencido' : diasHastaProxima <= DIAS_ALERTA_POR_VENCER ? 'por_vencer' : 'al_dia'

  return {
    obligacion,
    fechaUltimoCumplimiento,
    proximaFecha: proxima.toISOString().slice(0, 10),
    estado,
  }
}
