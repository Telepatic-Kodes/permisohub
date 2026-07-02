import { validateCronSecret } from '@/lib/scraper'
import {
  fetchFromDatosGobCl,
  fetchFromPortalTransparencia,
  upsertPlanReguladores,
  type PlanReguladorRaw,
} from '@/lib/scrapers/plan-reguladores'

export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results = {
    inserted: 0,
    updated: 0,
    sources: { datos_gob_cl: 0, portal_transparencia: 0 },
    errors: [] as string[],
  }

  // Source A: datos.gob.cl CKAN API — paginate until all datasets are fetched
  try {
    const allItems: PlanReguladorRaw[] = []
    const pageSize = 100
    let start = 0

    const firstPage = await fetchFromDatosGobCl(start)
    allItems.push(...firstPage.items)
    const total = firstPage.total

    while (allItems.length < total) {
      start += pageSize
      const page = await fetchFromDatosGobCl(start)
      if (page.items.length === 0) break
      allItems.push(...page.items)
    }

    results.sources.datos_gob_cl = allItems.length
    const upserted = await upsertPlanReguladores(allItems)
    results.inserted += upserted.inserted
    results.updated += upserted.updated
  } catch (err) {
    results.errors.push(
      `datos_gob_cl: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  // Source B: portaltransparencia.cl — experimental, returns [] if still blocked
  try {
    const items = await fetchFromPortalTransparencia()
    results.sources.portal_transparencia = items.length
    if (items.length > 0) {
      const upserted = await upsertPlanReguladores(items)
      results.inserted += upserted.inserted
      results.updated += upserted.updated
    }
  } catch (err) {
    results.errors.push(
      `portal_transparencia: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  return Response.json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...results,
  })
}
