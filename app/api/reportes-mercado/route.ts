import { aiComplete } from '@/lib/ai'
import { aiAuthGuard } from '@/lib/ai-guard'
import { checkRateLimit } from '@/lib/rate-limit'
import { recordUsage } from '@/lib/usage'
import { createClient } from '@/lib/supabase/server'
import { parseAiJson } from '@/lib/ai-parse'
import { obtenerBandasMercadoLocales, obtenerOportunidadesMercadoLocales, obtenerHistorialMedianaUfM2 } from '@/lib/mercado-locales-server'
import { fetchMacroData } from '@/lib/indicadores-macro'
import { obtenerTendenciaConstruccionComuna } from '@/lib/ine-permisos-server'
import {
  SYSTEM_REPORTE_MERCADO,
  ReporteMercadoSchema,
  buildUserQueryReporteMercado,
  type ReporteMercadoInput,
  type ContextoRealReporte,
} from '@/lib/reportes-mercado-prompts'

export const dynamic = 'force-dynamic'
export const maxDuration = 30

function formatUf(n: number | null): string {
  return n != null ? n.toLocaleString('es-CL', { maximumFractionDigits: 2 }) : 'sin dato'
}

async function obtenerNoticiasTexto(comuna: string): Promise<string | null> {
  try {
    const supabase = await createClient()
    const { data: noticias } = await supabase
      .from('noticias_mercado')
      .select('titulo, fuente, url')
      .contains('comunas', [comuna])
      .order('publicado_el', { ascending: false, nullsFirst: false })
      .limit(3)

    if (!noticias || noticias.length === 0) return null
    return noticias.map((n) => `- "${n.titulo as string}" (${n.fuente as string})`).join('\n')
  } catch {
    // best-effort — sin noticias reales, el modelo cae a fuentes genéricas
    return null
  }
}

async function construirContextoReal(input: ReporteMercadoInput): Promise<ContextoRealReporte> {
  const operacion = 'arriendo' as const

  // Las 5 llamadas son independientes entre sí (todas solo dependen de
  // `input`) — corrían en serie dentro de un maxDuration=30, incluyendo la
  // más cara (oportunidades, que escanea listings activos). Promise.all es
  // una ganancia gratis, no un rediseño.
  const [bandas, oportunidades, noticiasTexto, macro, tendenciaConstruccion] = await Promise.all([
    obtenerBandasMercadoLocales(input.comuna, operacion),
    obtenerOportunidadesMercadoLocales(operacion, { comuna: input.comuna, limit: 2 }),
    obtenerNoticiasTexto(input.comuna),
    fetchMacroData(),
    obtenerTendenciaConstruccionComuna(input.comuna).catch(() => null),
  ])

  const bandaPrecioTexto = bandas
    ? [
        `Banda de precio real (calculada estadísticamente, no adivinada) para locales comerciales en ${
          bandas.usoFallback ? `Región Metropolitana (banda de respaldo — "${input.comuna}" tiene pocos comparables propios)` : bandas.comuna
        }, arriendo, fecha de cálculo ${bandas.statsDate}.`,
        `Tamaño de muestra: N=${bandas.muestraN}.`,
        `UF/m² — P25: ${formatUf(bandas.p25UfM2)} · Mediana: ${formatUf(bandas.medianaUfM2)} · P75: ${formatUf(bandas.p75UfM2)}.`,
        bandas.usoFallback
          ? `El KPI de precio DEBE ser la mediana UF/m² de esta banda, con "verificado": false — es una banda de RESPALDO (Región Metropolitana), no de la comuna consultada; dilo explícitamente en el contexto del KPI, nunca la presentes como el dato propio de "${input.comuna}".`
          : `El KPI de precio DEBE ser la mediana UF/m² de esta banda, con "verificado": true.`,
      ].join(' ')
    : null

  const oportunidadesTexto =
    oportunidades.length > 0
      ? oportunidades
          .map((o) => `- "${o.titulo}" en ${o.comuna}, ${formatUf(o.precioUfNormalizado)} UF (${o.reasonCodes.join(', ')}).`)
          .join('\n')
      : null

  const macroTexto = [
    `CONTEXTO MACROECONÓMICO CHILE (dato real, hoy):`,
    `- UF: $${macro.uf.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CLP${
      macro.ufFuente === 'fallback' ? ' — RESPALDO: mindicador.cl no respondió ahora, este NO es el valor de hoy, no lo presentes como tal' : ''
    }`,
    macro.ipc !== null ? `- IPC: ${macro.ipc.toFixed(1)}%` : null,
    macro.dolar !== null ? `- USD/CLP: $${Math.round(macro.dolar).toLocaleString('es-CL')}` : null,
    macro.tpm !== null ? `- TPM: ${macro.tpm.toFixed(2)}%` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const construccionTexto = tendenciaConstruccion
    ? [
        `Superficie construida NO habitacional + mixta (proxy de actividad comercial/industrial) en ${input.comuna}, dato histórico del INE (fuente oficial, licencia CC BY-SA — cita "INE" en fuentes).`,
        `Últimos 3 años con dato (hasta ${tendenciaConstruccion.anioMax}): ${Math.round(tendenciaConstruccion.m2Recientes).toLocaleString('es-CL')} m² construidos.`,
        `3 años anteriores a esos: ${Math.round(tendenciaConstruccion.m2Previos).toLocaleString('es-CL')} m².`,
        tendenciaConstruccion.variacionPct !== null
          ? `Variación: ${tendenciaConstruccion.variacionPct >= 0 ? '+' : ''}${tendenciaConstruccion.variacionPct.toFixed(0)}% → tendencia ${tendenciaConstruccion.tendencia}.`
          : `Sin dato del período anterior para calcular variación — tendencia ${tendenciaConstruccion.tendencia}.`,
        `IMPORTANTE: esto es histórico (el INE no ha publicado años más recientes en este servicio) — nunca lo presentes como actividad "actual" o "de este año".`,
      ].join(' ')
    : null

  return { bandaPrecioTexto, oportunidadesTexto, noticiasTexto, macroTexto, construccionTexto }
}

export async function POST(request: Request) {
  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

  const body = (await request.json().catch(() => ({}))) as ReporteMercadoInput

  if (!body.comuna || typeof body.comuna !== 'string' || body.comuna.trim().length === 0) {
    return Response.json({ error: 'Comuna requerida' }, { status: 400 })
  }
  // max_tokens acota la salida del modelo, no la entrada — un valor de
  // comuna arbitrariamente largo se embebe directo en el prompt (abajo, en
  // el texto de la banda de precio) sin ningún tope.
  if (body.comuna.length > 100) {
    return Response.json({ error: 'Comuna inválida' }, { status: 400 })
  }

  try {
    const contexto = await construirContextoReal(body)
    const userQuery = buildUserQueryReporteMercado(body, contexto)

    const text = await aiComplete(
      [
        { role: 'system', content: SYSTEM_REPORTE_MERCADO },
        { role: 'user', content: userQuery },
      ],
      { max_tokens: 2048, json: true },
    )

    const reporte = parseAiJson(text, ReporteMercadoSchema, 'reportes-mercado') ?? ReporteMercadoSchema.parse({})
    const historialPrecio = await obtenerHistorialMedianaUfM2(body.comuna, 'arriendo').catch(() => [])

    await recordUsage(auth.userId, 'ai_chats')
    return Response.json({ ok: true, ...reporte, historialPrecio })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
