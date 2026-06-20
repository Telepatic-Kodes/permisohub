export const dynamic = 'force-dynamic'

interface MockProyecto {
  nombre: string
  cliente: string
  municipio: string
  tipo_permiso: string
  estado: string
  fecha_inicio: string
  direccion?: string
  numero_expediente?: string
  superficie_terreno?: number
  superficie_construida?: number
}

// Mock project data — in production this would query Supabase
function getMockProyecto(id: string): MockProyecto {
  return {
    nombre: `Proyecto ${id}`,
    cliente: 'Cliente',
    municipio: 'Las Condes',
    tipo_permiso: 'Permiso de edificación',
    estado: 'En tramitación',
    fecha_inicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    direccion: 'No especificada',
    numero_expediente: `EXP-2026-${id.slice(0, 4).toUpperCase()}`,
    superficie_terreno: undefined,
    superficie_construida: undefined,
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // In production: query Supabase for real project data
  const proyecto = getMockProyecto(id)

  const fechaExport = new Date().toLocaleDateString('es-CL', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Expediente — ${proyecto.nombre}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: 'Helvetica Neue', Arial, sans-serif; color: #1a1a1a; background: white; }
    .header { background: #1A3328; color: white; padding: 32px 40px; }
    .header h1 { font-size: 24px; font-weight: 700; margin-bottom: 4px; }
    .header p { font-size: 13px; opacity: 0.8; }
    .content { padding: 40px; max-width: 800px; margin: 0 auto; }
    .section { margin-bottom: 32px; }
    .section-title { font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #1A3328; border-bottom: 2px solid #1A3328; padding-bottom: 6px; margin-bottom: 16px; }
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .field { margin-bottom: 12px; }
    .field-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #666; margin-bottom: 2px; }
    .field-value { font-size: 14px; color: #1a1a1a; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 100px; font-size: 12px; font-weight: 600; background: #dcfce7; color: #166534; }
    .timeline { border-left: 2px solid #e5e7eb; padding-left: 20px; }
    .timeline-item { position: relative; margin-bottom: 20px; }
    .timeline-item::before { content: ''; position: absolute; left: -25px; top: 5px; width: 10px; height: 10px; border-radius: 50%; background: #1A3328; }
    .timeline-date { font-size: 11px; color: #888; margin-bottom: 2px; }
    .timeline-text { font-size: 14px; }
    .footer { margin-top: 48px; padding-top: 20px; border-top: 1px solid #e5e7eb; font-size: 11px; color: #888; display: flex; justify-content: space-between; }
    .disclaimer { background: #fef9c3; border: 1px solid #fef08a; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #854d0e; margin-top: 32px; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } .no-print { display: none; } }
  </style>
</head>
<body>
  <div class="no-print" style="background:#f3f4f6;padding:12px 40px;display:flex;align-items:center;justify-content:space-between;">
    <span style="font-size:13px;color:#374151;">Expediente completo — ${proyecto.nombre}</span>
    <button onclick="window.print()" style="background:#1A3328;color:white;border:none;border-radius:6px;padding:8px 16px;font-size:13px;cursor:pointer;">🖨️ Imprimir / Guardar PDF</button>
  </div>

  <div class="header">
    <h1>Expediente de Tramitación</h1>
    <p>EP Gestión Arquitectónica — Estefanía Parada · estefania@epgestion.cl</p>
  </div>

  <div class="content">
    <!-- Project data -->
    <div class="section">
      <div class="section-title">Datos del proyecto</div>
      <div class="grid-2">
        <div>
          <div class="field"><div class="field-label">Nombre del proyecto</div><div class="field-value">${proyecto.nombre}</div></div>
          <div class="field"><div class="field-label">Tipo de permiso</div><div class="field-value">${proyecto.tipo_permiso}</div></div>
          <div class="field"><div class="field-label">Estado actual</div><div class="field-value"><span class="badge">${proyecto.estado}</span></div></div>
        </div>
        <div>
          <div class="field"><div class="field-label">Municipio</div><div class="field-value">${proyecto.municipio}</div></div>
          <div class="field"><div class="field-label">N° Expediente DOM</div><div class="field-value">${proyecto.numero_expediente ?? '—'}</div></div>
          <div class="field"><div class="field-label">Fecha de ingreso</div><div class="field-value">${proyecto.fecha_inicio ? new Date(proyecto.fecha_inicio).toLocaleDateString('es-CL') : '—'}</div></div>
        </div>
      </div>
      ${proyecto.direccion ? `<div class="field"><div class="field-label">Dirección</div><div class="field-value">${proyecto.direccion}</div></div>` : ''}
    </div>

    <!-- Client data -->
    <div class="section">
      <div class="section-title">Datos del mandante</div>
      <div class="field"><div class="field-label">Nombre</div><div class="field-value">${proyecto.cliente}</div></div>
    </div>

    <!-- Technical data -->
    ${(proyecto.superficie_terreno ?? proyecto.superficie_construida) ? `
    <div class="section">
      <div class="section-title">Datos técnicos</div>
      <div class="grid-2">
        ${proyecto.superficie_terreno ? `<div class="field"><div class="field-label">Superficie terreno</div><div class="field-value">${proyecto.superficie_terreno} m²</div></div>` : ''}
        ${proyecto.superficie_construida ? `<div class="field"><div class="field-label">Superficie construida</div><div class="field-value">${proyecto.superficie_construida} m²</div></div>` : ''}
      </div>
    </div>` : ''}

    <!-- Timeline placeholder -->
    <div class="section">
      <div class="section-title">Línea de tiempo</div>
      <div class="timeline">
        <div class="timeline-item">
          <div class="timeline-date">${proyecto.fecha_inicio ? new Date(proyecto.fecha_inicio).toLocaleDateString('es-CL') : '—'}</div>
          <div class="timeline-text">Ingreso a la DOM de ${proyecto.municipio}</div>
        </div>
        <div class="timeline-item">
          <div class="timeline-date">Presente</div>
          <div class="timeline-text">Estado: ${proyecto.estado}</div>
        </div>
      </div>
    </div>

    <!-- Professional -->
    <div class="section">
      <div class="section-title">Arquitecta responsable</div>
      <div class="grid-2">
        <div>
          <div class="field"><div class="field-label">Nombre</div><div class="field-value">Estefanía Parada</div></div>
          <div class="field"><div class="field-label">Empresa</div><div class="field-value">EP Gestión Arquitectónica</div></div>
        </div>
        <div>
          <div class="field"><div class="field-label">Email</div><div class="field-value">estefania@epgestion.cl</div></div>
        </div>
      </div>
    </div>

    <div class="disclaimer">
      ⚠️ Este documento es un resumen generado por PermisoHub y tiene carácter informativo. Los documentos oficiales son los emitidos por la DOM correspondiente.
    </div>

    <div class="footer">
      <span>Generado el ${fechaExport} por PermisoHub</span>
      <span>Expediente ID: ${id}</span>
    </div>
  </div>
</body>
</html>`

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
    },
  })
}
