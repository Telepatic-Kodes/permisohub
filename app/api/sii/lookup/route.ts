import { type NextRequest, NextResponse } from 'next/server'
import { ScraperUnavailableError } from '@/lib/scraper'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { reportError } from '@/lib/observability'
import { consultarRolEnSII, type DatosSIIParseados } from '@/lib/sii-lookup-server'

export const dynamic = 'force-dynamic'

// El scraping y el parseo se extrajeron a lib/sii-lookup-server.ts el 05-08.
// Acá queda SOLO lo que es propio de la ruta: autenticación, rate limit,
// validación del parámetro y la traducción a códigos HTTP.
//
// El motivo del corte es concreto: el probe de salud de fuentes externas
// (lib/data-source-probes.ts) necesita ejercitar el MISMO parser que usan los
// usuarios, y no tiene sesión con la que atravesar el gate de auth. La
// alternativa —un probe con su propia copia del parser— podría dar verde con
// el parser real roto, que es precisamente lo que un health check no puede
// permitirse.
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

  if (!rolRaw) {
    return NextResponse.json({ ok: false, error: 'Parámetro "rol" requerido (ej: ?rol=1234-056)' }, { status: 400 })
  }

  // region 13 = RM por defecto; la mayoría de los arquitectos trabaja acá.
  const region = searchParams.get('region') ?? '13'

  try {
    const consulta = await consultarRolEnSII(rolRaw, region)

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
    reportError(err, { scope: 'api.sii.lookup', extra: { rol: rolRaw, region } })
    const mensaje =
      err instanceof ScraperUnavailableError
        ? 'SII no disponible en este momento. Intenta nuevamente o ingresa los datos manualmente.'
        : 'Error inesperado consultando el SII.'
    return NextResponse.json({ ok: false, error: mensaje }, { status: 503 })
  }
}
