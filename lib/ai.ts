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
  return response.choices[0].message.content ?? ''
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
  return response.choices[0].message.content ?? ''
}

// Visión: analiza una o más imágenes (láminas de plano) con gpt-4o.
// `images` son data URLs (data:image/png;base64,...). Se pide `detail: high`
// para no perder el detalle del dibujo — dolor explícito del arquitecto.
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
  return response.choices[0].message.content ?? ''
}
