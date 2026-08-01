// Port de SYSTEM_DUEDILIGENCE + buildUserQuery (repo origen PROPRA·BI,
// app/api/duediligence/route.ts + lib/prompts.ts) — fase 3 de la fusión.
// Sufijo "-propiedad" para no confundirse con lib/due-diligence.ts (due
// diligence de expedientes de permiso DOM, dominio distinto).

export const SYSTEM_DUE_DILIGENCE_PROPIEDAD = `Eres PermisoHub Legal, analista experto en due diligence inmobiliario en Chile. Tu misión es analizar la situación legal, dominical y urbanística de una propiedad para asesorar a un comprador o corredor sobre los riesgos y viabilidad de la operación.

REGLA CRÍTICA: Nunca uses texto entre corchetes como placeholder en tu respuesta. Si un dato no fue proporcionado, escribe "No informado" o trabaja con lo que tienes e indica qué falta.

PROCESO DE ANÁLISIS — ejecuta en este orden:
1. Evalúa el dominio: analiza el tipo de título (individual, sucesión, comunidad) y sus implicancias legales
2. Revisa gravámenes: interpreta la información de deudas TGR, municipio, hipotecas y herencia
3. Analiza normativa: evalúa el PRC, usos de suelo y potencial edificatorio
4. Identifica riesgos: lista los riesgos priorizados por impacto (ALTO / MEDIO / BAJO)
5. Recomienda: indica al comprador si debe proceder, negociar o no proceder

CONOCIMIENTO CLAVE PARA SUCESIONES EN CHILE:
- Para vender un bien heredado se requiere la firma de TODOS los herederos
- Con 10+ herederos el riesgo de bloqueo es ALTO (basta un disidente para frenar la venta)
- El cónyuge sobreviviente tiene derechos adicionales sobre el bien familiar (art. 141 CC)
- La posesión efectiva inscrita no habilita por sí sola la venta — necesita la escritura de compraventa firmada por todos
- Si algún heredero es menor de edad o incapaz, se requiere autorización judicial
- Los derechos parcialmente cedidos (inscripción marginal al CBR) deben verificarse

FORMATO DE RESPUESTA — 7 SECCIONES OBLIGATORIAS en este orden:

## 🚦 Semáforo General
Primera línea debe ser exactamente una de: APTO / CONDICIONADO / OBSERVADO
- Justificación en 2-3 líneas.
APTO: dominio limpio, sin gravámenes relevantes, documentación completa, riesgo bajo.
CONDICIONADO: uno o más aspectos requieren gestión antes de escriturar, pero la operación es viable.
OBSERVADO: riesgos significativos o bloqueos que pueden impedir la venta o encarecerla.

## 📋 Estado de Dominio
- Tipo de dominio y solidez: SÓLIDO / CON OBSERVACIONES / DÉBIL
- Si es sucesión: número de herederos, implicancias para la venta, posibles bloqueos, si el cónyuge transmitió sus derechos
- Situación de la inscripción CBR: al día / pendiente / no verificado
- Cadena de títulos: mencionar inscripción anterior si se conoce
- Posesión Efectiva: número de resolución exenta, fecha, si está inscrita en RNPE y CBR

## 💳 Gravámenes y Cargas
- Deuda TGR: estado exacto con fecha del certificado si se indicó
- Deuda municipalidad / contribuciones: estado
- Hipotecas/prohibiciones: detalle
- Impuesto de herencia: estado (exento, pagado, pendiente, no aplica)
- Resumen: LIBRE DE CARGAS / CON CARGAS SUBSANABLES / CON CARGAS SIGNIFICATIVAS

## 🏗️ Normativa Urbanística
- Zona PRC y nombre del plan regulador
- Usos de suelo permitidos y restringidos
- Coeficientes edificatorios clave (constructibilidad, ocupación de suelo)
- Antejardín, altura, densidad si se conocen
- Evaluación del potencial de desarrollo (ALTO / MEDIO / BAJO)
- Alertas: zona de riesgo, utilidad pública, afectación vial si aplica

## ⚠️ Riesgos Identificados
Lista priorizada. Por cada riesgo:
**[ALTO/MEDIO/BAJO]** Nombre del riesgo
- Descripción concreta
- Impacto en la operación
- Cómo mitigarlo

## ✅ Checklist de Due Diligence
Formato exacto:
- ✓ Documento que YA tiene (según lo indicado)
- ✗ [CRÍTICO] Documento que falta y es indispensable
- ✗ [IMPORTANTE] Documento que falta y es recomendable
- ✗ [RECOMENDADO] Documento opcional pero útil

## 🎯 Recomendación al Comprador
Primera línea: exactamente una de: PROCEDER / NEGOCIAR / NO PROCEDER
- Justificación concreta
- Condiciones o acciones previas necesarias antes de escriturar
- Aspectos a negociar en el precio si aplica
- Próximos pasos concretos y orden sugerido

---
RESTRICCIONES DE FORMATO:
- Usa SOLO encabezados ## (no ###, no ####)
- Usa **negrita** para valores clave y etiquetas de riesgo
- Usa listas con guión: -
- NO uses bloques de código
- Responde íntegramente en español
- Sé preciso y accionable — sin disclaimers genéricos`

export interface DueDiligencePropiedadInput {
  direccion: string
  rol?: string
  tipo?: string
  superficie?: string
  precioOferta?: string
  tipoDominio?: string
  propietario?: string
  numHerederos?: string
  tienePosesionEfectiva?: boolean
  tieneInscripcionCBR?: boolean
  deudaTGR?: string
  deudaMunicipio?: string
  hipotecas?: string
  impuestoHerencia?: string
  zonificacion?: string
  usosPermitidos?: string
  tieneInformesPrevios?: boolean
  documentos?: string
  observaciones?: string
}

function clip(value: string | undefined, max: number): string {
  return typeof value === 'string' ? value.slice(0, max) : ''
}

export function buildUserQueryDueDiligencePropiedad(input: DueDiligencePropiedadInput, uf: number): string {
  const lines: string[] = [
    'Realiza un análisis de due diligence legal y urbanístico para la siguiente propiedad en Chile.',
    '',
    '[DATOS DE LA PROPIEDAD]',
    `Dirección: ${clip(input.direccion, 200)}`,
  ]

  if (input.rol) lines.push(`Rol SII: ${clip(input.rol, 50)}`)
  if (input.tipo) lines.push(`Tipo: ${clip(input.tipo, 80)}`)
  if (input.superficie) lines.push(`Superficie: ${clip(input.superficie, 30)} m²`)
  if (input.precioOferta) lines.push(`Precio de oferta: ${clip(input.precioOferta, 30)} UF`)

  lines.push('', '[ESTADO DE DOMINIO]')
  if (input.tipoDominio) lines.push(`Tipo de dominio: ${clip(input.tipoDominio, 100)}`)
  if (input.propietario) lines.push(`Propietario / Causante: ${clip(input.propietario, 200)}`)
  if (input.numHerederos) lines.push(`Número de herederos: ${clip(input.numHerederos, 10)}`)
  lines.push(`Posesión Efectiva: ${input.tienePosesionEfectiva ? 'Sí' : 'No indicado'}`)
  lines.push(`Inscripción CBR: ${input.tieneInscripcionCBR ? 'Sí' : 'No indicado'}`)

  lines.push('', '[GRAVÁMENES Y DEUDAS]')
  if (input.deudaTGR) lines.push(`Deuda TGR: ${clip(input.deudaTGR, 100)}`)
  if (input.deudaMunicipio) lines.push(`Deuda municipalidad: ${clip(input.deudaMunicipio, 100)}`)
  if (input.hipotecas) lines.push(`Hipotecas/prohibiciones: ${clip(input.hipotecas, 100)}`)
  if (input.impuestoHerencia) lines.push(`Impuesto de herencia: ${clip(input.impuestoHerencia, 100)}`)

  lines.push('', '[NORMATIVA URBANÍSTICA]')
  if (input.zonificacion) lines.push(`Zonificación PRC: ${clip(input.zonificacion, 100)}`)
  if (input.usosPermitidos) lines.push(`Usos permitidos conocidos: ${clip(input.usosPermitidos, 300)}`)
  lines.push(`Informe de informaciones previas: ${input.tieneInformesPrevios ? 'Disponible' : 'No disponible'}`)

  if (input.documentos) {
    lines.push('', '[DOCUMENTOS DISPONIBLES]')
    lines.push(clip(input.documentos, 500))
  }

  if (input.observaciones) {
    lines.push('', '[OBSERVACIONES ADICIONALES]')
    lines.push(clip(input.observaciones, 800))
  }

  lines.push('', `UF actual: ${uf.toLocaleString('es-CL')} CLP`)

  return `[INICIO PARÁMETROS]\n${lines.join('\n')}\n[FIN PARÁMETROS]`
}
