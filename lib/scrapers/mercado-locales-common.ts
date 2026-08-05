import { createServiceClient } from '@/lib/supabase/service'

// ---------------------------------------------------------------------------
// Tipos y helpers compartidos del pipeline de mercado de locales comerciales
// (fase 1 de la fusión PROPRA·BI → PermisoHub). Mirror deliberado de
// lib/scrapers/terrenos-common.ts, pero para un dataset GLOBAL (sin
// workspace_id) — ver el comentario en la migración
// 20260802_mercado_locales_listings.sql para el porqué.
//
// IMPORTANTE: MERCADO_LOCALES_COMUNA_SLUGS es un universo de comunas
// DISTINTO de COMUNAS_CON_ZONIFICACION (terrenos-common.ts). Uno cubre las
// comunas donde PROPRA·BI verificó cobertura de locales comerciales en
// Portalinmobiliario (corredores comerciales/oficinas del sector oriente y
// pericentro), el otro las comunas con cobertura de zonificación para
// terrenos (mayoritariamente sur/poniente de la RM). NO fusionar estas dos
// listas "por prolijidad" — sirven a productos distintos.
// ---------------------------------------------------------------------------

export type OperacionMercadoLocal = 'arriendo' | 'venta'


// Fase 8 (ago. 2026): tipos adicionales al local comercial original —
// verificados en vivo como sub-categorías propias dentro de "Comercial" en
// Portalinmobiliario (facet ids distintos: 242065 locales, 242067 oficina,
// 245003 bodega, 245009 industrial), cada una con su propio segmento de URL
// (`/oficina/`, `/bodega/`, `/industrial/` — el segmento por sí solo aplica
// el filtro correcto, confirmado contra `applied_filters` de una respuesta
// en vivo; a diferencia de locales, no requieren el query param
// ?PROPERTY_TYPE= explícito).
export type TipoPropiedadComercial = 'local_comercial' | 'oficina' | 'bodega' | 'industrial'

export const TIPO_PROPIEDAD_PORTAL_PATH: Record<TipoPropiedadComercial, string> = {
  local_comercial: 'comercial',
  oficina: 'oficina',
  bodega: 'bodega',
  industrial: 'industrial',
}

// Etiquetas humanas para prompts de IA y UI — evita que la narrativa de
// pricing llame "local comercial" a una oficina o bodega cuando se generaliza
// más allá de local_comercial (Fase 8).
export const TIPO_PROPIEDAD_LABEL: Record<TipoPropiedadComercial, { singular: string; plural: string }> = {
  local_comercial: { singular: 'local comercial', plural: 'locales comerciales' },
  oficina: { singular: 'oficina', plural: 'oficinas' },
  bodega: { singular: 'bodega', plural: 'bodegas' },
  industrial: { singular: 'nave industrial', plural: 'naves industriales' },
}

// Verificado a mano contra un fetch en vivo de
// /{operacion}/comercial/{slug}-metropolitana?PROPERTY_TYPE=242065 (242065 =
// facet id interno de MELI para "Locales") — igual que en el repo origen,
// el slug NO es una transliteración mecánica del nombre ("Santiago Centro" es
// "santiago", no "santiago-centro", que cae silenciosamente al resultado
// nacional sin filtrar). Agregar comunas nuevas leyendo el facet `city` de
// una búsqueda sin filtrar, no adivinando el slug — en la práctica: fetch
// `/comercial/{slug}-metropolitana?PROPERTY_TYPE=242065` y confirmar que
// `applied_filters` incluye `{"key":"city",...}`; si no aparece, el slug cae
// silenciosamente al resultado nacional sin filtrar y no sirve.
//
// Fase 7 (ago. 2026): +20 comunas RM verificadas en vivo con el mismo método
// (todas confirmaron `city` aplicado) — dobla la cobertura original de 16,
// aprovechando la ventana de first-mover encontrada en el benchmark
// competitivo (la cobertura "nacional" de GPS Property/Inciti resultó más
// débil de lo que declaran).
export const MERCADO_LOCALES_COMUNA_SLUGS: Record<string, string> = {
  'Santiago Centro': 'santiago',
  Providencia: 'providencia',
  'Las Condes': 'las-condes',
  Vitacura: 'vitacura',
  'Lo Barnechea': 'lo-barnechea',
  Ñuñoa: 'nunoa',
  'La Reina': 'la-reina',
  Macul: 'macul',
  Peñalolén: 'penalolen',
  'La Florida': 'la-florida',
  Maipú: 'maipu',
  'San Miguel': 'san-miguel',
  'Estación Central': 'estacion-central',
  Huechuraba: 'huechuraba',
  Quilicura: 'quilicura',
  Recoleta: 'recoleta',
  'San Bernardo': 'san-bernardo',
  'Puente Alto': 'puente-alto',
  'La Cisterna': 'la-cisterna',
  'San Joaquín': 'san-joaquin',
  'El Bosque': 'el-bosque',
  'Pedro Aguirre Cerda': 'pedro-aguirre-cerda',
  Cerrillos: 'cerrillos',
  Independencia: 'independencia',
  Conchalí: 'conchali',
  Renca: 'renca',
  Pudahuel: 'pudahuel',
  'Quinta Normal': 'quinta-normal',
  'Lo Prado': 'lo-prado',
  'Cerro Navia': 'cerro-navia',
  'San Ramón': 'san-ramon',
  'La Granja': 'la-granja',
  Colina: 'colina',
  Lampa: 'lampa',
  Buin: 'buin',
  'Padre Hurtado': 'padre-hurtado',
}

export interface MercadoLocalListadoRaw {
  fuente: 'portalinmobiliario' | 'doomos'
  fuenteId: string
  url: string
  titulo: string
  operacion: OperacionMercadoLocal
  precioMonto: number | null
  precioMoneda: 'UF' | 'CLP' | null
  superficieM2: number | null
  atributosRaw: Record<string, unknown>
}

export const TIPO_PROPIEDAD_DEFAULT: TipoPropiedadComercial = 'local_comercial'

// Descubierto en vivo en Fase 8 (ago. 2026) al revisar bandas de oficina que
// salían implausiblemente bajas: igual que el bug ya documentado en
// terrenos-common.ts::PRECIO_CLP_MINIMO_PLAUSIBLE, algunos avisos de
// propiedades grandes/premium (torres de oficinas, bodegas de gran
// superficie) muestran en el MISMO widget de precio total el valor UF/m²
// que el corredor quiso ingresar como tarifa, sin ningún marcador
// distinguible en el HTML (verificado contra la página en vivo: aria-label
// "0 unidades de fomento con 61 centavos" para una oficina de 311 m² en
// Las Condes — imposible que sea el arriendo mensual real). Afecta las 4
// categorías, no solo las nuevas de Fase 8 (confirmado con datos reales ya
// scrapeados: ~5-20% de los avisos según categoría/operación). Sin forma de
// distinguir estructuralmente cuál es cuál, se descarta el precio del aviso
// (no el aviso completo) antes que inventar o adivinar cuál de los dos
// números es el real.
export const PRECIO_MINIMO_PLAUSIBLE_MERCADO_LOCALES: Record<OperacionMercadoLocal, { uf: number; clp: number }> = {
  arriendo: { uf: 5, clp: 1_000_000 },
  venta: { uf: 50, clp: 10_000_000 },
}

export function precioMercadoLocalEsPlausible(
  monto: number,
  moneda: 'UF' | 'CLP',
  operacion: OperacionMercadoLocal,
): boolean {
  const piso = PRECIO_MINIMO_PLAUSIBLE_MERCADO_LOCALES[operacion]
  return moneda === 'UF' ? monto >= piso.uf : monto >= piso.clp
}

export interface UpsertMercadoLocalesSummary {
  comuna: string
  operacion: OperacionMercadoLocal
  scrapeados: number
  nuevos: number
  actualizados: number
  dadosDeBaja: number
  reactivados: number
}

/**
 * Upsert de resultados del scraper de locales comerciales en
 * mercado_locales_listings, con detección de bajas (delisting) — scoped
 * estrictamente a (fuente, comuna, operación, tipo_propiedad) para que un
 * aviso solo se marque "dado_de_baja" cuando ESTA corrida efectivamente
 * re-chequeó esa combinación (mismo razonamiento que diffAndUpsertBatch en
 * el repo origen: nunca dar de baja comunas que el cron de hoy no tocó).
 *
 * IMPORTANTE (Fase 8): tipo_propiedad debe ir en el filtro "before" y en el
 * de la baja — sin esto, correr un scrape de "oficina" en una comuna que ya
 * tiene locales comerciales activos marcaría esos locales como
 * "dado_de_baja" (su fuente_id nunca aparece en un scrape de oficinas),
 * mezclando dos datasets que deben permanecer independientes.
 *
 * El historial de precio NO se inserta acá — lo hace el trigger
 * registrar_historial_precio_mercado_local() en cada INSERT/UPDATE real de
 * precio, así ningún caller nuevo puede "olvidarlo".
 */
export async function upsertMercadoLocalesDesdeListado(
  comuna: string,
  operacion: OperacionMercadoLocal,
  items: MercadoLocalListadoRaw[],
  tipoPropiedad: TipoPropiedadComercial = TIPO_PROPIEDAD_DEFAULT,
): Promise<UpsertMercadoLocalesSummary> {
  const summary: UpsertMercadoLocalesSummary = {
    comuna,
    operacion,
    scrapeados: items.length,
    nuevos: 0,
    actualizados: 0,
    dadosDeBaja: 0,
    reactivados: 0,
  }
  if (items.length === 0) return summary

  // Todos los items de una misma llamada vienen del mismo scraper (el
  // caller siempre invoca UNA función buscarLocalesComerciales() por
  // fuente) — se deriva de items[0] en vez de recibir un parámetro
  // separado que podría desincronizarse del contenido real de `items`.
  // Antes hardcodeaba 'portalinmobiliario' acá y en la baja de abajo: con
  // una segunda fuente, eso habría hecho que TODO item de esa fuente
  // contara siempre como "nuevo" (el filtro "before" nunca matcheaba) y
  // que nunca se diera de baja nada (04-08).
  const fuente = items[0].fuente

  const supabase = createServiceClient()
  const scrapedIds = new Set(items.map((i) => i.fuenteId))

  const { data: before, error: beforeError } = await supabase
    .from('mercado_locales_listings')
    .select('fuente_id, status')
    .eq('fuente', fuente)
    .eq('comuna', comuna)
    .eq('operacion', operacion)
    .eq('tipo_propiedad', tipoPropiedad)

  if (beforeError) throw new Error(`lectura previa de mercado_locales_listings falló: ${beforeError.message}`)

  const beforeMap = new Map((before ?? []).map((r) => [r.fuente_id as string, r.status as string]))

  const rows = items.map((item) => ({
    fuente: item.fuente,
    fuente_id: item.fuenteId,
    url: item.url,
    titulo: item.titulo,
    operacion: item.operacion,
    comuna,
    tipo_propiedad: tipoPropiedad,
    precio_monto: item.precioMonto,
    precio_moneda: item.precioMoneda,
    superficie_m2: item.superficieM2,
    atributos_raw: item.atributosRaw,
    status: 'activo',
    ultima_vez_visto_el: new Date().toISOString(),
    dado_de_baja_el: null,
  }))

  const { error: upsertError } = await supabase
    .from('mercado_locales_listings')
    // onConflict incluye tipo_propiedad (04-08, corrige gap de integridad):
    // un mismo fuente_id puede aparecer legítimamente en más de una
    // categoría de la fuente — antes se pisaban entre sí en vez de
    // coexistir como filas separadas.
    .upsert(rows, { onConflict: 'fuente,fuente_id,tipo_propiedad', ignoreDuplicates: false })

  if (upsertError) throw new Error(`upsert de mercado_locales_listings falló: ${upsertError.message}`)

  for (const item of items) {
    const priorStatus = beforeMap.get(item.fuenteId)
    if (priorStatus === undefined) {
      summary.nuevos++
    } else {
      summary.actualizados++
      if (priorStatus === 'dado_de_baja') summary.reactivados++
    }
  }

  const goneIds = [...beforeMap.entries()]
    .filter(([id, status]) => status === 'activo' && !scrapedIds.has(id))
    .map(([id]) => id)

  if (goneIds.length > 0) {
    const { error: delistError } = await supabase
      .from('mercado_locales_listings')
      .update({ status: 'dado_de_baja', dado_de_baja_el: new Date().toISOString() })
      .eq('fuente', fuente)
      .eq('comuna', comuna)
      .eq('operacion', operacion)
      .eq('tipo_propiedad', tipoPropiedad)
      .in('fuente_id', goneIds)

    if (delistError) throw new Error(`baja de mercado_locales_listings falló: ${delistError.message}`)
    summary.dadosDeBaja = goneIds.length
  }

  return summary
}
