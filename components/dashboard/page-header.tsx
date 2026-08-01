"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { esRutaCompartida, inferirModuloDesdeRuta, MODULO_CONFIG, type Modulo } from "@/lib/modulo"

interface Breadcrumb {
  label: string
  href?: string
}

interface PageHeaderProps {
  emoji?: string
  title: string
  subtitle?: string
  breadcrumbs?: Breadcrumb[]
  action?: React.ReactNode
  toolbar?: React.ReactNode
  className?: string
  /** null = ocultar el badge de módulo a la fuerza (usado solo por el hub compartido /dashboard). Sin pasar: se infiere de la ruta. */
  moduloOverride?: Modulo | null
}

// Colores del badge de módulo — variables de página (no las de sidebar.tsx,
// que tiene su propio fondo oscuro invariante y por eso usa oklch literales
// distintos). Ver app/globals.css: --modulo-permisos/--modulo-mercado.
const MODULO_BADGE_CLASSES: Record<Modulo, string> = {
  permisos: "text-modulo-permisos bg-modulo-permisos-subtle",
  "mercado-inmobiliario": "text-modulo-mercado bg-modulo-mercado-subtle",
}

export function PageHeader({
  emoji,
  title,
  subtitle,
  breadcrumbs,
  action,
  toolbar,
  className,
  moduloOverride,
}: PageHeaderProps) {
  const pathname = usePathname()
  const modulo: Modulo | null =
    moduloOverride === null || esRutaCompartida(pathname) ? null : (moduloOverride ?? inferirModuloDesdeRuta(pathname))

  return (
    <div className={cn(
      "shrink-0 border-b border-border bg-card px-8 py-5 relative",
      className
    )}>
      {/* Top accent line */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[oklch(0.28_0.055_158)]/30 to-transparent" />

      {(modulo || (breadcrumbs && breadcrumbs.length > 0)) && (
        <nav className="mb-3 flex items-center gap-1 text-[11px] text-muted-foreground">
          {modulo && (
            <span className={cn(
              "mr-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold tracking-wide uppercase",
              MODULO_BADGE_CLASSES[modulo]
            )}>
              {MODULO_CONFIG[modulo].label}
            </span>
          )}
          {breadcrumbs?.map((b, i) => (
            <span key={b.label} className="flex items-center gap-1">
              {(i > 0 || modulo) && <ChevronRight className="size-3 shrink-0 text-muted-foreground/30" />}
              {b.href ? (
                <Link href={b.href} className="hover:text-primary transition-colors font-medium tracking-wide uppercase">
                  {b.label}
                </Link>
              ) : (
                <span className="font-medium tracking-wide uppercase text-muted-foreground/60">{b.label}</span>
              )}
            </span>
          ))}
        </nav>
      )}

      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          {emoji && (
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/8 border border-primary/12 text-xl leading-none">
              {emoji}
            </div>
          )}
          <div className="min-w-0">
            <h1 className="heading-page truncate text-[22px] text-primary">{title}</h1>
            {subtitle && (
              <p className="mt-0.5 text-[13px] text-muted-foreground leading-relaxed">{subtitle}</p>
            )}
          </div>
        </div>
        {action && <div className="shrink-0 mt-0.5">{action}</div>}
      </div>

      {toolbar && <div className="mt-4">{toolbar}</div>}
    </div>
  )
}
