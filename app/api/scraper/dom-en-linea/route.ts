import {
  fetchWithTimeout,
  extractBetween,
  stripTags,
  mapDomEstado,
} from '@/lib/scraper'

export const dynamic = 'force-dynamic'

interface DomEnLineaData {
  estado: string
  etapa: string | null
  observaciones: string | null
  fechaIngreso: string | null
  fechaUltimaActualizacion: string | null
  municipio: string
  simulated?: boolean
}

async function queryDomEnLinea(
  expedienteNumero: string,
  municipio: string
): Promise<DomEnLineaData> {
  // Dev/test mode: return realistic mock data
  if (
    process.env.NODE_ENV !== 'production' ||
    expedienteNumero.startsWith('TEST-')
  ) {
    return {
      estado: 'en_revision',
      etapa: 'Revisión DOM',
      observaciones: null,
      fechaIngreso: '2026-03-15',
      fechaUltimaActualizacion: new Date().toISOString().split('T')[0],
      municipio,
      simulated: true,
    }
  }

  try {
    const url = `https://domlena.minvu.gob.cl/solicitudes/busqueda?numero_expediente=${encodeURIComponent(
      expedienteNumero
    )}`
    const response = await fetchWithTimeout(url, {}, 15000)

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const html = await response.text()

    // Parse key fields from DOM en Línea HTML.
    // Multiple selector fallbacks cover the typical output structure.
    const estado =
      extractBetween(html, 'Estado:</strong>', '<') ??
      extractBetween(html, 'class="estado">', '<') ??
      extractBetween(html, 'Estado del Expediente', '</td>') ??
      ''

    const etapa =
      extractBetween(html, 'Etapa:</strong>', '<') ??
      extractBetween(html, 'Etapa Actual:', '</td>') ??
      null

    const observaciones =
      extractBetween(html, 'Observaciones:</strong>', '</p>') ??
      extractBetween(html, 'class="observaciones">', '</div>') ??
      null

    const fechaUltAct =
      extractBetween(html, 'Última Actualización:</strong>', '<') ??
      extractBetween(html, 'Fecha Actualización:', '</td>') ??
      null

    return {
      estado: mapDomEstado(stripTags(estado)),
      etapa: etapa ? stripTags(etapa) : null,
      observaciones: observaciones ? stripTags(observaciones) : null,
      fechaIngreso: null,
      fechaUltimaActualizacion: fechaUltAct ? stripTags(fechaUltAct) : null,
      municipio,
    }
  } catch (err) {
    // Fallback to simulated data on error so callers never hard-fail.
    // eslint-disable-next-line no-console
    console.warn(`[dom-en-linea] scrape failed for ${expedienteNumero}:`, err)
    return {
      estado: 'en_revision',
      etapa: null,
      observaciones: null,
      fechaIngreso: null,
      fechaUltimaActualizacion: null,
      municipio,
      simulated: true,
    }
  }
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<
    string,
    string
  >
  const { expedienteNumero, municipio } = body

  if (!expedienteNumero) {
    return Response.json(
      { error: 'expedienteNumero is required' },
      { status: 400 }
    )
  }

  const data = await queryDomEnLinea(expedienteNumero, municipio ?? '')

  return Response.json({
    ok: true,
    expedienteNumero,
    fetchedAt: new Date().toISOString(),
    ...data,
  })
}
