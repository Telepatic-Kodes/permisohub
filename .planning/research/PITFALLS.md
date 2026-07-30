# Pitfalls Research

**Domain:** Zonificación automática por dirección — point-in-polygon PRC lookup against an unofficial public ArcGIS FeatureServer, cached and cited inside an existing regulatory due-diligence SaaS (PermisoHub)
**Researched:** 2026-07-30
**Confidence:** MEDIUM — ArcGIS REST query mechanics and Chilean PRC legal-vigencia mechanics are HIGH confidence (official Esri docs, BCN/MINVU sources); specifics of MINVU/OCUC's actual undocumented FeatureServer (exact URL, schema, layer list, rate limits) are LOW confidence and MUST be verified empirically against the real endpoint before/during implementation — this research covers the *class* of pitfall, not the specific service's current behavior.

## Critical Pitfalls

### Pitfall 1: Coordinate system / axis-order errors produce a plausible-looking WRONG zone

**What goes wrong:**
The point-in-polygon query silently returns a zone for the wrong location — not an error, a *different but valid-looking* PRC zone/comuna — because (a) the query point wasn't reprojected to match the layer's spatial reference, or (b) lat/lng were swapped into ArcGIS's x,y (lng,lat) order. Chile's lat (~-33) and lng (~-70) are different enough in magnitude that a lat/lng swap usually still lands *somewhere* inside Chile, so the bug doesn't crash — it just quietly attributes the wrong comuna/zone to the project.

**Why it happens:**
ArcGIS REST `query` expects `geometry=<x>,<y>` (x=longitude, y=latitude) plus an explicit `inSR`. The existing codebase already stores/passes coordinates as `{ lat, lng }` (see `SIIData` in `lib/sii-lookup.ts`) — the natural, easy-to-miss bug is passing `${lat},${lng}` instead of `${lng},${lat}` into the ArcGIS query string. Separately, MINVU/OCUC ArcGIS Hub layers are commonly published in Web Mercator (EPSG:3857/102100, confirmed for OCUC's PRC layers), not WGS84 (EPSG:4326). If `inSR=4326` is omitted, the API "is assumed to be in the spatial reference of the layer" per Esri docs — i.e. it silently reinterprets your WGS84 degrees as Web Mercator meters, producing a nonsensical or wildly-off point with no error thrown.

**How to avoid:**
- Always pass both `inSR=4326` (explicit, never omitted) and construct `geometry` as `lng,lat` (or the JSON form `{"x": lng, "y": lat, "spatialReference": {"wkid": 4326}}`), never `lat,lng`.
- Write a unit test with a known address/zone pair (e.g. a landmark with publicly known PRC zone) and assert the returned zone matches, so axis-order regressions fail CI instead of silently corrupting production data.
- Log the raw request URL/geometry on every lookup during the pilot period so a wrong-zone report can be diagnosed after the fact.

**Warning signs:**
Returned comuna in the zone response doesn't match the project's stored `municipio` field — this is a strong, cheap, automatable sanity check (the ArcGIS feature attributes for PRC layers typically include a comuna name/code you can cross-check against `proyectos.municipio`).

**Phase to address:**
Data-registry-definition time (when the ArcGIS client wrapper/query builder is written) — this is a construction-time bug, not something to catch later. Add the comuna cross-check at cache-write time as a permanent safety net.

---

### Pitfall 2: Treating an ad-hoc-discovered ArcGIS FeatureServer as a stable, contracted dependency

**What goes wrong:**
The feature is built against a specific FeatureServer URL + layer index + field names discovered by inspecting MINVU/OCUC's web map viewer. Because it's not a documented, versioned API, any of the following can happen without notice: the URL changes (viewer gets rebuilt on a new AGOL org/subdomain), the layer index shifts (a new layer gets inserted), field names change casing or get renamed, the service is throttled/blocked after unexpected traffic from PermisoHub's server IP, or the service is taken down entirely (these are frequently hosted on university/pilot infrastructure — OCUC — not production government infrastructure with an uptime SLA). When any of this happens, the failure mode in an unmonitored integration is silent: requests start returning empty results or errors that get swallowed by a try/catch, and nobody notices until an architect asks why zonificación stopped populating.

**Why it happens:**
There is no contract. Esri's public REST query docs don't document rate limits for arbitrary third-party hosted FeatureServers (this is host-controlled, not part of the ArcGIS REST spec), and MINVU/OCUC give no notice channel for schema/URL changes because the service was never intended as a public API — it's the backend for their own web map.

**How to avoid:**
- Isolate all ArcGIS-specific knowledge (URL, layer index, field names) behind a single adapter module (e.g. `lib/prc-lookup.ts`) with a typed response contract, so a schema change requires editing one file, not chasing call sites through due-diligence/via-tramitacion.
- Add a scheduled health-check (reuse the existing cron pattern in `app/api/cron/daily-check/route.ts`) that runs a known-good query against the service weekly and alerts (email/log) on failure — treat this the same way the codebase already treats `sii-lookup`'s scraper fragility (`console.warn('[sii-lookup] SII unreachable...')` + a 503 with a user-facing manual-entry fallback message).
- Never let the feature become a hard dependency: due-diligence/via-tramitacion must have a defined behavior when the lookup is unavailable (manual zone entry, not a blocked workflow).
- Server-side proxy only — never call the ArcGIS endpoint from the browser (avoids CORS breakage if the host changes CORS policy, and avoids exposing the discovered URL/pattern directly in client bundle, which invites the host to notice and block the referrer).

**Warning signs:**
Any change in response shape without an application-level error (e.g. a field silently becomes `null` for all requests, or attribute keys change casing) — validate the response shape at the adapter boundary and throw loudly on unexpected shape rather than passing through whatever comes back.

**Phase to address:**
Data-registry-definition time (adapter isolation, typed contract) and ongoing at cache-write time (schema validation on every write, not just at build time).

---

### Pitfall 3: Coverage is fragmented per-comuna — "no result" and "outside coverage" get conflated with "sin restricciones"

**What goes wrong:**
MINVU/OCUC's PRC GIS layers are published per-comuna (confirmed: separate ArcGIS Hub items exist per municipality — Puerto Montt, Tomé, Independencia, Iquique, etc. — not one national FeatureServer). Many Chilean comunas, especially smaller/rural ones, have no digitized PRC at all, or only a Plan Regulador Intercomunal without a comunal layer. A point query against a comuna with no coverage returns an empty result set — structurally identical to a point query that correctly found "no PRC zone defined at this location" (e.g. genuinely rural/non-normado land). If the integration doesn't distinguish these, the UI or a downstream engine (`via-tramitacion.ts`'s `excedePRC` flag, due-diligence's PRC citation) can present "no zone found" as if it means "no restrictions apply," when it actually means "we have no data for this comuna" — a dangerous false negative for a professional making a real permitting decision.

**Why it happens:**
Empty result sets from ArcGIS queries look identical whether caused by (a) genuine absence of zoning at that point, (b) the comuna simply isn't in the dataset PermisoHub queries, or (c) a wrong layer/URL for that comuna. Without an explicit, maintained "which comunas are covered" registry, the code has no way to tell these apart.

**How to avoid:**
- Maintain an explicit per-comuna coverage registry (which comunas have a working FeatureServer + layer index configured), separate from the runtime query result. Never infer coverage from an empty response.
- Three-state result, not two: `zona_encontrada` / `comuna_sin_cobertura` / `error_consulta` — never collapse "sin cobertura" into "sin restricciones."
- Surface "sin cobertura para esta comuna — determina la zona manualmente desde el PRC vigente" as an explicit UI state, distinct from "consultado, sin restricciones especiales en este punto" (which itself should be rare/suspicious and probably worth flagging for manual review too).

**Warning signs:**
Any comuna returning 100% empty results across all addresses queried — that's a coverage gap, not real data, and should trip an alert rather than silently populate as "no zone."

**Phase to address:**
Data-registry-definition time (the coverage registry is core schema, must exist before any UI trusts a lookup result) and UI-render time (the three-state distinction must reach the user, not get collapsed in a boolean).

---

### Pitfall 4: Reusing `flagUnverifiedCita`'s "(por verificar)" pattern conflates two different kinds of uncertainty

**What goes wrong:**
`lib/normativa-retrieval.ts`'s `flagUnverifiedCita` / `flagUnverifiedArticulo` / `flagUnverifiedDDU` exist to catch a specific failure mode: an LLM inventing an article/circular number that doesn't exist in PermisoHub's hand-curated, verified normativa database. `verificado: true` there means "this citation matches a real, curated legal text we've checked." If the new PRC zone/usos data is threaded through the same `RefNormativa`/`ArticuloCitable` shape and marked `verificado: true` just because it came back from a live query (as opposed to being LLM-hallucinated), it inherits visual/semantic trust it hasn't earned: the PRC data source itself is an unofficial third party with no institutional affiliation (exactly the caveat the direct competitor zonificación.cl states explicitly: *"Esta plataforma no está afiliada directamente a las instituciones mencionadas"*). "Not hallucinated" and "officially authoritative" are different axes of trust, and the existing pattern only encodes the first one.

**Why it happens:**
It's tempting to reuse existing types/UI (badge, tooltip, citation card) for a new normativa source because the plumbing already exists (`RefNormativa`, `getArticuloById`, `urlDeCitable`, the citation `Cita` component). But `flagUnverifiedCita` was designed against a closed, curated corpus (OGUC/LGUC/DDU arrays in the codebase) where "verified" is a deterministic membership check. PRC zone data has no such corpus to check membership against — it either came back from the live/cached ArcGIS query or it didn't; there is no equivalent of "not in our curated base, so mark unverified."

**How to avoid:**
- Add a new, distinct `FuenteNormativa` value (e.g. `'PRC_GIS'`) and a separate confidence field — do NOT set `verificado: true` on PRC citations. Give it its own semantics: `fuente_no_oficial: true` always, plus a `consultado_el` timestamp, distinct from `verificado`.
- Render PRC zone results with their own disclaimer treatment, not the generic "(por verificar)" citation tag used for LLM-invented article numbers — that tag reads as "the AI might be wrong," while the PRC caveat is "the AI is right about what the source says, but the source is not an official determination." These need different copy and arguably different visual weight (a persistent banner/disclaimer near the zone result, not just an inline citation footnote).
- Explicitly state in the UI, near every PRC zone/usos result, that it is informational, sourced from an unofficial third-party GIS layer, and that the architect must verify against the comuna's Certificado de Informes Previos (CIP) or the Ordenanza Local text before relying on it for a submission — mirroring the "orientativo" framing `via-tramitacion.ts` already uses for its rule-based routing ("Es ORIENTATIVO... la DOM de cada comuna puede exigir matices").
- Do not let `via-tramitacion.ts`'s `excedePRC` flag get silently auto-set from the PRC lookup without a human confirmation step — that flag currently drives a "no vía liviana salva un incumplimiento" alert; auto-populating it from an unofficial source and letting it silently change the recommended path removes the human checkpoint the rest of the file's `EstadoRevision` pattern (`propuesto`/`confirmado`/`descartado`) exists to preserve elsewhere.

**Warning signs:**
Grep for any place `RefNormativa.verificado` or `ArticuloCitable.verificado` is set to `true` for a PRC-sourced citation — that's the tell that the two uncertainty axes have been conflated.

**Phase to address:**
Data-registry-definition time (new type/field design) — this is a schema decision that's expensive to unwind once due-diligence reports/via-tramitacion results have been generated and stored with the wrong shape.

---

### Pitfall 5: Caching makes staleness *worse to detect*, and the underlying source is often already stale

**What goes wrong:**
Two independent staleness problems compound. First, the obvious one: a comuna publishes a PRC modification decree in the Diario Oficial, and PermisoHub's cached zone/usos data for that comuna is now wrong until invalidated. Second, the less obvious and more dangerous one: MINVU/OCUC's underlying GIS layer for that comuna may *itself* already lag the decree by months or years, because digitizing an approved PRC modification into the shapefile is a separate, unfunded step that happens on nobody's guaranteed timeline. This means "the live ArcGIS query returned a fresh, un-cached result" does NOT imply "this reflects the current, legally effective PRC" — a naive TTL-based cache-invalidation strategy fixes only the first problem and creates false confidence about the second, because a short TTL makes the data *look* fresh when the risk was never about PermisoHub's cache age.

**Why it happens:**
Cache-invalidation thinking (TTL, cache-busting on writes) assumes the upstream source is authoritative and current whenever queried live. That assumption doesn't hold for government-adjacent GIS layers maintained by a university lab on a best-effort basis.

**How to avoid:**
- Store and always display a `fuente_actualizada_el` (or equivalent last-known-update) date per comuna/layer if the ArcGIS service exposes one (check the FeatureServer's `editingInfo.lastEditDate` or layer metadata — Esri services often expose this) alongside the cache's own `consultado_el`. Show both to the user: "Consultado hoy · capa municipal actualizada por última vez [fecha]" — this makes the upstream-staleness risk visible instead of hidden behind a reassuring "fresh" cache hit.
- Cache TTL should be short enough to catch decree updates within a reasonable window (e.g. 30-90 days, matching the ~30-day OGUC vigencia-after-publication rule) but the TTL is a *secondary* control — the primary mitigation is disclosure, not invalidation, because invalidation can't fix upstream staleness the way it can fix PermisoHub's own cache staleness.
- Add a manual "recheck now" affordance for architects on active projects near a submission deadline, bypassing cache — cheap to build, high trust value, and matches the existing pattern of user-triggered re-fetch already present in `SIIEnricher`.
- Never silently overwrite a previously cached zone determination that a due-diligence report or via-tramitacion decision already cited without flagging the change — if a re-query returns a *different* zone than what's cached, that's a signal worth surfacing ("la zonificación cambió desde la última consulta: revisa si afecta hallazgos existentes"), not a silent UPDATE.

**Warning signs:**
A comuna whose cached zone data has never changed across many months of periodic re-checks — could be genuinely stable, or could be silently hitting a stale/cached layer on the ArcGIS side too (worth spot-checking against the comuna's own published PRC modification history periodically).

**Phase to address:**
Cache-write time (store both timestamps, never blind-overwrite) and UI-render time (staleness disclosure must be visible wherever the zone is shown — due-diligence report, via-tramitacion result, project detail page — not just in an admin view).

---

### Pitfall 6: Fire-and-forget background enrichment fails silently, and the UI has no way to distinguish "not yet checked" from "checked and failed"

**What goes wrong:**
The codebase already has a precedent for this exact shape of bug: `app/api/proyectos/route.ts`'s SII enrichment fallback uses Next's `after()` to fire a background fetch, wrapped in a bare `try { ... } catch { /* Fire-and-forget — silent failure intentional */ }`. If a project's `destino_sii` stays `null`, there is no way from the data alone to tell whether enrichment hasn't run yet, ran and found nothing, or ran and threw. If the zonificación feature copies this pattern verbatim for the PRC lookup, the same ambiguity appears for `zona_prc` — and here the consequence is worse, because `via-tramitacion.ts`'s `excedePRC` and the due-diligence engine's PRC citation are decision-relevant, not just form-prefill convenience. A `null` zone silently and indistinguishably means "we don't know" everywhere it's read, and nothing in the UI prompts the architect to check.

**Why it happens:**
Fire-and-forget is an easy, low-friction pattern to copy when you've already seen it work elsewhere in the codebase for a "nice to have" enrichment (SII data is optional/convenience, explicitly labeled "(opcional)" in `SIIEnricher`). Zonificación is not equivalently optional once due-diligence/via-tramitacion start depending on it, but the implementation temptation to reuse the exact same `after()` + bare try/catch is high because it's the path of least resistance already present in the codebase.

**How to avoid:**
- Store an explicit status enum on the project (or the cache table), not just a nullable data column: `zonificacion_status: 'pendiente' | 'ok' | 'error' | 'sin_cobertura'`. Every code path that writes the result must set this explicitly, including the catch block (`'error'`, not silent skip).
- Any UI that reads zone data (project detail, due-diligence report, via-tramitacion) must branch on this status, not just on nullability — "aún no consultado" and "consulta falló, reintentar" are different UX states with different actions, and both are different from "sin cobertura para esta comuna" (Pitfall 3).
- Log/alert on the error branch at minimum (the current `catch { /* silent */ }` in `app/api/proyectos/route.ts` doesn't even `console.error`) — for a decision-relevant lookup, silent failure with zero trace is not acceptable even if the fire-and-forget *trigger* pattern itself is kept for UX responsiveness.
- Prefer request-triggered-but-awaited-with-a-visible-spinner (like `SIIEnricher`'s synchronous flow) over pure fire-and-forget for the zonificación lookup specifically, given it's decision-relevant rather than convenience-only — the existing codebase already models both patterns (synchronous `SIIEnricher` vs. background `after()` fallback in `proyectos/route.ts`); this feature should follow the synchronous-with-explicit-states model, not the silent-background one.

**Warning signs:**
Grep for `zona_prc` (or equivalent column) being read anywhere with `if (proyecto.zona_prc) { ... }` — that pattern can't distinguish "not checked" from "checked, none found" and is a strong signal the status enum is missing.

**Phase to address:**
Data-registry-definition time (status enum in schema, not an afterthought) and UI-render time (every consumer branches on status, not nullability). This should be flagged for deeper design review before implementation, given the codebase's own precedent leans toward the wrong pattern for a decision-relevant feature.

---

### Pitfall 7: A single query point cannot represent a lot that straddles two zones, sits on a boundary, or falls in a digitization gap

**What goes wrong:**
Chilean urban lots (predios), especially subdivided or irregular ones, commonly straddle two PRC zones — this is common enough that PRC ordinances and OGUC practice have explicit rules for "predios afectos a dos o más zonas" (proportional/zone-specific application of norms per portion of the lot). A single geocoded point (centroid, or the SII/geocoded street-address point, which may not even be inside the actual parcel polygon for corner lots or deep lots) intersects at most one zone polygon and returns a single, falsely confident zone determination, with the multi-zone condition invisible to the user. Separately, adjacent PRC zone polygons in a digitized dataset are rarely perfectly topologically snapped — a point that falls exactly on a shared boundary or in a sliver gap between two polygons can return an empty result (false negative, easily misread as "no zone/no restrictions" per Pitfall 3) even though the lot clearly has zoning. Finally, some ArcGIS Hub items publish both the currently-vigente PRC layer and an in-progress "Actualización PRC" (under public consultation, not yet decreed) as sibling layers in the same service — querying the wrong layer index serves a draft, not-yet-legally-effective zone as if authoritative.

**Why it happens:**
Point-in-polygon is the simplest possible spatial query, and it's tempting to treat "found a zone" as equivalent to "fully and uniquely determined the applicable zoning for this lot" — which is only true for simple, single-zone, well-inside-the-polygon lots. The multi-zone and boundary-gap cases require deliberate additional handling (buffered/multi-point queries, explicit disambiguation UX) that a naive single-point implementation won't have.

**How to avoid:**
- Query with a small buffer or multiple points (e.g. lot centroid plus, if a parcel polygon is available, its corners/vertices) rather than a single address point, and explicitly detect and surface the multi-zone case ("este predio intersecta 2 zonas: [A] y [B] — revisa el plano regulador para la aplicación por sector del lote") rather than silently picking one.
- On empty result, do not default to "sin restricciones" — retry with a small buffer (a few meters) before concluding no coverage, to rule out boundary/gap false negatives; if still empty, fall into the explicit "sin cobertura / revisar manualmente" state from Pitfall 3.
- Verify, per comuna at integration time, which layer index in the FeatureServer is the vigente layer vs. any draft/en-trámite layer, and hardcode/document that choice explicitly per comuna in the coverage registry (Pitfall 3) — don't assume layer 0 is always the current plan.
- Never present the free-text "usos permitidos/prohibidos" attribute as a verbatim legal quote — it's a GIS attribute transcribed by whoever digitized the layer, may use outdated category names (OGUC use-category definitions have been amended over time) or abbreviations, and can silently drift from the actual Ordenanza Local wording. Always link to (or instruct the user to verify against) the comuna's official Ordenanza Local document/CIP rather than treating the attribute text as a citable norm.

**Warning signs:**
Any project sitting very close to a mapped zone boundary (detectable by checking distance from the query point to the returned polygon's edge) should be flagged for manual confirmation rather than silently trusted — this is cheap to compute (distance from point to polygon boundary) and catches the highest-risk cases.

**Phase to address:**
Data-registry-definition time (buffer/multi-point query strategy, layer selection per comuna) and UI-render time (multi-zone/boundary-proximity disclosure must reach the architect, not just the raw single-zone answer).

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|--------------------|-----------------|------------------|
| Hardcode one comuna's FeatureServer URL/layer index to ship an MVP fast | Fast pilot with one comuna (e.g. wherever the first pilot client operates) | Every new comuna requires code changes, not config; coverage registry (Pitfall 3) becomes an afterthought instead of a foundation | Acceptable ONLY if the coverage registry table/shape is still built from day one, with one row, so adding comunas is a data change not a schema change |
| Reuse `after()` fire-and-forget exactly like `proyectos/route.ts`'s SII fallback | Zero new async-handling code to write | Silent failures on a decision-relevant lookup (Pitfall 6) | Never for the primary zonificación lookup; acceptable only for a genuinely optional secondary re-check job |
| Cache PRC result forever (no TTL) after first successful lookup | Simplest cache implementation, avoids re-hitting a fragile third party | Stale-forever data on any comuna that later gets a PRC modification decree; nobody notices | Never for production; acceptable only in a throwaway prototype/demo |
| Skip the comuna cross-check (Pitfall 1's sanity check) at launch | Slightly less code | A silent lat/lng-swap or wrong-SR bug ships undetected and corrupts data for real projects before anyone notices | Never — this check is cheap (one string comparison) relative to the risk it catches |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|-----------------|-------------------|
| MINVU/OCUC ArcGIS FeatureServer (point-in-polygon query) | Sending `geometry=lat,lng` or omitting `inSR` | Always `inSR=4326`, always `x,y` = `lng,lat`; validate against a known address/zone pair in tests |
| MINVU/OCUC ArcGIS FeatureServer (client-side calls) | Calling directly from the browser | Proxy through a PermisoHub API route (matches `app/api/sii/lookup/route.ts` pattern) — hides the discovered URL, avoids CORS breakage, centralizes rate-limit/retry/caching logic |
| MINVU/OCUC ArcGIS FeatureServer (availability) | Assuming it behaves like a versioned, SLA'd API because it's "government data" | Treat exactly like the existing `sii-lookup` scraper: timeout-wrapped fetch (`fetchWithTimeout`), explicit 503 + manual-entry fallback message on failure, weekly health-check cron |
| `lib/normativa-retrieval.ts` citation types | Marking PRC citations `verificado: true` because they weren't LLM-hallucinated | New `FuenteNormativa` value with its own non-`verificado` trust semantics (Pitfall 4) |
| `lib/via-tramitacion.ts` `excedePRC` flag | Auto-setting `excedePRC` from the PRC lookup without a human confirm step | Pre-fill/suggest only; keep the existing `EstadoRevision` (`propuesto`/`confirmado`/`descartado`) human-checkpoint pattern in front of anything that changes the recommended vía |
| `app/api/proyectos/route.ts` background-enrichment pattern | Copy-pasting the exact `after()` + silent `catch {}` shape for zonificación | Explicit status enum, logged errors, and prefer awaited-with-spinner UX for this decision-relevant lookup (Pitfall 6) |
| Supabase cache table for PRC results | Modeling it like `plan_reguladores` (the existing document-catalog table — title/URL/fecha_publicacion metadata) | It's a different shape: point-keyed (lat/lng or predio id) geospatial result with its own staleness/coverage/status fields — don't conflate with the existing document registry |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|-----------------|
| Querying the ArcGIS service synchronously on every project-detail page load instead of caching | Slow page loads, and repeated load on a fragile third-party service increases risk of throttling/blocking | Cache-first with the status/staleness model from Pitfall 5-6; only re-query on explicit user action or cache expiry | Noticeable at even modest usage (tens of concurrent architects each loading project pages) since the third party has no documented capacity guarantee |
| No per-comuna request coalescing/backoff | Multiple projects in the same comuna trigger redundant identical queries within seconds of each other | Debounce/coalesce identical in-flight lookups; a short in-memory or Redis lock per comuna+point during enrichment | Breaks first during any batch/bulk-import of several projects in the same comuna |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing the discovered ArcGIS FeatureServer URL/query pattern in client-side JS | Makes it trivial for the host to notice unusual referrer traffic and block PermisoHub, or for competitors to find and reuse the same undocumented endpoint | Server-side proxy only, matching the `sii-lookup` route pattern |
| No rate limiting on PermisoHub's own proxy route for the PRC lookup | A buggy retry loop or scripted abuse could hammer the third-party service and get PermisoHub's IP blocked, taking the feature down for all users | Reuse `checkRateLimit` (existing Upstash-based limiter in `lib/rate-limit.ts`) on the new proxy route, same as `sii/lookup` and `proyectos` routes already do |
| Storing raw architect-facing "usos permitidos/prohibidos" free text without provenance metadata | If the upstream attribute is later found wrong/outdated, there's no way to know which cached rows came from which layer version, complicating cleanup/correction | Store `fuente_layer_id`, `fuente_actualizada_el`, and `consultado_el` alongside the text on every cache row |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-------------------|
| Presenting the PRC zone/usos result with the same visual weight/styling as verified OGUC/LGUC citations | Architect over-trusts an unofficial source for a decision with legal/financial consequences | Distinct visual treatment (persistent disclaimer banner, different badge) — never blend into the "verified normativa" citation UI |
| Silently treating "no result" as "no restrictions" | Architect proceeds as if a project has no zoning constraints when the real cause was a coverage gap or boundary artifact | Explicit three-state UI (found / sin cobertura / error) per Pitfall 3 |
| No indication of when the underlying municipal GIS layer was last updated | Architect assumes "fresh from the government" means "current," missing upstream digitization lag | Show both `consultado_el` and the layer's own last-update date (Pitfall 5) |
| No flag when a lot appears to straddle a zone boundary | Architect designs/submits based on a single zone when the lot is legally subject to two | Boundary-proximity check + explicit multi-zone disclosure (Pitfall 7) |
| Treating the free-text usos permitidos/prohibidos as final legal text | Architect cites it directly in a submission without checking the actual Ordenanza Local, risking a DOM observation/rejection if wording has drifted | Always pair the GIS attribute text with a link/pointer to the comuna's official Ordenanza Local / CIP as the actual source of truth |

## "Looks Done But Isn't" Checklist

- [ ] **Coordinate handling:** Often missing an explicit `inSR=4326` and correct `lng,lat` ordering — verify with a known address/zone test case, not just "it returned *a* zone"
- [ ] **Coverage registry:** Often missing entirely (code just queries and trusts whatever comes back) — verify there's an explicit list of covered comunas + layer indices, separate from runtime query results
- [ ] **Status tracking:** Often just a nullable `zona_prc` column — verify there's an explicit status enum distinguishing pending/ok/error/sin_cobertura
- [ ] **Staleness disclosure:** Often just a cache-age timestamp shown to admins, not to the architect — verify the "consultado" date AND the "unofficial source" disclaimer are visible on every screen that shows the zone (project detail, due-diligence report, via-tramitacion result), not just one
- [ ] **Citation trust separation:** Often reuses `verificado: true`/the existing citation badge for convenience — verify PRC citations render with distinct, non-`verificado` styling and copy
- [ ] **Multi-zone/boundary handling:** Often just a single point-in-polygon query with no boundary-proximity or multi-zone check — verify there's at least a distance-to-boundary flag, even if full multi-point querying is deferred
- [ ] **Error visibility:** Often a bare `catch {}` copied from the existing SII fallback — verify failures are logged/alertable, not silent

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|-----------------|------------------|
| Coordinate/axis-order bug shipped and corrupted cached zone data | MEDIUM | Identify affected rows via the comuna cross-check (Pitfall 1), invalidate and re-query; audit any due-diligence reports/via-tramitacion results generated in the affected window and flag them for manual re-review since a human may have already acted on wrong data |
| ArcGIS FeatureServer URL/schema changed silently, feature stopped populating | LOW-MEDIUM | Health-check cron (Pitfall 2) should catch this within a week; re-discover the current endpoint via the public web viewer, update the adapter module, backfill any gap period |
| Conflated `verificado` trust on PRC citations already shipped to users | MEDIUM-HIGH | Requires a data migration (add the new distinct field/type), a UI change, and — because trust was already misrepresented to real users — likely a direct communication/notice to affected architects about the correct trust level of past results |
| Fire-and-forget silent failures left projects with unexplained missing zone data | LOW | Backfill job: re-run enrichment for all projects with `zona_prc IS NULL`, now with explicit status tracking so future failures are visible |
| Multi-zone lot silently reported as single-zone in a past due-diligence report | HIGH | Cannot be auto-corrected retroactively without human review — flag affected reports and notify the responsible architect directly, since a real permitting decision may already have been made on the incomplete determination |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|--------------------|----------------|
| 1. Coordinate/axis-order errors | Data-registry-definition (ArcGIS adapter construction) | Unit test against known address/zone pair; comuna cross-check at cache-write time |
| 2. Unofficial dependency treated as stable | Data-registry-definition (adapter isolation) + ongoing (health-check cron) | Weekly cron alert wired up before feature ships; manual-fallback UX exists and is tested |
| 3. Coverage fragmentation / empty-result ambiguity | Data-registry-definition (coverage registry schema) | Three-state result type enforced by TypeScript; no code path treats empty result as "sin restricciones" |
| 4. `flagUnverifiedCita` trust conflation | Data-registry-definition (new type/field design) | Grep audit: no PRC citation ever sets `verificado: true`; distinct UI component/copy reviewed before ship |
| 5. Cache staleness vs. upstream staleness | Cache-write time (dual timestamps) + UI-render time (disclosure) | Both `consultado_el` and layer last-update date rendered on every surface showing zone data |
| 6. Silent fire-and-forget enrichment failure | Data-registry-definition (status enum) + UI-render time (branch on status) | No UI reads `zona_prc` nullability directly; all reads branch on the status enum; errors are logged/alertable |
| 7. Single-point boundary/multi-zone blindness | Data-registry-definition (query strategy, layer selection) + UI-render time (disclosure) | Boundary-proximity flag computed and surfaced; per-comuna layer index documented in the coverage registry, not assumed |

## Sources

- ArcGIS REST APIs — Query (Feature Service/Layer): https://developers.arcgis.com/rest/services-reference/enterprise/query-feature-service-layer/ (HIGH confidence — official Esri docs; confirms `inSR` defaults to the layer's own spatial reference when omitted, and `geometryType=esriGeometryPoint` / `geometry=x,y` conventions)
- Esri — maxRecordCount/service limits: https://support.esri.com/en-us/knowledge-base/faq-what-are-the-limits-of-the-maxrecordcount-and-maxre-000030432 (HIGH confidence — official; no documented rate-limit policy for arbitrary hosted FeatureServers, confirming this must be treated as unknown/undocumented per-host behavior)
- OCUC / MINVU ArcGIS Hub PRC datasets (Puerto Montt/Puerto Varas, Tomé, Independencia, Iquique): https://ideocuc-ocuc.hub.arcgis.com/ , https://ide.minvu.cl/ (MEDIUM confidence — WebSearch verified via multiple ArcGIS Hub listing pages; confirms per-comuna fragmentation and EPSG:102100/Web Mercator reference system for OCUC's PRC layers — the specific FeatureServer PermisoHub will actually integrate must still be independently confirmed and documented)
- zonificación.cl disclaimer language ("Esta plataforma no está afiliada directamente a las instituciones mencionadas"): https://zonificacion.cl (MEDIUM confidence — WebFetch of live site footer; confirms the standard disclaimer pattern used by the direct competitor referenced in the milestone brief)
- Diario Oficial / BCN — PRC modification decree publication and 30-day vigencia-after-publication rule: https://www.bcn.cl/leychile/navegar?idNorma=1220742 , https://www.diariooficial.interior.gob.cl/ (MEDIUM confidence — WebSearch verified against BCN/Diario Oficial sources; confirms the legal timing mechanism that GIS-layer digitization lags behind, supporting the upstream-staleness pitfall)
- Existing codebase patterns reviewed directly (HIGH confidence, primary source): `lib/sii-lookup.ts`, `app/api/sii/lookup/route.ts`, `app/api/proyectos/route.ts` (fire-and-forget `after()` pattern), `lib/normativa-retrieval.ts` (`flagUnverifiedCita`/`flagUnverifiedArticulo`/`flagUnverifiedDDU`, `RefNormativa`, `ArticuloCitable`), `lib/via-tramitacion.ts` (`excedePRC`, `EstadoRevision`, "es ORIENTATIVO" framing), `lib/due-diligence.ts`, `supabase/migrations/20260630_plan_reguladores.sql` (existing, structurally different document-catalog table), `app/api/cron/daily-check/route.ts` (existing cron/health-check pattern), `lib/rate-limit.ts`, `components/proyecto/sii-enricher.tsx` (synchronous awaited-lookup UX precedent)

---
*Pitfalls research for: zonificación automática por dirección (PRC point-in-polygon lookup feature) — PermisoHub*
*Researched: 2026-07-30*
