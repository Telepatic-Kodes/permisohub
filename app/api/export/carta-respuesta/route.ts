import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'

interface ObservacionItem {
  numero: number
  texto: string
  articuloCitado: string | null
  tipo: 'TECNICA' | 'FORMAL' | 'DOCUMENTOS'
  gravedad: 'ALTA' | 'MEDIA' | 'BAJA'
  respuestaGenerada?: string
}

interface CartaRequest {
  proyectoNombre: string
  municipio: string
  expediente: string | null
  fechaOrdinario: string | null
  plazoRespuesta: number | null
  observaciones: ObservacionItem[]
  arquitecta?: string
}

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function formatFechaLarga(date: Date): string {
  const dia = date.getDate()
  const mes = MESES[date.getMonth()]
  const anio = date.getFullYear()
  return `Santiago, ${dia} de ${mes} de ${anio}`
}

export async function POST(req: NextRequest) {
  const body = await req.json() as CartaRequest
  const {
    proyectoNombre,
    municipio,
    expediente,
    observaciones,
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
      .text('estefania@epgestion.cl', marginLeft)

    // Línea separadora
    const lineY = doc.y + 8
    doc.moveTo(marginLeft, lineY).lineTo(pageWidth - marginRight, lineY).strokeColor('#D1D5DB').lineWidth(1).stroke()

    // ── DESTINATARIO ──
    doc
      .fillColor('#111827')
      .fontSize(10)
      .font('Helvetica')
      .text('Director/a de Obras Municipales', marginLeft, lineY + 20)
      .text(`Municipalidad de ${municipio}`, marginLeft)

    // ── FECHA ──
    doc.moveDown(1)
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#111827')
      .text(formatFechaLarga(new Date()), marginLeft, doc.y, { align: 'right', width: contentWidth })

    // ── ASUNTO ──
    doc.moveDown(1)
    doc
      .fontSize(10)
      .font('Helvetica-Bold')
      .fillColor('#111827')
      .text(
        `ASUNTO: RESPUESTA A ORDINARIO DE OBSERVACIONES — Expediente N° ${expediente ?? 'Pendiente'}`,
        marginLeft,
        doc.y,
        { width: contentWidth }
      )

    // ── CUERPO APERTURA ──
    doc.moveDown(1)
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#111827')
      .text(
        `Por medio de la presente, vengo a dar respuesta a las observaciones formuladas por esa Dirección de Obras Municipales en relación al Proyecto ${proyectoNombre}, en los siguientes términos:`,
        marginLeft,
        doc.y,
        { width: contentWidth, align: 'justify' }
      )

    // ── OBSERVACIONES ──
    const obsConRespuesta = observaciones.filter(o => o.respuestaGenerada)

    for (const obs of obsConRespuesta) {
      doc.moveDown(1.2)

      // Título observación
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#1A3328')
        .text(`OBSERVACIÓN N° ${obs.numero}:`, marginLeft, doc.y, { width: contentWidth })

      // Texto original en itálica
      doc.moveDown(0.4)
      doc
        .fontSize(10)
        .font('Helvetica-Oblique')
        .fillColor('#374151')
        .text(obs.texto, marginLeft, doc.y, { width: contentWidth, align: 'justify' })

      // Etiqueta RESPUESTA
      doc.moveDown(0.6)
      doc
        .fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#1A3328')
        .text('RESPUESTA:', marginLeft, doc.y, { width: contentWidth })

      // Texto de respuesta
      doc.moveDown(0.4)
      doc
        .fontSize(10)
        .font('Helvetica')
        .fillColor('#111827')
        .text(obs.respuestaGenerada!, marginLeft, doc.y, { width: contentWidth, align: 'justify' })
    }

    // ── CIERRE ──
    doc.moveDown(2)
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#111827')
      .text(
        'Sin otro particular, saluda atentamente a Ud.',
        marginLeft,
        doc.y,
        { width: contentWidth }
      )

    doc.moveDown(4)
    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#111827')
      .text('_______________________________', marginLeft, doc.y)
      .text(arquitecta, marginLeft)
      .text('Arquitecta', marginLeft)
      .text('AR-XXXX', marginLeft)

    // ── FOOTER con número de página ──
    const pageHeight = doc.page.height
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#9CA3AF')
      .text(
        `Página 1  ·  EP Gestión Arquitectónica  ·  ${new Date().toLocaleDateString('es-CL')}`,
        marginLeft,
        pageHeight - 45,
        { align: 'center', width: contentWidth }
      )

    doc.end()
  })

  const pdfBuffer = Buffer.concat(chunks)
  const filename = `carta-respuesta-${expediente ?? 'dom'}.pdf`

  return new Response(pdfBuffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdfBuffer.length),
    },
  })
}
