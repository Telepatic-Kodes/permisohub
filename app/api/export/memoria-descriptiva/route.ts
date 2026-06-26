import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

interface MemoriaPDFRequest {
  memoria: string
  proyectoNombre: string
  arquitecta?: string
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const rateLimit = await checkRateLimit(`general:${user.id}`)
  if (rateLimit) return rateLimit

  const body = (await req.json()) as MemoriaPDFRequest
  const {
    memoria,
    proyectoNombre,
    arquitecta = 'Estefanía Parada',
  } = body

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const PDFDocument = require('pdfkit') as typeof import('pdfkit')

  const chunks: Buffer[] = []

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 70, size: 'letter' })

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', resolve)
    doc.on('error', reject)

    const pageWidth = doc.page.width
    const marginLeft = 70
    const marginRight = 70
    const contentWidth = pageWidth - marginLeft - marginRight

    // ── ENCABEZADO ──
    doc
      .fillColor('#1A3328')
      .fontSize(14)
      .font('Helvetica-Bold')
      .text('EP Gestión Arquitectónica', marginLeft, 70)

    doc
      .fillColor('#374151')
      .fontSize(9)
      .font('Helvetica')
      .text('Av. Vitacura 2909, Of. 805, Las Condes, Santiago', marginLeft, doc.y + 2)
      .text('estefania@epgestion.cl  ·  www.epgestion.cl', marginLeft)

    // Línea separadora
    const lineY = doc.y + 8
    doc
      .moveTo(marginLeft, lineY)
      .lineTo(pageWidth - marginRight, lineY)
      .strokeColor('#D1D5DB')
      .lineWidth(1)
      .stroke()

    // ── TÍTULO PRINCIPAL ──
    doc
      .fillColor('#1A3328')
      .fontSize(18)
      .font('Helvetica-Bold')
      .text('MEMORIA DESCRIPTIVA', marginLeft, lineY + 24, {
        align: 'center',
        width: contentWidth,
      })

    // ── SUBTÍTULO: nombre del proyecto ──
    doc
      .fillColor('#374151')
      .fontSize(12)
      .font('Helvetica')
      .text(proyectoNombre, marginLeft, doc.y + 6, {
        align: 'center',
        width: contentWidth,
      })

    // Segunda línea separadora
    const line2Y = doc.y + 12
    doc
      .moveTo(marginLeft, line2Y)
      .lineTo(pageWidth - marginRight, line2Y)
      .strokeColor('#D1D5DB')
      .lineWidth(0.5)
      .stroke()

    // ── CONTENIDO: parsear líneas ──
    const lines = memoria.split('\n')
    let currentY = line2Y + 18

    for (const line of lines) {
      const trimmed = line.trim()

      if (!trimmed) {
        currentY += 6
        continue
      }

      // Detect section titles: ALL CAPS lines with at least 4 chars
      const isSectionTitle =
        trimmed.length >= 4 &&
        trimmed === trimmed.toUpperCase() &&
        /[A-ZÁÉÍÓÚÑ]/.test(trimmed)

      if (isSectionTitle) {
        currentY += 10
        doc
          .fillColor('#1A3328')
          .fontSize(11)
          .font('Helvetica-Bold')
          .text(trimmed, marginLeft, currentY, { width: contentWidth })
        currentY = doc.y + 4
      } else {
        doc
          .fillColor('#111827')
          .fontSize(10)
          .font('Helvetica')
          .text(trimmed, marginLeft, currentY, { width: contentWidth, align: 'justify' })
        currentY = doc.y + 2
      }
    }

    // ── FIRMA ──
    doc.moveDown(3)
    doc
      .fillColor('#111827')
      .fontSize(10)
      .font('Helvetica')
      .text('_______________________________', marginLeft, doc.y)
      .text(`Arq. ${arquitecta}`, marginLeft)
      .text('estefania@epgestion.cl', marginLeft)

    // ── FOOTER ──
    const pageHeight = doc.page.height
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#9CA3AF')
      .text(
        `Arquitecta ${arquitecta}  ·  estefania@epgestion.cl  ·  Página 1`,
        marginLeft,
        pageHeight - 45,
        { align: 'center', width: contentWidth }
      )

    doc.end()
  })

  const pdfBuffer = Buffer.concat(chunks)
  const safeName = proyectoNombre.replace(/[^a-zA-Z0-9_\-]/g, '_').toLowerCase()
  const filename = `memoria-${safeName}.pdf`

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.length),
    },
  })
}
