"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  BookMarked,
  Building2,
  Calculator,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  MapPin,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Settings,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/dashboard/theme-toggle"

interface NavItem {
  href: string
  label: string
  icon: LucideIcon
  newHref?: string
  matchPaths?: string[]
}

interface NavGroup {
  label: string | null
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    ],
  },
  {
    label: "Gestión",
    items: [
      { href: "/proyectos", label: "Proyectos", icon: FolderOpen, newHref: "/proyectos/nuevo" },
      { href: "/clientes",  label: "Clientes",  icon: Building2, matchPaths: ["/prospectos"] },
      { href: "/cartera",   label: "Cartera",   icon: BookMarked },
    ],
  },
  {
    label: "Herramientas IA",
    items: [
      { href: "/herramientas", label: "Herramientas IA", icon: Sparkles },
    ],
  },
  {
    label: "Referencia",
    items: [
      { href: "/municipios",               label: "Municipios",  icon: MapPin },
      { href: "/herramientas/calculadora", label: "Calculadora", icon: Calculator },
    ],
  },
  {
    label: "Sistema",
    items: [
      { href: "/documentos",           label: "Documentos",    icon: FileText },
      { href: "/configuracion/equipo", label: "Equipo",        icon: Users },
      { href: "/configuracion",        label: "Configuración", icon: Settings, matchPaths: ["/configuracion/billing", "/configuracion/whatsapp"] },
    ],
  },
]

function isActive(pathname: string, item: NavItem) {
  const paths = [item.href, ...(item.matchPaths ?? [])]
  return paths.some((p) =>
    p === "/" ? pathname === p : pathname === p || pathname.startsWith(`${p}/`)
  )
}

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const onSearchOpen = () => window.dispatchEvent(new CustomEvent("ph:open-palette"))
  const pathname = usePathname()
  const [perfil, setPerfil] = useState<{ nombre?: string; especialidad?: string } | null>(null)

  useEffect(() => {
    fetch('/api/configuracion/perfil')
      .then((r) => r.json())
      .then((d: { perfil?: { nombre?: string; especialidad?: string } }) => {
        if (d.perfil) setPerfil(d.perfil)
      })
      .catch(() => undefined)
  }, [])

  return (
    <aside
      className={cn(
        "group/sidebar fixed inset-y-0 left-0 z-30 flex flex-col transition-[width] duration-200 ease-in-out",
        "bg-[oklch(0.28_0.055_158)] border-r border-white/8",
        collapsed ? "w-14" : "w-60"
      )}
    >
      {/* Logo + Toggle */}
      <div className="relative flex h-[57px] shrink-0 items-center border-b border-white/8 px-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-white/15 ring-1 ring-white/20">
            <span className="text-[10px] font-bold tracking-tight text-white">PH</span>
          </div>
          <div
            className={cn(
              "min-w-0 overflow-hidden transition-all duration-200",
              collapsed ? "w-0 opacity-0" : "w-auto opacity-100"
            )}
          >
            <p className="truncate text-[13px] font-semibold leading-tight text-white">PermisoHub</p>
            <p className="truncate text-[10px] text-white/50">EP Gestión Arquitectónica</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onToggle}
          title={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          className={cn(
            "absolute right-2 flex size-6 items-center justify-center rounded-md text-white/40 transition-all hover:bg-white/10 hover:text-white",
            "opacity-0 group-hover/sidebar:opacity-100",
            collapsed && "opacity-100"
          )}
        >
          {collapsed ? (
            <PanelLeftOpen className="size-4" />
          ) : (
            <PanelLeftClose className="size-4" />
          )}
        </button>
      </div>

      {/* Search chip */}
      <button
        type="button"
        onClick={onSearchOpen}
        title="Buscar (⌘K)"
        className={cn(
          "mx-2 my-2 flex items-center gap-2 rounded-lg border border-white/10 bg-white/8 px-2.5 py-1.5 text-left transition-all hover:bg-white/14 hover:border-white/18",
          collapsed ? "justify-center px-0 border-transparent bg-transparent" : ""
        )}
      >
        <Search className="size-3.5 shrink-0 text-white/50" />
        {!collapsed && (
          <>
            <span className="flex-1 text-xs text-white/40">Buscar...</span>
            <kbd className="text-[10px] text-white/25 font-mono">⌘K</kbd>
          </>
        )}
      </button>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-1">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.label ?? `group-${groupIndex}`} className="mb-1">
            {group.label && !collapsed && (
              <p className="px-2.5 pb-1 pt-3 text-[9px] font-semibold uppercase tracking-[0.12em] text-white/30">
                {group.label}
              </p>
            )}
            {collapsed && group.label && <div className="my-1.5 mx-2 h-px bg-white/10" />}

            {group.items.map((item) => {
              const active = isActive(pathname, item)
              const Icon = item.icon
              return (
                <div key={item.href} className="group/item relative">
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={cn(
                      "relative flex items-center gap-2.5 overflow-hidden rounded-lg px-2.5 py-[7px] text-sm transition-all duration-150",
                      collapsed ? "justify-center px-0 py-2" : "",
                      active
                        ? "bg-white/15 text-white font-medium shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)]"
                        : "text-white/55 hover:bg-white/8 hover:text-white/90"
                    )}
                  >
                    {active && !collapsed && (
                      <span className="absolute inset-y-1.5 left-0 w-[2.5px] rounded-r-full bg-[oklch(0.78_0.16_78)]" />
                    )}
                    <Icon className={cn("size-4 shrink-0", active ? "text-white" : "text-white/50", collapsed && "mx-auto")} />
                    {!collapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </Link>

                  {item.newHref && !collapsed && (
                    <Link
                      href={item.newHref}
                      title={`Nuevo en ${item.label}`}
                      className="absolute right-1 top-1/2 -translate-y-1/2 flex size-5 items-center justify-center rounded-md text-white/30 opacity-0 transition-opacity hover:bg-white/15 hover:text-white group-hover/item:opacity-100"
                    >
                      <Plus className="size-3" />
                    </Link>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="shrink-0 border-t border-white/8 p-2">
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-lg px-2 py-2",
            collapsed ? "justify-center px-0" : "hover:bg-white/8 transition-colors"
          )}
        >
          <Avatar size="sm">
            <AvatarFallback className="bg-[oklch(0.78_0.16_78)] text-[10px] font-bold text-[oklch(0.28_0.055_158)]">
              {perfil?.nombre
                ? perfil.nombre.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()
                : "?"}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-white/90">
                  {perfil?.nombre ?? "Mi perfil"}
                </p>
                <p className="truncate text-[10px] text-white/40">
                  {perfil?.especialidad ?? "Arquitecto/a"}
                </p>
              </div>
              <ThemeToggle />
              <button
                type="button"
                aria-label="Cerrar sesión"
                className="flex size-7 shrink-0 items-center justify-center rounded-md text-white/30 transition-colors hover:bg-white/10 hover:text-white"
              >
                <LogOut className="size-3.5" />
              </button>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}
