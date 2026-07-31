import { z } from 'zod'
import { isAIAvailable, aiComplete } from '@/lib/ai'
import { ARTICULOS_OGUC } from '@/lib/oguc-knowledge'
import { ARTICULOS_LGUC } from '@/lib/lguc-knowledge'
import { flagUnverifiedCita } from '@/lib/normativa-retrieval'
import { aiAuthGuard } from '@/lib/ai-guard'
import { recordUsage } from '@/lib/usage'
import { checkRateLimit } from '@/lib/rate-limit'
import { parseAiJson } from '@/lib/ai-parse'

export const dynamic = 'force-dynamic'

// M5 (auditoría 2026-07-30): schema laxo — solo garantiza forma estructural
// (arrays son arrays, campos existen con un valor por defecto razonable). No
// se restringen los valores de enum ("resultado"/"riesgo") a un set cerrado:
// eso ya era así antes de esta migración (cast `as X` sin chequeo) y una
// restricción estricta aquí solo agregaría fallos de parseo por drift menor
// del modelo sin beneficio real.
const CheckSchema = z
  .object({
    item: z.string().default(''),
    resultado: z.string().default('VERIFICAR'),
    detalle: z.string().default(''),
    articulo: z.string().default(''),
    riesgo: z.string().default('BAJO'),
  })
  .passthrough()

const ComplianceSchema = z
  .object({
    riesgoGeneral: z.string().default('VERIFICAR'),
    resumen: z.string().default(''),
    checks: z.array(CheckSchema).default([]),
    recomendaciones: z.array(z.string()).default([]),
  })
  .passthrough()

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
  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

  const body = await request.json() as ComplianceRequest

  if (!isAIAvailable()) {
    return Response.json({ error: 'OPENAI_API_KEY no configurado' }, { status: 503 })
  }

  // Include coefficient and rasante articles always
  const articulosRelevantes = ARTICULOS_OGUC.filter((a) =>
    ['2.7.1', '2.6.3', '2.6.6', '1.1.2'].includes(a.id)
  )

  // Enrich with LGUC framing articles: permiso de edificación (116) y
  // responsabilidad del proyectista sobre lo declarado (18).
  const articulosLGUC = ARTICULOS_LGUC.filter((a) => ['116', '18'].includes(a.id))

  const fotReal = body.superficieConstruida / body.superficieTerreno
  const fosReal = body.huellaEdificacion / body.superficieTerreno

  const prompt = `Eres un experto en normativa de construcción chilena. Analiza el siguiente proyecto y verifica su cumplimiento con la OGUC (D.S. N°47/1992 con modificaciones hasta D.S. N°2, D.O. 16.03.2026, vigente desde 25.04.2026).

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
${articulosRelevantes.map((a) => `**Art. ${a.id} OGUC — ${a.titulo}**\n${a.texto}`).join('\n\n---\n\n')}

## MARCO LEGAL LGUC (DFL N°458/1975):
${articulosLGUC.map((a) => `**Art. ${a.id} LGUC — ${a.titulo}**\n${a.texto}`).join('\n\n---\n\n')}

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
    const text = await aiComplete([{ role: 'user', content: prompt }], { max_tokens: 2000 })

    // M5: parseo validado con zod (antes: regex + JSON.parse + cast `as` sin
    // validación de runtime). En fallo, degrada al mismo fallback que existía.
    const parsed = parseAiJson(text, ComplianceSchema, 'compliance-check') ?? {
      riesgoGeneral: 'VERIFICAR',
      resumen: text,
      checks: [],
      recomendaciones: [],
    }

    // A2 (auditoría 2026-07-30): el modelo puede inventar un número de
    // artículo. Cada `articulo` pasa por el guard anti-citas-inventadas antes
    // de salir al cliente — gana el sufijo "(por verificar)" si no está en la
    // base curada.
    const result = {
      ...parsed,
      checks: parsed.checks.map((c) => ({ ...c, articulo: flagUnverifiedCita(c.articulo) })),
    }

    recordUsage(auth.userId, 'ai_chats').catch(console.error)
    return Response.json({ ok: true, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
