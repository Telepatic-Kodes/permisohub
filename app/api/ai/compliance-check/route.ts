import { getAI, AI_MODEL } from '@/lib/ai'
import { ARTICULOS_OGUC } from '@/lib/oguc-knowledge'

export const dynamic = 'force-dynamic'

interface ComplianceRequest {
  municipio: string
  zonaPRC?: string
  superficieTerreno: number
  superficieConstruida: number
  huellaEdificacion: number
  numeroPisos: number
  alturaEdificacion: number
  distanciamientoNorte?: number
  distanciamientoSur?: number
  distanciamientoOriente?: number
  distanciamientoPoniente?: number
  tipoObra: string
  tieneAdosamiento?: boolean
}

export async function POST(request: Request) {
  const body = await request.json() as ComplianceRequest

  const ai = getAI()
  if (!ai) {
    return Response.json({ error: 'ANTHROPIC_API_KEY no configurado' }, { status: 503 })
  }

  // Include coefficient and rasante articles always
  const articulosRelevantes = ARTICULOS_OGUC.filter((a) =>
    ['2.7.1', '2.6.3', '2.6.6', '1.1.2'].includes(a.id)
  )

  const fotReal = body.superficieConstruida / body.superficieTerreno
  const fosReal = body.huellaEdificacion / body.superficieTerreno

  const prompt = `Eres un experto en normativa de construcción chilena. Analiza el siguiente proyecto y verifica su cumplimiento con la OGUC.

## DATOS DEL PROYECTO:
- Municipio: ${body.municipio}
- Zona PRC (si se conoce): ${body.zonaPRC ?? 'No especificada'}
- Tipo de obra: ${body.tipoObra}
- Superficie terreno: ${body.superficieTerreno} m²
- Superficie construida total: ${body.superficieConstruida} m² → FOT real: ${fotReal.toFixed(2)}
- Huella en planta baja: ${body.huellaEdificacion} m² → FOS real: ${fosReal.toFixed(2)}
- Número de pisos: ${body.numeroPisos}
- Altura de edificación: ${body.alturaEdificacion} m
${body.distanciamientoNorte !== undefined ? `- Distanciamiento Norte: ${body.distanciamientoNorte} m` : ''}
${body.distanciamientoSur !== undefined ? `- Distanciamiento Sur: ${body.distanciamientoSur} m` : ''}
${body.distanciamientoOriente !== undefined ? `- Distanciamiento Oriente: ${body.distanciamientoOriente} m` : ''}
${body.distanciamientoPoniente !== undefined ? `- Distanciamiento Poniente: ${body.distanciamientoPoniente} m` : ''}
- Tiene adosamiento: ${body.tieneAdosamiento ? 'Sí' : 'No'}

## ARTÍCULOS OGUC DE REFERENCIA:
${articulosRelevantes.map((a) => `**Art. ${a.id} — ${a.titulo}**\n${a.texto}`).join('\n\n---\n\n')}

## INSTRUCCIÓN:
Responde EXACTAMENTE en este formato JSON (sin markdown, solo el JSON puro):

{
  "riesgoGeneral": "BAJO" | "MEDIO" | "ALTO",
  "resumen": "texto corto de 1-2 oraciones",
  "checks": [
    {
      "item": "nombre del check (ej: Coeficiente FOT)",
      "resultado": "OK" | "EXCEDIDO" | "ADVERTENCIA" | "VERIFICAR",
      "detalle": "explicación específica con números",
      "articulo": "Art. X.X.X OGUC",
      "riesgo": "BAJO" | "MEDIO" | "ALTO"
    }
  ],
  "recomendaciones": ["lista de acciones concretas a tomar"]
}

Verifica al menos: FOT, FOS, rasantes (calcula si la altura genera problemas según distanciamientos), distanciamientos mínimos, y cualquier otro issue que detectes.
Si no tienes datos suficientes para verificar algo, ponlo como "VERIFICAR" con instrucción de qué verificar en el PRC municipal.`

  try {
    const response = await ai.messages.create({
      model: AI_MODEL,
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : '{}'

    // Parse JSON response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    const result = jsonMatch ? JSON.parse(jsonMatch[0]) as {
      riesgoGeneral: string
      resumen: string
      checks: Array<{ item: string; resultado: string; detalle: string; articulo: string; riesgo: string }>
      recomendaciones: string[]
    } : { riesgoGeneral: 'VERIFICAR', resumen: text, checks: [], recomendaciones: [] }

    return Response.json({ ok: true, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
