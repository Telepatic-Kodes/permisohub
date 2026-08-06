import { type NextRequest, NextResponse } from 'next/server'
import { ScraperRateLimitedError, ScraperUnavailableError } from '@/lib/scraper'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { reportError } from '@/lib/observability'
import { consultarRolEnSII, type DatosSIIParseados } from '@/lib/sii-lookup-server'

export const dynamic = 'force-dynamic'

// La consulta al SII y su normalización viven en lib/sii-lookup-server.ts desde
// el 05-08. Acá queda SOLO lo que es propio de la ruta: autenticación, rate
// limit, validación de parámetros y la traducción a códigos HTTP.
//
// El motivo del corte es concreto: el probe de salud de fuentes externas
// (lib/data-source-probes.ts) necesita ejercitar el MISMO camino que usan los
// usuarios, y no tiene sesión con la que atravesar el gate de auth. La
// alternativa —un probe con su propia copia— podría dar verde con el camino
// real roto, que es precisamente lo que un health check no puede permitirse.
interface LookupResult {
  ok: boolean
  rol?: string
  data?: DatosSIIParseados
  error?: string
}

export async function GET(request: NextRequest): Promise<NextResponse<LookupResult>> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ ok: false, error: 'No autenticado' }, { status: 401 })

  const rateLimit = await checkRateLimit(`general:${user.id}`)
  if (rateLimit) return rateLimit as NextResponse<LookupResult>

  const { searchParams } = new URL(request.url)
  const rolRaw = searchParams.get('rol')
  const comuna = searchParams.get('comuna')

  if (!rolRaw) {
    return NextResponse.json({ ok: false, error: 'Parámetro "rol" requerido (ej: ?rol=1234-056)' }, { status: 400 })
  }

  // `comuna` es OBLIGATORIO desde la migración del 06-08, y reemplaza al viejo
  // `region` (que traía default '13'). No es cosmético: el endpoint nuevo del
  // SII resuelve por código de comuna, no por región, así que sin comuna no hay
  // consulta posible. Un default sería peor que un 400 — buscaría el rol en una
  // comuna que nadie pidió y devolvería otro predio con toda confianza.
  if (!comuna) {
    return NextResponse.json(
      { ok: false, error: 'Parámetro "comuna" requerido (ej: ?rol=1234-056&comuna=Providencia)' },
      { status: 400 },
    )
  }

  try {
    const consulta = await consultarRolEnSII(rolRaw, comuna)

    if (!consulta.ok) {
      // 404 y no 200: el SII respondió, pero no hay ficha que leer. Antes esto
      // salía 200 con ok:true y todos los campos vacíos, así que la UI pintaba
      // huecos como si fueran el dato real del predio.
      return NextResponse.json({ ok: false, rol: consulta.rol, error: consulta.error }, { status: 404 })
    }

    return NextResponse.json({ ok: true, rol: consulta.rol, data: consulta.data })
  } catch (err) {
    // reportError y no console.warn: este camino no llegaba a Sentry, así que
    // una caída sostenida del SII solo era visible revisando logs de Vercel a
    // mano — y el SII está en el camino crítico de la ficha de propiedad.
    reportError(err, { scope: 'api.sii.lookup', extra: { rol: rolRaw, comuna } })

    // 429 propio para el bloqueo del SII, separado del 503 de "está caído".
    // Para quien lo recibe son situaciones distintas: una se pasa sola en
    // minutos, la otra dura más de una hora y reintentar la empeora.
    if (err instanceof ScraperRateLimitedError) {
      return NextResponse.json(
        {
          ok: false,
          error: 'El SII está bloqueando nuestras consultas por volumen. Intenta más tarde o ingresa los datos manualmente.',
        },
        { status: 429 },
      )
    }
    const mensaje =
      err instanceof ScraperUnavailableError
        ? 'SII no disponible en este momento. Intenta nuevamente o ingresa los datos manualmente.'
        : 'Error inesperado consultando el SII.'
    return NextResponse.json({ ok: false, error: mensaje }, { status: 503 })
  }
}
