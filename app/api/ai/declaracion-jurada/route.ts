import { isAIAvailable, aiComplete } from '@/lib/ai'

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
  const body = await request.json() as DeclaracionRequest

  if (!isAIAvailable()) {
    return Response.json({
      ok: true,
      texto: generateMockDeclaracion(body),
      source: 'mock',
    })
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
    return Response.json({ ok: true, texto, source: 'ai' })
  } catch {
    return Response.json({ ok: false, error: 'Error al generar declaración' }, { status: 500 })
  }
}

function generateMockDeclaracion(body: DeclaracionRequest): string {
  const fechaActual = new Date().toLocaleDateString('es-CL', {
    day: '2-digit', month: 'long', year: 'numeric',
  })

  return `DECLARACIÓN JURADA
OBRA MENOR — LEY 21.718 / ART. 5.1.2 OGUC

${body.municipio}, ____ de ____________ de ______

Yo, ${body.propietarioNombre}, Rut ${body.propietarioRut}, en calidad de propietario del inmueble ubicado en ${body.direccion}, ${body.municipio}, declaro bajo juramento lo siguiente:

PRIMERO: Que con fecha ____/____/______ se iniciará la ejecución de obras de ${body.tipoObra}, consistentes en ${body.descripcionObra}, en el inmueble de mi dominio antes singularizado.

SEGUNDO: Que las obras descritas corresponden a obras menores que no requieren permiso de edificación en virtud del artículo 116 bis de la Ley General de Urbanismo y Construcciones (Ley 21.718) y del artículo 5.1.2 inciso 2° de la Ordenanza General de Urbanismo y Construcciones (OGUC).

TERCERO: Que las obras a ejecutar cumplirán íntegramente con las disposiciones de la Ordenanza General de Urbanismo y Construcciones, y en especial con las normas técnicas de seguridad estructural, habitabilidad y accesibilidad universal que resulten aplicables.

CUARTO: Que el proyecto ha sido elaborado por el arquitecto proyectista que a continuación declara su conformidad técnica.

DECLARACIÓN DEL ARQUITECTO PROYECTISTA

Yo, ${body.arquitectoNombre}, Rut ${body.arquitectoRut}, arquitecto inscrito en el Registro Nacional de Profesionales del Ministerio de Vivienda y Urbanismo bajo el N° ${body.numeroMatricula}, declaro que las obras de ${body.tipoObra} descritas en la presente Declaración Jurada son técnicamente conformes a la Ordenanza General de Urbanismo y Construcciones vigente y a las demás normas técnicas aplicables.

El suscrito asume la responsabilidad profesional que le compete de acuerdo a la Ley General de Urbanismo y Construcciones y al Código de Ética del Colegio de Arquitectos de Chile A.G.

_________________________          _________________________
${body.propietarioNombre}              ${body.arquitectoNombre}
RUT: ${body.propietarioRut}                  RUT: ${body.arquitectoRut}
Propietario                               Arquitecto Proyectista
                                          Mat. ${body.numeroMatricula}

Firmado ante Notario ____________________________
Notaría: ________________________________________
Fecha: ${fechaActual}

NOTA: Este documento no reemplaza al permiso de edificación cuando la naturaleza de las obras lo requiera. Verificar con la DOM de ${body.municipio} si las obras específicas se encuentran comprendidas en las exenciones del Art. 5.1.2 OGUC.`
}
