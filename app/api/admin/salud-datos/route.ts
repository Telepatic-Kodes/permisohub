import { createClient } from "@/lib/supabase/server"

export const dynamic = "force-dynamic"

/**
 * Últimas corridas de scrapers/crons — consumido por
 * app/(admin)/admin/salud-datos/page.tsx (Torre de Control, checkpoint B).
 *
 * Sin agregados en el servidor a propósito: se traen las últimas N filas
 * crudas y la página las agrupa por `source_id` en el cliente — mantiene
 * esta ruta simple mientras el volumen de `data_source_runs` sea chico.
 */
export interface DataSourceRunRow {
  id: number
  source_id: string
  status: "ok" | "error"
  row_count: number | null
  error_message: string | null
  ran_at: string
}

const LIMITE_FILAS = 200

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("data_source_runs")
    .select("id, source_id, status, row_count, error_message, ran_at")
    .order("ran_at", { ascending: false })
    .limit(LIMITE_FILAS)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ runs: (data ?? []) as DataSourceRunRow[] })
}
