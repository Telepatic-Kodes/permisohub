import Link from "next/link"
import { redirect } from "next/navigation"
import { BarChart2, Building2, Gauge, Receipt, ShieldCheck } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { esAdminPlataforma } from "@/lib/admin-plataforma"

/**
 * Consola interna del equipo que opera el servicio.
 *
 * El acceso se controla por lista de correos en variable de entorno
 * (ADMIN_EMAILS), no por rol en base de datos: no es algo que un cliente pueda
 * otorgarse a sí mismo. Quien no esté en la lista —o no tenga sesión— vuelve a
 * la raíz. Este grupo de rutas NO es alcanzable por clientes.
 */

const NAV_ITEMS = [
  { href: "/admin", label: "Métricas", Icon: BarChart2 },
  { href: "/admin/cuentas", label: "Cuentas", Icon: Building2 },
  { href: "/admin/sla", label: "SLA", Icon: Gauge },
  { href: "/admin/billing", label: "Facturación", Icon: Receipt },
] as const

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const email = user?.email?.toLowerCase()

  if (!esAdminPlataforma(email)) {
    redirect("/")
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Dark green admin sidebar — visually distinct from the customer dashboard */}
      <aside className="fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-[oklch(0.22_0.045_158)] text-white/90">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-white/10">
            <ShieldCheck className="size-4 text-white" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold text-white">PermisoHub</p>
            <span className="inline-flex items-center rounded-full bg-amber-400/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[oklch(0.22_0.045_158)]">
              Admin
            </span>
          </div>
        </div>

        <nav className="mt-2 flex flex-col gap-0.5 px-3">
          {NAV_ITEMS.map(({ href, label, Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/75 transition-colors hover:bg-white/10 hover:text-white"
            >
              <Icon className="size-4 shrink-0" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto px-5 py-4">
          <p className="truncate text-[11px] text-white/40">{email}</p>
          <Link
            href="/dashboard"
            className="mt-1 inline-block text-[11px] text-white/60 underline-offset-2 transition-colors hover:text-white hover:underline"
          >
            ← Volver al dashboard
          </Link>
        </div>
      </aside>

      <main className="flex min-h-screen flex-col overflow-auto pl-60">
        {children}
      </main>
    </div>
  )
}
