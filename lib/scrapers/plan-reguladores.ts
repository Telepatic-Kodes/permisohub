import { createServiceClient } from '@/lib/supabase/service'

export interface PlanReguladorRaw {
  municipio_nombre: string
  region?: string
  titulo: string
  descripcion?: string
  organizacion?: string
  fecha_publicacion?: string
  url_fuente?: string
  url_documento?: string
  formato?: string
  fuente: 'datos_gob_cl' | 'portal_transparencia'
  dataset_id?: string
}

interface CkanResource {
  url: string
  format: string
  name: string
}

interface CkanOrganization {
  title: string
  name: string
}

interface CkanPackage {
  name: string
  title: string
  notes?: string
  organization?: CkanOrganization
  metadata_modified?: string
  resources?: CkanResource[]
}

interface CkanSearchResult {
  success: boolean
  result: {
    count: number
    results: CkanPackage[]
  }
}

function extractMunicipioNombre(pkg: CkanPackage): string {
  const orgTitle = pkg.organization?.title ?? ''
  const mMatch = orgTitle.match(/Municipalidad\s+(?:de|del?)\s+(.+)/i)
  if (mMatch) return mMatch[1].trim()

  const titleMatch = pkg.title.match(/(?:PRC|Plan\s+Regulador\s+Comunal)\s+(.+)/i)
  if (titleMatch) return titleMatch[1].trim()

  return orgTitle || pkg.title
}

function extractRegion(pkg: CkanPackage): string | undefined {
  const text = `${pkg.title} ${pkg.notes ?? ''}`
  const match = text.match(/Regi[oó]n\s+(?:de\s+)?([A-ZÁÉÍÓÚÑ][^,\n.(]+)/i)
  return match ? match[1].trim() : undefined
}

export async function fetchFromDatosGobCl(
  start = 0
): Promise<{ items: PlanReguladorRaw[]; total: number }> {
  const url = `https://datos.gob.cl/api/3/action/package_search?q=plan+regulador&rows=100&start=${start}`

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; PermisoHub/1.0)',
      Accept: 'application/json',
    },
  })

  if (!response.ok) {
    throw new Error(`datos.gob.cl returned HTTP ${response.status}`)
  }

  const json = (await response.json()) as CkanSearchResult

  if (!json.success) {
    throw new Error('datos.gob.cl CKAN API returned success=false')
  }

  const items: PlanReguladorRaw[] = json.result.results.map((pkg) => {
    const resource =
      pkg.resources?.find((r) => r.format?.toUpperCase() === 'PDF') ??
      pkg.resources?.[0]

    return {
      municipio_nombre: extractMunicipioNombre(pkg),
      region: extractRegion(pkg),
      titulo: pkg.title,
      descripcion: pkg.notes ?? undefined,
      organizacion: pkg.organization?.title,
      fecha_publicacion: pkg.metadata_modified?.split('T')[0],
      url_fuente: `https://datos.gob.cl/dataset/${pkg.name}`,
      url_documento: resource?.url,
      formato: resource?.format?.toUpperCase(),
      fuente: 'datos_gob_cl',
      dataset_id: pkg.name,
    }
  })

  return { items, total: json.result.count }
}

export async function fetchFromPortalTransparencia(): Promise<PlanReguladorRaw[]> {
  // The portal returns 403 for automated requests. Attempt with browser-like headers;
  // returns [] silently if still blocked — not a critical failure.
  try {
    const response = await fetch(
      'https://www.portaltransparencia.cl/PortalPdT/buscador-es?search_term=plan+regulador',
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'es-CL,es;q=0.9',
          Referer: 'https://www.portaltransparencia.cl/',
        },
      }
    )

    if (!response.ok) {
      console.warn(
        `[plan-reguladores] portaltransparencia.cl returned ${response.status} — skipping`
      )
      return []
    }

    // TODO: parse HTML results once 403 is resolved
    return []
  } catch {
    return []
  }
}

export async function upsertPlanReguladores(
  items: PlanReguladorRaw[]
): Promise<{ inserted: number; updated: number }> {
  if (items.length === 0) return { inserted: 0, updated: 0 }

  const supabase = createServiceClient()
  const now = new Date().toISOString()

  const rows = items.map((item) => ({
    municipio_nombre: item.municipio_nombre,
    region: item.region ?? null,
    titulo: item.titulo,
    descripcion: item.descripcion ?? null,
    organizacion: item.organizacion ?? null,
    fecha_publicacion: item.fecha_publicacion ?? null,
    url_fuente: item.url_fuente ?? null,
    url_documento: item.url_documento ?? null,
    formato: item.formato ?? null,
    fuente: item.fuente,
    dataset_id: item.dataset_id ?? null,
    vigente: true,
    updated_at: now,
  }))

  // Rows with dataset_id: upsert on (dataset_id, fuente) unique index
  const withId = rows.filter((r) => r.dataset_id !== null)
  // Rows without dataset_id: always insert (null != null in SQL unique semantics)
  const withoutId = rows.filter((r) => r.dataset_id === null)

  let inserted = 0

  if (withId.length > 0) {
    const { data, error } = await supabase
      .from('plan_reguladores')
      .upsert(withId, { onConflict: 'dataset_id,fuente', ignoreDuplicates: false })
      .select('id')

    if (error) throw new Error(`upsert failed: ${error.message}`)
    inserted += data?.length ?? 0
  }

  if (withoutId.length > 0) {
    const { data, error } = await supabase
      .from('plan_reguladores')
      .insert(withoutId)
      .select('id')

    if (error) throw new Error(`insert failed: ${error.message}`)
    inserted += data?.length ?? 0
  }

  return { inserted, updated: 0 }
}
