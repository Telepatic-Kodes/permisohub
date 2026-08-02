import { aiComplete } from '@/lib/ai'
import { aiAuthGuard } from '@/lib/ai-guard'
import { checkRateLimit } from '@/lib/rate-limit'
import { recordUsage } from '@/lib/usage'
import { createClient } from '@/lib/supabase/server'
import { parseAiJson } from '@/lib/ai-parse'
import { obtenerBandasMercadoLocales, obtenerOportunidadesMercadoLocales } from '@/lib/mercado-locales-server'
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

async function construirContextoReal(input: ReporteMercadoInput): Promise<ContextoRealReporte> {
  const operacion = 'arriendo' as const

  const bandas = await obtenerBandasMercadoLocales(input.comuna, operacion)
  const bandaPrecioTexto = bandas
    ? [
        `Banda de precio real (calculada estadísticamente, no adivinada) para locales comerciales en ${
          bandas.usoFallback ? `Región Metropolitana (banda de respaldo — "${input.comuna}" tiene pocos comparables propios)` : bandas.comuna
        }, arriendo, fecha de cálculo ${bandas.statsDate}.`,
        `Tamaño de muestra: N=${bandas.muestraN}.`,
        `UF/m² — P25: ${formatUf(bandas.p25UfM2)} · Mediana: ${formatUf(bandas.medianaUfM2)} · P75: ${formatUf(bandas.p75UfM2)}.`,
        `El KPI de precio DEBE ser la mediana UF/m² de esta banda, con "verificado": true.`,
      ].join(' ')
    : null

  const oportunidades = await obtenerOportunidadesMercadoLocales(operacion, { comuna: input.comuna, limit: 2 })
  const oportunidadesTexto =
    oportunidades.length > 0
      ? oportunidades
          .map((o) => `- "${o.titulo}" en ${o.comuna}, ${formatUf(o.precioUfNormalizado)} UF (${o.reasonCodes.join(', ')}).`)
          .join('\n')
      : null

  let noticiasTexto: string | null = null
  try {
    const supabase = await createClient()
    const { data: noticias } = await supabase
      .from('noticias_mercado')
      .select('titulo, fuente, url')
      .contains('comunas', [input.comuna])
      .order('publicado_el', { ascending: false, nullsFirst: false })
      .limit(3)

    if (noticias && noticias.length > 0) {
      noticiasTexto = noticias.map((n) => `- "${n.titulo as string}" (${n.fuente as string})`).join('\n')
    }
  } catch {
    // best-effort — sin noticias reales, el modelo cae a fuentes genéricas
  }

  const macro = await fetchMacroData()
  const macroTexto = [
    `CONTEXTO MACROECONÓMICO CHILE (dato real, hoy):`,
    `- UF: $${macro.uf.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} CLP`,
    macro.ipc !== null ? `- IPC: ${macro.ipc.toFixed(1)}%` : null,
    macro.dolar !== null ? `- USD/CLP: $${Math.round(macro.dolar).toLocaleString('es-CL')}` : null,
    macro.tpm !== null ? `- TPM: ${macro.tpm.toFixed(2)}%` : null,
  ]
    .filter(Boolean)
    .join('\n')

  const tendenciaConstruccion = await obtenerTendenciaConstruccionComuna(input.comuna).catch(() => null)
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
  const body = (await request.json()) as ReporteMercadoInput

  if (!body.comuna || typeof body.comuna !== 'string' || body.comuna.trim().length === 0) {
    return Response.json({ error: 'Comuna requerida' }, { status: 400 })
  }

  const auth = await aiAuthGuard()
  if (auth instanceof Response) return auth

  const rateLimit = await checkRateLimit(`ai:${auth.userId}`)
  if (rateLimit) return rateLimit

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

    await recordUsage(auth.userId, 'ai_chats')
    return Response.json({ ok: true, ...reporte })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Error desconocido'
    return Response.json({ error: msg }, { status: 500 })
  }
}
