import { Resend } from "resend"

let _resend: Resend | null = null
function getResend(): Resend | null {
  if (!process.env.RESEND_API_KEY) return null
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY)
  return _resend
}

const FROM_EMAIL = "EP Gestión Arquitectónica <notificaciones@permisohub.cl>"
const BRAND_COLOR = "#1A3328"
const PORTAL_URL = "https://permisohub.cl/portal"

export interface EmailResult {
  success: boolean
  id?: string
  error?: string
}

// ----------------------------------------------------------------------------
// Base layout
// ----------------------------------------------------------------------------

function baseTemplate(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: Inter, -apple-system, sans-serif; background: #F9F7F3; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; padding: 40px 20px; }
  .card { background: white; border-radius: 12px; padding: 32px; border: 1px solid #E5E7EB; }
  .header { border-bottom: 2px solid ${BRAND_COLOR}; padding-bottom: 20px; margin-bottom: 28px; }
  .logo { color: ${BRAND_COLOR}; font-size: 20px; font-weight: 700; }
  .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
  .badge-orange { background: #FEF3C7; color: #92400E; }
  .badge-green { background: #D1FAE5; color: #065F46; }
  .badge-blue { background: #DBEAFE; color: #1E40AF; }
  .btn { display: inline-block; background: ${BRAND_COLOR}; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px; }
  .footer { color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 24px; }
  h2 { color: #111827; margin-top: 0; }
  p { color: #4B5563; line-height: 1.6; }
  .info-row { display: flex; gap: 8px; margin: 8px 0; }
  .info-label { color: #9CA3AF; font-size: 13px; min-width: 140px; }
  .info-value { color: #111827; font-size: 13px; font-weight: 500; }
</style></head>
<body>
  <div class="container">
    <div class="card">
      <div class="header">
        <div class="logo">PermisoHub</div>
        <div style="color: #6B7280; font-size: 13px; margin-top: 4px;">EP Gestión Arquitectónica</div>
      </div>
      ${content}
      <div style="margin-top: 28px; padding-top: 20px; border-top: 1px solid #F3F4F6;">
        <a href="${PORTAL_URL}" class="btn">Ver en el portal →</a>
      </div>
    </div>
    <div class="footer">
      EP Gestión Arquitectónica · permisohub.cl<br>
      Para dejar de recibir estas notificaciones, <a href="#" style="color: #9CA3AF;">haz clic aquí</a>
    </div>
  </div>
</body>
</html>`
}

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function infoRow(label: string, value: string): string {
  return `<div class="info-row"><span class="info-label">${escapeHtml(
    label
  )}</span><span class="info-value">${escapeHtml(value)}</span></div>`
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

/**
 * Sends an email through Resend. If `RESEND_API_KEY` is not configured we log a
 * warning and return a mock success so local development never breaks.
 */
async function send(params: {
  to: string
  subject: string
  html: string
}): Promise<EmailResult> {
  if (!process.env.RESEND_API_KEY) {
    // eslint-disable-next-line no-console
    console.warn(
      `[email] RESEND_API_KEY no configurado. Email simulado a ${params.to}: "${params.subject}"`
    )
    return { success: true, id: "mock-no-api-key" }
  }

  try {
    const client = getResend()!
    const { data, error } = await client.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: params.subject,
      html: params.html,
    })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true, id: data?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido"
    return { success: false, error: message }
  }
}

// ----------------------------------------------------------------------------
// 1. Observación DOM (requiere respuesta)
// ----------------------------------------------------------------------------

export async function sendObservacionAlert(params: {
  to: string
  clienteNombre: string
  proyectoNombre: string
  municipio: string
  expediente: string
  descripcionObservacion: string
  plazoRespuesta: string
}): Promise<EmailResult> {
  const content = `
    <span class="badge badge-orange">Requiere respuesta</span>
    <h2 style="margin-top: 16px;">Nueva observación de la DOM</h2>
    <p>Hola ${escapeHtml(params.clienteNombre)},</p>
    <p>La Dirección de Obras Municipales de <strong>${escapeHtml(
      params.municipio
    )}</strong> emitió una observación para tu proyecto <strong>${escapeHtml(
      params.proyectoNombre
    )}</strong>. Es necesario subsanarla dentro del plazo indicado.</p>
    <div style="background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 8px; padding: 16px; margin: 20px 0;">
      <p style="color: #92400E; font-weight: 600; margin: 0 0 8px;">Detalle de la observación</p>
      <p style="color: #78350F; margin: 0;">${escapeHtml(
        params.descripcionObservacion
      )}</p>
    </div>
    <div style="margin-top: 20px;">
      ${infoRow("Proyecto", params.proyectoNombre)}
      ${infoRow("Municipio", params.municipio)}
      ${infoRow("Expediente", params.expediente)}
      ${infoRow("Plazo de respuesta", params.plazoRespuesta)}
    </div>
  `

  return send({
    to: params.to,
    subject: `Observación DOM · ${params.proyectoNombre} (${params.municipio})`,
    html: baseTemplate(content),
  })
}

// ----------------------------------------------------------------------------
// 2. Vencimiento de plazo próximo (dentro de 7 días)
// ----------------------------------------------------------------------------

export async function sendDeadlineAlert(params: {
  to: string
  clienteNombre: string
  proyectoNombre: string
  municipio: string
  diasRestantes: number
  fechaEstimada: string
}): Promise<EmailResult> {
  const diasLabel =
    params.diasRestantes === 1
      ? "1 día"
      : `${params.diasRestantes} días`

  const content = `
    <span class="badge badge-orange">Vence en ${escapeHtml(diasLabel)}</span>
    <h2 style="margin-top: 16px;">Plazo próximo a vencer</h2>
    <p>Hola ${escapeHtml(params.clienteNombre)},</p>
    <p>El plazo de tu proyecto <strong>${escapeHtml(
      params.proyectoNombre
    )}</strong> en <strong>${escapeHtml(
      params.municipio
    )}</strong> está por vencer. Te recomendamos revisar el estado y preparar la documentación pendiente.</p>
    <div style="margin-top: 20px;">
      ${infoRow("Proyecto", params.proyectoNombre)}
      ${infoRow("Municipio", params.municipio)}
      ${infoRow("Días restantes", diasLabel)}
      ${infoRow("Fecha estimada", params.fechaEstimada)}
    </div>
  `

  return send({
    to: params.to,
    subject: `Plazo por vencer · ${params.proyectoNombre} (${diasLabel})`,
    html: baseTemplate(content),
  })
}

// ----------------------------------------------------------------------------
// 3. Cambio de estado
// ----------------------------------------------------------------------------

export async function sendEstadoChangeAlert(params: {
  to: string
  clienteNombre: string
  proyectoNombre: string
  estadoAnterior: string
  estadoNuevo: string
  descripcion?: string
}): Promise<EmailResult> {
  const descripcionBlock = params.descripcion
    ? `<p>${escapeHtml(params.descripcion)}</p>`
    : ""

  const content = `
    <span class="badge badge-blue">Cambio de estado</span>
    <h2 style="margin-top: 16px;">Tu proyecto avanzó de etapa</h2>
    <p>Hola ${escapeHtml(params.clienteNombre)},</p>
    <p>El estado de tu proyecto <strong>${escapeHtml(
      params.proyectoNombre
    )}</strong> ha sido actualizado.</p>
    <div style="display: flex; align-items: center; gap: 12px; margin: 20px 0;">
      <span class="badge badge-blue">${escapeHtml(params.estadoAnterior)}</span>
      <span style="color: #9CA3AF; font-size: 18px;">→</span>
      <span class="badge badge-green">${escapeHtml(params.estadoNuevo)}</span>
    </div>
    ${descripcionBlock}
    <div style="margin-top: 20px;">
      ${infoRow("Proyecto", params.proyectoNombre)}
      ${infoRow("Estado anterior", params.estadoAnterior)}
      ${infoRow("Estado actual", params.estadoNuevo)}
    </div>
  `

  return send({
    to: params.to,
    subject: `${params.proyectoNombre}: ${params.estadoNuevo}`,
    html: baseTemplate(content),
  })
}

// ----------------------------------------------------------------------------
// 4. Resumen semanal
// ----------------------------------------------------------------------------

export async function sendResumenSemanal(params: {
  to: string
  clienteNombre: string
  proyectos: Array<{
    nombre: string
    municipio: string
    estado: string
    etapa: string
    fechaEstimada?: string
    tieneAlerta?: boolean
  }>
}): Promise<EmailResult> {
  const rows = params.proyectos
    .map((p) => {
      const alerta = p.tieneAlerta
        ? `<span class="badge badge-orange" style="font-size: 11px;">Alerta</span>`
        : ""
      const fecha = p.fechaEstimada ? escapeHtml(p.fechaEstimada) : "—"
      return `
        <tr>
          <td style="padding: 12px 0; border-bottom: 1px solid #F3F4F6;">
            <div style="color: #111827; font-weight: 600; font-size: 14px;">${escapeHtml(
              p.nombre
            )} ${alerta}</div>
            <div style="color: #9CA3AF; font-size: 12px; margin-top: 2px;">${escapeHtml(
              p.municipio
            )} · ${escapeHtml(p.etapa)}</div>
          </td>
          <td style="padding: 12px 0; border-bottom: 1px solid #F3F4F6; text-align: right;">
            <span class="badge badge-blue" style="font-size: 11px;">${escapeHtml(
              p.estado
            )}</span>
            <div style="color: #9CA3AF; font-size: 12px; margin-top: 4px;">${fecha}</div>
          </td>
        </tr>`
    })
    .join("")

  const emptyState = `<p>No tienes proyectos activos esta semana.</p>`

  const content = `
    <span class="badge badge-green">Resumen semanal</span>
    <h2 style="margin-top: 16px;">Tus proyectos activos</h2>
    <p>Hola ${escapeHtml(params.clienteNombre)},</p>
    <p>Este es el resumen de tus ${
      params.proyectos.length
    } proyecto${params.proyectos.length === 1 ? "" : "s"} en gestión.</p>
    ${
      params.proyectos.length === 0
        ? emptyState
        : `<table style="width: 100%; border-collapse: collapse; margin-top: 16px;">${rows}</table>`
    }
  `

  return send({
    to: params.to,
    subject: `Resumen semanal · ${params.proyectos.length} proyecto${
      params.proyectos.length === 1 ? "" : "s"
    } activo${params.proyectos.length === 1 ? "" : "s"}`,
    html: baseTemplate(content),
  })
}
