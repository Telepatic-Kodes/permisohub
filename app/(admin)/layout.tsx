import Link from "next/link"
import { redirect } from "next/navigation"
import { Building2, Gauge, Receipt, ShieldCheck } from "lucide-react"

import { createClient } from "@/lib/supabase/server"

/**
 * Internal admin panel layout for the PermisoHub outsourcing team.
 *
 * Access is gated by an env-based whitelist (`ADMIN_EMAILS`, comma-separated).
 * Any authenticated user whose email is not whitelisted — and any anonymous
 * visitor — is redirected to `/`. This route group is NOT reachable by customers.
 */

const NAV_ITEMS = [
  { href: "/admin/cuentas", label: "Cuentas", Icon: Building2 },
  { href: "/admin/sla", label: "SLA", Icon: Gauge },
  { href: "/configuracion/billing", label: "Billing", Icon: Receipt },
] as const

function parseAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const whitelist = parseAdminEmails()
  const email = user?.email?.toLowerCase()

  if (!email || !whitelist.includes(email)) {
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
