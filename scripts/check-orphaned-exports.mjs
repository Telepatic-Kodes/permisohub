#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Detector de exports huérfanos en lib/ — "wired or it doesn't count".
//
// POR QUÉ EXISTE: el 04-08 se encontraron TRES módulos completos, testeados y
// sin un solo caller fuera de sus tests: las dos funciones de demografía
// (Fase 17), calcularVeredictoCabida() (Fase 19) y el motor de cabida entero
// (Planes 16-04/16-05, que directamente no existían). Semanas de trabajo con
// valor entregado al usuario = 0.
//
// La causa no fue descuido: el sistema de planificación encadena fases, y
// cuando la Fase 16 se bloqueó por el 403 de OpenRouteService, las fases
// 17-19 se escribieron igual porque el plan lo indicaba, pero nunca se
// conectaron. El plan medía "plan ejecutado", no "el usuario puede verlo".
// Este script mide lo segundo.
//
// CÓMO FUNCIONA: un export de lib/ está "huérfano" si nadie fuera de su
// propio archivo y fuera de tests/ lo menciona. Es una heurística textual, no
// análisis semántico — suficiente para lo que cuida, y con baseline para que
// nunca bloquee por deuda preexistente.
//
// TRINQUETE (ratchet): los huérfanos que ya existen viven en el baseline y no
// fallan. Solo falla si aparece uno NUEVO. Para bajar el baseline: conectar
// el export (o borrarlo) y correr con --update.
// ---------------------------------------------------------------------------

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const RAIZ = process.cwd()
const BASELINE = join(RAIZ, '.orphaned-exports-baseline.json')

// De dónde salen los exports que se vigilan.
const DIR_VIGILADO = 'lib'
// Dónde se busca si alguien los usa. lib/ se incluye: un módulo usado por otro
// módulo de lib/ cuenta como conectado. Si ese otro también está huérfano, se
// detecta en la siguiente pasada al arreglar el primero — el trinquete
// desenreda las cadenas de a una.
const DIRS_CONSUMIDORES = ['app', 'components', 'hooks', 'lib', 'scripts', 'middleware.ts', 'instrumentation.ts']
// tests/ NO cuenta como consumidor: un export que solo usan sus tests es
// exactamente el caso que este script existe para cazar.
const DIRS_EXCLUIDOS = new Set(['node_modules', '.next', 'tests', '.git', 'graphify-out', 'coverage'])

const EXTENSIONES = new Set(['.ts', '.tsx', '.mjs'])

function listarArchivos(dir, acumulado = []) {
  if (!existsSync(dir)) return acumulado
  if (statSync(dir).isFile()) {
    acumulado.push(dir)
    return acumulado
  }
  for (const entrada of readdirSync(dir)) {
    if (DIRS_EXCLUIDOS.has(entrada)) continue
    const ruta = join(dir, entrada)
    const stat = statSync(ruta)
    if (stat.isDirectory()) listarArchivos(ruta, acumulado)
    else if (EXTENSIONES.has(ruta.slice(ruta.lastIndexOf('.')))) acumulado.push(ruta)
  }
  return acumulado
}

// Captura `export function X`, `export async function X`, `export const X`,
// `export class X`, `export interface X`, `export type X`. Deliberadamente NO
// captura `export default` (no tiene nombre que rastrear) ni `export { ... }`
// (re-export: el símbolo original ya se cuenta en su archivo de origen).
const RE_EXPORT = /^export\s+(?:declare\s+)?(?:async\s+)?(function|const|let|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)(.*)$/gm

// Solo el COMPORTAMIENTO huérfano bloquea. Un `interface` o un `type` sin usar
// es inofensivo (típicamente es el tipo del parámetro de una función que sí se
// usa, nombrado por claridad); una FUNCIÓN sin usar es trabajo que no le llega
// a nadie — los tres huérfanos reales del 04-08 eran los tres funciones. Sin
// esta distinción el reporte da 175 hallazgos, se vuelve ruido y se ignora,
// que es la forma más común en que muere un check de calidad.
function clasificar(palabraClave, resto) {
  if (palabraClave === 'function') return 'funcion'
  if (palabraClave === 'class') return 'clase'
  if (palabraClave === 'interface' || palabraClave === 'type') return 'tipo'
  // `export const X = (...) => ...` y `export const X = async (...) =>` son
  // funciones con otra sintaxis, no constantes de datos.
  if (palabraClave === 'const' && /=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*=>/.test(resto)) return 'funcion'
  return 'dato'
}

function extraerExports(contenido) {
  const encontrados = []
  let m
  RE_EXPORT.lastIndex = 0
  while ((m = RE_EXPORT.exec(contenido)) !== null) {
    encontrados.push({ nombre: m[2], clase: clasificar(m[1], m[3] ?? '') })
  }
  return encontrados
}

const archivosLib = listarArchivos(join(RAIZ, DIR_VIGILADO))

// Se lee cada consumidor una sola vez y se indexa por archivo, para poder
// excluir el archivo que define el símbolo sin releer nada.
const consumidores = new Map()
for (const d of DIRS_CONSUMIDORES) {
  for (const archivo of listarArchivos(join(RAIZ, d))) {
    consumidores.set(archivo, readFileSync(archivo, 'utf8'))
  }
}

const huerfanos = [] // solo comportamiento: funciones y clases. Es lo que bloquea.
const huerfanosInertes = [] // tipos y datos: se informan, no bloquean.

for (const archivo of archivosLib) {
  const contenido = readFileSync(archivo, 'utf8')
  const rel = relative(RAIZ, archivo)

  for (const { nombre, clase } of extraerExports(contenido)) {
    const re = new RegExp(`\\b${nombre}\\b`)
    let usado = false

    for (const [rutaConsumidor, textoConsumidor] of consumidores) {
      if (rutaConsumidor === archivo) continue // el propio archivo no cuenta
      if (re.test(textoConsumidor)) {
        usado = true
        break
      }
    }

    if (usado) continue
    if (clase === 'funcion' || clase === 'clase') huerfanos.push(`${rel}:${nombre}`)
    else huerfanosInertes.push(`${rel}:${nombre}`)
  }
}

huerfanos.sort()
huerfanosInertes.sort()

const actualizar = process.argv.includes('--update')

if (actualizar) {
  writeFileSync(BASELINE, JSON.stringify({ huerfanos }, null, 2) + '\n')
  console.log(`✔ Baseline actualizado: ${huerfanos.length} export(s) huérfano(s) registrado(s).`)
  process.exit(0)
}

const previos = existsSync(BASELINE) ? new Set(JSON.parse(readFileSync(BASELINE, 'utf8')).huerfanos) : new Set()
const nuevos = huerfanos.filter((h) => !previos.has(h))
const resueltos = [...previos].filter((h) => !huerfanos.includes(h))

if (resueltos.length > 0) {
  console.log(`✔ ${resueltos.length} huérfano(s) resuelto(s) desde el último baseline:`)
  for (const r of resueltos) console.log(`    ${r}`)
  console.log('  Corré `npm run check:orphans -- --update` para bajar el trinquete.\n')
}

if (nuevos.length > 0) {
  console.error(`✖ ${nuevos.length} export(s) NUEVO(s) de ${DIR_VIGILADO}/ sin ningún caller fuera de tests:\n`)
  for (const n of nuevos) console.error(`    ${n}`)
  console.error(
    '\n  Un export que solo usan sus tests no le entrega valor a nadie.' +
      '\n  Conectalo a una ruta/componente, borralo, o —si es intencional—' +
      '\n  registralo con `npm run check:orphans -- --update`.'
  )
  process.exit(1)
}

console.log(
  `✔ Sin funciones huérfanas nuevas (${huerfanos.length} en baseline, ${archivosLib.length} archivos de ${DIR_VIGILADO}/).` +
    `\n  ${huerfanosInertes.length} tipo(s)/dato(s) sin usar — informativo, no bloquea.`
)
