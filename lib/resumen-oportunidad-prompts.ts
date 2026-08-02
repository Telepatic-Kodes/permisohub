// Prompt builders para el resumen ejecutivo IA de una oportunidad individual
// (DETA-06). A diferencia de Tasación/Due Diligence (lib/tasacion-prompts.ts),
// acá NO hay protocolo de búsqueda web — todos los datos (bandas P25/mediana/
// P75, muestra_n, comparables, historial, reasonCodes) ya fueron calculados
// server-side con datos reales antes de llamar a este builder. El prompt
// existe para NARRAR esos números con criterio de inversionista, no para
// generarlos ni completarlos con conocimiento propio del modelo.

export interface ResumenOportunidadContexto {
  titulo: string
  comuna: string
  tipoPropiedadLabel: string
  operacion: 'arriendo' | 'venta'
  precioUf: number
  precioUfM2: number | null
  reasonCodes: string[]
  muestraN: number
  muestraNComuna: number
  usoFallback: boolean
  p25Uf: number | null
  medianaUf: number | null
  p75Uf: number | null
  p25UfM2: number | null
  medianaUfM2: number | null
  p75UfM2: number | null
  diasPublicado: number
  historialResumen: string
  comparables: { titulo: string; comuna: string; precioUf: number; precioUfM2: number | null }[]
  rentabilidadZonaPct: number | null
  senalExpansion: string | null
  tendenciaConstruccion: string | null
}

function num(n: number | null, sufijo = ''): string {
  return n === null ? 'no disponible' : `${n.toLocaleString('es-CL', { maximumFractionDigits: 2 })}${sufijo}`
}

export function buildSystemResumenOportunidad(): string {
  return `Eres un analista de PermisoHub Mercado Inmobiliario. Escribes resúmenes ejecutivos breves para arquitectos/inversionistas que evalúan un local comercial (u oficina/bodega/industrial) como oportunidad de arriendo o venta.

REGLA CRÍTICA — NUNCA busques información externa ni inventes cifras. TODA la información que necesitas ya viene en el mensaje del usuario, estructurada y verificada server-side contra la base de datos real de PermisoHub. Si un dato viene marcado "no disponible", dilo así explícitamente — nunca lo estimes ni lo completes con tu propio conocimiento del mercado chileno.

Responde en español, tono directo tipo "so what" para alguien que decide rápido — NO un informe formal de tasación. Estructura tu respuesta así:

## 🎯 Resumen Ejecutivo
2-4 frases: ¿por qué esta oportunidad califica (o no) como atractiva, según los datos entregados? Cita al menos una cifra real (precio vs. banda, o comparables, o historial).

## Contexto de Mercado
1-2 frases citando la banda de la cohorte (muestra_n, percentiles) y cómo se posiciona el precio.

## Riesgos y Consideraciones
1-2 frases: qué NO se sabe (muestra chica, sin datos de venta/arriendo cruzado, etc.) — nunca minimices la incertidumbre cuando el contexto la señala explícitamente (ej. usoFallback=true, rentabilidadZonaPct=null).

No agregues secciones adicionales. No uses placeholders entre corchetes.`
}

export function buildUserQueryResumenOportunidad(ctx: ResumenOportunidadContexto): string {
  const bandaTexto = ctx.usoFallback
    ? `banda CITYWIDE de respaldo (la comuna solo tiene N=${ctx.muestraNComuna} avisos, bajo el mínimo de 15 para confiar en su propia banda)`
    : `banda propia de la comuna`

  const comparablesTexto = ctx.comparables.length === 0
    ? 'Sin comparables reales disponibles en esta comuna/tipo/operación todavía.'
    : ctx.comparables
        .map((c) => `- ${c.titulo} (${c.comuna}): ${num(c.precioUf, ' UF')}${c.precioUfM2 !== null ? `, ${num(c.precioUfM2, ' UF/m²')}` : ''}`)
        .join('\n')

  return `## Oportunidad a resumir

- Título: ${ctx.titulo}
- Comuna: ${ctx.comuna}
- Tipo de propiedad: ${ctx.tipoPropiedadLabel}
- Operación: ${ctx.operacion}
- Precio: ${num(ctx.precioUf, ' UF')}${ctx.precioUfM2 !== null ? ` (${num(ctx.precioUfM2, ' UF/m²')})` : ' (sin superficie declarada, no hay UF/m²)'}
- Señales activas (reasonCodes): ${ctx.reasonCodes.length > 0 ? ctx.reasonCodes.join(', ') : 'ninguna'}
- Días publicado: ${ctx.diasPublicado}
- Historial de precio: ${ctx.historialResumen}

## Banda de mercado de su cohorte (${bandaTexto})

- Muestra: N=${ctx.muestraN}
- UF — P25: ${num(ctx.p25Uf)}, mediana: ${num(ctx.medianaUf)}, P75: ${num(ctx.p75Uf)}
- UF/m² — P25: ${num(ctx.p25UfM2)}, mediana: ${num(ctx.medianaUfM2)}, P75: ${num(ctx.p75UfM2)}

## Comparables reales en la misma comuna/tipo/operación

${comparablesTexto}

## Rentabilidad implícita de zona

${ctx.rentabilidadZonaPct === null ? 'No calculable — falta cobertura de arriendo y/o venta para esta comuna×tipo.' : `${num(ctx.rentabilidadZonaPct, '%')} (estimado de zona, no del activo específico — estimado con el cap rate neto genérico, ver desglose ya mostrado en la ficha)`}

## Otras señales

- Expansión de cadenas en la comuna: ${ctx.senalExpansion ?? 'sin señal registrada'}
- Tendencia constructiva histórica (INE): ${ctx.tendenciaConstruccion ?? 'sin señal registrada'}`
}
