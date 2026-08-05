// Tabla de tareas cron consolidadas.
//
// Por qué existe este archivo: Vercel (plan Hobby) limita a 2 cron jobs por
// proyecto. Este proyecto acumuló 12 entradas en vercel.json (agregadas a lo
// largo de varias features — ver `git log -p -- vercel.json`), lo que hacía
// que CADA deploy de producción fuera rechazado en la activación —
// silenciosamente, sin mensaje de error en los logs de build, justo después
// de "Deploying outputs..." — desde que el commit que agregó las 5 tareas de
// terrenos empujó el conteo de 7 a 12.
//
// Solución: un solo cron de Vercel ("/api/cron/dispatch", diario) que en
// runtime decide qué tareas están "debidas hoy" según el calendario original
// de cada una (mismos días/frecuencias que tenían en vercel.json), y las
// dispara como invocaciones HTTP independientes hacia sus rutas ya
// existentes — sin tocar esas rutas. Cada una sigue corriendo con su propio
// maxDuration, así que los presupuestos de tiempo no se suman.
//
// La hora exacta original (6:00–11:00 UTC) se pierde al consolidar a 1
// trigger diario — no es preservable sin un cron por horario, que es
// exactamente lo que no podemos tener. Lo que SÍ se preserva es el
// escalonado relativo entre las 5 fuentes de terrenos (staggerMs alto),
// porque esa fue una decisión deliberada para no golpear Overpass (rate
// limit compartido de lib/terrenos-ubicacion.ts) con las 5 a la vez — ver
// comentario en app/api/cron/terrenos-portalinmobiliario/route.ts.

export interface TareaCron {
  path: string
  /** Solo para trazabilidad — el horario real ya no aplica una vez consolidado a 1 trigger diario. */
  horarioOriginal: string
  /** true si la tarea corresponde disparar hoy, según el calendario que tenía en vercel.json. */
  debidaHoy: (fecha: Date) => boolean
  /** Pausa (ms) DESPUÉS de disparar esta tarea, antes de la siguiente. */
  staggerMs: number
}

const DIARIA = () => true
const LUNES = (fecha: Date) => fecha.getUTCDay() === 1
const MARTES = (fecha: Date) => fecha.getUTCDay() === 2
const DIA_2_DEL_MES = (fecha: Date) => fecha.getUTCDate() === 2

export const TAREAS_CRON: TareaCron[] = [
  // PRIMERA a propósito: mide la salud de las fuentes externas ANTES de que
  // corran los scrapers del día. Si midiera después, estaría midiendo la
  // contención que produce este mismo cron (los martes las 5 tareas de
  // terrenos golpean Overpass, el mismo servicio que el probe consulta) y
  // reportaría como "fuente degradada" lo que en realidad es carga propia.
  // El stagger de 10 s deja que el slot de Overpass se regenere antes de que
  // arranque lo demás.
  { path: '/api/cron/salud-fuentes', horarioOriginal: 'nuevo — 05-08', debidaHoy: DIARIA, staggerMs: 10_000 },

  // Terrenos: 5 fuentes, mismo día (martes) — stagger alto preserva la
  // intención original de vercel.json.
  { path: '/api/cron/terrenos-portalinmobiliario', horarioOriginal: '0 6 * * 2', debidaHoy: MARTES, staggerMs: 30_000 },
  { path: '/api/cron/terrenos-yapo', horarioOriginal: '40 6 * * 2', debidaHoy: MARTES, staggerMs: 30_000 },
  { path: '/api/cron/terrenos-doomos', horarioOriginal: '20 7 * * 2', debidaHoy: MARTES, staggerMs: 30_000 },
  { path: '/api/cron/terrenos-chilepropiedades', horarioOriginal: '0 8 * * 2', debidaHoy: MARTES, staggerMs: 30_000 },
  { path: '/api/cron/terrenos-portalterreno', horarioOriginal: '40 8 * * 2', debidaHoy: MARTES, staggerMs: 5_000 },

  // Resto — sin conflicto documentado de rate-limit entre ellas, stagger corto solo por prudencia.
  { path: '/api/scraper/sii-nomina-sucursales', horarioOriginal: '0 7 2 * *', debidaHoy: DIA_2_DEL_MES, staggerMs: 5_000 },
  { path: '/api/scraper/instrumentos-ipt', horarioOriginal: '0 8 * * 1', debidaHoy: LUNES, staggerMs: 5_000 },
  { path: '/api/cron/noticias-macro', horarioOriginal: '0 9 * * *', debidaHoy: DIARIA, staggerMs: 5_000 },
  { path: '/api/scraper/mercado-locales', horarioOriginal: '0 10 * * *', debidaHoy: DIARIA, staggerMs: 5_000 },
  { path: '/api/scraper/mercado-locales-tipos-adicionales', horarioOriginal: '30 10 * * *', debidaHoy: DIARIA, staggerMs: 5_000 },
  // Segunda fuente de mercado_locales_listings (04-08) — mismo criterio de
  // stagger que el resto de "sin conflicto documentado", Doomos no comparte
  // ningún rate-limit conocido con Overpass ni con Portalinmobiliario.
  { path: '/api/scraper/mercado-locales-doomos', horarioOriginal: 'nuevo — 04-08', debidaHoy: DIARIA, staggerMs: 5_000 },
  { path: '/api/scraper/mercado-locales-doomos-tipos-adicionales', horarioOriginal: 'nuevo — 04-08', debidaHoy: DIARIA, staggerMs: 5_000 },
  { path: '/api/cron/daily-check', horarioOriginal: '0 11 * * *', debidaHoy: DIARIA, staggerMs: 5_000 },
  { path: '/api/cron/weekly-summary', horarioOriginal: '0 11 * * 1', debidaHoy: LUNES, staggerMs: 0 },
]

export function tareasDebidasHoy(fecha: Date = new Date()): TareaCron[] {
  return TAREAS_CRON.filter((tarea) => tarea.debidaHoy(fecha))
}
