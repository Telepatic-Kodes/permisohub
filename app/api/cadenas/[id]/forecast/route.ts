import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// Cost constants (CLP)
const PATENTE_COMERCIAL_POR_LOCAL = 250_000
const PERMISO_EDIFICACION_POR_M2 = 1_200
const PERMISO_EDIFICACION_MIN = 500_000
const PERMISO_EDIFICACION_MAX = 2_500_000
const RECEPCION_FINAL_POR_LOCAL = 450_000

// Month names in Spanish
const MES_NOMBRES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']

interface DesgloseLine {
  concepto: string
  cantidad: number
  costo_unitario: number
  total: number
}

interface CentroCostResult {
  centro_id: string
  nombre: string
  municipio: string
  locales_sin_permiso: number
  costo_estimado_clp: number
  desglose: DesgloseLine[]
}

interface CronogramaEntry {
  mes: string
  acumulado: number
  nuevos: number
}

type LocalRow = {
  id: string
  area_m2: number | null
  proyectos: { id: string }[] | null
}

type CentroRow = {
  id: string
  nombre: string
  municipio: string
  locales: LocalRow[] | null
}

function calcularCostoLocal(local: LocalRow): DesgloseLine[] {
  const lines: DesgloseLine[] = []

  // Patente comercial: always 1 per local
  lines.push({
    concepto: 'Patente Comercial',
    cantidad: 1,
    costo_unitario: PATENTE_COMERCIAL_POR_LOCAL,
    total: PATENTE_COMERCIAL_POR_LOCAL,
  })

  // Permiso de edificacion: if area_m2 known
  if (local.area_m2 !== null && local.area_m2 > 0) {
    const raw = local.area_m2 * PERMISO_EDIFICACION_POR_M2
    const clamped = Math.min(Math.max(raw, PERMISO_EDIFICACION_MIN), PERMISO_EDIFICACION_MAX)
    lines.push({
      concepto: 'Permiso de Edificación',
      cantidad: 1,
      costo_unitario: clamped,
      total: clamped,
    })
  }

  // Recepcion final: always 1 per local
  lines.push({
    concepto: 'Recepción Final',
    cantidad: 1,
    costo_unitario: RECEPCION_FINAL_POR_LOCAL,
    total: RECEPCION_FINAL_POR_LOCAL,
  })

  return lines
}

function calcularCostoCentro(centro: CentroRow): CentroCostResult {
  const locales = centro.locales ?? []
  // All locales without projects are assumed to need permits
  const localesSinPermiso = locales.filter((l) => !l.proyectos || l.proyectos.length === 0)

  const desglosePorConcepto: Record<string, DesgloseLine> = {}

  for (const local of localesSinPermiso) {
    const lines = calcularCostoLocal(local)
    for (const line of lines) {
      if (desglosePorConcepto[line.concepto]) {
        desglosePorConcepto[line.concepto].cantidad += line.cantidad
        desglosePorConcepto[line.concepto].total += line.total
      } else {
        desglosePorConcepto[line.concepto] = { ...line }
      }
    }
  }

  const desglose = Object.values(desglosePorConcepto)
  const costo_estimado_clp = desglose.reduce((sum, d) => sum + d.total, 0)

  return {
    centro_id: centro.id,
    nombre: centro.nombre,
    municipio: centro.municipio,
    locales_sin_permiso: localesSinPermiso.length,
    costo_estimado_clp,
    desglose,
  }
}

function generarCronograma(totalCLP: number): CronogramaEntry[] {
  // Reference: current month, 6 months forward
  const now = new Date()
  const base = new Date(now.getFullYear(), now.getMonth(), 1)
  const costoPorMes = Math.round(totalCLP / 6)
  const cronograma: CronogramaEntry[] = []

  for (let i = 0; i < 6; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() + i, 1)
    const mesNombre = `${MES_NOMBRES[d.getMonth()]} ${d.getFullYear()}`
    const nuevos = i < 5 ? costoPorMes : totalCLP - costoPorMes * 5 // last month absorbs remainder
    const acumulado = (i === 0 ? 0 : cronograma[i - 1].acumulado) + nuevos

    cronograma.push({
      mes: mesNombre,
      acumulado,
      nuevos,
    })
  }

  return cronograma
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const { data: cadenaRow, error: cadenaError } = await supabase
      .from('cadenas')
      .select('id')
      .eq('id', id)
      .single()

    if (cadenaError || !cadenaRow) {
      return Response.json({ error: 'Cadena no encontrada' }, { status: 404 })
    }

    const { data: centrosData, error: centrosError } = await supabase
      .from('centros_comerciales')
      .select('id, nombre, municipio, locales(id, area_m2, proyectos(id))')
      .eq('cadena_id', id)

    if (centrosError) throw centrosError

    const centros = (centrosData ?? []) as CentroRow[]
    const porCentro = centros.map(calcularCostoCentro)

    const total_estimado_clp = porCentro.reduce((sum, c) => sum + c.costo_estimado_clp, 0)
    const permisos_pendientes = porCentro.reduce((sum, c) => {
      // Each local needs 3 items on average (patente + edificacion + recepcion) but
      // count per desglose line as individual permits
      return sum + c.desglose.reduce((s, d) => s + d.cantidad, 0)
    }, 0)

    const cronograma = generarCronograma(total_estimado_clp)

    return Response.json({
      ok: true,
      resumen: {
        total_estimado_clp,
        permisos_pendientes,
        centros: centros.length,
      },
      por_centro: porCentro,
      cronograma,
    })
  } catch (err) {
    return apiError('Error al generar forecast', 500, err)
  }
}
