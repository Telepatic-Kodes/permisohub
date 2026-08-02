import OpenAI from 'openai'

let _client: OpenAI | null = null

export function getAI(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) return null
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _client
}

// gpt-4o — best cost/quality ratio for regulatory analysis
export const AI_MODEL = 'gpt-4o'

export function isAIAvailable(): boolean {
  return !!process.env.OPENAI_API_KEY
}

type Message = { role: 'system' | 'user' | 'assistant'; content: string }

// json: true fuerza response_format json_object (el prompt DEBE mencionar
// "JSON"). Evita el parsing frágil por regex sobre prosa.
interface CompleteOptions {
  max_tokens?: number
  json?: boolean
}

// Se descartaba `finish_reason` y se devolvía el texto igual — para salidas
// JSON, un corte a medias normalmente ya fallaba en JSON.parse/parseAiJson
// (visible), pero para PROSA (memoria descriptiva, declaración jurada,
// respuesta a observación) un corte a media frase es texto sintácticamente
// válido: nada lo detectaba y la ruta devolvía `ok:true` con un documento
// legal incompleto. Lanzar en vez de devolver silencioso hace que TODO
// caller (los ~17 de este archivo, todos con try/catch → 500 con el
// mensaje) trate un corte por longitud como la falla real que es.
export class AITruncationError extends Error {
  constructor() {
    super('La respuesta de la IA se cortó por límite de tokens (finish_reason=length)')
    this.name = 'AITruncationError'
  }
}

export async function aiComplete(
  messages: Message[],
  options?: CompleteOptions
): Promise<string> {
  const ai = getAI()
  if (!ai) throw new Error('OPENAI_API_KEY no configurado')
  const response = await ai.chat.completions.create({
    model: AI_MODEL,
    max_tokens: options?.max_tokens ?? 2000,
    ...(options?.json ? { response_format: { type: 'json_object' as const } } : {}),
    messages,
  })
  if (response.choices[0].finish_reason === 'length') throw new AITruncationError()
  return response.choices[0].message.content ?? ''
}

export type ToolMessage = OpenAI.Chat.ChatCompletionMessageParam

export interface ToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export interface ToolCallResult {
  id: string
  name: string
  args: unknown
}

export interface AICompleteWithToolsResult {
  content: string | null
  toolCalls: ToolCallResult[]
  // Mensaje crudo del SDK — se reenvía tal cual como próximo turno del
  // historial cuando hay tool_calls (OpenAI exige el shape exacto de
  // `tool_calls` para poder aceptar los `role: 'tool'` que le siguen).
  rawAssistantMessage: OpenAI.Chat.ChatCompletionMessage
}

// Function/tool-calling — no usado en ningún otro lado del proyecto hasta
// ahora (streamConBusquedaWeb usa el tool nativo `web_search_preview` de la
// Responses API, mecanismo distinto). Sin streaming a propósito: se usa para
// las rondas de "qué herramienta llamar", donde la latencia real la domina
// la ronda de ida y vuelta con OpenAI, no la generación de texto — el
// caller decide cómo entregar la respuesta final al usuario.
export async function aiCompleteWithTools(
  messages: ToolMessage[],
  tools: ToolDefinition[],
  options?: { max_tokens?: number; toolChoice?: 'auto' | 'none' },
): Promise<AICompleteWithToolsResult> {
  const ai = getAI()
  if (!ai) throw new Error('OPENAI_API_KEY no configurado')

  const response = await ai.chat.completions.create({
    model: AI_MODEL,
    max_tokens: options?.max_tokens ?? 2000,
    messages,
    tools,
    tool_choice: options?.toolChoice ?? 'auto',
  })

  const choice = response.choices[0].message

  const toolCalls: ToolCallResult[] = (choice.tool_calls ?? [])
    .filter((tc): tc is OpenAI.Chat.ChatCompletionMessageToolCall & { type: 'function' } => tc.type === 'function')
    .map((tc) => {
      let args: unknown = {}
      try {
        args = JSON.parse(tc.function.arguments)
      } catch {
        // Argumentos mal formados del modelo — se ejecuta la herramienta
        // con {} en vez de lanzar; cada implementación de herramienta ya
        // valida sus propios campos requeridos y responde con un error
        // legible que el modelo puede leer y corregir en la ronda siguiente.
      }
      return { id: tc.id, name: tc.function.name, args }
    })

  return { content: choice.content, toolCalls, rawAssistantMessage: choice }
}

interface FileContentPart {
  type: 'file'
  file: { filename: string; file_data: string }
}

export async function aiCompleteWithPDF(
  prompt: string,
  pdfBase64: string,
  fileName: string,
  options?: CompleteOptions
): Promise<string> {
  const ai = getAI()
  if (!ai) throw new Error('OPENAI_API_KEY no configurado')

  const content: (OpenAI.Chat.ChatCompletionContentPart | FileContentPart)[] = [
    { type: 'text', text: prompt },
    { type: 'file', file: { filename: fileName, file_data: `data:application/pdf;base64,${pdfBase64}` } },
  ]

  const response = await ai.chat.completions.create({
    model: AI_MODEL,
    max_tokens: options?.max_tokens ?? 3000,
    ...(options?.json ? { response_format: { type: 'json_object' as const } } : {}),
    messages: [{ role: 'user', content: content as OpenAI.Chat.ChatCompletionContentPart[] }],
  })
  if (response.choices[0].finish_reason === 'length') throw new AITruncationError()
  return response.choices[0].message.content ?? ''
}

// Visión: analiza una o más imágenes (láminas de plano) con gpt-4o.
// `images` son data URLs (data:image/png;base64,...). Se pide `detail: high`
// para no perder el detalle del dibujo — dolor explícito del arquitecto.
// Responses API + web_search_preview — a diferencia de aiComplete() (Chat
// Completions, sin acceso a internet), esto permite que el modelo busque en
// vivo antes de responder. Usado por Tasación (app/api/tasacion/route.ts,
// informe de 10 secciones con varias tablas) y Due Diligence
// (app/api/due-diligence-propiedad/route.ts, 7 secciones) — ninguna de las
// dos tiene todavía una tabla de comparables/precedentes real, así que la
// búsqueda web es la única fuente disponible en esta fase. Devuelve el
// stream crudo del SDK — cada ruta que la use decide cómo traducir sus
// eventos a su propio framing SSE, igual que app/api/ai/chat/route.ts hace
// con ai.chat.completions.create({stream: true}) en vez de envolverlo acá.
//
// `max_output_tokens` explícito: sin este parámetro, la Responses API cae al
// default del modelo (gpt-4o: 4.096 tokens) — verificado en vivo que esto
// truncaba el informe de Tasación antes de llegar a "Score de Liquidez" (la
// sección 8 de 10), porque las llamadas de búsqueda web y sus resultados
// comparten el mismo presupuesto de salida que el texto final en la
// Responses API. 12.000 da margen real para 10 secciones con tablas + 8+
// búsquedas sin ser un límite tan alto que oculte una regresión futura.
export async function streamConBusquedaWeb(instructions: string, input: string) {
  const ai = getAI()
  if (!ai) throw new Error('OPENAI_API_KEY no configurado')
  return ai.responses.create({
    model: AI_MODEL,
    instructions,
    tools: [{ type: 'web_search_preview' }],
    input,
    stream: true,
    max_output_tokens: 12000,
  })
}

// Como streamConBusquedaWeb pero SIN el tool web_search_preview — para
// dominios donde los datos reales ya existen server-side (Fase 13:
// mercado_locales_stats_diarias, comparables, historial de precio) y el rol
// del modelo es narrar/citar esos números, no inventar contexto de mercado
// vía búsqueda. Reusar streamConBusquedaWeb acá dejaría que el modelo
// busque en vivo y devuelva un rango "plausible" pero no anclado a los
// datos reales de PermisoHub — exactamente el riesgo de fabricación que el
// resto del proyecto evita (ver AUDIT-FIDELIDAD-DATOS-2026-07-30.md). Sin
// `tools` en el payload: no es solo una instrucción de prompt (que el
// modelo podría ignorar), es estructuralmente imposible que busque.
export async function streamConContexto(instructions: string, input: string) {
  const ai = getAI()
  if (!ai) throw new Error('OPENAI_API_KEY no configurado')
  return ai.responses.create({
    model: AI_MODEL,
    instructions,
    input,
    stream: true,
    max_output_tokens: 3000,
  })
}

export async function aiCompleteWithImages(
  prompt: string,
  images: string[],
  options?: CompleteOptions
): Promise<string> {
  const ai = getAI()
  if (!ai) throw new Error('OPENAI_API_KEY no configurado')

  const content: OpenAI.Chat.ChatCompletionContentPart[] = [
    { type: 'text', text: prompt },
    ...images.map(
      (url): OpenAI.Chat.ChatCompletionContentPart => ({
        type: 'image_url',
        image_url: { url, detail: 'high' },
      }),
    ),
  ]

  const response = await ai.chat.completions.create({
    model: AI_MODEL,
    max_tokens: options?.max_tokens ?? 3000,
    ...(options?.json ? { response_format: { type: 'json_object' as const } } : {}),
    messages: [{ role: 'user', content }],
  })
  if (response.choices[0].finish_reason === 'length') throw new AITruncationError()
  return response.choices[0].message.content ?? ''
}
