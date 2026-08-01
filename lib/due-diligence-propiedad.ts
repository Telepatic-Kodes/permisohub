// Port de app/api/duediligence/checklist/route.ts (repo origen PROPRA·BI) —
// fase 3 de la fusión. Motor de reglas 100% determinista, sin IA — sufijo
// "-propiedad" en el nombre del archivo para no confundirse con
// lib/due-diligence.ts (due diligence de EXPEDIENTES DE PERMISO DOM, dominio
// completamente distinto: coherencia de resoluciones/vigencia de documentos,
// no riesgo legal de comprar una propiedad).

export interface DueDiligenceChecklistInput {
  direccion?: string
  rol?: string
  tipo?: string
  superficie?: string
  tipoDominio?: string
  propietario?: string
  numHerederos?: string
  deudaTGR?: string
  deudaMunicipio?: string
  hipotecas?: string
  impuestoHerencia?: string
  zonificacion?: string
  documentos?: string[]
  observaciones?: string
  semaforo?: string // APTO | CONDICIONADO | OBSERVADO (viene de la narrativa IA)
}

export type PrioridadDocumento = 'critico' | 'importante' | 'recomendado' | 'disponible'

export interface DocumentoChecklist {
  nombre: string
  sub?: string
  donde: string
  prioridad: PrioridadDocumento
}

export function buildDocList(input: DueDiligenceChecklistInput): DocumentoChecklist[] {
  const docs: DocumentoChecklist[] = []
  const disponibles = new Set((input.documentos ?? []).map((d) => d.toLowerCase()))

  const has = (keyword: string) => [...disponibles].some((d) => d.includes(keyword.toLowerCase()))

  const esSucesion =
    (input.tipoDominio ?? '').toLowerCase().includes('sucesi') ||
    (input.tipoDominio ?? '').toLowerCase().includes('comunidad')

  const numH = parseInt(input.numHerederos ?? '0', 10) || 0

  // ── CRÍTICOS ──────────────────────────────────────────────────
  if (!has('hipotecas') && !has('gravámenes') && !has('gravamenes')) {
    docs.push({
      nombre: 'Certificado de hipotecas y gravámenes CBR',
      sub: input.rol ? `Rol ${input.rol}` : undefined,
      donde: 'CBR de la comuna',
      prioridad: 'critico',
    })
  }

  if (!has('dominio vigente') && !has('dominio')) {
    docs.push({
      nombre: 'Certificado de dominio vigente CBR',
      sub: 'Confirma titularidad actual del inmueble',
      donde: 'CBR de la comuna',
      prioridad: 'critico',
    })
  }

  if (esSucesion && !has('posesión efectiva cbr') && !has('posesion efectiva cbr') && !has('inscripción posesión')) {
    docs.push({
      nombre: 'Inscripción de posesión efectiva en el CBR',
      sub: 'Distinto del folio SRCEI — obligatorio para venta válida',
      donde: 'CBR de la comuna',
      prioridad: 'critico',
    })
  }

  if (esSucesion && numH >= 10) {
    docs.push({
      nombre: 'Poderes notariales de herederos que no concurran',
      sub: `${numH} herederos activos — necesario por cada uno que no firme en persona`,
      donde: 'Notaría (cada heredero)',
      prioridad: 'critico',
    })
  } else if (esSucesion && numH >= 2) {
    docs.push({
      nombre: 'Poderes notariales de herederos ausentes',
      sub: 'Necesario para quienes no puedan concurrir a la firma',
      donde: 'Notaría (cada heredero)',
      prioridad: 'critico',
    })
  }

  if ((input.hipotecas ?? '').toLowerCase().includes('sí') || (input.hipotecas ?? '').toLowerCase().includes('si')) {
    docs.push({
      nombre: 'Alzamiento de hipotecas / prohibiciones',
      sub: 'Trámite obligatorio antes de la escritura de compraventa',
      donde: 'Banco o acreedor hipotecario · CBR',
      prioridad: 'critico',
    })
  }

  // ── IMPORTANTES ───────────────────────────────────────────────
  const deudaTGRClara =
    (input.deudaTGR ?? '').toLowerCase().includes('sin deuda') || (input.deudaTGR ?? '').toLowerCase().includes('al día')

  if (!deudaTGRClara && !has('tgr')) {
    docs.push({
      nombre: 'Certificado TGR del rol local',
      sub: input.rol ? `Rol ${input.rol} — verifica contribuciones al día` : 'Verifica contribuciones al día',
      donde: 'tgr.cl',
      prioridad: 'importante',
    })
  }

  const deudaMunicipioClara =
    (input.deudaMunicipio ?? '').toLowerCase().includes('sin deuda') || (input.deudaMunicipio ?? '').toLowerCase().includes('al día')

  if (!deudaMunicipioClara && !has('municipal')) {
    docs.push({
      nombre: 'Certificado deuda municipal',
      sub: 'Contribuciones y derechos municipales al día',
      donde: 'Municipalidad de la comuna',
      prioridad: 'importante',
    })
  }

  if (esSucesion && numH >= 5 && !has('acuerdo') && !has('distribución')) {
    docs.push({
      nombre: 'Acuerdo de distribución entre herederos',
      sub: 'Acta notarial que fija el % de reparto del precio de venta',
      donde: 'Notaría',
      prioridad: 'importante',
    })
  }

  if (!has('sanitaria') && !has('esval') && !has('agua')) {
    docs.push({
      nombre: 'Certificado deuda sanitaria',
      sub: 'Sin deuda en agua potable y alcantarillado',
      donde: 'Empresa sanitaria de la zona',
      prioridad: 'importante',
    })
  }

  if (!has('expropiación') && !has('expropiacion')) {
    docs.push({
      nombre: 'Certificado de no expropiación',
      sub: 'Confirma que no está afecto a utilidad pública o ensanche vial',
      donde: 'SEREMI MINVU o DOM de la comuna',
      prioridad: 'importante',
    })
  }

  if (esSucesion && !has('contacto herederos')) {
    docs.push({
      nombre: 'Datos de todos los herederos activos',
      sub: 'RUT, dirección, teléfono y estado civil de cada uno',
      donde: 'Gestión interna familia',
      prioridad: 'importante',
    })
  }

  // ── RECOMENDADOS ──────────────────────────────────────────────
  if (!has('informaciones previas') && !has('informes previos')) {
    docs.push({
      nombre: 'Certificado informaciones previas actualizado',
      sub: 'Verificar usos de suelo y restricciones vigentes',
      donde: 'DOM de la comuna',
      prioridad: 'recomendado',
    })
  }

  if (!has('tasación fiscal') && !has('tasacion fiscal') && !has('avalúo sii')) {
    docs.push({
      nombre: 'Tasación fiscal SII actualizada',
      sub: 'Avalúo vigente para cálculo real de contribuciones',
      donde: 'sii.cl',
      prioridad: 'recomendado',
    })
  }

  // ── YA DISPONIBLES ────────────────────────────────────────────
  for (const doc of input.documentos ?? []) {
    docs.push({ nombre: doc, donde: '', prioridad: 'disponible' })
  }

  return docs
}

function renderBadge(prioridad: PrioridadDocumento): string {
  const map: Record<PrioridadDocumento, string> = {
    critico: `<span class="badge badge-red">Pendiente</span>`,
    importante: `<span class="badge badge-orange">Pendiente</span>`,
    recomendado: `<span class="badge badge-blue">Recomendado</span>`,
    disponible: `<span class="badge badge-green">Disponible</span>`,
  }
  return map[prioridad]
}

function renderRow(doc: DocumentoChecklist, idx: number): string {
  return `
    <tr>
      <td class="num">${idx}</td>
      <td>
        <div class="doc-name">${doc.nombre}</div>
        ${doc.sub ? `<div class="doc-sub">${doc.sub}</div>` : ''}
      </td>
      <td>${renderBadge(doc.prioridad)}</td>
      <td class="where">${doc.donde}</td>
    </tr>`
}

export function buildChecklistHTML(input: DueDiligenceChecklistInput, docs: DocumentoChecklist[]): string {
  const criticos = docs.filter((d) => d.prioridad === 'critico')
  const importantes = docs.filter((d) => d.prioridad === 'importante')
  const recomendados = docs.filter((d) => d.prioridad === 'recomendado')
  const disponibles = docs.filter((d) => d.prioridad === 'disponible')

  let contador = 1

  const semaforoColor = input.semaforo === 'APTO' ? '#15803d' : input.semaforo === 'OBSERVADO' ? '#b91c1c' : '#c2410c'
  const semaforoBg = input.semaforo === 'APTO' ? '#dcfce7' : input.semaforo === 'OBSERVADO' ? '#fee2e2' : '#ffedd5'

  const ahora = new Date().toLocaleDateString('es-CL', { month: 'long', year: 'numeric' })

  const tableHead = `
    <thead><tr>
      <th style="width:28px;">#</th>
      <th>Documento</th>
      <th style="width:110px;">Estado</th>
      <th style="width:200px;">Dónde obtener</th>
    </tr></thead>`

  const renderSection = (title: string, items: DocumentoChecklist[], color: string) => {
    if (items.length === 0) return ''
    const rows = items.map((d) => renderRow(d, contador++)).join('')
    return `
      <div class="section">
        <div class="section-title" style="color:${color};">${title}</div>
        <table>${tableHead}<tbody>${rows}</tbody></table>
      </div>`
  }

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Checklist Due Diligence — ${input.direccion ?? 'Propiedad'}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  @page { size: A4; margin: 20mm 16mm; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    background: #fff; color: #111; font-size: 11px; line-height: 1.4;
  }
  .header {
    display: flex; justify-content: space-between; align-items: flex-start;
    margin-bottom: 20px; padding-bottom: 14px; border-bottom: 2px solid #111;
  }
  .header h1 { font-size: 20px; font-weight: 800; letter-spacing: -0.5px; }
  .header p { font-size: 11px; color: #555; margin-top: 4px; }
  .header-right { text-align: right; font-size: 10px; color: #888; line-height: 1.7; }
  .badge {
    display: inline-block; padding: 2px 8px; border-radius: 4px;
    font-size: 9px; font-weight: 700; letter-spacing: 0.4px; text-transform: uppercase;
  }
  .badge-red    { background: #fee2e2; color: #b91c1c; }
  .badge-orange { background: #ffedd5; color: #c2410c; }
  .badge-blue   { background: #dbeafe; color: #1d4ed8; }
  .badge-green  { background: #dcfce7; color: #15803d; }
  .section { margin-bottom: 16px; }
  .section-title {
    font-size: 9px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase;
    margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb;
  }
  table { width: 100%; border-collapse: collapse; }
  th {
    background: #f8fafc; font-size: 9px; font-weight: 700;
    text-transform: uppercase; letter-spacing: 0.4px; color: #64748b;
    padding: 5px 8px; text-align: left; border-bottom: 1px solid #e2e8f0;
  }
  td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .num   { color: #94a3b8; font-size: 10px; font-weight: 700; }
  .doc-name { font-weight: 600; font-size: 11px; }
  .doc-sub  { font-size: 10px; color: #64748b; margin-top: 1px; }
  .where    { font-size: 10px; color: #374151; }
  .summary {
    display: flex; gap: 10px; flex-wrap: wrap; margin-top: 18px;
    padding: 10px 14px; background: #f8fafc;
    border: 1px solid #e2e8f0; border-radius: 6px; align-items: center;
  }
  .s-item { display: flex; align-items: center; gap: 5px; }
  .s-dot  { width: 7px; height: 7px; border-radius: 50%; }
  .s-lbl  { font-size: 10px; color: #475569; }
  .s-num  { font-size: 13px; font-weight: 800; }
  .footer {
    margin-top: 16px; padding-top: 10px; border-top: 1px solid #e2e8f0;
    display: flex; justify-content: space-between; font-size: 9px; color: #94a3b8;
  }
  @media print {
    body { font-size: 10.5px; }
    .section { page-break-inside: avoid; }
  }
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>Checklist de Due Diligence</h1>
    <p>${[input.direccion, input.rol ? `Rol SII ${input.rol}` : '', input.tipoDominio].filter(Boolean).join(' · ')}</p>
    ${input.propietario ? `<p style="color:#888; font-size:10px; margin-top:2px;">${input.propietario}</p>` : ''}
  </div>
  <div class="header-right">
    <div>PermisoHub · Due Diligence de Propiedad</div>
    <div style="text-transform:capitalize;">${ahora}</div>
    ${input.semaforo ? `<div style="margin-top:4px;"><span class="badge" style="background:${semaforoBg};color:${semaforoColor};">${input.semaforo}</span></div>` : ''}
  </div>
</div>

${renderSection('Críticos — sin estos no se puede escriturar', criticos, '#b91c1c')}
${renderSection('Importantes — necesarios antes de cerrar', importantes, '#c2410c')}
${renderSection('Recomendados — no bloquean pero evitan problemas', recomendados, '#1d4ed8')}
${renderSection('Ya disponibles', disponibles, '#15803d')}

<div class="summary">
  ${disponibles.length > 0 ? `<div class="s-item"><div class="s-dot" style="background:#15803d;"></div><span class="s-lbl">Disponibles</span><span class="s-num" style="color:#15803d;">${disponibles.length}</span></div><span style="color:#cbd5e1;">·</span>` : ''}
  ${criticos.length > 0 ? `<div class="s-item"><div class="s-dot" style="background:#b91c1c;"></div><span class="s-lbl">Críticos</span><span class="s-num" style="color:#b91c1c;">${criticos.length}</span></div><span style="color:#cbd5e1;">·</span>` : ''}
  ${importantes.length > 0 ? `<div class="s-item"><div class="s-dot" style="background:#c2410c;"></div><span class="s-lbl">Importantes</span><span class="s-num" style="color:#c2410c;">${importantes.length}</span></div><span style="color:#cbd5e1;">·</span>` : ''}
  ${recomendados.length > 0 ? `<div class="s-item"><div class="s-dot" style="background:#1d4ed8;"></div><span class="s-lbl">Recomendados</span><span class="s-num" style="color:#1d4ed8;">${recomendados.length}</span></div>` : ''}
  <span style="margin-left:auto;font-size:10px;color:#475569;">
    <strong>Prioridad inmediata:</strong> documentos críticos (CBR + poderes notariales)
  </span>
</div>

<div class="footer">
  <span>PermisoHub · Due Diligence · ${input.tipo ?? 'Propiedad'} · ${input.superficie ? `${input.superficie} m²` : ''}</span>
  <span>Checklist orientativo — verificar con abogado inmobiliario</span>
</div>

</body>
</html>`
}
