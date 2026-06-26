import { isAIAvailable, aiComplete } from '@/lib/ai'
import { aiAuthGuard } from '@/lib/ai-guard'
import { recordUsage } from '@/lib/usage'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

interface MemoriaRequest {
  proyectoNombre: string
  direccion: string
  municipio: string
  propietario: string
  tipoObra: string
  zonaPRC: string
  superficieTerreno: number
  superficieConstruida: number
  superficieExistente?: number
  pisos: number
  alturaMaxima: number
  materialEstructura: string
  materialCubierta: string
  usoEdificacion: string
  descripcionProyecto: string
  arquitecta?: string
}

const TIPO_OBRA_LABELS: Record<string, string> = {
  permiso_edificacion: 'Permiso de Edificación (obra nueva)',
  ampliacion: 'Ampliación',
  regularizacion: 'Regularización',
}

const MATERIAL_ESTRUCTURA_LABELS: Record<string, string> = {
  hormigon_armado: 'Hormigón armado',
  albañileria: 'Albañilería confinada',
  madera: 'Madera',
  metalica: 'Estructura metálica',
}

const MATERIAL_CUBIERTA_LABELS: Record<string, string> = {
  zinc: 'Zinc',
  teja: 'Teja',
  losa_hormigon: 'Losa de hormigón',
  otro: 'Otro',
}

const USO_LABELS: Record<string, string> = {
  vivienda: 'Vivienda',
  comercio: 'Comercio',
  oficina: 'Oficina',
  bodega: 'Bodega',
  mixto: 'Uso mixto',
}

export async function POST(request: Request) {
  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

  const body = (await request.json()) as MemoriaRequest

  if (!isAIAvailable()) {
    return Response.json({ error: 'OPENAI_API_KEY no configurado' }, { status: 503 })
  }

  const tipoObraLabel = TIPO_OBRA_LABELS[body.tipoObra] ?? body.tipoObra
  const materialEstructuraLabel = MATERIAL_ESTRUCTURA_LABELS[body.materialEstructura] ?? body.materialEstructura
  const materialCubiertaLabel = MATERIAL_CUBIERTA_LABELS[body.materialCubierta] ?? body.materialCubierta
  const usoLabel = USO_LABELS[body.usoEdificacion] ?? body.usoEdificacion

  const superficieExistenteLine = body.superficieExistente
    ? `- Superficie existente: ${body.superficieExistente} m²`
    : ''

  const prompt = `Eres una arquitecta chilena experta. Genera una Memoria Descriptiva formal y completa para un permiso de edificación ante la DOM chilena.

DATOS DEL PROYECTO:
- Nombre: ${body.proyectoNombre}
- Dirección: ${body.direccion}, ${body.municipio}
- Propietario: ${body.propietario}
- Tipo de obra: ${tipoObraLabel}
- Zona PRC: ${body.zonaPRC}
- Superficie terreno: ${body.superficieTerreno} m²
- Superficie a construir: ${body.superficieConstruida} m²
${superficieExistenteLine}
- N° pisos: ${body.pisos}
- Altura máxima: ${body.alturaMaxima} m
- Sistema estructural: ${materialEstructuraLabel}
- Cubierta: ${materialCubiertaLabel}
- Uso: ${usoLabel}
- Descripción adicional: ${body.descripcionProyecto}

Genera la memoria con estas secciones exactas en orden:
1. ANTECEDENTES GENERALES (propietario, dirección, rol, normativa aplicable)
2. DESCRIPCIÓN DEL PROYECTO (programa arquitectónico detallado por piso)
3. CUADRO DE SUPERFICIES (tabla con superficies por nivel y totales)
4. SISTEMA ESTRUCTURAL (fundaciones, losa, muro, cubierta)
5. INSTALACIONES (agua, alcantarillado, electricidad, gas si aplica)
6. MATERIALIDAD Y TERMINACIONES (muros, pisos, ventanas, puertas)
7. CUMPLIMIENTO NORMATIVO (FOT, FOS, altura, distanciamientos según PRC zona ${body.zonaPRC})

Usa formato formal con mayúsculas para títulos de sección. Sé técnico y preciso. Cita artículos OGUC relevantes. Incluye valores numéricos donde corresponde.`

  try {
    const memoria = await aiComplete([{ role: 'user', content: prompt }], { max_tokens: 4096 })

    // Extract section titles (lines that are ALL CAPS and non-empty)
    const secciones = memoria
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line.length > 3 && line === line.toUpperCase() && /[A-ZÁÉÍÓÚÑ]/.test(line))

    recordUsage(auth.userId, 'ai_chats').catch(console.error)
    return Response.json({ ok: true, memoria, secciones })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
