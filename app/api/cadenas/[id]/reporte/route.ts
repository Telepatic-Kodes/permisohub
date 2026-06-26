import { createClient } from '@/lib/supabase/server'
import { MOCK_CADENAS, MOCK_CENTROS, MOCK_LOCALES } from '@/lib/mock-data'
import type { Cadena, CentroComercial, Local } from '@/types'

export const dynamic = 'force-dynamic'

type CentroWithLocales = CentroComercial & { locales: Local[] }
type CadenaWithCentros = Cadena & { centros: CentroWithLocales[] }

function buildMockReport(): CadenaWithCentros | null {
  const cadena = MOCK_CADENAS[0]
  if (!cadena) return null
  const centros: CentroWithLocales[] = MOCK_CENTROS
    .filter(cc => cc.cadena_id === cadena.id)
    .map(cc => ({ ...cc, locales: MOCK_LOCALES.filter(l => l.centro_id === cc.id) }))
  return { ...cadena, centros }
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let data: CadenaWithCentros | null = null

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      if (process.env.NODE_ENV !== 'production') throw new Error('dev-no-auth')
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const { data: row, error } = await supabase
      .from('cadenas')
      .select('*, centros:centros_comerciales(*, locales(id, numero, nombre_negocio, uso, proyectos(id, estado)))')
      .eq('id', id)
      .single()

    if (error) throw error
    data = row as CadenaWithCentros
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      data = buildMockReport()
    } else {
      return Response.json({ error: 'Error al generar reporte' }, { status: 500 })
    }
  }

  if (!data) return Response.json({ error: 'Cadena no encontrada' }, { status: 404 })

  // Build PDF with pdfkit
  const PDFDocument = (await import('pdfkit')).default

  const doc = new PDFDocument({ margin: 50, size: 'A4' })
  const chunks: Buffer[] = []
  doc.on('data', (chunk: Buffer) => chunks.push(chunk))

  const fechaStr = new Date().toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
  const GREEN = '#1A3328'
  const ACCENT = '#2D6A4F'
  const MUTED = '#6B7280'
  const WIDTH = 495

  // ── Header ─────────────────────────────────────────────────────────────
  doc.rect(50, 50, WIDTH, 80).fill(GREEN)
  doc.fillColor('#F9F7F3').fontSize(20).font('Helvetica-Bold')
    .text('PermisoHub', 70, 65)
  doc.fontSize(11).font('Helvetica').fillColor('#F9F7F3')
    .text('Reporte Ejecutivo de Permisos', 70, 92)
  doc.fontSize(9).fillColor('#B0C4BB')
    .text(fechaStr, 70, 110)
  doc.moveDown(4)

  // ── Cadena title ────────────────────────────────────────────────────────
  doc.fillColor(GREEN).fontSize(16).font('Helvetica-Bold')
    .text(data.nombre, 50, 155)
  if (data.rut) {
    doc.fontSize(10).font('Helvetica').fillColor(MUTED)
      .text(`RUT ${data.rut}`, 50, 175)
  }
  if (data.municipios && data.municipios.length > 0) {
    doc.fontSize(9).fillColor(MUTED)
      .text(`Municipios: ${data.municipios.join(' · ')}`, 50, 188)
  }
  doc.moveTo(50, 205).lineTo(545, 205).strokeColor('#E5E7EB').lineWidth(1).stroke()

  // ── KPIs ───────────────────────────────────────────────────────────────
  const totalCentros = data.centros.length
  const totalLocales = data.centros.reduce((s, cc) => s + (cc.locales ?? []).length, 0)
  const conPermiso = data.centros.reduce((s, cc) => {
    return s + (cc.locales ?? []).filter(l => (l.proyectos?.length ?? 0) > 0).length
  }, 0)
  const cobertura = totalLocales > 0 ? Math.round((conPermiso / totalLocales) * 100) : 0

  const kpis = [
    { label: 'Centros', value: String(totalCentros) },
    { label: 'Locales totales', value: String(totalLocales) },
    { label: 'Con permiso activo', value: String(conPermiso) },
    { label: 'Cobertura global', value: `${cobertura}%` },
  ]

  const boxW = 115
  kpis.forEach((k, i) => {
    const x = 50 + i * (boxW + 8)
    doc.rect(x, 215, boxW, 60).fill('#F9FAFB').stroke('#E5E7EB')
    doc.fillColor(GREEN).fontSize(20).font('Helvetica-Bold')
      .text(k.value, x + 8, 225, { width: boxW - 16, align: 'center' })
    doc.fillColor(MUTED).fontSize(8).font('Helvetica')
      .text(k.label, x + 8, 248, { width: boxW - 16, align: 'center' })
  })
  doc.moveDown(6)

  // ── Table: resumen por centro ───────────────────────────────────────────
  const tableY = 295
  doc.fillColor(GREEN).fontSize(12).font('Helvetica-Bold')
    .text('Resumen por Centro Comercial', 50, tableY)

  const headers = ['Centro', 'Municipio', 'Locales', 'Con permiso', 'Cobertura']
  const colW = [160, 100, 60, 80, 70]
  const headerY = tableY + 20

  doc.rect(50, headerY, WIDTH, 18).fill(ACCENT)
  let cx = 50
  headers.forEach((h, i) => {
    doc.fillColor('#F9F7F3').fontSize(8).font('Helvetica-Bold')
      .text(h, cx + 4, headerY + 5, { width: colW[i] - 8 })
    cx += colW[i]
  })

  let rowY = headerY + 18
  data.centros.forEach((cc, idx) => {
    const locCount = (cc.locales ?? []).length
    const activos = (cc.locales ?? []).filter(l => (l.proyectos?.length ?? 0) > 0).length
    const pct = locCount > 0 ? Math.round((activos / locCount) * 100) : 0
    const bg = idx % 2 === 0 ? '#FFFFFF' : '#F9FAFB'

    doc.rect(50, rowY, WIDTH, 16).fill(bg)
    const vals = [cc.nombre, cc.municipio, String(locCount), String(activos), `${pct}%`]
    cx = 50
    vals.forEach((v, i) => {
      doc.fillColor(GREEN).fontSize(8).font('Helvetica')
        .text(v, cx + 4, rowY + 4, { width: colW[i] - 8 })
      cx += colW[i]
    })
    rowY += 16

    // Add new page if needed
    if (rowY > 720) {
      doc.addPage()
      rowY = 50
    }
  })

  // ── Locales sin permiso (alerta) ────────────────────────────────────────
  const sinPermiso = data.centros.flatMap(cc =>
    (cc.locales ?? [])
      .filter(l => (l.proyectos?.length ?? 0) === 0)
      .map(l => ({ ...l, centro: cc.nombre, municipio: cc.municipio }))
  )

  if (sinPermiso.length > 0) {
    rowY += 20
    if (rowY > 680) { doc.addPage(); rowY = 50 }

    doc.fillColor(GREEN).fontSize(12).font('Helvetica-Bold')
      .text('Locales sin permiso registrado', 50, rowY)
    rowY += 20

    const h2 = ['Local', 'Negocio', 'Uso', 'Centro']
    const cw2 = [70, 160, 100, 150]
    doc.rect(50, rowY, WIDTH, 18).fill('#DC2626')
    cx = 50
    h2.forEach((h, i) => {
      doc.fillColor('#FFFFFF').fontSize(8).font('Helvetica-Bold')
        .text(h, cx + 4, rowY + 5, { width: cw2[i] - 8 })
      cx += cw2[i]
    })
    rowY += 18

    sinPermiso.slice(0, 30).forEach((l, idx) => {
      const bg = idx % 2 === 0 ? '#FEF2F2' : '#FFFFFF'
      doc.rect(50, rowY, WIDTH, 16).fill(bg)
      const vals = [l.numero, l.nombre_negocio ?? '—', l.uso ?? '—', l.centro]
      cx = 50
      vals.forEach((v, i) => {
        doc.fillColor(GREEN).fontSize(8).font('Helvetica')
          .text(v, cx + 4, rowY + 4, { width: cw2[i] - 8 })
        cx += cw2[i]
      })
      rowY += 16
      if (rowY > 720) { doc.addPage(); rowY = 50 }
    })
    if (sinPermiso.length > 30) {
      doc.fillColor(MUTED).fontSize(8).font('Helvetica-Oblique')
        .text(`... y ${sinPermiso.length - 30} locales más sin permiso`, 50, rowY + 4)
    }
  }

  // ── Footer ──────────────────────────────────────────────────────────────
  const pages = doc.bufferedPageRange()
  for (let i = 0; i < pages.count; i++) {
    doc.switchToPage(i)
    doc.fillColor(MUTED).fontSize(7).font('Helvetica')
      .text(
        `Generado por PermisoHub · permisohub.cl · ${fechaStr} · Página ${i + 1} de ${pages.count}`,
        50, 820, { align: 'center', width: WIDTH }
      )
  }

  doc.end()

  const pdf = await new Promise<Uint8Array>((resolve) => {
    doc.on('end', () => resolve(new Uint8Array(Buffer.concat(chunks))))
  })

  const slug = data.nombre.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-')
  const month = new Date().toISOString().slice(0, 7)

  return new Response(pdf as BodyInit, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="reporte-${slug}-${month}.pdf"`,
      'Content-Length': String(pdf.byteLength),
    },
  })
}
