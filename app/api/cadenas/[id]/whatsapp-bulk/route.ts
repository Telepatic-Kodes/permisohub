import { enviarWhatsApp, isWhatsAppAvailable } from '@/lib/whatsapp'
import { MOCK_LOCALES, MOCK_CENTROS } from '@/lib/mock-data'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

type Body = {
  localIds?: string[]
  tipo: 'alerta_vencimiento' | 'recordatorio' | 'personalizado'
  mensaje?: string
}

type LocalConTelefono = {
  id: string
  centro_id: string
  nombre_negocio?: string
  tenant_telefono?: string
  centro_nombre?: string
}

type Resultado = {
  localId: string
  numero: string
  ok: boolean
  error?: string
}

function buildMensaje(
  tipo: Body['tipo'],
  centroNombre: string,
  mensajePersonalizado?: string
): string {
  if (tipo === 'alerta_vencimiento') {
    return `⚠️ *Alerta de permiso*\n\nEstimado tenant, el permiso de su local en ${centroNombre} vence próximamente. Favor contactar a su gestor.`
  }
  if (tipo === 'recordatorio') {
    return `📋 *Recordatorio de documentación*\n\nSu local en ${centroNombre} tiene documentación pendiente.`
  }
  return mensajePersonalizado ?? ''
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cadenaId } = await params
  const body = (await request.json()) as Body

  if (body.tipo === 'personalizado' && !body.mensaje) {
    return Response.json(
      { error: 'mensaje es requerido cuando tipo es personalizado' },
      { status: 400 }
    )
  }

  let locales: LocalConTelefono[] = []

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('dev-no-auth')

    type LocalRow = {
      id: string
      centro_id: string
      nombre_negocio: string | null
      tenant_telefono: string | null
      centros: Array<{ nombre: string }> | null
    }

    let query = supabase
      .from('locales')
      .select('id, centro_id, nombre_negocio, tenant_telefono, centros(nombre)')
      .eq('centros.cadena_id', cadenaId)

    if (body.localIds && body.localIds.length > 0) {
      query = query.in('id', body.localIds)
    }

    const { data, error: dbError } = await query
    if (dbError) throw dbError

    locales = ((data as unknown as LocalRow[]) ?? []).map((row) => ({
      id: row.id,
      centro_id: row.centro_id,
      nombre_negocio: row.nombre_negocio ?? undefined,
      tenant_telefono: row.tenant_telefono ?? undefined,
      centro_nombre: row.centros?.[0]?.nombre ?? undefined,
    }))
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      const centrosDelaCadena = MOCK_CENTROS.filter(
        (c) => c.cadena_id === cadenaId
      )
      const centroIds = new Set(centrosDelaCadena.map((c) => c.id))
      const centroMap = new Map(centrosDelaCadena.map((c) => [c.id, c.nombre]))

      let candidatos = MOCK_LOCALES.filter((l) => centroIds.has(l.centro_id))

      if (body.localIds && body.localIds.length > 0) {
        const ids = new Set(body.localIds)
        candidatos = candidatos.filter((l) => ids.has(l.id))
      }

      const MOCK_PHONES = ['912345678', '923456789', '934567890']

      locales = candidatos.slice(0, 3).map((l, i) => ({
        id: l.id,
        centro_id: l.centro_id,
        nombre_negocio: l.nombre_negocio,
        tenant_telefono: MOCK_PHONES[i],
        centro_nombre: centroMap.get(l.centro_id),
      }))

      if (locales.length === 0) {
        const fallback = MOCK_LOCALES.slice(0, 3)
        locales = fallback.map((l, i) => ({
          id: l.id,
          centro_id: l.centro_id,
          nombre_negocio: l.nombre_negocio,
          tenant_telefono: MOCK_PHONES[i],
          centro_nombre: centroMap.get(l.centro_id) ?? 'Centro Demo',
        }))
      }
    } else {
      return Response.json({ error: 'Error al obtener locales' }, { status: 500 })
    }
  }

  const localesConTelefono = locales.filter(
    (l): l is LocalConTelefono & { tenant_telefono: string } =>
      typeof l.tenant_telefono === 'string' && l.tenant_telefono.trim() !== ''
  )

  const resultados: Resultado[] = []

  for (const local of localesConTelefono) {
    const centroNombre = local.centro_nombre ?? 'su centro'
    const texto = buildMensaje(body.tipo, centroNombre, body.mensaje)

    if (!isWhatsAppAvailable()) {
      resultados.push({ localId: local.id, numero: local.tenant_telefono, ok: true })
      continue
    }

    const result = await enviarWhatsApp(
      local.tenant_telefono,
      'actualizacion_general',
      { proyectoNombre: local.nombre_negocio ?? 'Local', municipio: centroNombre, mensaje: texto }
    )

    resultados.push({
      localId: local.id,
      numero: local.tenant_telefono,
      ok: result.ok,
      ...(result.error ? { error: result.error } : {}),
    })
  }

  const enviados = resultados.filter((r) => r.ok).length
  const fallidos = resultados.filter((r) => !r.ok).length

  return Response.json({ ok: true, enviados, fallidos, resultados })
}
