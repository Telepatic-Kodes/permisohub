// Extrae datos graficables directamente de las tablas/listas markdown que
// los prompts de Tasación y Due Diligence YA generan con formato fijo (ver
// lib/tasacion-prompts.ts / lib/due-diligence-propiedad-prompts.ts) — no se
// le pide al modelo un JSON estructurado en paralelo (duplicaría tokens y
// arriesgaría que texto y gráfico diverjan). Mismo criterio de degradación
// elegante que components/mercado-inmobiliario/informe-ejecutivo.tsx: si el
// parseo no encuentra la sección o las filas esperadas, se devuelve null y
// el llamador simplemente no muestra el gráfico — el markdown completo (con
// su tabla) sigue ahí, nunca se pierde información.

// Mismo parser que app/api/sii/lookup/route.ts (parseChileanNumber) —
// duplicado acá (función pura de 5 líneas) en vez de importar desde una
// ruta API. "1.250" es mil doscientos cincuenta, no 1.25 — Number() con un
// simple replace(',', '.') dividía por mil todo comparable con separador de
// miles.
function parsearNumeroChileno(raw: string): number | null {
  const limpio = raw.replace(/\./g, '').replace(',', '.').replace(/[^0-9.]/g, '')
  const n = parseFloat(limpio)
  return Number.isFinite(n) ? n : null
}

function extraerSeccion(markdown: string, tituloRegex: RegExp): string | null {
  const secciones = markdown.split(/\n(?=## )/)
  const seccion = secciones.find((s) => tituloRegex.test(s.split('\n')[0] ?? ''))
  return seccion ?? null
}

function parsearFilasTabla(seccion: string): string[][] {
  const lineas = seccion.split('\n').filter((l) => l.trim().startsWith('|'))
  return lineas
    .filter((l) => !/^\|[\s-:|]+\|$/.test(l.trim())) // descarta la fila separadora (|---|---|)
    .map((l) =>
      l
        .trim()
        .replace(/^\||\|$/g, '')
        .split('|')
        .map((c) => c.trim().replace(/\*\*/g, '')),
    )
}

export interface DimensionScore {
  dimension: string
  score: number
}

/**
 * "## 📊 Score de Liquidez" — 5 dimensiones con "Score (1–5)" tipo "4/5",
 * más la fila "Score total" (excluida del ranking, es una suma, no una
 * dimensión comparable).
 */
export function extraerScoreLiquidez(markdown: string): DimensionScore[] | null {
  const seccion = extraerSeccion(markdown, /score de liquidez/i)
  if (!seccion) return null

  const filas = parsearFilasTabla(seccion)
  const dimensiones: DimensionScore[] = []

  for (const fila of filas) {
    if (fila.length < 2) continue
    const [dimension, scoreRaw] = fila
    if (/dimensión|score total/i.test(dimension)) continue
    const match = scoreRaw.match(/(\d+(?:[.,]\d+)?)\s*\/\s*5/)
    if (!match) continue
    const score = Number(match[1].replace(',', '.'))
    if (!Number.isFinite(score)) continue
    dimensiones.push({ dimension, score })
  }

  return dimensiones.length > 0 ? dimensiones : null
}

export interface ComparableRanking {
  label: string
  ufM2Ajustado: number
}

/**
 * "## 📊 Comparables de Mercado" — rankea por UF/m² ajustado (la columna que
 * ya corrige por tamaño/zona, no el publicado crudo). La columna de
 * dirección y la de UF/m² ajustado se resuelven por texto de encabezado, no
 * por posición fija — si el modelo omite o reordena una columna (ej. no
 * incluye "#"), un índice hardcodeado leería silenciosamente otra columna
 * (precio total en vez de UF/m² ajustado) en vez de degradar a null.
 */
export function extraerComparables(markdown: string): ComparableRanking[] | null {
  const seccion = extraerSeccion(markdown, /comparables de mercado/i)
  if (!seccion) return null

  const filas = parsearFilasTabla(seccion)
  if (filas.length === 0) return null

  const encabezado = filas[0]
  const idxDireccion = encabezado.findIndex((c) => /direcci[oó]n/i.test(c))
  const idxAjustado = encabezado.findIndex((c) => /ajustad/i.test(c))
  if (idxDireccion === -1 || idxAjustado === -1) return null

  const comparables: ComparableRanking[] = []

  for (const fila of filas.slice(1)) {
    if (fila.length <= Math.max(idxDireccion, idxAjustado)) continue
    const direccion = fila[idxDireccion]
    const valor = parsearNumeroChileno(fila[idxAjustado])
    if (!direccion || valor === null || valor <= 0) continue
    comparables.push({ label: direccion.length > 28 ? `${direccion.slice(0, 26)}…` : direccion, ufM2Ajustado: valor })
  }

  return comparables.length > 0 ? comparables : null
}

export interface RiesgosPorNivel {
  alto: number
  medio: number
  bajo: number
}

/**
 * "## ⚠️ Riesgos Identificados" — líneas "**[ALTO/MEDIO/BAJO]** Nombre del
 * riesgo". Anclado al INICIO de línea: cada riesgo trae 3 bullets propios
 * ("Impacto en la operación", etc.) que pueden mencionar un nivel entre
 * corchetes dentro de la prosa (ej. "- Impacto: afecta [MEDIO] la
 * operación") — sin anclar, esas menciones inflaban el conteo.
 */
export function extraerRiesgosPorNivel(markdown: string): RiesgosPorNivel | null {
  const seccion = extraerSeccion(markdown, /riesgos identificados/i)
  if (!seccion) return null

  const resultado: RiesgosPorNivel = { alto: 0, medio: 0, bajo: 0 }
  const regex = /^\s*\*\*\[(ALTO|MEDIO|BAJO)\]\*\*/gim
  let match: RegExpExecArray | null
  let total = 0

  while ((match = regex.exec(seccion)) !== null) {
    const nivel = match[1].toUpperCase()
    if (nivel === 'ALTO') resultado.alto++
    else if (nivel === 'MEDIO') resultado.medio++
    else resultado.bajo++
    total++
  }

  return total > 0 ? resultado : null
}
