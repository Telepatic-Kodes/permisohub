import { after } from 'next/server'
import { validateCronSecret } from '@/lib/scraper'
import { tareasDebidasHoy } from '@/lib/cron-dispatch'
import { reportError } from '@/lib/observability'

export const dynamic = 'force-dynamic'
export const maxDuration = 280

// Punto único de entrada de Vercel Cron (ver lib/cron-dispatch.ts para el
// porqué). Decide qué tareas corren hoy y las dispara como invocaciones
// HTTP independientes hacia sus rutas ya existentes, sin esperar a que
// terminen — cada una sigue corriendo con su propio maxDuration en su
// propia invocación de función, así que los presupuestos de tiempo no se
// suman acá.

function baseUrl(): string {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL ?? process.env.VERCEL_URL
  return host ? `https://${host}` : 'http://localhost:3000'
}

async function dispararTarea(path: string): Promise<void> {
  const secret = process.env.CRON_SECRET
  try {
    // Timeout corto a propósito: solo confirma que la invocación arrancó,
    // no esperamos su duración completa (puede ser hasta 280s del lado de
    // la ruta destino). El abort no cancela esa invocación — sigue
    // corriendo en Vercel independiente de que nosotros dejemos de escuchar
    // la respuesta.
    await fetch(`${baseUrl()}${path}`, {
      headers: secret ? { Authorization: `Bearer ${secret}` } : {},
      signal: AbortSignal.timeout(8_000),
    })
  } catch (err) {
    // Un AbortError acá es el caso esperado (timeout intencional), no un
    // fallo real — solo lo reportamos si NO es eso, para no ensuciar los
    // logs con "errores" que en realidad son el diseño funcionando.
    if (!(err instanceof Error && err.name === 'TimeoutError')) {
      reportError(err, { scope: 'cron.dispatch', extra: { path } })
    }
  }
}

export async function GET(request: Request) {
  if (!validateCronSecret(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tareas = tareasDebidasHoy()

  after(async () => {
    for (const tarea of tareas) {
      await dispararTarea(tarea.path)
      if (tarea.staggerMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, tarea.staggerMs))
      }
    }
  })

  return Response.json({
    ok: true,
    timestamp: new Date().toISOString(),
    dispatched: tareas.map((tarea) => tarea.path),
  })
}
