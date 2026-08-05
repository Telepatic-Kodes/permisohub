#!/usr/bin/env node
// Valida .planning/data-sources.yaml contra el estado real del repo.
// Cinco chequeos deterministas, sin LLM — esto es un diff estructural.
// Uso: node scripts/check-data-sources.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import yaml from 'js-yaml'

const ROOT = resolve(import.meta.dirname, '..')
const REGISTRY_PATH = resolve(ROOT, '.planning/data-sources.yaml')
const VERCEL_JSON_PATH = resolve(ROOT, 'vercel.json')
const CRON_DISPATCH_PATH = resolve(ROOT, 'lib/cron-dispatch.ts')
const CRON_DISPATCH_ROUTE = '/api/cron/dispatch'

// Sin dependencia de fs.globSync (Node 22+, no disponible en el Node 20 que
// usa CI) — recursive readdirSync (Node 20.1+) alcanza para estos 3 patrones.
function findFiles(baseDir, matches) {
  if (!existsSync(resolve(ROOT, baseDir))) return []
  return readdirSync(resolve(ROOT, baseDir), { recursive: true })
    .filter(matches)
    .map((f) => join(baseDir, f))
}

function scannedFiles() {
  return [
    ...findFiles('lib/scrapers', (f) => f.endsWith('.ts') && !f.includes('/')),
    ...findFiles('app/api/scraper', (f) => f.endsWith('route.ts')),
    ...findFiles('app/api/cron', (f) => f.endsWith('route.ts')),
  ]
}

// Archivos que existen en los globs de arriba pero deliberadamente no son
// "una fuente de datos externa" (helpers compartidos, no un scraper en sí;
// o jobs de notificación interna que no ingieren nada de afuera).
const GLOB_EXCLUDE = new Set([
  'lib/scrapers/mercado-locales-common.ts',
  'lib/scrapers/terrenos-common.ts',
  'lib/scrapers/noticias-common.ts',
  'app/api/cron/weekly-summary/route.ts',
  // Infraestructura de scheduling y de observabilidad, no fuentes: dispatch
  // solo despacha las tareas de lib/cron-dispatch.ts (no ingiere nada), y
  // salud-fuentes consulta fuentes que YA están registradas — su cobertura
  // se valida en el chequeo 5, no acá.
  'app/api/cron/dispatch/route.ts',
  'app/api/cron/salud-fuentes/route.ts',
])

let hardFailures = 0
let warnings = 0

function fail(msg) {
  console.error(`✗ ${msg}`)
  hardFailures++
}

function warn(msg) {
  console.warn(`! ${msg}`)
  warnings++
}

function ok(msg) {
  console.log(`✓ ${msg}`)
}

if (!existsSync(REGISTRY_PATH)) {
  console.error(`No existe el registro: ${REGISTRY_PATH}`)
  process.exit(1)
}

const registry = yaml.load(readFileSync(REGISTRY_PATH, 'utf8'))
if (!Array.isArray(registry)) {
  console.error('data-sources.yaml debe ser una lista de entradas.')
  process.exit(1)
}

console.log(`Registro cargado: ${registry.length} fuentes.\n`)

// ---------------------------------------------------------------------------
// Chequeo 1: registro → filesystem — cada owner_files debe existir.
// ---------------------------------------------------------------------------
console.log('[1/5] Registro → filesystem')
for (const entry of registry) {
  for (const file of entry.owner_files ?? []) {
    if (!existsSync(resolve(ROOT, file))) {
      fail(`${entry.id}: owner_files "${file}" no existe (¿se movió o eliminó?)`)
    }
  }
  for (const file of entry.called_from ?? []) {
    if (!existsSync(resolve(ROOT, file))) {
      fail(`${entry.id}: called_from "${file}" no existe`)
    }
  }
}
if (hardFailures === 0) ok('Todos los owner_files/called_from del registro existen.')

// ---------------------------------------------------------------------------
// Chequeo 2: filesystem → registro — detecta fuentes nuevas sin documentar
// (la próxima versión del "scraper huérfano").
// ---------------------------------------------------------------------------
console.log('\n[2/5] Filesystem → registro')
const registeredFiles = new Set()
for (const entry of registry) {
  for (const f of entry.owner_files ?? []) registeredFiles.add(f)
  for (const f of entry.called_from ?? []) registeredFiles.add(f)
}

const onDisk = scannedFiles()
const undocumented = onDisk.filter((f) => !GLOB_EXCLUDE.has(f) && !registeredFiles.has(f))

if (undocumented.length > 0) {
  for (const f of undocumented) {
    fail(`"${f}" existe en el repo pero no aparece en ningún owner_files/called_from del registro.`)
  }
} else {
  ok('Todo lo que hay en disco (scrapers, rutas de scraper/cron) está documentado en el registro.')
}

// ---------------------------------------------------------------------------
// Chequeo 3: verdad de scheduling — cruza trigger:"cron:<path>" contra los
// disparadores reales (vercel.json → dispatch → TAREAS_CRON).
// ---------------------------------------------------------------------------
console.log('\n[3/5] Verdad de scheduling (vercel.json + lib/cron-dispatch.ts)')
// Este chequeo validaba `trigger:"cron:X"` directamente contra vercel.json.
// Dejó de ser correcto cuando las 12 entradas de vercel.json se consolidaron
// en UN solo cron (`/api/cron/dispatch`) por el límite de 2 crons del plan
// Hobby: la verdad de scheduling se mudó a TAREAS_CRON en
// lib/cron-dispatch.ts, y el validador quedó preguntándole a la fuente vieja
// — 12 falsos positivos que hicieron ilegible al resto del reporte durante 4
// días (y por eso `mercado-locales-doomos` pudo quedar sin registrar sin que
// nadie lo notara).
//
// El modelo correcto tiene DOS eslabones, y los dos tienen que estar:
//   1. vercel.json dispara /api/cron/dispatch (el único trigger real);
//   2. dispatch encuentra la ruta en TAREAS_CRON.
// Si se rompe cualquiera de los dos, la fuente no corre.
const vercelConfig = existsSync(VERCEL_JSON_PATH)
  ? JSON.parse(readFileSync(VERCEL_JSON_PATH, 'utf8'))
  : { crons: [] }
const cronPaths = new Set((vercelConfig.crons ?? []).map((c) => c.path))

// Se parsea el .ts con regex a propósito: este script es Node plano sin build
// step (corre en CI antes que cualquier compilación), así que no puede
// importar un módulo TypeScript. El formato de TAREAS_CRON es estable y
// literal — si alguien lo vuelve dinámico, el conteo cae a 0 y el chequeo
// falla ruidosamente en vez de dar un OK vacío.
function tareasDeDispatch() {
  if (!existsSync(CRON_DISPATCH_PATH)) return null
  const src = readFileSync(CRON_DISPATCH_PATH, 'utf8')
  const bloque = src.slice(src.indexOf('TAREAS_CRON'))
  return new Set([...bloque.matchAll(/path:\s*'([^']+)'/g)].map((m) => m[1]))
}

const tareasCron = tareasDeDispatch()
let schedulingOk = true

if (!cronPaths.has(CRON_DISPATCH_ROUTE)) {
  fail(`vercel.json no dispara ${CRON_DISPATCH_ROUTE} — con eso NINGUNA tarea de TAREAS_CRON corre.`)
  schedulingOk = false
}
if (tareasCron === null || tareasCron.size === 0) {
  fail('No se pudo leer TAREAS_CRON de lib/cron-dispatch.ts (¿se renombró o dejó de ser una lista literal?).')
  schedulingOk = false
}

for (const entry of registry) {
  if (typeof entry.trigger !== 'string' || !entry.trigger.startsWith('cron:')) continue
  const claimedPath = entry.trigger.slice('cron:'.length)
  // Un trigger directo en vercel.json sigue siendo válido (es el caso de
  // dispatch mismo); si no, tiene que estar despachado desde TAREAS_CRON.
  if (cronPaths.has(claimedPath)) continue
  if (tareasCron?.has(claimedPath)) continue
  fail(
    `${entry.id}: declara trigger "${entry.trigger}" pero esa ruta no está ni en vercel.json crons ni en TAREAS_CRON (lib/cron-dispatch.ts) — no la dispara nadie.`
  )
  schedulingOk = false
}
if (schedulingOk) {
  ok(`Todo trigger "cron:*" resuelve a un disparador real (vercel.json → ${CRON_DISPATCH_ROUTE} → TAREAS_CRON).`)
}

// Dirección inversa: una tarea despachada cuya ruta no existe en disco falla
// en silencio en producción (dispararTarea() traga el error de fetch), así
// que se valida acá donde sí se ve.
for (const path of tareasCron ?? []) {
  if (!existsSync(resolve(ROOT, `app${path}/route.ts`))) {
    fail(`TAREAS_CRON despacha "${path}" pero no existe app${path}/route.ts.`)
  }
}

// ---------------------------------------------------------------------------
// Chequeo 4: frescura — last_verified vs. freshness_sla_days (si existe).
// ---------------------------------------------------------------------------
console.log('\n[4/5] Frescura')
const today = new Date()
let staleCount = 0
for (const entry of registry) {
  if (entry.freshness_sla_days == null) continue
  const lastVerified = new Date(entry.last_verified)
  const ageDays = Math.floor((today - lastVerified) / (1000 * 60 * 60 * 24))
  if (ageDays > entry.freshness_sla_days) {
    warn(`${entry.id}: STALE — última verificación hace ${ageDays} días, SLA es ${entry.freshness_sla_days}.`)
    staleCount++
  }
}
if (staleCount === 0) ok('Ninguna fuente con SLA definido está vencida.')

// ---------------------------------------------------------------------------
// Chequeo 5: salud → registro. Todo sourceId que se escriba en
// data_source_runs (vía recordSourceRun) tiene que existir en el registro.
//
// Sin esto, el id es de facto un string libre: `mercado-locales-doomos` venía
// escribiendo filas de salud desde el 04-08 contra un id que este registro no
// conocía, y la página /admin/salud-datos las mostraba como si fueran de una
// fuente catalogada. Un typo produce exactamente lo mismo — una fuente que
// "reporta bien" en una fila que nadie va a cruzar nunca con el catálogo.
// ---------------------------------------------------------------------------
console.log('\n[5/5] Salud → registro (sourceId de recordSourceRun)')
const ids = new Set(registry.map((e) => e.id))

function tsFiles(baseDir) {
  if (!existsSync(resolve(ROOT, baseDir))) return []
  return readdirSync(resolve(ROOT, baseDir), { recursive: true })
    .filter((f) => typeof f === 'string' && f.endsWith('.ts'))
    .map((f) => join(baseDir, f))
}

const sourceIdsEnCodigo = new Map() // id -> [archivos]
for (const file of [...tsFiles('lib'), ...tsFiles('app')]) {
  const src = readFileSync(resolve(ROOT, file), 'utf8')
  for (const match of src.matchAll(/sourceId:\s*'([^']+)'/g)) {
    const lista = sourceIdsEnCodigo.get(match[1]) ?? []
    if (!lista.includes(file)) lista.push(file)
    sourceIdsEnCodigo.set(match[1], lista)
  }
}

let saludOk = true
for (const [sourceId, archivos] of sourceIdsEnCodigo) {
  if (!ids.has(sourceId)) {
    fail(`sourceId "${sourceId}" se escribe en data_source_runs (${archivos.join(', ')}) pero no existe en el registro.`)
    saludOk = false
  }
}
if (saludOk) {
  ok(`Los ${sourceIdsEnCodigo.size} sourceId usados en código existen en el registro.`)
}

// ---------------------------------------------------------------------------
// Chequeo adicional: duplicate_of debe apuntar a un id real.
// ---------------------------------------------------------------------------
for (const entry of registry) {
  if (entry.duplicate_of && !ids.has(entry.duplicate_of)) {
    fail(`${entry.id}: duplicate_of "${entry.duplicate_of}" no corresponde a ningún id del registro.`)
  }
}

// ---------------------------------------------------------------------------
// Resumen
// ---------------------------------------------------------------------------
const needsDecision = registry.filter((e) => e.status === 'needs-decision').length
const duplicates = registry.filter((e) => e.status === 'duplicate').length
const staleKb = registry.filter((e) => e.status === 'stale-kb').length

console.log('\n--- Resumen ---')
console.log(`Fuentes totales: ${registry.length}`)
console.log(`  needs-decision: ${needsDecision}`)
console.log(`  duplicate:      ${duplicates}`)
console.log(`  stale-kb:       ${staleKb}`)
console.log(`Fallos duros: ${hardFailures}`)
console.log(`Warnings (frescura): ${warnings}`)

if (hardFailures > 0) {
  console.error('\nFAIL — hay fallos duros (categorías 1-3). Ver arriba.')
  process.exit(1)
}
console.log('\nOK — sin fallos duros. (Los needs-decision/duplicate/stale-kb son deuda conocida, no errores.)')
