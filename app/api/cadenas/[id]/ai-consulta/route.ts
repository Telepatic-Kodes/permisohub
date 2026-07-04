import { aiComplete, isAIAvailable } from '@/lib/ai'
import { getContextoOGUC } from '@/lib/oguc-knowledge'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: cadenaId } = await params
  const { pregunta } = (await request.json()) as { pregunta: string }

  let cadena: Record<string, unknown> = {}
  let centros: Record<string, unknown>[] = []
  let locales: Record<string, unknown>[] = []

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const rateLimit = await checkRateLimit(`general:${user.id}`)
      if (rateLimit) return rateLimit
    }

    const { data: cadenaData, error: cadenaError } = await supabase
      .from('cadenas')
      .select('*')
      .eq('id', cadenaId)
      .single()
    if (cadenaError) throw cadenaError
    cadena = cadenaData as Record<string, unknown>

    const { data: centrosData, error: centrosError } = await supabase
      .from('centros_comerciales')
      .select('*')
      .eq('cadena_id', cadenaId)
    if (centrosError) throw centrosError
    centros = (centrosData ?? []) as Record<string, unknown>[]

    const centroIds = centros.map((c) => c['id'] as string)
    if (centroIds.length > 0) {
      const { data: localesData, error: localesError } = await supabase
        .from('locales')
        .select('*')
        .in('centro_id', centroIds)
      if (localesError) throw localesError
      locales = (localesData ?? []) as Record<string, unknown>[]
    }
  } catch {
    // Respaldo: si el fetch inicial falla (sin sesión o RLS), consultamos la DB
    // con el service client para armar igual el contexto real de la cadena.
    try {
      const service = createServiceClient()

      const { data: cadenaData } = await service
        .from('cadenas')
        .select('*')
        .eq('id', cadenaId)
        .single()
      cadena = (cadenaData ?? {}) as Record<string, unknown>

      const { data: centrosData } = await service
        .from('centros_comerciales')
        .select('*')
        .eq('cadena_id', cadenaId)
      centros = (centrosData ?? []) as Record<string, unknown>[]

      const centroIds = centros.map((c) => c['id'] as string)
      if (centroIds.length > 0) {
        const { data: localesData } = await service
          .from('locales')
          .select('*')
          .in('centro_id', centroIds)
        locales = (localesData ?? []) as Record<string, unknown>[]
      }
    } catch {
      // Sin credenciales de servicio o DB inaccesible: contexto vacío
      cadena = {}
      centros = []
      locales = []
    }
  }

  if (!isAIAvailable()) {
    return Response.json({
      ok: true,
      respuesta:
        'Para abrir un local comercial en Chile, necesitas: (1) Permiso de edificación de la DOM según Art. 5.1.1 OGUC, (2) Patente municipal, (3) Certificados de especialidades. El plazo legal es 30 días hábiles según Ley 21.718.',
    })
  }

  const cadenaName = (cadena['nombre'] as string | undefined) ?? 'cadena sin nombre'
  const municipios = (cadena['municipios'] as string[] | undefined) ?? []
  const centrosList = centros
    .map((c) => `${c['nombre'] as string} (${c['municipio'] as string}, ${c['num_locales'] ?? '?'} locales)`)
    .join(', ')
  const localesList = locales
    .map((l) => `${l['numero'] as string} - ${l['nombre_negocio'] as string} (${l['uso'] as string}, ${l['area_m2'] as number}m²)`)
    .join('; ')

  const contextoCadena = [
    `Cadena: ${cadenaName}`,
    municipios.length > 0 ? `Municipios activos: ${municipios.join(', ')}` : null,
    centros.length > 0 ? `Centros comerciales: ${centrosList}` : null,
    locales.length > 0 ? `Locales registrados: ${localesList}` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const contextoOGUC = getContextoOGUC(pregunta)

  const systemPrompt = [
    'Eres un experto en permisos municipales chilenos, normativa OGUC y patentes comerciales.',
    'Respondes preguntas específicas de permisos en el contexto de la siguiente cadena de retail:',
    contextoCadena,
    contextoOGUC ? `\nContexto normativo OGUC relevante:\n${contextoOGUC}` : '',
    '\nSé preciso, cita artículos específicos cuando corresponda y adapta tu respuesta al contexto de esta cadena.',
  ]
    .filter(Boolean)
    .join('\n')

  const respuesta = await aiComplete(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: pregunta },
    ],
    { max_tokens: 1500 }
  )

  return Response.json({ ok: true, respuesta })
}
