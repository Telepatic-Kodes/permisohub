export const dynamic = 'force-dynamic'

import { obtenerUfActual } from '@/lib/uf-server'

// El fetch, la caché y el fallback viven en lib/uf-server.ts desde el 06-08:
// consultarRolEnSII() también necesita la UF y no puede hacerse un self-fetch a
// esta ruta. Acá queda solo la traducción al contrato HTTP, que NO cambió — lo
// consumen 5 vistas del dashboard y el copiloto.
export async function GET() {
  const uf = await obtenerUfActual()

  if (uf.fallback) {
    return Response.json({ ok: false, valor: uf.valor, fecha: null, error: uf.error, fallback: true })
  }
  return Response.json({ ok: true, valor: uf.valor, fecha: uf.fecha, cached: uf.cached })
}
