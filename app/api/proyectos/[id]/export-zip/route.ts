import { createClient } from '@/lib/supabase/server'
import JSZip from 'jszip'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

// SSRF guard: only allow fetching from the project's own Supabase Storage bucket.
// This prevents a malicious document URL (e.g. injected via a compromised Supabase row)
// from being used to make the server fetch arbitrary internal or external hosts.
const SUPABASE_STORAGE_HOST = new URL(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
).hostname

function isAllowedStorageUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.hostname === SUPABASE_STORAGE_HOST
  } catch {
    return false
  }
}

// DOM file naming convention: DOC_NNN_nombre-descriptivo.ext
function sanitize(str: string) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 40)
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    // Fetch proyecto + documentos
    const [proyectoRes, docsRes] = await Promise.all([
      supabase.from('proyectos').select('nombre, municipio, tipo').eq('id', id).single(),
      supabase.from('documentos').select('nombre, tipo, url').eq('proyecto_id', id),
    ])

    if (proyectoRes.error) throw proyectoRes.error

    const zip = new JSZip()
    const folder = zip.folder(`expediente-${sanitize(proyectoRes.data.nombre ?? id)}`)!

    const documentos = docsRes.data ?? []

    if (documentos.length === 0) {
      // No docs — return mock readme
      folder.file('LEEME.txt', [
        'EXPEDIENTE DOM',
        `Proyecto: ${proyectoRes.data.nombre}`,
        `Municipio: ${proyectoRes.data.municipio}`,
        '',
        'No hay documentos subidos aún.',
        'Sube documentos desde la ficha del proyecto en PermisoHub.',
      ].join('\n'))
    } else {
      // Download each file from Supabase Storage and add to zip
      await Promise.allSettled(
        documentos.map(async (doc, idx) => {
          const ext = doc.url.split('.').pop() ?? 'pdf'
          const filename = `DOC_${String(idx + 1).padStart(3, '0')}_${sanitize(doc.tipo)}.${ext}`
          try {
            // SSRF guard: reject URLs that don't point to our Supabase Storage bucket
            if (!isAllowedStorageUrl(doc.url)) {
              folder.file(filename.replace(`.${ext}`, '.error.txt'), `URL no permitida: ${doc.nombre}`)
              return
            }
            const res = await fetch(doc.url)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const buffer = await res.arrayBuffer()
            folder.file(filename, buffer)
          } catch {
            // If download fails, add a placeholder txt
            folder.file(filename.replace(`.${ext}`, '.error.txt'), `No se pudo descargar: ${doc.nombre}\nURL: ${doc.url}`)
          }
        })
      )

      // Add an index file
      folder.file('INDICE.txt', [
        'EXPEDIENTE DOM — ÍNDICE DE DOCUMENTOS',
        `Proyecto: ${proyectoRes.data.nombre}`,
        `Municipio: ${proyectoRes.data.municipio}`,
        `Tipo: ${proyectoRes.data.tipo}`,
        '',
        ...documentos.map((d, i) => `${i + 1}. ${d.nombre} (${d.tipo})`),
        '',
        `Generado por PermisoHub — ${new Date().toLocaleDateString('es-CL')}`,
      ].join('\n'))
    }

    const zipBuffer = new Uint8Array(await zip.generateAsync({ type: 'arraybuffer', compression: 'DEFLATE' }))
    const filename = `expediente-${sanitize(proyectoRes.data.nombre ?? id)}.zip`

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(zipBuffer.length),
      },
    })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      // Return a mock zip with placeholder content
      const zip = new JSZip()
      zip.file('expediente-demo/LEEME.txt', 'Expediente de demostración generado por PermisoHub.\nConectar Supabase para exportar documentos reales.')
      const zipBuffer = new Uint8Array(await zip.generateAsync({ type: 'arraybuffer' }))
      return new Response(zipBuffer, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': 'attachment; filename="expediente-demo.zip"',
        },
      })
    }
    return Response.json({ error: 'Error al generar ZIP' }, { status: 500 })
  }
}
