export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { after } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { isAIAvailable } from '@/lib/ai'
import { aiAuthGuard } from '@/lib/ai-guard'
import { recordUsage } from '@/lib/usage'
import { checkRateLimit } from '@/lib/rate-limit'
import {
  extractDocumentContent,
  synthesizeDueDiligence,
  mapWithConcurrency,
} from '@/lib/due-diligence'
import type { DocExtract, ProyectoContexto } from '@/lib/due-diligence'

// ---------------------------------------------------------------------------
// Due Diligence documental — inicio del proceso asíncrono.
//
// El POST valida (auth, rate limit, IA disponible, proyecto con documentos),
// crea la fila `due_diligence_reports` en estado 'pending' y responde de
// inmediato con { reportId }. El trabajo pesado (descarga de PDFs, extracción
// por documento y síntesis cruzada) corre tras la respuesta vía `after()`.
// El cliente hace polling contra GET /api/ai/due-diligence/[reportId].
// ---------------------------------------------------------------------------

const MAX_DOCS = 25
const CONCURRENCY = 4

interface DueDiligenceRequest {
  proyectoId: string
}

/** Campos del proyecto que realmente usamos (cast estrecho sobre la fila). */
interface ProyectoRow {
  id: string
  nombre: string
  direccion: string | null
  municipio: string | null
  rol_sii: string | null
  tipo: string | null
}

/** Campos del documento que usamos para descargar y analizar. */
interface DocumentoRow {
  id: string
  nombre: string
  tipo: string | null
  url: string
  created_at: string
}

// El trabajo en segundo plano usa el cliente service-role, así que aceptamos
// cualquier SupabaseClient (sesión o service) en los helpers.
type SupabaseServerClient = SupabaseClient

const STORAGE_MARKER = '/object/public/documentos/'

/** Deriva el PATH dentro del bucket `documentos` a partir de la URL pública. */
function storagePathFromUrl(url: string): string | null {
  const idx = url.indexOf(STORAGE_MARKER)
  if (idx === -1) return null
  return decodeURIComponent(url.slice(idx + STORAGE_MARKER.length))
}

function isPdf(nombre: string): boolean {
  return nombre.toLowerCase().endsWith('.pdf')
}

/** Descarga el documento desde Storage (o vía fetch de respaldo) y lo devuelve en base64. */
async function downloadDocumentBase64(
  supabase: SupabaseServerClient,
  doc: DocumentoRow,
): Promise<string> {
  const path = storagePathFromUrl(doc.url)

  if (path) {
    const { data, error } = await supabase.storage.from('documentos').download(path)
    if (!error && data) {
      return Buffer.from(await data.arrayBuffer()).toString('base64')
    }
  }

  // Respaldo: la URL es pública, así que un fetch directo suele funcionar.
  const res = await fetch(doc.url)
  if (!res.ok) {
    throw new Error(`No se pudo descargar el documento (HTTP ${res.status}).`)
  }
  const blob = await res.blob()
  return Buffer.from(await blob.arrayBuffer()).toString('base64')
}

/** Trabajo pesado: extrae cada documento, sintetiza y persiste el resultado. */
async function procesar(
  supabase: SupabaseServerClient,
  reportId: string,
  userId: string,
  proyecto: ProyectoRow,
  documentos: DocumentoRow[],
): Promise<void> {
  const total = documentos.length

  try {
    await supabase
      .from('due_diligence_reports')
      .update({ status: 'processing' })
      .eq('id', reportId)

    const worker = async (doc: DocumentoRow): Promise<DocExtract> => {
      if (!isPdf(doc.nombre)) {
        // No es PDF (dwg, etc.): no llamamos IA, devolvemos un extract mínimo.
        return {
          nombreArchivo: doc.nombre,
          tipoReal: doc.tipo || 'Archivo',
          esActoDOM: false,
          esRechazo: false,
          datosClave: [],
          fechas: [],
          vigencia: null,
          observacionesDOM: [],
          incoherenciasInternas: [],
          resumen: '',
          error: 'Formato no analizable por IA (no es PDF).',
        }
      }

      try {
        const pdfBase64 = await downloadDocumentBase64(supabase, doc)
        return await extractDocumentContent(pdfBase64, doc.nombre)
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido'
        return {
          nombreArchivo: doc.nombre,
          tipoReal: doc.tipo || 'Archivo',
          esActoDOM: false,
          esRechazo: false,
          datosClave: [],
          fechas: [],
          vigencia: null,
          observacionesDOM: [],
          incoherenciasInternas: [],
          resumen: '',
          error: `No se pudo descargar el documento: ${msg}`,
        }
      }
    }

    const extracts = await mapWithConcurrency(documentos, CONCURRENCY, worker, (i) => {
      void supabase
        .from('due_diligence_reports')
        .update({
          progress: { current: i + 1, total, label: `Leyendo ${i + 1}/${total}…` },
        })
        .eq('id', reportId)
    })

    await supabase
      .from('due_diligence_reports')
      .update({
        progress: { current: total, total, label: 'Cruzando información…' },
      })
      .eq('id', reportId)

    const proyectoContexto: ProyectoContexto = {
      nombre: proyecto.nombre,
      direccion: proyecto.direccion,
      municipio: proyecto.municipio,
      rol_sii: proyecto.rol_sii,
      tipo: proyecto.tipo,
    }

    const generadoEl = new Date().toISOString()
    const result = await synthesizeDueDiligence(extracts, proyectoContexto, generadoEl)

    await supabase
      .from('due_diligence_reports')
      .update({
        status: 'done',
        result,
        progress: { current: total, total, label: 'Listo' },
      })
      .eq('id', reportId)

    recordUsage(userId, 'ai_chats').catch(console.error)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error desconocido'
    await supabase
      .from('due_diligence_reports')
      .update({ status: 'error', error: message })
      .eq('id', reportId)
  }
}

export async function POST(request: Request) {
  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rl = await checkRateLimit(`ai:${auth.userId}`)
  if (rl) return rl

  if (!isAIAvailable()) {
    return Response.json({ error: 'OPENAI_API_KEY no configurado' }, { status: 503 })
  }

  const body = (await request.json().catch(() => null)) as DueDiligenceRequest | null
  if (!body?.proyectoId) {
    return Response.json({ error: 'proyectoId requerido' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: proyectoData, error: proyectoError } = await supabase
    .from('proyectos')
    .select('*')
    .eq('id', body.proyectoId)
    .single()

  if (proyectoError || !proyectoData) {
    return Response.json({ error: 'Proyecto no encontrado' }, { status: 404 })
  }
  const proyecto = proyectoData as ProyectoRow

  const { data: documentosData } = await supabase
    .from('documentos')
    .select('*')
    .eq('proyecto_id', body.proyectoId)
    .order('created_at', { ascending: true })

  const documentos = ((documentosData ?? []) as DocumentoRow[]).slice(0, MAX_DOCS)

  if (documentos.length === 0) {
    return Response.json(
      { error: 'El proyecto no tiene documentos para analizar.' },
      { status: 422 },
    )
  }

  const { data: reportData, error: insertError } = await supabase
    .from('due_diligence_reports')
    .insert({
      proyecto_id: body.proyectoId,
      user_id: auth.userId,
      status: 'pending',
      progress: { current: 0, total: documentos.length, label: 'En cola…' },
    })
    .select('id')
    .single()

  if (insertError || !reportData) {
    return Response.json({ error: 'No se pudo crear el reporte.' }, { status: 500 })
  }

  const reportId = (reportData as { id: string }).id

  // Trabajo pesado tras enviar la respuesta. Usamos el cliente service-role
  // (sin sesión de cookies) para que las escrituras y descargas de Storage
  // funcionen de forma fiable DESPUÉS de enviada la respuesta. La autorización
  // y la pertenencia del proyecto ya se validaron arriba con el cliente de
  // sesión. Si faltaran credenciales de service role, caemos al cliente de la
  // request como respaldo.
  let bgClient: SupabaseServerClient
  try {
    bgClient = createServiceClient()
  } catch {
    bgClient = supabase
  }
  after(async () => {
    await procesar(bgClient, reportId, auth.userId, proyecto, documentos)
  })

  return Response.json({ reportId }, { status: 201 })
}
