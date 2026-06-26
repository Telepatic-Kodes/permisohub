import { createClient } from '@/lib/supabase/server'
import type { Cadena, CentroComercial, Local, Proyecto } from '@/types'

export const dynamic = 'force-dynamic'

// ──────────────────────────────────────────────────────────────────────────
// Contract types (consumed by app/portal/cadena/[token]/page.tsx)
// ──────────────────────────────────────────────────────────────────────────

type EstadoCompliance = 'vigente' | 'por_vencer' | 'vencido' | 'sin_datos'

export interface LocalCompliance {
  id: string
  numero: string
  nombre_negocio?: string
  estado: EstadoCompliance
  tipo_permiso?: string
  fecha_vencimiento?: string
  dias_restantes?: number
}

export interface CentroCompliance {
  id: string
  nombre: string
  municipio: string
  locales: LocalCompliance[]
}

export interface AlertaCompliance {
  tipo: 'vencimiento_30d' | 'vencimiento_7d' | 'vencido' | 'sin_permiso'
  local_nombre: string
  centro_nombre: string
  fecha?: string
  dias?: number
}

export interface ComplianceStats {
  vigentes: number
  por_vencer: number
  vencidos: number
  sin_datos: number
  total: number
}

export interface CadenaComplianceResponse {
  ok: true
  cadena: { nombre: string; logo_url?: string }
  stats: ComplianceStats
  centros: CentroCompliance[]
  alertas: AlertaCompliance[]
  generated_at: string
  source: 'db' | 'mock'
}

// ──────────────────────────────────────────────────────────────────────────
// Compliance computation — derives per-local estado from its proyectos.
// Mirrors the logic that backs the cadena compliance export.
// ──────────────────────────────────────────────────────────────────────────

const POR_VENCER_DIAS = 30

function diasRestantes(fechaISO: string, ref: Date): number {
  const venc = new Date(fechaISO)
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.ceil((venc.getTime() - ref.getTime()) / msPerDay)
}

interface LocalEvaluado {
  local: LocalCompliance
  alerta?: AlertaCompliance
}

// A "permiso otorgado" is a proyecto that has a vencimiento date (patente /
// permiso de edificación con fecha de vencimiento). We pick the one expiring
// soonest as the governing record for the local.
function evaluarLocal(
  local: Local,
  centroNombre: string,
  ref: Date,
): LocalEvaluado {
  const conVencimiento = (local.proyectos ?? [])
    .filter((p): p is Proyecto & { fecha_vencimiento_permiso: string } =>
      Boolean(p.fecha_vencimiento_permiso),
    )
    .sort(
      (a, b) =>
        new Date(a.fecha_vencimiento_permiso).getTime() -
        new Date(b.fecha_vencimiento_permiso).getTime(),
    )

  const base = {
    id: local.id,
    numero: local.numero,
    nombre_negocio: local.nombre_negocio,
  }

  if (conVencimiento.length === 0) {
    return {
      local: { ...base, estado: 'sin_datos' },
      alerta: {
        tipo: 'sin_permiso',
        local_nombre: local.nombre_negocio ?? `Local ${local.numero}`,
        centro_nombre: centroNombre,
      },
    }
  }

  const gobernante = conVencimiento[0]
  const dias = diasRestantes(gobernante.fecha_vencimiento_permiso, ref)
  const localNombre = local.nombre_negocio ?? `Local ${local.numero}`

  let estado: EstadoCompliance
  let alerta: AlertaCompliance | undefined

  if (dias < 0) {
    estado = 'vencido'
    alerta = {
      tipo: 'vencido',
      local_nombre: localNombre,
      centro_nombre: centroNombre,
      fecha: gobernante.fecha_vencimiento_permiso,
      dias,
    }
  } else if (dias <= POR_VENCER_DIAS) {
    estado = 'por_vencer'
    alerta = {
      tipo: dias <= 7 ? 'vencimiento_7d' : 'vencimiento_30d',
      local_nombre: localNombre,
      centro_nombre: centroNombre,
      fecha: gobernante.fecha_vencimiento_permiso,
      dias,
    }
  } else {
    estado = 'vigente'
  }

  return {
    local: {
      ...base,
      estado,
      tipo_permiso: gobernante.tipo,
      fecha_vencimiento: gobernante.fecha_vencimiento_permiso,
      dias_restantes: dias,
    },
    alerta,
  }
}

function buildCompliance(
  cadena: Cadena,
  centrosRaw: CentroComercial[],
  ref: Date,
): Omit<CadenaComplianceResponse, 'source'> {
  const centros: CentroCompliance[] = []
  const alertas: AlertaCompliance[] = []
  const stats: ComplianceStats = {
    vigentes: 0,
    por_vencer: 0,
    vencidos: 0,
    sin_datos: 0,
    total: 0,
  }

  for (const centro of centrosRaw) {
    const localesEval = (centro.locales ?? []).map((l) =>
      evaluarLocal(l, centro.nombre, ref),
    )

    for (const { local, alerta } of localesEval) {
      stats.total += 1
      if (local.estado === 'vigente') stats.vigentes += 1
      else if (local.estado === 'por_vencer') stats.por_vencer += 1
      else if (local.estado === 'vencido') stats.vencidos += 1
      else stats.sin_datos += 1

      if (alerta) alertas.push(alerta)
    }

    centros.push({
      id: centro.id,
      nombre: centro.nombre,
      municipio: centro.municipio,
      locales: localesEval.map((e) => e.local),
    })
  }

  // Order alertas by urgency: vencido → 7d → 30d → sin_permiso, then by días asc.
  const urgenciaPeso: Record<AlertaCompliance['tipo'], number> = {
    vencido: 0,
    vencimiento_7d: 1,
    vencimiento_30d: 2,
    sin_permiso: 3,
  }
  alertas.sort((a, b) => {
    const peso = urgenciaPeso[a.tipo] - urgenciaPeso[b.tipo]
    if (peso !== 0) return peso
    return (a.dias ?? Infinity) - (b.dias ?? Infinity)
  })

  return {
    ok: true,
    cadena: { nombre: cadena.nombre, logo_url: cadena.logo_url },
    stats,
    centros,
    alertas,
    generated_at: ref.toISOString(),
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Mock data (dev fallback) — 1 cadena, 2 centros, 8 locales, mixed estados.
// ──────────────────────────────────────────────────────────────────────────

function buildMock(ref: Date): CadenaComplianceResponse {
  const iso = (offsetDays: number): string => {
    const d = new Date(ref)
    d.setDate(d.getDate() + offsetDays)
    return d.toISOString().slice(0, 10)
  }

  const cadena: Cadena = {
    id: 'c1',
    workspace_id: 'ws-mock',
    nombre: 'Retail Andino SpA',
    logo_url: undefined,
    created_at: ref.toISOString(),
  }

  const mkProyecto = (
    id: string,
    tipo: Proyecto['tipo'],
    venc?: string,
  ): Proyecto => ({
    id,
    cliente_id: 'c1',
    nombre: `Permiso ${id}`,
    direccion: '—',
    municipio: '—',
    tipo,
    estado: 'aprobado',
    fecha_inicio: iso(-400),
    created_at: ref.toISOString(),
    fecha_vencimiento_permiso: venc,
  })

  const mkLocal = (
    id: string,
    centroId: string,
    numero: string,
    negocio: string,
    proyectos: Proyecto[],
  ): Local => ({
    id,
    centro_id: centroId,
    numero,
    nombre_negocio: negocio,
    proyectos,
    created_at: ref.toISOString(),
  })

  const centroA: CentroComercial = {
    id: 'cc1',
    cadena_id: 'c1',
    nombre: 'Mall Plaza Norte',
    municipio: 'Huechuraba',
    created_at: ref.toISOString(),
    locales: [
      mkLocal('l1', 'cc1', 'A-101', 'Cafetería Andina', [
        mkProyecto('p1', 'patente_comercial', iso(210)),
      ]),
      mkLocal('l2', 'cc1', 'A-102', 'TecnoStore', [
        mkProyecto('p2', 'patente_comercial', iso(18)),
      ]),
      mkLocal('l3', 'cc1', 'A-103', 'Boutique Tempo', [
        mkProyecto('p3', 'patente_comercial', iso(5)),
      ]),
      mkLocal('l4', 'cc1', 'A-104', 'Farmacia Salud+', [
        mkProyecto('p4', 'patente_comercial', iso(-12)),
      ]),
    ],
  }

  const centroB: CentroComercial = {
    id: 'cc2',
    cadena_id: 'c1',
    nombre: 'Open Plaza Sur',
    municipio: 'La Florida',
    created_at: ref.toISOString(),
    locales: [
      mkLocal('l5', 'cc2', 'B-201', 'Jugos Frescos', [
        mkProyecto('p5', 'patente_comercial', iso(320)),
      ]),
      mkLocal('l6', 'cc2', 'B-202', 'Librería Saber', [
        mkProyecto('p6', 'patente_comercial', iso(27)),
      ]),
      mkLocal('l7', 'cc2', 'B-203', 'Zapatería Paso', [
        mkProyecto('p7', 'patente_comercial', iso(-45)),
      ]),
      // Sin datos: local sin proyecto con vencimiento
      mkLocal('l8', 'cc2', 'B-204', 'Local Nuevo', []),
    ],
  }

  return {
    ...buildCompliance(cadena, [centroA, centroB], ref),
    source: 'mock',
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Token resolution
//   For now the token is the base64-encoded cadena_id. In production this
//   would map to a workspace_invites row scoped to the cadena.
// ──────────────────────────────────────────────────────────────────────────

function decodeToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8').trim()
    // Only accept plausible ids (avoid garbage from arbitrary base64 input).
    if (/^[A-Za-z0-9_-]{1,64}$/.test(decoded)) return decoded
    return null
  } catch {
    return null
  }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params
  const ref = new Date()

  if (!token) {
    return Response.json({ error: 'token requerido' }, { status: 400 })
  }

  const cadenaId = decodeToken(token) ?? 'c1'

  try {
    const supabase = await createClient()

    const { data: cadena, error: cadenaError } = await supabase
      .from('cadenas')
      .select('*')
      .eq('id', cadenaId)
      .single()

    if (cadenaError || !cadena) {
      throw cadenaError ?? new Error('Cadena no encontrada')
    }

    const { data: centros, error: centrosError } = await supabase
      .from('centros_comerciales')
      .select('*, locales(*, proyectos(*))')
      .eq('cadena_id', cadenaId)

    if (centrosError) throw centrosError

    const payload: CadenaComplianceResponse = {
      ...buildCompliance(
        cadena as Cadena,
        (centros as CentroComercial[]) ?? [],
        ref,
      ),
      source: 'db',
    }

    return Response.json(payload)
  } catch {
    // Dev without DB: return realistic mock data for cadena c1.
    if (process.env.NODE_ENV !== 'production') {
      return Response.json(buildMock(ref))
    }
    return Response.json({ error: 'Token no encontrado' }, { status: 404 })
  }
}
