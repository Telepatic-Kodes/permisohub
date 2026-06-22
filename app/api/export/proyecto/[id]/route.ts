import PDFDocument from 'pdfkit'
import { NextRequest } from 'next/server'
import { MOCK_PROYECTOS, MOCK_CLIENTES, MOCK_DOCUMENTOS, MOCK_ETAPAS } from '@/lib/mock-data'
import { TIPO_PERMISO_LABELS, ESTADO_CONFIG } from '@/types'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const proyecto = MOCK_PROYECTOS.find((p) => p.id === id) ?? MOCK_PROYECTOS[0]
  const cliente = MOCK_CLIENTES.find((c) => c.id === proyecto.cliente_id)
  const estadoCfg = ESTADO_CONFIG[proyecto.estado]
  const etapas = MOCK_ETAPAS.filter((e) => e.proyecto_id === proyecto.id)
  const documentos = MOCK_DOCUMENTOS.filter((d) => d.proyecto_id === proyecto.id)

  // Stream PDF to response
  const chunks: Buffer[] = []

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })

    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', resolve)
    doc.on('error', reject)

    // ── HEADER ──
    doc.fillColor('#1A3328').fontSize(20).font('Helvetica-Bold')
       .text('PermisoHub', 50, 50)
    doc.fillColor('#6B7280').fontSize(10).font('Helvetica')
       .text('EP Gestión Arquitectónica', 50, 75)

    doc.moveTo(50, 95).lineTo(545, 95).strokeColor('#E5E7EB').stroke()

    // ── TÍTULO PROYECTO ──
    doc.fillColor('#111827').fontSize(16).font('Helvetica-Bold')
       .text(proyecto.nombre, 50, 110)

    doc.fillColor('#6B7280').fontSize(10).font('Helvetica')
       .text(
         `Estado: ${estadoCfg?.label ?? proyecto.estado}  ·  ${TIPO_PERMISO_LABELS[proyecto.tipo] ?? proyecto.tipo}`,
         50, 132
       )

    // ── DATOS PRINCIPALES ──
    doc.moveDown(2)
    const startY = doc.y

    const rows: [string, string][] = [
      ['Cliente', cliente?.nombre ?? '—'],
      ['Municipio', proyecto.municipio],
      ['Dirección', proyecto.direccion ?? '—'],
      ['N° Expediente', proyecto.numero_expediente ?? 'Sin asignar'],
      ['Fecha de ingreso', proyecto.fecha_inicio],
      ['Fecha estimada', proyecto.fecha_estimada ?? '—'],
    ]

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#1A3328')
       .text('Información del Expediente', 50, startY)
    doc.moveDown(0.5)

    rows.forEach(([label, value]) => {
      const y = doc.y
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#374151')
         .text(label + ':', 50, y, { width: 150 })
      doc.fontSize(9).font('Helvetica').fillColor('#111827')
         .text(value, 200, y, { width: 345 })
      doc.moveDown(0.4)
    })

    // ── ETAPAS ──
    if (etapas.length > 0) {
      doc.moveDown(1)
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1A3328')
         .text('Etapas de Tramitación')
      doc.moveDown(0.5)

      etapas.forEach((etapa) => {
        const y = doc.y
        const estadoLabel =
          etapa.estado === 'completada' ? '[OK]' :
          etapa.estado === 'en_curso'   ? '[->]' : '[ ]'
        doc.fontSize(9).font('Helvetica-Bold').fillColor('#374151')
           .text(`${estadoLabel}  ${etapa.nombre}`, 50, y)
        if (etapa.notas) {
          doc.moveDown(0.2)
          doc.fontSize(8).font('Helvetica').fillColor('#6B7280')
             .text(etapa.notas, 70, doc.y)
        }
        doc.moveDown(0.5)
      })
    }

    // ── DOCUMENTOS ──
    if (documentos.length > 0) {
      doc.moveDown(1)
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#1A3328')
         .text('Documentos Adjuntos')
      doc.moveDown(0.5)

      documentos.forEach((d) => {
        doc.fontSize(9).font('Helvetica').fillColor('#374151')
           .text(`- ${d.nombre}  (${d.tipo})`, 50, doc.y)
        doc.moveDown(0.3)
      })
    }

    // ── FOOTER ──
    const pageHeight = doc.page.height
    doc.fontSize(8).font('Helvetica').fillColor('#9CA3AF')
       .text(
         `Generado por PermisoHub · ${new Date().toLocaleDateString('es-CL')}`,
         50, pageHeight - 50,
         { align: 'center', width: 495 }
       )

    doc.end()
  })

  const pdf = Buffer.concat(chunks)
  const filename = `expediente-${proyecto.numero_expediente ?? proyecto.id}.pdf`

  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': String(pdf.length),
    },
  })
}
