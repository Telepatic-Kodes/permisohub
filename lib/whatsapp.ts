import twilio from 'twilio'

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

export type TipoNotificacionWA =
  | 'proyecto_ingresado'
  | 'en_revision'
  | 'con_observaciones'
  | 'aprobado'
  | 'rechazado'
  | 'recepcion_solicitada'
  | 'recepcion_aprobada'
  | 'actualizacion_general'

interface PlantillaParams {
  proyectoNombre: string
  municipio: string
  etapa?: string
  mensaje?: string
  diasEstimados?: number
  arquitecta?: string
}

function getPlantilla(tipo: TipoNotificacionWA, params: PlantillaParams): string {
  const firma = `\n\n_${params.arquitecta ?? 'Estefanía Parada'} — EP Gestión Arquitectónica_`

  switch (tipo) {
    case 'proyecto_ingresado':
      return `*📋 Proyecto ingresado a la DOM*\n\nHola! Te informamos que el proyecto *${params.proyectoNombre}* en *${params.municipio}* fue ingresado exitosamente a la Dirección de Obras Municipales.\n\n⏱️ Plazo legal: hasta 30 días hábiles para pronunciamiento (Ley 21.718).${firma}`

    case 'en_revision':
      return `*🔍 Proyecto en revisión*\n\nTu proyecto *${params.proyectoNombre}* en *${params.municipio}* está siendo revisado por la DOM.\n\n📅 Plazo estimado de respuesta: ${params.diasEstimados ?? 15} días hábiles.${firma}`

    case 'con_observaciones':
      return `*⚠️ Observaciones recibidas*\n\nLa DOM de *${params.municipio}* emitió observaciones al proyecto *${params.proyectoNombre}*.\n\nTe contactaremos pronto para coordinar las correcciones necesarias. El plazo de respuesta es de 30 días hábiles.${firma}`

    case 'aprobado':
      return `*✅ ¡Permiso aprobado!*\n\n🎉 Excelente noticia! El permiso de edificación del proyecto *${params.proyectoNombre}* en *${params.municipio}* fue *APROBADO* por la DOM.\n\nNos pondremos en contacto para coordinar los próximos pasos.${firma}`

    case 'rechazado':
      return `*❌ Permiso denegado*\n\nLamentamos informarte que la DOM de *${params.municipio}* denegó el permiso del proyecto *${params.proyectoNombre}*.\n\nAnalizaremos las causas y nos comunicaremos para definir el plan de acción.${firma}`

    case 'recepcion_solicitada':
      return `*🏗️ Recepción final solicitada*\n\nHemos ingresado la solicitud de recepción final del proyecto *${params.proyectoNombre}* en la DOM de *${params.municipio}*.\n\nLa DOM programará una visita de inspección en los próximos días.${firma}`

    case 'recepcion_aprobada':
      return `*🏠 ¡Recepción final aprobada!*\n\n🎉 El proyecto *${params.proyectoNombre}* fue recibido satisfactoriamente por la DOM de *${params.municipio}*.\n\nYa cuentas con el Certificado de Recepción Final. Tu propiedad está 100% regularizada.${firma}`

    case 'actualizacion_general':
    default:
      return `*📬 Actualización de proyecto*\n\n*${params.proyectoNombre}* — ${params.municipio}\n\n${params.mensaje ?? 'Hay una novedad en tu proyecto. Te contactaremos pronto.'}${firma}`
  }
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

// Generate a wa.me link as fallback (no API needed)
export function getWhatsAppLink(telefono: string, tipo: TipoNotificacionWA, params: PlantillaParams): string {
  const to = normalizarTelefonoChileno(telefono).replace('+', '')
  const text = getPlantilla(tipo, params)
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`
}
