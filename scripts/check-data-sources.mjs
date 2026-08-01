#!/usr/bin/env node
// Valida .planning/data-sources.yaml contra el estado real del repo.
// Cuatro chequeos deterministas, sin LLM — esto es un diff estructural.
// Uso: node scripts/check-data-sources.mjs

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import yaml from 'js-yaml'

const ROOT = resolve(import.meta.dirname, '..')
const REGISTRY_PATH = resolve(ROOT, '.planning/data-sources.yaml')
const VERCEL_JSON_PATH = resolve(ROOT, 'vercel.json')

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
console.log('[1/4] Registro → filesystem')
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
console.log('\n[2/4] Filesystem → registro')
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
// Chequeo 3: verdad de scheduling — cruza trigger:"cron:<path>" contra
// vercel.json real.
// ---------------------------------------------------------------------------
console.log('\n[3/4] Verdad de scheduling (vercel.json)')
const vercelConfig = existsSync(VERCEL_JSON_PATH)
  ? JSON.parse(readFileSync(VERCEL_JSON_PATH, 'utf8'))
  : { crons: [] }
const cronPaths = new Set((vercelConfig.crons ?? []).map((c) => c.path))

let schedulingOk = true
for (const entry of registry) {
  if (typeof entry.trigger === 'string' && entry.trigger.startsWith('cron:')) {
    const claimedPath = entry.trigger.slice('cron:'.length)
    if (!cronPaths.has(claimedPath)) {
      fail(`${entry.id}: declara trigger "${entry.trigger}" pero esa ruta no está en vercel.json crons.`)
      schedulingOk = false
    }
  }
}
if (schedulingOk) ok('Todo trigger "cron:*" declarado coincide con un cron real en vercel.json.')

// ---------------------------------------------------------------------------
// Chequeo 4: frescura — last_verified vs. freshness_sla_days (si existe).
// ---------------------------------------------------------------------------
console.log('\n[4/4] Frescura')
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
// Chequeo adicional: duplicate_of debe apuntar a un id real.
// ---------------------------------------------------------------------------
const ids = new Set(registry.map((e) => e.id))
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
