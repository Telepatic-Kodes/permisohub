import Link from "next/link"

export default function PortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F9F7F3]">
      {/* Minimal header */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-white px-6 sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <div className="flex size-7 items-center justify-center rounded-lg bg-primary">
            <span className="text-[10px] font-bold tracking-tight text-white">PH</span>
          </div>
          <div>
            <p className="text-[13px] font-semibold text-primary leading-none">PermisoHub</p>
            <p className="text-[9px] text-muted-foreground/60 mt-0.5">Portal de cliente</p>
          </div>
        </div>
        <Link
          href="/dashboard"
          className="text-xs text-muted-foreground hover:text-primary transition-colors"
        >
          Panel completo →
        </Link>
      </header>
      {children}
    </div>
  )
}
