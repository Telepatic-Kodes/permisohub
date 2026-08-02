import { createClient } from "@/lib/supabase/server"
import { SLA_METAS } from "@/lib/sla-config"
import { esAdminPlataforma } from "@/lib/admin-plataforma"

export const dynamic = "force-dynamic"

/**
 * SLA per-cadena summary — consumed by the internal admin SLA board.
 *
 * `CadenaSLA = { cadena_id, cadena_nombre, avg_dias_ingreso,
 *                proyectos_sin_expediente, obs_pendientes, sla_ok }`
 */
export interface CadenaSLA {
  cadena_id: string
  cadena_nombre: string
  /** Promedio de días entre `fecha_inicio` y la asignación de expediente DOM. */
  avg_dias_ingreso: number
  /** Proyectos sin `numero_expediente` con más de 7 días de antigüedad. */
  proyectos_sin_expediente: number
  /** Observaciones de DOM en estado `pendiente`. */
  obs_pendientes: number
  /** true si cumple todas las metas SLA. */
  sla_ok: boolean
}

/** Fila mínima de proyecto necesaria para el cálculo SLA. */
interface ProyectoSLARow {
  cadena_id: string | null
  cadena_nombre: string | null
  fecha_inicio: string | null
  numero_expediente: string | null
  fecha_expediente: string | null
}

const DAY_MS = 24 * 60 * 60 * 1000

function diffDays(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00`).getTime()
  const b = new Date(`${to}T00:00:00`).getTime()
  return Math.max(0, Math.round((b - a) / DAY_MS))
}

function daysSince(from: string): number {
  const a = new Date(`${from}T00:00:00`).getTime()
  return Math.max(0, Math.round((Date.now() - a) / DAY_MS))
}

/**
 * Agrupa proyectos por cadena y computa las métricas SLA.
 * Las observaciones pendientes se reciben pre-agregadas por cadena.
 */
function buildSLA(
  rows: ProyectoSLARow[],
  obsPorCadena: Map<string, number>,
): CadenaSLA[] {
  const groups = new Map<
    string,
    { nombre: string; ingresoDias: number[]; sinExpediente: number }
  >()

  for (const row of rows) {
    if (!row.cadena_id) continue
    const g =
      groups.get(row.cadena_id) ??
      { nombre: row.cadena_nombre ?? "Cadena", ingresoDias: [], sinExpediente: 0 }

    if (row.numero_expediente && row.fecha_inicio && row.fecha_expediente) {
      g.ingresoDias.push(diffDays(row.fecha_inicio, row.fecha_expediente))
    } else if (
      !row.numero_expediente &&
      row.fecha_inicio &&
      daysSince(row.fecha_inicio) > SLA_METAS.ingreso_dom_dias
    ) {
      g.sinExpediente += 1
    }

    groups.set(row.cadena_id, g)
  }

  const result: CadenaSLA[] = []
  for (const [cadena_id, g] of groups) {
    const avg =
      g.ingresoDias.length > 0
        ? Math.round(
            g.ingresoDias.reduce((a, b) => a + b, 0) / g.ingresoDias.length,
          )
        : 0
    const obs = obsPorCadena.get(cadena_id) ?? 0
    const sla_ok =
      avg <= SLA_METAS.ingreso_dom_dias && g.sinExpediente === 0 && obs === 0
    result.push({
      cadena_id,
      cadena_nombre: g.nombre,
      avg_dias_ingreso: avg,
      proyectos_sin_expediente: g.sinExpediente,
      obs_pendientes: obs,
      sla_ok,
    })
  }
  return result
}

/** Datos de ejemplo (3 cadenas con escenarios SLA realistas). */
function mockSLA(): CadenaSLA[] {
  return [
    {
      cadena_id: "cad-1",
      cadena_nombre: "Falabella Retail",
      avg_dias_ingreso: 5,
      proyectos_sin_expediente: 0,
      obs_pendientes: 0,
      sla_ok: true,
    },
    {
      cadena_id: "cad-2",
      cadena_nombre: "Cencosud Shopping",
      avg_dias_ingreso: 9,
      proyectos_sin_expediente: 2,
      obs_pendientes: 1,
      sla_ok: false,
    },
    {
      cadena_id: "cad-3",
      cadena_nombre: "Parque Arauco",
      avg_dias_ingreso: 7,
      proyectos_sin_expediente: 0,
      obs_pendientes: 3,
      sla_ok: false,
    },
  ]
}

export async function GET() {
  const supabase = await createClient()

  // Mismo gap que salud-datos: la página en app/(admin)/ está protegida por
  // su layout, pero esta API no tenía ningún chequeo propio — cualquier
  // usuario autenticado podía leer el estado de SLA por cadena enterprise.
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user || !esAdminPlataforma(user.email)) {
    return Response.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const { data: proyectos, error } = await supabase
      .from("proyectos")
      .select("cadena_id, fecha_inicio, numero_expediente, fecha_expediente, cadena:cadenas(nombre)")

    if (error) throw error
    if (!proyectos || proyectos.length === 0) {
      return Response.json({ cadenas: mockSLA(), source: "mock" })
    }

    const rows: ProyectoSLARow[] = proyectos.map((p) => {
      const cadena = p.cadena as { nombre?: string } | { nombre?: string }[] | null
      const nombre = Array.isArray(cadena) ? cadena[0]?.nombre : cadena?.nombre
      return {
        cadena_id: (p.cadena_id as string | null) ?? null,
        cadena_nombre: nombre ?? null,
        fecha_inicio: (p.fecha_inicio as string | null) ?? null,
        numero_expediente: (p.numero_expediente as string | null) ?? null,
        fecha_expediente: (p.fecha_expediente as string | null) ?? null,
      }
    })

    // Observaciones pendientes agrupadas por cadena (via su proyecto).
    const obsPorCadena = new Map<string, number>()
    const { data: obs } = await supabase
      .from("observaciones")
      .select("estado, proyecto:proyectos(cadena_id)")
      .eq("estado", "pendiente")

    for (const o of obs ?? []) {
      const proyecto = o.proyecto as { cadena_id?: string } | { cadena_id?: string }[] | null
      const cid = Array.isArray(proyecto) ? proyecto[0]?.cadena_id : proyecto?.cadena_id
      if (!cid) continue
      obsPorCadena.set(cid, (obsPorCadena.get(cid) ?? 0) + 1)
    }

    const cadenas = buildSLA(rows, obsPorCadena)
    if (cadenas.length === 0) {
      return Response.json({ cadenas: mockSLA(), source: "mock" })
    }
    return Response.json({ cadenas, source: "db" })
  } catch (err) {
    // Antes esto caía a mockSLA() ante CUALQUIER falla (caída de DB, drift
    // de esquema en `proyectos`) — el board mostraba "Falabella Retail —
    // SLA ok" con números inventados, indistinguible a simple vista de un
    // estado real (el campo `source:"mock"` existe pero nadie lo mira en
    // una conversación de SLA con un cliente enterprise). Una consulta que
    // falla debe fallar visible, no disfrazarse de dato real.
    const msg = err instanceof Error ? err.message : "Error desconocido"
    return Response.json({ error: `No se pudo calcular el SLA: ${msg}` }, { status: 500 })
  }
}
