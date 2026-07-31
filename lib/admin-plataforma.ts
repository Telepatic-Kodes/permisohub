// ---------------------------------------------------------------------------
// Administrador de PLATAFORMA — el equipo que opera el servicio.
//
// Es un concepto distinto del admin de workspace: aquel gestiona la cuenta de
// UN cliente (workspace_members.role = 'admin'); este ve todas las cuentas,
// los SLA y la facturación. Por eso no vive en la base de datos sino en una
// variable de entorno: no es un rol que un cliente pueda otorgarse.
//
// Antes había dos gates distintos para lo mismo — ADMIN_EMAIL (singular) en
// esta app y ADMIN_EMAILS (plural) en la app de outsourcing. Aquí se unifican;
// se acepta la forma singular para no romper la configuración existente.
// ---------------------------------------------------------------------------

export function adminsPlataforma(): string[] {
  const plural = process.env.ADMIN_EMAILS ?? ""
  const singular = process.env.ADMIN_EMAIL ?? ""
  return [...plural.split(","), singular]
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

/**
 * `false` cuando no hay ninguna configurada: sin lista explícita nadie entra,
 * que es lo correcto para una consola interna. Si la consola aparece vacía en
 * producción, lo que falta es definir ADMIN_EMAILS.
 */
export function esAdminPlataforma(email: string | null | undefined): boolean {
  if (!email) return false
  const lista = adminsPlataforma()
  if (lista.length === 0) return false
  return lista.includes(email.toLowerCase())
}
