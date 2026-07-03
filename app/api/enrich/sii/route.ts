import { fetchWithTimeout, extractBetween, stripTags } from '@/lib/scraper'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { apiError } from '@/lib/api-error'

export const dynamic = 'force-dynamic'

interface SIIData {
  direccion?: string
  region?: string
  comuna?: string
  superficieTerreno?: string
  superficieConstruida?: string
  destino?: string
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const rateLimit = await checkRateLimit(`general:${user.id}`)
  if (rateLimit) return rateLimit

  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    string
  >
  const { rol, region = '13' } = body // region 13 = Metropolitana by default

  if (!rol) {
    return Response.json(
      { error: 'rol is required (ej: 1234-56)' },
      { status: 400 }
    )
  }

  // Clean rol format: "1234-56" or "1234" + "000"
  const [manzana, predio] = rol.includes('-') ? rol.split('-') : [rol, '000']

  try {
    // SII property lookup URL
    const url = `https://zeus.sii.cl/avalu_cgi/br/erc0000.sh?RGN=${region}&MNZ=${manzana.padStart(
      4,
      '0'
    )}&PRD=${predio.padStart(3, '0')}`

    const response = await fetchWithTimeout(url, {}, 12000)

    if (!response.ok) throw new Error(`SII HTTP ${response.status}`)

    const html = await response.text()

    const data: SIIData = {
      direccion: extractBetween(html, 'DIRECCIÓN</TD>', '</TD>')
        ? stripTags(extractBetween(html, 'DIRECCIÓN</TD>', '</TD>') ?? '')
        : undefined,
      region: extractBetween(html, 'REGIÓN</TD>', '</TD>')
        ? stripTags(extractBetween(html, 'REGIÓN</TD>', '</TD>') ?? '')
        : undefined,
      comuna: extractBetween(html, 'COMUNA</TD>', '</TD>')
        ? stripTags(extractBetween(html, 'COMUNA</TD>', '</TD>') ?? '')
        : undefined,
      superficieTerreno: extractBetween(html, 'SUP.TERRENO</TD>', '</TD>')
        ? stripTags(extractBetween(html, 'SUP.TERRENO</TD>', '</TD>') ?? '')
        : undefined,
      superficieConstruida: extractBetween(html, 'SUP.CONSTRUIDA</TD>', '</TD>')
        ? stripTags(extractBetween(html, 'SUP.CONSTRUIDA</TD>', '</TD>') ?? '')
        : undefined,
      destino: extractBetween(html, 'DESTINO</TD>', '</TD>')
        ? stripTags(extractBetween(html, 'DESTINO</TD>', '</TD>') ?? '')
        : undefined,
    }

    return Response.json({ ok: true, rol, data })
  } catch (err) {
    return apiError('Servicio SII no disponible', 502, err)
  }
}
