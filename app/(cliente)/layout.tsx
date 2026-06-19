import Link from "next/link"

const BRAND_GREEN = "#1A3328"

export default function ClienteLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header
        className="w-full"
        style={{ backgroundColor: BRAND_GREEN }}
      >
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/portal" className="flex flex-col leading-tight">
            <span className="text-lg font-semibold tracking-tight text-white">
              PermisoHub
            </span>
            <span className="text-xs text-white/70">
              Portal de seguimiento de permisos
            </span>
          </Link>
          <span className="rounded-full border border-white/20 px-3 py-1 text-xs font-medium text-white/90">
            Portal Cliente
          </span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  )
}
