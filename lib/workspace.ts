import type { SupabaseClient } from "@supabase/supabase-js"

// ---------------------------------------------------------------------------
// Resolución del workspace del usuario.
//
// Existe porque las rutas de equipo usaban `user.id` COMO workspace_id, que
// solo funciona en el caso degenerado en que coincidan. El workspace real vive
// en workspace_members y hay que buscarlo.
//
// Todo dato de la app cuelga de un workspace: es lo que permite que dos
// personas vean el mismo expediente (ver supabase/migrations/
// 20260731_workspace_compartir.sql).
// ---------------------------------------------------------------------------

export type RolWorkspace = "admin" | "arquitecto" | "viewer"

export interface WorkspaceActual {
  id: string
  rol: RolWorkspace
}

/**
 * Workspace al que pertenece el usuario. `null` si aún no tiene ninguno — el
 * llamador decide si crearlo o rechazar la operación.
 */
export async function getWorkspaceActual(
  supabase: SupabaseClient,
  userId: string,
): Promise<WorkspaceActual | null> {
  const { data } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .order("joined_at", { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!data?.workspace_id) return null
  return { id: data.workspace_id as string, rol: (data.role as RolWorkspace) ?? "viewer" }
}

/**
 * Igual que el anterior, pero crea el workspace si falta. Se usa al crear el
 * primer proyecto o al abrir Equipo: nadie debería quedarse sin workspace por
 * haberse registrado antes de que existiera esta noción.
 */
export async function asegurarWorkspace(
  supabase: SupabaseClient,
  userId: string,
  nombreSugerido?: string | null,
): Promise<WorkspaceActual> {
  const existente = await getWorkspaceActual(supabase, userId)
  if (existente) return existente

  const { data: ws, error: errWs } = await supabase
    .from("workspaces")
    .insert({ nombre: nombreSugerido?.trim() || "Mi estudio", tipo: "estudio", owner_id: userId })
    .select("id")
    .single()
  if (errWs || !ws) throw new Error(errWs?.message ?? "No se pudo crear el workspace")

  const { error: errMiembro } = await supabase
    .from("workspace_members")
    .insert({ workspace_id: ws.id, user_id: userId, role: "admin" })
  if (errMiembro) throw new Error(errMiembro.message)

  return { id: ws.id as string, rol: "admin" }
}
