import PDFDocument from 'pdfkit'
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { MOCK_PROYECTOS, MOCK_CLIENTES, MOCK_DOCUMENTOS, MOCK_ETAPAS } from '@/lib/mock-data'
import { TIPO_PERMISO_LABELS, ESTADO_CONFIG } from '@/types'
import type { DueDiligenceResult } from '@/lib/due-diligence'

export const dynamic = 'force-dynamic'

// Paleta
const BRAND = '#1A3328'
const INK = '#111827'
const MUTED = '#6B7280'
const HAIR = '#E5E7EB'
const CARD = '#F7F7F5'
const M = 50 // margen
const CW = 495 // ancho de contenido (A4 - 2*M)

function riesgoColor(r: string): string {
  if (r === 'ALTO') return '#EF4444'
  if (r === 'MEDIO') return '#F59E0B'
  return '#16A34A'
}
function sevColor(s: string): string {
  if (s === 'critico') return '#EF4444'
  if (s === 'alto') return '#F59E0B'
  return '#3B82F6'
}

interface Row {
  id: string
  nombre: string
  direccion: string | null
  municipio: string | null
  tipo: string
  estado: keyof typeof ESTADO_CONFIG
  numero_expediente: string | null
  fecha_inicio: string | null
  fecha_estimada: string | null
  rol_sii: string | null
  cliente: { nombre: string } | null
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const rateLimit = await checkRateLimit(`general:${user.id}`)
  if (rateLimit) return rateLimit

  // ── Datos REALES (fallback a mock solo si no existe) ──
  const { data: proyectoReal } = await supabase
    .from('proyectos')
    .select('*, cliente:clientes(nombre)')
    .eq('id', id)
    .maybeSingle()

  let proyecto: Row
  let documentos: { nombre: string; tipo: string }[]
  let etapas: { nombre: string; estado: string; notas?: string | null }[]

  if (proyectoReal) {
    proyecto = proyectoReal as unknown as Row
    const [{ data: docs }, { data: ets }] = await Promise.all([
      supabase.from('documentos').select('nombre, tipo').eq('proyecto_id', id),
      supabase.from('etapas').select('nombre, estado, notas').eq('proyecto_id', id),
    ])
    documentos = docs ?? []
    etapas = ets ?? []
  } else {
    const p = MOCK_PROYECTOS.find((x) => x.id === id) ?? MOCK_PROYECTOS[0]
    proyecto = {
      ...p,
      cliente: { nombre: MOCK_CLIENTES.find((c) => c.id === p.cliente_id)?.nombre ?? '—' },
    } as unknown as Row
    documentos = MOCK_DOCUMENTOS.filter((d) => d.proyecto_id === p.id)
    etapas = MOCK_ETAPAS.filter((e) => e.proyecto_id === p.id)
  }

  // Informe de due diligence (si existe)
  const { data: ddRow } = await supabase
    .from('due_diligence_reports')
    .select('result')
    .eq('proyecto_id', id)
    .eq('status', 'done')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const dd = (ddRow?.result ?? null) as DueDiligenceResult | null

  const estadoCfg = ESTADO_CONFIG[proyecto.estado]
  const tipoLabel = TIPO_PERMISO_LABELS[proyecto.tipo as keyof typeof TIPO_PERMISO_LABELS] ?? proyecto.tipo

  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: M, size: 'A4' })
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', resolve)
    doc.on('error', reject)

    // Footer en cada página (sin clobbing del flujo de contenido).
    let pageNo = 0
    let inFooter = false
    const drawFooter = () => {
      if (inFooter) return // guard anti-recursión
      inFooter = true
      pageNo++
      const savedY = doc.y
      const savedBottom = doc.page.margins.bottom
      doc.page.margins.bottom = 0 // evita que escribir en la zona de pie agregue página
      doc
        .fillColor('#9CA3AF')
        .font('Helvetica')
        .fontSize(7.5)
        .text(
          `PermisoHub · ${proyecto.nombre} · pág. ${pageNo} · No constituye pronunciamiento de la DOM.`,
          M,
          doc.page.height - 38,
          { width: CW, align: 'center', lineBreak: false },
        )
      doc.page.margins.bottom = savedBottom
      doc.y = savedY
      inFooter = false
    }
    doc.on('pageAdded', () => drawFooter())
    drawFooter() // página 1

    // Helpers ---------------------------------------------------------------
    const ensure = (need: number) => {
      if (doc.y + need > doc.page.height - 60) doc.addPage()
    }
    const sectionTitle = (t: string) => {
      ensure(30)
      const y = doc.y
      doc.save().rect(M, y + 1, 3, 12).fill(BRAND).restore()
      doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(12).text(t, M + 10, y)
      doc.moveDown(0.6)
    }
    const pill = (x: number, y: number, text: string, bg: string, fg = '#FFFFFF') => {
      doc.font('Helvetica-Bold').fontSize(8)
      const w = doc.widthOfString(text) + 16
      doc.save().roundedRect(x, y, w, 15, 7).fill(bg).restore()
      doc.fillColor(fg).text(text, x + 8, y + 4)
      return w
    }

    // ── HEADER ──
    doc.fillColor(BRAND).fontSize(19).font('Helvetica-Bold').text('PermisoHub', M, 46)
    doc.fillColor(MUTED).fontSize(9).font('Helvetica').text('EP Gestión Arquitectónica', M, 70)
    doc
      .fillColor(MUTED)
      .fontSize(8)
      .text(`Informe de expediente · ${new Date().toLocaleDateString('es-CL')}`, M, 58, {
        width: CW,
        align: 'right',
      })
    doc.moveTo(M, 90).lineTo(M + CW, 90).strokeColor(HAIR).lineWidth(1).stroke()

    // ── ESTADO (kicker) + TÍTULO ──
    pill(M, 104, (estadoCfg?.label ?? proyecto.estado).toUpperCase(), BRAND)
    doc.fillColor(INK).fontSize(17).font('Helvetica-Bold').text(proyecto.nombre, M, 126, { width: CW })
    doc.fillColor(MUTED).fontSize(10).font('Helvetica').text(tipoLabel, M, doc.y + 2)
    doc.moveDown(1)

    // ── TARJETA DE INFORMACIÓN ──
    const infoRows: [string, string][] = [
      ['Cliente', proyecto.cliente?.nombre ?? '—'],
      ['Municipio', proyecto.municipio ?? '—'],
      ['Dirección', proyecto.direccion ?? '—'],
      ['N° Expediente', proyecto.numero_expediente ?? 'Sin asignar'],
      ['Rol SII', proyecto.rol_sii ?? '—'],
      ['Fecha de ingreso', proyecto.fecha_inicio ?? '—'],
    ]
    const cardY = doc.y
    const rowH = 18
    const cardH = 14 + Math.ceil(infoRows.length / 2) * rowH
    doc.save().roundedRect(M, cardY, CW, cardH, 6).fill(CARD).restore()
    infoRows.forEach(([label, value], i) => {
      const col = i % 2
      const x = M + 14 + col * (CW / 2)
      const y = cardY + 12 + Math.floor(i / 2) * rowH
      doc.fillColor(MUTED).font('Helvetica').fontSize(7.5).text(label.toUpperCase(), x, y)
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5).text(value, x, y + 8, {
        width: CW / 2 - 28,
        ellipsis: true,
        lineBreak: false,
      })
    })
    doc.y = cardY + cardH + 18

    // ── DUE DILIGENCE (si existe) ──
    if (dd) {
      sectionTitle('Due Diligence documental')
      // Fila de badges
      const by = doc.y
      let bx = M
      bx += pill(bx, by, `RIESGO ${dd.riesgoGlobal}`, riesgoColor(dd.riesgoGlobal)) + 8
      bx += pill(bx, by, `Completitud ${dd.completitud.presentes}/${dd.completitud.esperados}`, '#374151') + 8
      pill(bx, by, `${dd.conteos.criticos} crít · ${dd.conteos.altos} altos · ${dd.conteos.medios} medios`, '#6B7280')
      doc.y = by + 24

      if (dd.estadoDOM?.rechazado || dd.estadoDOM?.detalle) {
        ensure(40)
        const y = doc.y
        const detalle = dd.estadoDOM.detalle ?? ''
        doc.font('Helvetica').fontSize(8.5)
        const dh = 26 + doc.heightOfString(detalle, { width: CW - 24 })
        doc.save().roundedRect(M, y, CW, dh, 5).fillAndStroke('#FEF2F2', '#EF4444').restore()
        doc.fillColor('#B91C1C').font('Helvetica-Bold').fontSize(9).text(
          dd.estadoDOM.rechazado ? 'Estado DOM: RECHAZADO' : 'Estado DOM',
          M + 12,
          y + 8,
        )
        doc.fillColor('#4B5563').font('Helvetica').fontSize(8.5).text(detalle, M + 12, y + 20, { width: CW - 24 })
        doc.y = y + dh + 14
      }

      if (dd.resumenEjecutivo) {
        ensure(30)
        doc.fillColor('#374151').font('Helvetica').fontSize(9.5).text(dd.resumenEjecutivo, M, doc.y, { width: CW })
        doc.moveDown(0.8)
      }

      if (dd.hallazgos.length > 0) {
        doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(10).text(`Hallazgos (${dd.hallazgos.length})`, M, doc.y)
        doc.moveDown(0.4)
        dd.hallazgos.forEach((h) => {
          doc.font('Helvetica').fontSize(8.5)
          const descH = doc.heightOfString(h.descripcion, { width: CW - 16 })
          const blockH = 16 + descH
          ensure(blockH + 6)
          const y = doc.y
          doc.save().rect(M, y, 3, blockH).fill(sevColor(h.severidad)).restore()
          doc.fillColor(sevColor(h.severidad)).font('Helvetica-Bold').fontSize(9).text(`${h.codigo} · ${h.titulo}`, M + 10, y)
          doc.fillColor('#4B5563').font('Helvetica').fontSize(8.5).text(h.descripcion, M + 10, y + 12, { width: CW - 16 })
          doc.y = y + blockH + 6
        })
        doc.moveDown(0.4)
      }

      if (dd.proximosPasos.length > 0) {
        ensure(24)
        doc.fillColor(BRAND).font('Helvetica-Bold').fontSize(10).text('Próximos pasos', M, doc.y)
        doc.moveDown(0.4)
        dd.proximosPasos.forEach((p, i) => {
          doc.font('Helvetica').fontSize(8.5)
          const detH = doc.heightOfString(p.detalle, { width: CW - 22 })
          ensure(14 + detH + 4)
          const y = doc.y
          doc.fillColor(p.critico ? '#B91C1C' : BRAND).font('Helvetica-Bold').fontSize(9).text(`${i + 1}. ${p.titulo}`, M, y)
          doc.fillColor('#4B5563').font('Helvetica').fontSize(8.5).text(p.detalle, M + 14, y + 11, { width: CW - 22 })
          doc.y = y + 11 + detH + 6
        })
      }
      doc.moveDown(0.6)
    }

    // ── ETAPAS ──
    if (etapas.length > 0) {
      sectionTitle('Etapas de tramitación')
      etapas.forEach((e) => {
        ensure(20)
        const y = doc.y
        const color = e.estado === 'completada' ? '#16A34A' : e.estado === 'en_curso' ? '#F59E0B' : '#D1D5DB'
        doc.save().circle(M + 5, y + 5, 4).fill(color).restore()
        doc.fillColor(INK).font('Helvetica-Bold').fontSize(9.5).text(e.nombre, M + 16, y)
        if (e.notas) {
          doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(e.notas, M + 16, doc.y, { width: CW - 16 })
        }
        doc.moveDown(0.5)
      })
      doc.moveDown(0.4)
    }

    // ── DOCUMENTOS ──
    if (documentos.length > 0) {
      sectionTitle(`Documentos del expediente (${documentos.length})`)
      documentos.forEach((d, i) => {
        ensure(16)
        const y = doc.y
        if (i % 2 === 0) doc.save().rect(M, y - 2, CW, 15).fill('#FAFAF9').restore()
        doc.fillColor(INK).font('Helvetica').fontSize(9).text(d.nombre, M + 8, y, { width: CW - 150, ellipsis: true, lineBreak: false })
        doc.fillColor(MUTED).font('Helvetica').fontSize(8).text(d.tipo, M + CW - 140, y + 0.5, { width: 132, align: 'right' })
        doc.moveDown(0.55)
      })
    }

    doc.end()
  })

  const pdf = Buffer.concat(chunks)
  const safe = (proyecto.numero_expediente ?? proyecto.nombre).replace(/[^\w.-]+/g, '-').slice(0, 60)
  return new Response(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="informe-${safe}.pdf"`,
      'Content-Length': String(pdf.length),
    },
  })
}
