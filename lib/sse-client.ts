// Consumidor de Server-Sent Events para las 4 páginas que hacen streaming de
// IA (Tasación, Due Diligence, Pricing, Copiloto) — todas escriben
// `data: ${JSON.stringify(...)}\n\n` server-side (ver app/api/tasacion/route.ts
// y equivalentes). Antes cada página repetía su propio parseo con
// `decoder.decode(value)` sin `{stream:true}` y `chunk.split("\n")` sin
// buffer entre lecturas — un `read()` puede cortar el JSON a la mitad o
// partir un carácter UTF-8 multibyte (tildes, ñ, m², emojis de sección), y
// el catch estaba invertido: relanzaba exactamente los SyntaxError de JSON
// incompleto que debía absorber, abortando un informe ya generado. Acá se
// bufferea entre lecturas y solo se entrega un evento cuando el separador
// `\n\n` completo ya llegó, así que un JSON.parse que falle es un bug real,
// no un artefacto de corte de chunk.
export async function* leerEventosSSE(response: Response): AsyncGenerator<string> {
  const reader = response.body?.getReader()
  if (!reader) throw new Error('No stream')

  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let separador: number
    while ((separador = buffer.indexOf('\n\n')) !== -1) {
      const linea = buffer.slice(0, separador)
      buffer = buffer.slice(separador + 2)
      if (!linea.startsWith('data: ')) continue
      const data = linea.slice(6)
      if (data === '[DONE]') continue
      yield data
    }
  }
}
