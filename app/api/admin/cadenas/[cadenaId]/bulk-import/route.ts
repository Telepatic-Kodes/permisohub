// ============================================================================
// Bulk import de locales desde CSV — vertical enterprise (cadenas comerciales)
// ----------------------------------------------------------------------------
// POST multipart/form-data con un archivo `file` (CSV).
//
//   ?preview=1  → solo valida y devuelve la previsualización + errores.
//   (sin query) → crea centros_comerciales (agrupados por `centro`) y locales.
//
// En modo dev se hace creación in-memory (mock): no toca Supabase.
// ============================================================================

export const dynamic = 'force-dynamic'

// ---------------------------------------------------------------------------
// Contratos
// ---------------------------------------------------------------------------

export interface ImportRow {
  nombre_negocio: string
  numero_local: string
  centro: string
  municipio: string
  area_m2?: number
  tenant_email?: string
}

export interface ValidationError {
  row: number
  field: string
  message: string
}

// Columnas esperadas, en orden, en el CSV.
const EXPECTED_HEADERS = [
  'nombre_negocio',
  'numero_local',
  'centro',
  'municipio',
  'area_m2',
  'tenant_email',
] as const

const REQUIRED_FIELDS: (keyof ImportRow)[] = [
  'nombre_negocio',
  'numero_local',
  'centro',
  'municipio',
]

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/**
 * Divide una línea CSV respetando comillas dobles. Soporta comas dentro de
 * campos entrecomillados y comillas escapadas como `""`.
 */
function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        current += char
      }
    } else if (char === '"') {
      inQuotes = true
    } else if (char === ',') {
      out.push(current)
      current = ''
    } else {
      current += char
    }
  }
  out.push(current)
  return out.map((c) => c.trim())
}

interface ParseResult {
  rows: ImportRow[]
  errors: ValidationError[]
}

/**
 * Parsea el contenido del CSV a filas tipadas y acumula errores de validación.
 * El número de fila reportado (`row`) es 1-based respecto a las filas de datos
 * (la cabecera no cuenta).
 */
function parseCsv(text: string): ParseResult {
  const errors: ValidationError[] = []
  const rows: ImportRow[] = []

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0)

  if (lines.length === 0) {
    errors.push({ row: 0, field: 'file', message: 'El archivo está vacío.' })
    return { rows, errors }
  }

  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase())

  // Validación mínima de cabecera: deben estar las columnas requeridas.
  for (const required of REQUIRED_FIELDS) {
    if (!header.includes(required)) {
      errors.push({
        row: 0,
        field: required,
        message: `Falta la columna requerida "${required}" en la cabecera.`,
      })
    }
  }
  if (errors.length > 0) {
    return { rows, errors }
  }

  const indexOf = (field: (typeof EXPECTED_HEADERS)[number]) =>
    header.indexOf(field)

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i])
    const dataRowNumber = i // 1-based respecto a filas de datos

    const get = (field: (typeof EXPECTED_HEADERS)[number]): string => {
      const idx = indexOf(field)
      if (idx === -1 || idx >= cells.length) return ''
      return cells[idx] ?? ''
    }

    const nombre_negocio = get('nombre_negocio')
    const numero_local = get('numero_local')
    const centro = get('centro')
    const municipio = get('municipio')
    const areaRaw = get('area_m2')
    const tenant_email = get('tenant_email')

    const row: ImportRow = {
      nombre_negocio,
      numero_local,
      centro,
      municipio,
    }

    // Requeridos no vacíos.
    for (const field of REQUIRED_FIELDS) {
      if (!row[field] || String(row[field]).trim() === '') {
        errors.push({
          row: dataRowNumber,
          field,
          message: `El campo "${field}" es obligatorio.`,
        })
      }
    }

    // area_m2 numérico si viene informado.
    if (areaRaw && areaRaw.trim() !== '') {
      const area = Number(areaRaw.replace(',', '.'))
      if (Number.isNaN(area) || area <= 0) {
        errors.push({
          row: dataRowNumber,
          field: 'area_m2',
          message: `"${areaRaw}" no es un área válida (m²).`,
        })
      } else {
        row.area_m2 = area
      }
    }

    if (tenant_email && tenant_email.trim() !== '') {
      row.tenant_email = tenant_email
    }

    rows.push(row)
  }

  return { rows, errors }
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cadenaId: string }> },
) {
  const { cadenaId } = await params

  if (!cadenaId) {
    return Response.json(
      { ok: false, error: 'cadenaId requerido' },
      { status: 400 },
    )
  }

  const { searchParams } = new URL(request.url)
  const isPreview = searchParams.get('preview') === '1'

  let file: File | null = null
  try {
    const formData = await request.formData()
    const entry = formData.get('file')
    if (entry instanceof File) {
      file = entry
    }
  } catch {
    return Response.json(
      { ok: false, error: 'Se esperaba multipart/form-data con un archivo "file".' },
      { status: 400 },
    )
  }

  if (!file) {
    return Response.json(
      { ok: false, error: 'No se recibió ningún archivo "file".' },
      { status: 400 },
    )
  }

  const text = await file.text()
  const { rows, errors } = parseCsv(text)

  // --- Modo previsualización -------------------------------------------------
  if (isPreview) {
    return Response.json({ ok: true, preview: rows, errors })
  }

  // --- Modo creación ---------------------------------------------------------
  // No se permite crear si hay errores de validación.
  if (errors.length > 0) {
    return Response.json(
      {
        ok: false,
        error: 'El archivo contiene errores de validación. Corrígelos antes de importar.',
        errors,
      },
      { status: 422 },
    )
  }

  // Agrupar por nombre de centro → cantidad de centros únicos.
  const centrosUnicos = new Set<string>()
  for (const row of rows) {
    centrosUnicos.add(row.centro)
  }

  // Mock in-memory: en dev simplemente devolvemos los conteos. En producción
  // aquí se insertarían los `centros_comerciales` y `locales` en Supabase,
  // asociados a `cadenaId`.
  return Response.json({
    ok: true,
    created: {
      centros: centrosUnicos.size,
      locales: rows.length,
    },
  })
}
