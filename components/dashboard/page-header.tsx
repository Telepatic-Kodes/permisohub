"use client"

import Link from "next/link"
import { ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"

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
}

export function PageHeader({
  emoji,
  title,
  subtitle,
  breadcrumbs,
  action,
  toolbar,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn(
      "shrink-0 border-b border-border bg-white px-8 py-5 relative",
      className
    )}>
      {/* Top accent line */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-[oklch(0.28_0.055_158)]/30 to-transparent" />

      {breadcrumbs && breadcrumbs.length > 0 && (
        <nav className="mb-3 flex items-center gap-1 text-[11px] text-muted-foreground">
          {breadcrumbs.map((b, i) => (
            <span key={b.label} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="size-3 shrink-0 text-muted-foreground/30" />}
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
