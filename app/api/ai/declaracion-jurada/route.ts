import { isAIAvailable, aiComplete } from '@/lib/ai'
import { aiAuthGuard } from '@/lib/ai-guard'
import { recordUsage } from '@/lib/usage'
import { checkRateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

interface DeclaracionRequest {
  tipoObra: string
  descripcionObra: string
  propietarioNombre: string
  propietarioRut: string
  direccion: string
  municipio: string
  arquitectoNombre: string
  arquitectoRut: string
  numeroMatricula: string
  superficie?: string
}

export async function POST(request: Request) {
  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

  const body = await request.json() as DeclaracionRequest

  if (!isAIAvailable()) {
    return Response.json({ error: 'OPENAI_API_KEY no configurado' }, { status: 503 })
  }

  const prompt = `Redacta una Declaración Jurada para obra menor conforme al Art. 5.1.2 inciso 2° de la OGUC y la Ley 21.718 vigente en Chile.

La Ley 21.718 (Art. 116 bis LGUC) permite que ciertas obras menores no requieran permiso de edificación, bastando una declaración jurada firmada por el propietario y el arquitecto proyectista.

Datos para la declaración:
- Tipo de obra: ${body.tipoObra}
- Descripción de la obra: ${body.descripcionObra}
- Propietario: ${body.propietarioNombre}, RUT ${body.propietarioRut}
- Dirección: ${body.direccion}, ${body.municipio}
- Arquitecto proyectista: ${body.arquitectoNombre}, RUT ${body.arquitectoRut}, Matrícula ${body.numeroMatricula}
${body.superficie ? `- Superficie de la obra: ${body.superficie} m²` : ''}

Formato requerido:
1. Encabezado formal con título
2. Ciudad y fecha en blanco para completar
3. Identificación del propietario
4. Descripción de la obra y fundamento legal
5. Declaración explícita del propietario sobre cumplimiento OGUC
6. Declaración del arquitecto sobre conformidad técnica
7. Espacios para firma y timbre

El documento debe ser formal, en primera persona para el propietario, citar correctamente los artículos de ley, y estar listo para firmar ante notario. Solo devuelve el texto del documento, sin explicaciones adicionales.`

  try {
    const texto = await aiComplete(
      [{ role: 'user', content: prompt }],
      { max_tokens: 1500 }
    )
    recordUsage(auth.userId, 'ai_chats').catch(console.error)
    return Response.json({ ok: true, texto, source: 'ai' })
  } catch {
    return Response.json({ ok: false, error: 'Error al generar declaración' }, { status: 500 })
  }
}
