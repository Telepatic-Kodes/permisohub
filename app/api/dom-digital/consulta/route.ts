import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

export type DomStatus =
  | 'sin_inicio'
  | 'en_revision'
  | 'con_observaciones'
  | 'aprobado'
  | 'vencido'

interface ConsultaBody {
  localId: string
  municipio: string
  numero: string
}

interface DomResponse {
  ok: true
  status: DomStatus
  descripcion: string
  numero_expediente: string | null
  fecha_ingreso: string | null
  municipio_url: string | null
}

const STATUS_DESCRIPTIONS: Record<DomStatus, string> = {
  sin_inicio: 'El trámite no ha sido iniciado en el municipio.',
  en_revision: 'El expediente se encuentra en revisión por el DOM.',
  con_observaciones: 'El expediente tiene observaciones pendientes de subsanar.',
  aprobado: 'El permiso fue aprobado por el Director de Obras Municipales.',
  vencido: 'El permiso aprobado ha vencido y requiere renovación.',
}

function charCodeSum(str: string): number {
  let sum = 0
  for (let i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i)
  }
  return sum
}

function buildMockResponse(localId: string, municipio: string): DomResponse {
  const sum = charCodeSum(localId)
  const bucket = sum % 5

  const statusMap: Record<number, DomStatus> = {
    0: 'aprobado',
    1: 'en_revision',
    2: 'con_observaciones',
    3: 'sin_inicio',
    4: 'vencido',
  }

  const status: DomStatus = statusMap[bucket]

  if (status === 'sin_inicio') {
    return {
      ok: true,
      status,
      descripcion: STATUS_DESCRIPTIONS[status],
      numero_expediente: null,
      fecha_ingreso: null,
      municipio_url: null,
    }
  }

  if (status === 'en_revision' || status === 'con_observaciones') {
    const pendingExpediente = `DOM-PEND-${localId.slice(-4).toUpperCase()}`
    const daysAgo = (sum % 60) + 10
    const fechaIngreso = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10)
    const municipioSlug = municipio.toLowerCase().replace(/\s+/g, '-')
    return {
      ok: true,
      status,
      descripcion: STATUS_DESCRIPTIONS[status],
      numero_expediente: pendingExpediente,
      fecha_ingreso: fechaIngreso,
      municipio_url: `https://dom.municipio.cl/expediente/${municipioSlug}/${pendingExpediente}`,
    }
  }

  // aprobado or vencido
  const year = new Date().getFullYear()
  const expediente = `DOM-${year}-${localId.slice(-4).toUpperCase()}`
  const daysAgo = (sum % 30) + 60 // between 60 and 90 days ago, deterministic
  const fechaIngreso = new Date(Date.now() - daysAgo * 86400000).toISOString().slice(0, 10)
  const municipioSlug = municipio.toLowerCase().replace(/\s+/g, '-')

  return {
    ok: true,
    status,
    descripcion: STATUS_DESCRIPTIONS[status],
    numero_expediente: expediente,
    fecha_ingreso: fechaIngreso,
    municipio_url: `https://dom.municipio.cl/expediente/${municipioSlug}/${expediente}`,
  }
}

export async function POST(req: NextRequest) {
  let body: ConsultaBody

  try {
    body = (await req.json()) as ConsultaBody
  } catch {
    return Response.json({ error: 'Cuerpo de solicitud inválido' }, { status: 400 })
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      if (process.env.NODE_ENV !== 'production') throw new Error('dev-no-auth')
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { localId, municipio } = body

    if (!localId || !municipio) {
      return Response.json({ error: 'Faltan parámetros requeridos' }, { status: 400 })
    }

    // In production with a real auth'd user, we would call the real DOM Digital API here.
    // For now, return mock data even in production until real integration is available.
    const result = buildMockResponse(localId, municipio)
    return Response.json(result)
  } catch {
    // Dev fallback — no auth available in local environment
    const result = buildMockResponse(body.localId ?? 'unknown', body.municipio ?? 'unknown')
    return Response.json(result)
  }
}
