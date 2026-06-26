import { createClient } from '@/lib/supabase/server'
import { MOCK_LOCALES, MOCK_CENTROS } from '@/lib/mock-data'

export const dynamic = 'force-dynamic'

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

type RiskResponse = {
  ok: boolean
  locales: LocalRiesgo[]
  resumen: {
    criticos: number
    altos: number
    medios: number
    bajos: number
    score_promedio: number
  }
}

const HIGH_ENFORCEMENT_MUNICIPIOS = new Set([
  'Santiago',
  'Las Condes',
  'Providencia',
  'Vitacura',
  'Ñuñoa',
])

function charCodeSum(str: string): number {
  let s = 0
  for (let i = 0; i < str.length; i++) s += str.charCodeAt(i)
  return s
}

function municipioEnforcement(municipio: string): 'alto' | 'medio' | 'bajo' {
  if (HIGH_ENFORCEMENT_MUNICIPIOS.has(municipio)) return 'alto'
  const mid = ['Maipú', 'San Miguel', 'Pudahuel', 'La Florida', 'Rancagua', 'Independencia']
  if (mid.includes(municipio)) return 'medio'
  return 'bajo'
}

function calcularScore(factores: Factores): number {
  let pts = 0
  if (factores.sin_permiso) pts += 35
  if (factores.dias_para_vencimiento !== null) {
    if (factores.dias_para_vencimiento < 30) pts += 30
    else if (factores.dias_para_vencimiento < 60) pts += 15
    else if (factores.dias_para_vencimiento < 90) pts += 8
  }
  pts += Math.min(factores.especialidades_pendientes * 5, 25)
  pts += Math.min(factores.observaciones_abiertas * 8, 24)
  if (factores.municipio_enforcement === 'alto') pts += 10
  return Math.min(Math.max(pts, 0), 100)
}

function scoreToNivel(score: number): NivelRiesgo {
  if (score >= 70) return 'critico'
  if (score >= 50) return 'alto'
  if (score >= 30) return 'medio'
  return 'bajo'
}

function buildMockLocales(cadenaId: string): LocalRiesgo[] {
  const centros = MOCK_CENTROS.filter((c) => c.cadena_id === cadenaId)
  const centroIds = new Set(centros.map((c) => c.id))
  const locales = MOCK_LOCALES.filter((l) => centroIds.has(l.centro_id))

  const results: LocalRiesgo[] = locales.map((local, idx) => {
    const centro = centros.find((c) => c.id === local.centro_id)!
    const municipio = centro.municipio
    const enforcement = municipioEnforcement(municipio)
    const base = charCodeSum(local.id) % 100

    let sin_permiso = base > 60
    let dias_para_vencimiento: number | null = null
    let especialidades_pendientes = 0
    let observaciones_abiertas = 0

    if (idx === 0) {
      sin_permiso = true
      especialidades_pendientes = 3
      observaciones_abiertas = 2
    } else if (idx === 1) {
      sin_permiso = false
      dias_para_vencimiento = 20
      especialidades_pendientes = 2
      observaciones_abiertas = 1
    } else {
      dias_para_vencimiento = sin_permiso ? null : (base % 120) + 10
      especialidades_pendientes = base % 4
      observaciones_abiertas = base % 3
    }

    const factores: Factores = {
      sin_permiso,
      dias_para_vencimiento,
      especialidades_pendientes,
      observaciones_abiertas,
      municipio_enforcement: enforcement,
    }

    const score = calcularScore(factores)
    return {
      local_id: local.id,
      local_numero: local.numero,
      local_nombre: local.nombre_negocio ?? local.numero,
      centro_nombre: centro.nombre,
      municipio,
      score,
      nivel: scoreToNivel(score),
      factores,
    }
  })

  return results.sort((a, b) => b.score - a.score)
}

function buildResumen(locales: LocalRiesgo[]) {
  const criticos = locales.filter((l) => l.nivel === 'critico').length
  const altos = locales.filter((l) => l.nivel === 'alto').length
  const medios = locales.filter((l) => l.nivel === 'medio').length
  const bajos = locales.filter((l) => l.nivel === 'bajo').length
  const score_promedio =
    locales.length > 0
      ? Math.round(locales.reduce((acc, l) => acc + l.score, 0) / locales.length)
      : 0
  return { criticos, altos, medios, bajos, score_promedio }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) throw new Error('dev-no-auth')

    const { data: localesDb, error: localesError } = await supabase
      .from('locales')
      .select(
        `
        id,
        numero,
        nombre_negocio,
        centros (
          id,
          nombre,
          municipio,
          cadena_id
        ),
        proyectos (
          id,
          estado,
          fecha_estimada,
          local_id
        )
      `
      )
      .eq('centros.cadena_id', id)

    if (localesError) throw localesError

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const locales: LocalRiesgo[] = (localesDb ?? [])
      .filter((row) => {
        const centro = Array.isArray(row.centros) ? row.centros[0] : row.centros
        return centro?.cadena_id === id
      })
      .map((row) => {
        const centro = Array.isArray(row.centros) ? row.centros[0] : row.centros
        const municipio: string = centro?.municipio ?? ''
        const enforcement = municipioEnforcement(municipio)

        const proyectos = (row.proyectos ?? []).filter(
          (p: { local_id: string | null }) => p.local_id === row.id
        )

        const sin_permiso = proyectos.length === 0

        let dias_para_vencimiento: number | null = null
        if (!sin_permiso) {
          const nearest = proyectos
            .filter((p: { fecha_estimada: string | null }) => p.fecha_estimada)
            .map((p: { fecha_estimada: string }) => {
              const d = new Date(p.fecha_estimada)
              d.setHours(0, 0, 0, 0)
              return Math.round((d.getTime() - today.getTime()) / 86400000)
            })
            .filter((d: number) => d >= 0)
            .sort((a: number, b: number) => a - b)
          dias_para_vencimiento = nearest[0] ?? null
        }

        const especialidades_pendientes = 0
        const observaciones_abiertas = 0

        const factores: Factores = {
          sin_permiso,
          dias_para_vencimiento,
          especialidades_pendientes,
          observaciones_abiertas,
          municipio_enforcement: enforcement,
        }

        const score = calcularScore(factores)
        return {
          local_id: row.id,
          local_numero: row.numero,
          local_nombre: row.nombre_negocio ?? row.numero,
          centro_nombre: centro?.nombre ?? '',
          municipio,
          score,
          nivel: scoreToNivel(score),
          factores,
        }
      })
      .sort((a, b) => b.score - a.score)

    const response: RiskResponse = {
      ok: true,
      locales,
      resumen: buildResumen(locales),
    }
    return Response.json(response)
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      const locales = buildMockLocales(id)
      const response: RiskResponse = {
        ok: true,
        locales,
        resumen: buildResumen(locales),
      }
      return Response.json(response)
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}
