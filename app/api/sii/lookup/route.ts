import { type NextRequest, NextResponse } from 'next/server'
import { fetchWithTimeout, extractBetween, stripTags } from '@/lib/scraper'

export const dynamic = 'force-dynamic'

interface LookupResult {
  ok: boolean
  rol?: string
  simulated?: boolean
  data?: {
    direccion_normalizada: string
    region: string
    comuna: string
    destino: string
    avaluo_fiscal_clp: number | null
    avaluo_fiscal_uf: number | null
    superficie_terreno_m2: number | null
    superficie_construida_m2: number | null
    lat?: number
    lng?: number
  }
  error?: string
}

// Parse Chilean number string: "1.234.567" → 1234567
function parseChileanNumber(raw: string): number | null {
  const cleaned = raw.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function parseM2(raw: string): number | null {
  const match = raw.match(/([\d.,]+)\s*m?²?/i)
  if (!match) return null
  return parseChileanNumber(match[1])
}

export async function GET(request: NextRequest): Promise<NextResponse<LookupResult>> {
  const { searchParams } = new URL(request.url)
  const rolRaw = searchParams.get('rol')

  if (!rolRaw) {
    return NextResponse.json({ ok: false, error: 'Parámetro "rol" requerido (ej: ?rol=1234-056)' }, { status: 400 })
  }

  // Normalize rol: "1234-056" or "1234-56" accepted
  const [manzana, predio] = rolRaw.includes('-') ? rolRaw.split('-') : [rolRaw, '000']
  const rolNorm = `${manzana}-${predio}`

  // Dev mode: return simulated data so the UI works without SII connectivity
  if (process.env.NODE_ENV !== 'production') {
    return NextResponse.json({
      ok: true,
      rol: rolNorm,
      simulated: true,
      data: {
        direccion_normalizada: 'AV. EJEMPLO 1234, SANTIAGO',
        region: 'METROPOLITANA DE SANTIAGO',
        comuna: 'SANTIAGO',
        destino: 'CASA HABITACION',
        avaluo_fiscal_clp: 48_500_000,
        avaluo_fiscal_uf: 1_102.5,
        superficie_terreno_m2: 180,
        superficie_construida_m2: 145,
      },
    })
  }

  try {
    // SII property detail page (region 13 = RM as default; most architects work here)
    const region = searchParams.get('region') ?? '13'
    const url =
      `https://zeus.sii.cl/avalu_cgi/br/erc0000.sh` +
      `?RGN=${region}&MNZ=${manzana.padStart(4, '0')}&PRD=${predio.padStart(3, '0')}`

    const response = await fetchWithTimeout(url, {}, 15_000)
    if (!response.ok) throw new Error(`SII HTTP ${response.status}`)

    const html = await response.text()

    const rawDireccion = extractBetween(html, 'DIRECCIÓN</TD>', '</TD>')
    const rawRegion    = extractBetween(html, 'REGIÓN</TD>', '</TD>')
    const rawComuna    = extractBetween(html, 'COMUNA</TD>', '</TD>')
    const rawTerreno   = extractBetween(html, 'SUP.TERRENO</TD>', '</TD>')
    const rawConstruida = extractBetween(html, 'SUP.CONSTRUIDA</TD>', '</TD>')
    const rawDestino   = extractBetween(html, 'DESTINO</TD>', '</TD>')
    // Avalúo fiscal appears in lines like "AVALÚO FISCAL TOTAL</TD><TD>$ 48.500.000</TD>"
    const rawAvaluoCLP = extractBetween(html, 'AVALÚO FISCAL TOTAL</TD>', '</TD>')
    const rawAvaluoUF  = extractBetween(html, 'AVALÚO FISCAL TOTAL UF</TD>', '</TD>')

    return NextResponse.json({
      ok: true,
      rol: rolNorm,
      data: {
        direccion_normalizada: rawDireccion ? stripTags(rawDireccion) : '',
        region: rawRegion ? stripTags(rawRegion) : '',
        comuna: rawComuna ? stripTags(rawComuna) : '',
        destino: rawDestino ? stripTags(rawDestino) : '',
        avaluo_fiscal_clp: rawAvaluoCLP ? parseChileanNumber(stripTags(rawAvaluoCLP).replace('$', '')) : null,
        avaluo_fiscal_uf: rawAvaluoUF ? parseChileanNumber(stripTags(rawAvaluoUF).replace('UF', '')) : null,
        superficie_terreno_m2: rawTerreno ? parseM2(stripTags(rawTerreno)) : null,
        superficie_construida_m2: rawConstruida ? parseM2(stripTags(rawConstruida)) : null,
      },
    })
  } catch (err) {
    console.warn('[sii-lookup] SII unreachable:', err)
    return NextResponse.json(
      { ok: false, error: 'SII no disponible en este momento. Intenta nuevamente o ingresa los datos manualmente.' },
      { status: 503 },
    )
  }
}
