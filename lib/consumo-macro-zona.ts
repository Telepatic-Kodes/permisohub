// Capacidad de gasto estimada por categoría (EPF) + tasa de pobreza comunal
// (CASEN) — Fase 17, DEMO-02/DEMO-03. A diferencia de lib/censo-manzana-server.ts
// (Plan 17-01, consulta ArcGIS en vivo), este módulo es ESTÁTICO — cero
// llamadas de red en tiempo de request. Ni INE (EPF) ni el Ministerio de
// Desarrollo Social (CASEN) exponen un archivo descargable machine-fetchable
// (17-RESEARCH.md, Open Question 1; re-confirmado en esta sesión — 2
// WebFetch contra ine.gob.cl no devolvieron el desglose completo por
// categoría, y datasocial.ministeriodesarrollosocial.gob.cl no resuelve DNS
// desde este entorno). Mismo patrón editorial que
// lib/strip-power-centers-chile.ts (Fase 18): array/tabla estática,
// git-versionada, PR-revisada — NO un scraper/cron.

import { normalizarNombreComuna } from '@/lib/scrapers/instrumentos-ipt'

// ---------------------------------------------------------------------------
// EPF — IX Encuesta de Presupuestos Familiares (INE, terreno oct 2021-sept
// 2022, última edición publicada — la X EPF seguía en fase de prueba según
// el propio sitio de INE al momento de esta investigación). Representativa
// SOLO a nivel Gran Santiago / capitales regionales — NUNCA comunal, NUNCA
// con precisión de isócrona (DEMO-02). Clasificación CCIF 2018.CL, 12
// divisiones — solo 3 tienen cifra exacta citable confirmada en esta
// investigación. Las restantes quedan explícitamente pendientes, nunca
// rellenadas con un valor inventado.
// Fuente: INE, comunicado IX EPF ("hogares en Chile gastan más de 1,4
// millones..."), sección de participación por división de gasto — cifras de
// capitales regionales/Gran Santiago.
// ---------------------------------------------------------------------------

export interface EpfCategoria {
  nombre: string
  participacionPct: number | null // null = categoría pendiente de transcripción, NUNCA inventada
}

export const EPF_ANO = 2022 // fin del período de terreno IX EPF (oct 2021-sept 2022)

export const EPF_PARTICIPACION_POR_CATEGORIA: EpfCategoria[] = [
  { nombre: 'Alimentos y bebidas no alcohólicas', participacionPct: 0.212 },
  { nombre: 'Vivienda, agua, electricidad, gas y combustibles', participacionPct: 0.160 },
  { nombre: 'Transporte', participacionPct: 0.150 },
  { nombre: 'Bebidas alcohólicas y tabaco', participacionPct: null },
  { nombre: 'Vestuario y calzado', participacionPct: null },
  { nombre: 'Muebles, artículos para el hogar', participacionPct: null },
  { nombre: 'Salud', participacionPct: null },
  { nombre: 'Información y comunicación', participacionPct: null },
  { nombre: 'Recreación, deporte y cultura', participacionPct: null },
  { nombre: 'Educación', participacionPct: null },
  { nombre: 'Restaurantes y alojamiento', participacionPct: null },
  { nombre: 'Seguros y servicios financieros, cuidado personal y bienes diversos', participacionPct: null },
]
// NOTA: INE agrupa la última división en algunos resúmenes ("diversos") —
// el conteo exacto de divisiones (12 vs 13) varía por fuente, ver
// 17-RESEARCH.md. No tratar el número de filas de este array como un
// hecho estadístico fijo, solo como el mejor listado disponible hoy.

// ---------------------------------------------------------------------------
// CASEN 2024 — pobreza comunal vía metodología SAE (Estimación de Área
// Pequeña), Ministerio de Desarrollo Social y Familia. Cobertura nacional
// real: 335 comunas — este archivo cubre SOLO las comunas RM donde
// mercado_locales_listings tiene oportunidades reales hoy (verificado en
// vivo, 2026-08-03: 36 comunas). Cualquier comuna fuera de esta lista
// retorna tasaPobrezaComunal: null en obtenerConsumoEstimado — NUNCA un
// valor aproximado o heredado de una comuna vecina.
//
// Filas pobladas por Task 2 de este plan (checkpoint humano) — transcritas
// desde observatorio.ministeriodesarrollosocial.gob.cl/pobreza-comunal →
// Data Social, con cita de fecha de consulta. Task 1 deja el array vacío a
// propósito: NO fabricar una sola fila antes de que Task 2 aporte datos
// reales.
// ---------------------------------------------------------------------------

export const CASEN_ANO = 2024

export interface CasenComunaEstimado {
  comuna: string // nombre oficial, mismo formato que lib/comunas-chile.ts
  tasaPobrezaPersonas: number // % — Estimación de Área Pequeña (SAE), CASEN 2024
  fuenteUrl: string
  transcritoEl: string // fecha ISO en que un humano confirmó esta cifra contra la fuente oficial
}

export const CASEN_POBREZA_POR_COMUNA: CasenComunaEstimado[] = [
  // Poblado por Task 2 (checkpoint humano) — ver nota arriba. Array vacío
  // hasta entonces: obtenerConsumoEstimado() ya maneja este caso
  // correctamente (tasaPobrezaComunal: null para toda comuna).
]

export interface ConsumoEstimadoResultado {
  comuna: string
  categorias: EpfCategoria[]
  categoriasPendientes: string[] // nombres de las categorías con participacionPct: null — para que la UI las liste explícitamente (locked decision #4)
  tasaPobrezaComunal: number | null // null si la comuna no está en CASEN_POBREZA_POR_COMUNA
  nivelGeografico: 'macro_zona_gran_santiago' // NUNCA uno solo para todo el objeto sin declararlo — DEMO-02/DEMO-03. Único valor posible en v1 (EPF no tiene desagregación comunal) — union deliberadamente abierta para no hardcodear un boolean si algún día se agrega otra fuente.
  disclosure: string // "estimado agregado a nivel macro-zona, no medido en el área específica" — literal de DEMO-02, nunca omitido
  epfAno: typeof EPF_ANO
  casenAno: typeof CASEN_ANO
  fuente: string
}

const DISCLOSURE_CONSUMO =
  'Estimado agregado a nivel macro-zona (Gran Santiago / capital regional), no medido en el área específica de esta oportunidad — nunca presentado con la precisión de la isócrona.'

/**
 * Pura por comuna — cero llamadas de red, cero caché necesario (recalcular
 * en cada llamada es gratis: son 2 lookups sobre arrays pequeños). Nunca
 * lanza. tasaPobrezaComunal: null si la comuna no aparece en
 * CASEN_POBREZA_POR_COMUNA (fuera de las 36 comunas RM cubiertas hoy) — eso
 * es un estado legítimo, no un error.
 */
export function obtenerConsumoEstimado(comuna: string): ConsumoEstimadoResultado {
  const objetivo = normalizarNombreComuna(comuna)
  const filaCasen = CASEN_POBREZA_POR_COMUNA.find((c) => normalizarNombreComuna(c.comuna) === objetivo)

  return {
    comuna,
    categorias: EPF_PARTICIPACION_POR_CATEGORIA,
    categoriasPendientes: EPF_PARTICIPACION_POR_CATEGORIA.filter((c) => c.participacionPct === null).map((c) => c.nombre),
    tasaPobrezaComunal: filaCasen?.tasaPobrezaPersonas ?? null,
    nivelGeografico: 'macro_zona_gran_santiago',
    disclosure: DISCLOSURE_CONSUMO,
    epfAno: EPF_ANO,
    casenAno: CASEN_ANO,
    fuente: filaCasen
      ? `IX EPF (INE, ${EPF_ANO}) + CASEN ${CASEN_ANO} SAE (Ministerio de Desarrollo Social y Familia) — ${filaCasen.fuenteUrl}`
      : `IX EPF (INE, ${EPF_ANO}) — CASEN ${CASEN_ANO}: comuna sin dato transcrito todavía`,
  }
}
