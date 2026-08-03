// Lista curada a mano de strip centers y power centers en Chile (RM) — COMPE-04.
// No existe tag OSM ni fuente pública con direcciones para estos formatos en
// Chile (ver .planning/research/SEED-STRIP-POWER-CENTERS-CHILE.md, investigación
// 2 ago 2026). Mismo patrón editorial que CADENAS_RUT_CONOCIDOS
// (lib/scrapers/sii-nomina-sucursales.ts): array estático, git-versionado,
// editado por PR cuando el equipo confirma un nuevo centro — NO una tabla con
// pipeline de ingesta (nada la actualiza en cron).
//
// lat/lng geocodificados UNA VEZ vía scripts/geocode-strip-power-seed.mjs
// (corrida real 2 ago 2026) contra Nominatim real — nunca fabricados. Filas
// con direccion: null (seed doc dice "no confirmada" o el número exacto no
// pudo confirmarse) tienen lat/lng: null a propósito — excluidas del
// matching espacial, visibles solo para auditoría. INVARIANTE (ver
// tests/unit/strip-power-centers-chile.test.ts): toda fila con
// direccion !== null tiene lat/lng !== null — si algún día una fila queda
// con direccion no-null pero sin geocodificar, es un bug, no un estado válido.
//
// GAPS CONOCIDOS (ver data-sources.yaml → strip-power-centers-chile-seed):
// Grupo Patio (~91-158 propiedades) y Más Center (~30 strip centers activos)
// NO tienen ni un solo activo nombrado en esta lista — un conteo de 0 para
// strip_center/power_center en una comuna donde alguno de estos dos operadores
// tiene presencia real NO significa "confirmado: no hay competencia".

import * as turf from '@turf/turf'
import type { CompetidorDetectado, FormatoComercial } from '@/lib/cabida-comercial'

export type StripPowerConfianza = 'alta' | 'media' | 'baja'

export interface StripPowerCenterSeed {
  nombre: string
  formato: 'strip_center' | 'power_center'
  operador: string
  comuna: string
  direccion: string | null
  lat: number | null
  lng: number | null
  fuente: string
  confianza: StripPowerConfianza
}

export const STRIP_POWER_CENTERS_CHILE: StripPowerCenterSeed[] = [
  // --- Tabla 1 (seed doc): Strip centers, Región Metropolitana ---
  {
    nombre: 'Punta Blanca Maipú (Los Pajaritos)',
    formato: 'strip_center',
    operador: 'Punta Blanca Inversiones',
    comuna: 'Maipú',
    direccion: 'Av. Los Pajaritos 1.948',
    lat: -33.470433,
    lng: -70.734977,
    fuente: 'https://puntablanca.cl/comercial',
    confianza: 'alta',
  },
  {
    nombre: 'Punta Blanca Pajaritos',
    formato: 'strip_center',
    operador: 'Punta Blanca Inversiones',
    comuna: 'Maipú',
    direccion: 'Av. Pajaritos 2.872',
    lat: -33.4701708,
    lng: -70.7342643,
    fuente: 'https://puntablanca.cl/comercial',
    confianza: 'alta',
  },
  {
    nombre: 'Punta Blanca Irarrázaval',
    formato: 'strip_center',
    operador: 'Punta Blanca Inversiones',
    comuna: 'Ñuñoa',
    direccion: 'Av. Irarrázaval 2.401',
    lat: -33.4535635,
    lng: -70.6223843,
    fuente: 'https://puntablanca.cl/comercial/irarrazaval',
    confianza: 'alta',
  },
  {
    nombre: 'Punta Blanca Antonio Varas',
    formato: 'strip_center',
    operador: 'Punta Blanca Inversiones',
    comuna: 'Ñuñoa',
    direccion: 'Av. Antonio Varas 2.284',
    lat: -33.4486975,
    lng: -70.6105402,
    fuente: 'https://puntablanca.cl/comercial',
    confianza: 'alta',
  },
  {
    nombre: 'Punta Blanca San Bernardo',
    formato: 'strip_center',
    operador: 'Punta Blanca Inversiones',
    comuna: 'San Bernardo',
    direccion: 'Av. Padre Hurtado 14.529',
    lat: -33.5989557,
    lng: -70.6810757,
    fuente: 'https://puntablanca.cl/comercial/san-bernardo',
    confianza: 'alta',
  },
  {
    nombre: 'Punta Blanca Avenida Perú',
    formato: 'strip_center',
    operador: 'Punta Blanca Inversiones',
    comuna: 'Recoleta',
    direccion: 'Av. Perú 805',
    lat: -33.4238365,
    lng: -70.6397053,
    fuente: 'https://puntablanca.cl/comercial/avenida-peru',
    confianza: 'alta',
  },
  {
    nombre: 'Punta Blanca Talagante',
    formato: 'strip_center',
    operador: 'Punta Blanca Inversiones',
    comuna: 'Talagante',
    direccion: "Av. Bernardo O'Higgins 1.116",
    lat: -33.6702536,
    lng: -70.9408371,
    fuente: 'https://puntablanca.cl/comercial',
    confianza: 'alta',
  },
  {
    nombre: 'Punta Blanca Ciudad Empresarial',
    formato: 'strip_center',
    operador: 'Punta Blanca Inversiones',
    comuna: 'Huechuraba',
    direccion: 'Av. del Parque 4.023',
    lat: -33.3936618,
    lng: -70.6204767,
    fuente: 'https://puntablanca.cl/comercial',
    confianza: 'alta',
  },
  {
    nombre: 'Plaza Don Carlos',
    formato: 'strip_center',
    operador: 'Fondo BTG Pactual Renta Comercial',
    comuna: 'La Reina',
    direccion: 'Príncipe de Gales 8.531 (esquina Carlos Ossandón)',
    lat: -33.4411934,
    lng: -70.5429542,
    fuente: 'https://btgpactual.cl/rentacomercial/activos/don-carlos/',
    confianza: 'alta',
  },
  {
    nombre: 'Paseo Tobalaba I',
    formato: 'strip_center',
    operador: 'Fondo BTG Pactual Renta Comercial',
    comuna: 'Peñalolén',
    direccion: 'Av. Tobalaba 11.835',
    lat: -33.5107482,
    lng: -70.5607166,
    fuente: 'https://btgpactual.cl/rentacomercial/activos/tobalaba-i/',
    confianza: 'alta',
  },
  {
    nombre: 'Paseo Tobalaba II',
    formato: 'strip_center',
    operador: 'Fondo BTG Pactual Renta Comercial',
    comuna: 'Peñalolén',
    direccion: 'Av. Tobalaba 11.855',
    lat: -33.5096081,
    lng: -70.5608099,
    fuente: 'https://btgpactual.cl/rentacomercial/activos/tobalaba-ii/',
    confianza: 'alta',
  },
  {
    nombre: 'Paseo Maipú II',
    formato: 'strip_center',
    operador: 'Fondo BTG Pactual Renta Comercial',
    comuna: 'Maipú',
    direccion: 'Av. Tres Poniente 2.600',
    lat: -33.5102005,
    lng: -70.7792201,
    fuente: 'https://btgpactual.cl/rentacomercial/activos/maipu-ii/',
    confianza: 'alta',
  },
  {
    nombre: 'Plaza La Fuente',
    formato: 'strip_center',
    operador: 'Fondo BTG Pactual Renta Comercial',
    comuna: 'Macul',
    direccion: 'Macul 2.555',
    lat: -33.4977207,
    lng: -70.5980833,
    fuente: 'https://btgpactual.cl/rentacomercial/activos/la-fuente/',
    confianza: 'alta',
  },
  {
    nombre: 'Plaza Vivaceta',
    formato: 'strip_center',
    operador: 'Fondo BTG Pactual Renta Comercial',
    comuna: 'Independencia',
    direccion: 'Fermín Vivaceta 957',
    lat: -33.420426,
    lng: -70.6630317,
    fuente: 'https://btgpactual.cl/rentacomercial/activos/vivaceta/',
    confianza: 'alta',
  },
  {
    // Dirección exacta ("número exacto no confirmado" en el seed doc) — la
    // celda SÍ traía una intersección geocodificable ("esquina Pío XI / Av.
    // Vitacura"), a diferencia de las filas con direccion: null de abajo
    // donde la fuente no dio ni siquiera eso. Confianza 'media' (no 'alta')
    // por esa imprecisión, y porque BTG vendió strip centers en esta zona a
    // fines de 2024 — posible activo ya no operado por el fondo.
    nombre: 'Plaza San Pío',
    formato: 'strip_center',
    operador: 'Fondo BTG Pactual Renta Comercial (¿vendido? — posible venta fin 2024)',
    comuna: 'Vitacura',
    direccion: 'Esquina Pío XI / Av. Vitacura (número exacto no confirmado)',
    lat: -33.3992544,
    lng: -70.5816672,
    fuente: 'https://thelatinamericanlawyer.com/be-assists-btg-pactual-in-the-sale-of-strip-centers/',
    confianza: 'media',
  },
  {
    nombre: 'Cimenta Strip Center Puente Alto',
    formato: 'strip_center',
    operador: 'Cimenta S.A.',
    comuna: 'Puente Alto',
    direccion: null,
    lat: null,
    lng: null,
    fuente: 'https://cimenta.cl/negocios/strip-centers/',
    confianza: 'media',
  },
  {
    nombre: 'Terrazas San Cristóbal',
    formato: 'strip_center',
    operador: 'Cimenta S.A.',
    comuna: 'Providencia',
    direccion: null,
    lat: null,
    lng: null,
    fuente: 'Búsqueda agregada "Cimenta strip centers Chile portafolio" — mención de inauguración próxima, no verificado con fetch directo a página del proyecto',
    confianza: 'baja',
  },
  {
    nombre: 'Strip center Camino Lonquén (sin nombre comercial confirmado)',
    formato: 'strip_center',
    operador: 'Inmobiliaria SMU (matriz de Unimarc/SMU)',
    comuna: 'Maipú',
    direccion: 'Camino Lonquén 17.723',
    lat: -33.5150242,
    lng: -70.7194968,
    fuente: 'https://www.df.cl/empresas/retail/matriz-de-los-supermercados-unimarc-busca-entrar-al-negocio-de-los-strip',
    confianza: 'alta',
  },
  {
    nombre: 'Strip center Colina (Más Center)',
    formato: 'strip_center',
    operador: 'IFB Inversiones / Más Center',
    comuna: 'Colina',
    direccion: null,
    lat: null,
    lng: null,
    fuente: 'https://www.meganoticias.cl/nacional/494412-strip-center-en-colina-ubicacion-cuando-abre-pdp-5-8-2025.html',
    confianza: 'media',
  },
  {
    nombre: 'Strip center Pirque Etapa III (Más Center)',
    formato: 'strip_center',
    operador: 'IFB Inversiones / Más Center',
    comuna: 'Pirque',
    direccion: null,
    lat: null,
    lng: null,
    fuente: 'https://www.meganoticias.cl/nacional/494020-strip-center-en-pirque-etapa-iii-supermercado-farmacia-pdp-1-8-2025.html',
    confianza: 'media',
  },
  {
    nombre: 'BCenter Alto Jahuel',
    formato: 'strip_center',
    operador: 'Operador no confirmado (portal bicentenario.cl lo publica)',
    comuna: 'Buin',
    direccion: 'Av. principal Buin–Alto Jahuel, cerca de Miraflores 166-300 (número exacto no confirmado)',
    lat: -33.7344602,
    lng: -70.7830293,
    fuente: 'https://www.bicentenario.cl/blcenter-alto-jahuel/',
    confianza: 'media',
  },
  // --- Tabla 2 (seed doc): Power centers, Región Metropolitana ---
  {
    nombre: 'Paseo Los Trapenses',
    formato: 'power_center',
    operador: 'Fondo BTG Pactual Renta Comercial',
    comuna: 'Lo Barnechea',
    direccion: 'Camino Los Trapenses N° 3.515',
    lat: -33.3450747,
    lng: -70.548135,
    fuente: 'https://btgpactual.cl/rentacomercial/activos/paseo-los-trapenses/',
    confianza: 'alta',
  },
  {
    nombre: 'Power Center Cerrillos',
    formato: 'power_center',
    operador: 'Cenco Malls (Cencosud)',
    comuna: 'Cerrillos',
    direccion: null,
    lat: null,
    lng: null,
    fuente: 'https://cencomalls.com/corporativo/negocios/centros-comerciales/chile',
    confianza: 'baja',
  },
  {
    nombre: 'Power Center Puente Alto',
    formato: 'power_center',
    operador: 'Cenco Malls (Cencosud)',
    comuna: 'Puente Alto',
    direccion: null,
    lat: null,
    lng: null,
    fuente: 'https://cencomalls.com/corporativo/negocios/centros-comerciales/chile',
    confianza: 'baja',
  },
  {
    nombre: 'Power Center San Bernardo',
    formato: 'power_center',
    operador: 'Cenco Malls (Cencosud)',
    comuna: 'San Bernardo',
    direccion: null,
    lat: null,
    lng: null,
    fuente: 'https://cencomalls.com/corporativo/negocios/centros-comerciales/chile',
    confianza: 'baja',
  },
]

// Cap deliberado: la lista es curada a mano y con gaps conocidos (Grupo
// Patio, Más Center) — un competidor individual de esta fuente nunca llega a
// 'alta' a nivel de CompetidorDetectado, por completa que parezca su fila
// fuente en STRIP_POWER_CENTERS_CHILE (ver tests/unit — regla verificada).
const CONFIANZA_STRIP_POWER_A_NIVEL: Record<StripPowerConfianza, CompetidorDetectado['confianza']> = {
  alta: 'media',
  media: 'media',
  baja: 'baja',
}

export function obtenerCompetidoresSeedList(
  formato: 'strip_center' | 'power_center',
  origen: { lat: number; lng: number },
  radioM: number,
  isocronaGeometria?: GeoJSON.Polygon | GeoJSON.MultiPolygon | null
): CompetidorDetectado[] {
  const puntoOrigen = turf.point([origen.lng, origen.lat])
  return STRIP_POWER_CENTERS_CHILE.filter((c) => c.formato === formato && c.lat != null && c.lng != null)
    .map((c) => {
      const punto = turf.point([c.lng as number, c.lat as number])
      const distanciaM = turf.distance(puntoOrigen, punto, { units: 'meters' })
      return { c, punto, distanciaM }
    })
    .filter(({ distanciaM, punto }) => {
      if (distanciaM > radioM) return false
      if (isocronaGeometria && !turf.booleanPointInPolygon(punto, isocronaGeometria)) return false
      return true
    })
    .map(
      ({ c, distanciaM }): CompetidorDetectado => ({
        nombre: c.nombre,
        formato: c.formato as FormatoComercial,
        fuente: 'seed_list',
        lat: c.lat as number,
        lng: c.lng as number,
        distanciaM: Math.round(distanciaM),
        confianza: CONFIANZA_STRIP_POWER_A_NIVEL[c.confianza],
        direccionLabel: c.direccion ?? undefined,
      })
    )
}
