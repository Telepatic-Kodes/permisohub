import type { ToolDefinition } from '@/lib/ai'
import { obtenerBandasMercadoLocales, obtenerOportunidadesMercadoLocales } from '@/lib/mercado-locales-server'
import { obtenerInstrumentosIptPorComuna } from '@/lib/instrumentos-ipt-server'
import { fetchMacroData } from '@/lib/indicadores-macro'
import type { OperacionMercadoLocal, TipoPropiedadComercial } from '@/lib/scrapers/mercado-locales-common'

// ---------------------------------------------------------------------------
// Copiloto de Mercado Inmobiliario — primer uso de function/tool-calling en
// PermisoHub. En vez de que la IA "sepa" precios de memoria o los adivine
// (como el asesor chat genérico descartado en la investigación de Fase 3),
// el modelo decide QUÉ función real llamar según la pregunta del usuario, y
// solo puede responder con los números que esas funciones ya calculan y
// verifican — exactamente el mismo principio de "nunca inventar un dato"
// que ya rige tasación/pricing/reportes-mercado, aplicado ahora a una
// interfaz conversacional en vez de un formulario de una sola pantalla.
// ---------------------------------------------------------------------------

const TIPOS_PROPIEDAD_VALIDOS: TipoPropiedadComercial[] = ['local_comercial', 'oficina', 'bodega', 'industrial']

export const HERRAMIENTAS_COPILOTO_MERCADO: ToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'consultar_banda_precio',
      description:
        'Banda de precio real (P25/mediana/P75, en UF y UF/m²) para arriendo o venta de un tipo de propiedad comercial en una comuna, calculada a diario desde listados activos de Portalinmobiliario.',
      parameters: {
        type: 'object',
        properties: {
          comuna: { type: 'string', description: 'Nombre de la comuna, ej. "Las Condes"' },
          operacion: { type: 'string', enum: ['arriendo', 'venta'] },
          tipoPropiedad: {
            type: 'string',
            enum: TIPOS_PROPIEDAD_VALIDOS,
            description: 'Default local_comercial si el usuario no especifica oficina/bodega/industrial',
          },
        },
        required: ['comuna', 'operacion'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_oportunidades',
      description:
        'Locales/oficinas/bodegas activos hoy con precio bajo el P25 de su cohorte, o con baja de precio en los últimos 7 días — datos reales, no estimados.',
      parameters: {
        type: 'object',
        properties: {
          operacion: { type: 'string', enum: ['arriendo', 'venta'] },
          comuna: { type: 'string', description: 'Opcional — si no se da, busca en todas las comunas cubiertas' },
          tipoPropiedad: { type: 'string', enum: TIPOS_PROPIEDAD_VALIDOS },
        },
        required: ['operacion'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_vigencia_prc',
      description:
        'Estado legal real (Vigente / En Desarrollo / Derogado / Desistido) de los Instrumentos de Planificación Territorial (Plan Regulador Comunal y sus modificaciones/seccionales) que cubren una comuna, sincronizado desde Portal IPT (MINVU).',
      parameters: {
        type: 'object',
        properties: {
          comuna: { type: 'string', description: 'Nombre de la comuna, ej. "Ñuñoa"' },
        },
        required: ['comuna'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'consultar_indicadores_macro',
      description: 'Valor actual de UF, IPC, TPM y dólar — indicadores macroeconómicos chilenos en vivo.',
      parameters: { type: 'object', properties: {} },
    },
  },
]

function esOperacionValida(v: unknown): v is OperacionMercadoLocal {
  return v === 'arriendo' || v === 'venta'
}

function tipoPropiedadOdefault(v: unknown): TipoPropiedadComercial {
  return TIPOS_PROPIEDAD_VALIDOS.includes(v as TipoPropiedadComercial) ? (v as TipoPropiedadComercial) : 'local_comercial'
}

/**
 * Ejecuta la herramienta que el modelo pidió llamar. Nunca lanza — un error
 * (argumentos inválidos, o la función real devolviendo null/[]) se traduce
 * en un resultado que el modelo puede leer y explicar honestamente al
 * usuario ("sin datos para esa comuna todavía"), nunca en una excepción que
 * rompa la ronda de tool-calling completa.
 */
export async function ejecutarHerramientaCopilotoMercado(nombre: string, args: unknown): Promise<unknown> {
  const a = (args ?? {}) as Record<string, unknown>

  try {
    switch (nombre) {
      case 'consultar_banda_precio': {
        if (typeof a.comuna !== 'string' || !esOperacionValida(a.operacion)) {
          return { error: 'Faltan comuna u operación (arriendo|venta) válidas' }
        }
        const bandas = await obtenerBandasMercadoLocales(a.comuna, a.operacion, tipoPropiedadOdefault(a.tipoPropiedad))
        return bandas ?? { error: `Sin datos de mercado todavía para ${a.comuna}` }
      }

      case 'consultar_oportunidades': {
        if (!esOperacionValida(a.operacion)) return { error: 'Falta operación (arriendo|venta) válida' }
        const oportunidades = await obtenerOportunidadesMercadoLocales(a.operacion, {
          comuna: typeof a.comuna === 'string' ? a.comuna : undefined,
          tipoPropiedad: a.tipoPropiedad ? tipoPropiedadOdefault(a.tipoPropiedad) : undefined,
          limit: 10,
        })
        return { total: oportunidades.length, oportunidades }
      }

      case 'consultar_vigencia_prc': {
        if (typeof a.comuna !== 'string') return { error: 'Falta comuna' }
        const instrumentos = await obtenerInstrumentosIptPorComuna(a.comuna)
        // Acotado a los más relevantes — igual criterio que la UI de /municipios/[id]:
        // el modelo no necesita las decenas de modificaciones menores para responder.
        return { total: instrumentos.length, instrumentos: instrumentos.slice(0, 8) }
      }

      case 'consultar_indicadores_macro':
        return await fetchMacroData()

      default:
        return { error: `Herramienta desconocida: ${nombre}` }
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Error al consultar el dato' }
  }
}

export const SYSTEM_PROMPT_COPILOTO_MERCADO = `Eres PermisoHub Mercado, el copiloto de inteligencia de mercado inmobiliario comercial (locales, oficinas, bodegas, naves industriales) para el equipo de PermisoHub en Chile.

Tienes acceso a herramientas que consultan datos REALES ya calculados/sincronizados por el sistema: bandas de precio (P25/mediana/P75 desde listados activos), oportunidades bajo el P25, estado legal de Planes Reguladores (Portal IPT/MINVU), e indicadores macro.

REGLA CRÍTICA E INQUEBRANTABLE: nunca declares un precio, una banda, un estado legal o un indicador que no venga de una llamada a una herramienta. Si la pregunta requiere un dato que ninguna herramienta cubre (ej. una comuna sin datos, o un tipo de propiedad no soportado), dilo explícitamente en vez de estimarlo o inventarlo.

Cuidado específico con consultar_banda_precio: el resultado trae \`muestraN\` (el tamaño de muestra REAL detrás de los números p25Uf/medianaUf/p75Uf que estás reportando) y, por separado, \`muestraNComuna\` (el tamaño de muestra propio de la comuna, que solo explica por qué se usó o no un respaldo metropolitano — NO es el N de los números reportados cuando usoFallback es true). Si usoFallback es true, di explícitamente que la banda es un respaldo a nivel Región Metropolitana con N=muestraN, y menciona muestraNComuna solo para explicar por qué la comuna no tuvo suficiente data propia. Nunca reportes muestraNComuna como si fuera el tamaño de muestra de la banda citada.

Cómo trabajar:
- Si la pregunta menciona una comuna + arriendo/venta de un tipo de propiedad → usa consultar_banda_precio.
- Si pregunta por "oportunidades", "gangas", o "qué está bajo el precio de mercado" → usa consultar_oportunidades.
- Si pregunta si un Plan Regulador está "vigente", "derogado", "en trámite", o por el estado normativo de una comuna → usa consultar_vigencia_prc.
- Si pregunta por UF, IPC, TPM o dólar → usa consultar_indicadores_macro.
- Puedes llamar más de una herramienta si la pregunta lo requiere (ej. "compárame Las Condes vs Providencia para oficinas en arriendo").
- Si una herramienta devuelve "sin datos" o un error, comunícalo con honestidad — nunca lo rellenes con una estimación propia.

Formato de respuesta:
- Español, tono profesional y directo, sin relleno.
- Cuando cites una banda de precio, sé explícito con el tamaño de muestra (N) y si es dato de la comuna o un respaldo metropolitano (usoFallback).
- Cuando cites vigencia de un instrumento, di el nombre exacto y el estado tal cual viene del dato (Vigente/En Desarrollo/Derogado/Desistido).
- Nunca mezcles avalúo fiscal, banda de mercado, y estado normativo como si fueran el mismo tipo de número — son señales distintas.`
