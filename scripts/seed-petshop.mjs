// ---------------------------------------------------------------------------
// Seed de prueba — Expediente PetShop
//
// Crea un proyecto "PetShop" y sube los 14 PDFs a Supabase Storage + tabla
// `documentos`, para poder probar el flujo de Due Diligence de punta a punta.
//
// Usa el SERVICE ROLE (bypassa RLS), así que corre FUERA del navegador.
//
// Uso:
//   node scripts/seed-petshop.mjs --email tu@correo.cl
//   node scripts/seed-petshop.mjs --user-id <uuid> --dir "/ruta/a/Petshop"
//
// Requiere en .env.local (además de NEXT_PUBLIC_SUPABASE_URL):
//   SUPABASE_SERVICE_ROLE_KEY=...   (Supabase → Project Settings → API → service_role)
// ---------------------------------------------------------------------------

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, basename, extname } from 'node:path'
import { createClient } from '@supabase/supabase-js'

// ── args ────────────────────────────────────────────────────────────────────
const args = process.argv.slice(2)
function arg(flag, fallback = null) {
  const i = args.indexOf(flag)
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback
}
const DIR = arg('--dir', '/Users/tomas/Estefanía/Petshop')
const EMAIL = arg('--email')
const USER_ID = arg('--user-id')
const PROYECTO_NOMBRE = arg('--name', 'Habilitación local comercial — PetShop')

// ── env (.env.local) ─────────────────────────────────────────────────────────
function loadEnvLocal() {
  const path = join(process.cwd(), '.env.local')
  const env = { ...process.env }
  if (existsSync(path)) {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const eq = t.indexOf('=')
      if (eq === -1) continue
      const k = t.slice(0, eq).trim()
      let v = t.slice(eq + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      if (env[k] === undefined) env[k] = v
    }
  }
  return env
}
const env = loadEnvLocal()
const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY

function die(msg) {
  console.error(`\n✗ ${msg}\n`)
  process.exit(1)
}

if (!SUPABASE_URL) die('Falta NEXT_PUBLIC_SUPABASE_URL en .env.local')
if (!SERVICE_KEY) {
  die(
    'Falta SUPABASE_SERVICE_ROLE_KEY en .env.local.\n' +
      '  Agrégala manualmente (yo no puedo escribir archivos .env):\n' +
      '  1. Supabase → tu proyecto → Project Settings → API\n' +
      '  2. Copia la clave "service_role" (secreta)\n' +
      '  3. Añade una línea a .env.local:  SUPABASE_SERVICE_ROLE_KEY=eyJ...\n' +
      '  4. Vuelve a correr este script.',
  )
}
if (!existsSync(DIR)) die(`No existe la carpeta de documentos: ${DIR}`)

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

// ── helpers ──────────────────────────────────────────────────────────────────
function inferTipo(nombre) {
  const n = nombre.toLowerCase()
  if (n.includes('carta')) return 'Carta'
  if (n.includes('memoria')) return 'Memoria'
  if (n.includes('declaraci') && n.includes('instala')) return 'Declaración instalaciones'
  if (n.includes('declaraci')) return 'Declaración arquitecto'
  if (n.includes('eett') || n.includes('especificac')) return 'Especificaciones técnicas'
  if (n.includes('dotaci') || n.includes('sanitari')) return 'Dotación sanitaria'
  if (n.startsWith('06') || n.startsWith('08') || n.includes('pe n')) return 'Permiso de edificación'
  if (n.startsWith('07') || n.startsWith('09') || n.includes('rf n')) return 'Recepción final'
  if (n.includes('lamina') || n.includes('plano') || n.includes('kennedy')) return 'Plano'
  if (n.includes('obs')) return 'Observaciones DOM'
  if (n.includes('listado')) return 'Listado'
  return 'Otro'
}

async function resolveUserId() {
  if (USER_ID) return USER_ID
  const { data, error } = await db.auth.admin.listUsers({ page: 1, perPage: 200 })
  if (error) die(`No se pudieron listar usuarios: ${error.message}`)
  const users = data?.users ?? []
  if (users.length === 0) die('No hay usuarios en el proyecto. Regístrate primero en la app.')
  if (EMAIL) {
    const match = users.find((u) => (u.email ?? '').toLowerCase() === EMAIL.toLowerCase())
    if (!match) die(`No encontré un usuario con email ${EMAIL}. Usuarios: ${users.map((u) => u.email).join(', ')}`)
    return match.id
  }
  console.warn(`⚠ Sin --email/--user-id: usando el primer usuario (${users[0].email}). Pasa --email para elegir.`)
  return users[0].id
}

async function ensureBucket() {
  const { data } = await db.storage.getBucket('documentos')
  if (data) return
  const { error } = await db.storage.createBucket('documentos', { public: true })
  if (error && !/already exists/i.test(error.message)) {
    die(`No se pudo crear el bucket 'documentos': ${error.message}`)
  }
  console.log("• Bucket 'documentos' creado (público).")
}

// ── run ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`\n▶ Seed PetShop\n  carpeta: ${DIR}\n  supabase: ${SUPABASE_URL}\n`)

  const userId = await resolveUserId()
  console.log(`• Owner user_id: ${userId}`)

  await ensureBucket()

  const { data: proyecto, error: pErr } = await db
    .from('proyectos')
    .insert({
      user_id: userId,
      nombre: PROYECTO_NOMBRE,
      direccion: 'Av. Presidente Kennedy N°8324, Vitacura',
      municipio: 'Vitacura',
      estado: 'borrador',
      numero_expediente: 'Exp. 2352 (Art. 5.1.2) · ED01',
      notas:
        'Rol SII 1841-21. Caso de prueba Due Diligence. Expediente ED01 rechazado por la DOM de Vitacura (Res. 63/2026).',
    })
    .select('id')
    .single()

  if (pErr || !proyecto) die(`No se pudo crear el proyecto: ${pErr?.message ?? 'sin datos'}`)
  const proyectoId = proyecto.id
  console.log(`• Proyecto creado: ${proyectoId}`)

  const files = readdirSync(DIR)
    .filter((f) => extname(f).toLowerCase() === '.pdf')
    .sort()

  if (files.length === 0) die(`No hay PDFs en ${DIR}`)
  console.log(`• ${files.length} PDFs a subir\n`)

  let ok = 0
  for (const file of files) {
    const buf = readFileSync(join(DIR, file))
    const safe = basename(file).replace(/\s+/g, '-')
    const path = `${proyectoId}/${Date.now()}-${safe}`

    const { error: upErr } = await db.storage
      .from('documentos')
      .upload(path, buf, { contentType: 'application/pdf', upsert: false })
    if (upErr) {
      console.error(`  ✗ ${file}: ${upErr.message}`)
      continue
    }

    const { data: pub } = db.storage.from('documentos').getPublicUrl(path)
    const { error: dbErr } = await db.from('documentos').insert({
      proyecto_id: proyectoId,
      nombre: file,
      tipo: inferTipo(file),
      url: pub.publicUrl,
      tamano: buf.length,
    })
    if (dbErr) {
      console.error(`  ✗ ${file} (fila documentos): ${dbErr.message}`)
      continue
    }
    ok++
    console.log(`  ✓ ${file}  [${inferTipo(file)}]`)
  }

  console.log(`\n✓ Listo: ${ok}/${files.length} documentos subidos.`)
  console.log(`\n  Abre el proyecto y presiona "Generar Due Diligence":`)
  console.log(`  http://localhost:3000/proyectos/${proyectoId}\n`)
}

main().catch((e) => die(e instanceof Error ? e.message : String(e)))
