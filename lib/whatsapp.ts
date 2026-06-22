import twilio from 'twilio'
import { type TipoNotificacionWA, type PlantillaParams, getPlantilla, getWhatsAppLink } from './whatsapp-templates'

export type { TipoNotificacionWA, PlantillaParams }
export { getPlantilla, getWhatsAppLink }

let _client: ReturnType<typeof twilio> | null = null

function getWhatsApp(): ReturnType<typeof twilio> | null {
  if (
    !process.env.TWILIO_ACCOUNT_SID ||
    !process.env.TWILIO_AUTH_TOKEN
  ) {
    return null
  }
  if (!_client) {
    _client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    )
  }
  return _client
}

export function isWhatsAppAvailable(): boolean {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_WHATSAPP_NUMBER
  )
}

// Chilean phone normalization: accepts 9XXXXXXXX, +569XXXXXXXX, 569XXXXXXXX
export function normalizarTelefonoChileno(telefono: string): string {
  const digits = telefono.replace(/\D/g, '')
  if (digits.startsWith('569') && digits.length === 11) return `+${digits}`
  if (digits.startsWith('9') && digits.length === 9) return `+56${digits}`
  if (digits.startsWith('56') && digits.length === 11) return `+${digits}`
  return `+56${digits}` // best guess
}

export async function enviarWhatsApp(
  telefono: string,
  tipo: TipoNotificacionWA,
  params: PlantillaParams
): Promise<{ ok: boolean; sid?: string; error?: string }> {
  const client = getWhatsApp()
  if (!client) {
    return { ok: false, error: 'WhatsApp (Twilio) no configurado. Agrega TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_WHATSAPP_NUMBER.' }
  }

  const from = process.env.TWILIO_WHATSAPP_NUMBER!
  const to = normalizarTelefonoChileno(telefono)
  const body = getPlantilla(tipo, params)

  try {
    const message = await client.messages.create({
      from: `whatsapp:${from}`,
      to: `whatsapp:${to}`,
      body,
    })
    return { ok: true, sid: message.sid }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return { ok: false, error: msg }
  }
}

