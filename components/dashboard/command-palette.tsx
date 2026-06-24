"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  BarChart2,
  BookText,
  Building2,
  Calculator,
  CalendarClock,
  CreditCard,
  FileSearch,
  FileText,
  FolderOpen,
  LayoutDashboard,
  MapPin,
  MessageCircle,
  MessageSquare,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Target,
  TrendingUp,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { MOCK_PROYECTOS, MOCK_CLIENTES } from "@/lib/mock-data"
import { getCommandContext } from "@/hooks/use-command-context"

interface CommandItem {
  id: string
  group: string
  label: string
  sublabel?: string
  href: string
  icon: LucideIcon
  emoji?: string
}

const NAV_ITEMS: CommandItem[] = [
  { id: "nav-dashboard",    group: "Navegar",      label: "Dashboard",           href: "/dashboard",                    icon: LayoutDashboard, emoji: "🏠" },
  { id: "nav-proyectos",    group: "Navegar",      label: "Proyectos",           href: "/proyectos",                    icon: FolderOpen,      emoji: "📁" },
  { id: "nav-clientes",     group: "Navegar",      label: "Clientes",            href: "/clientes",                     icon: Building2,       emoji: "🏢" },
  { id: "nav-prospectos",   group: "Navegar",      label: "CRM / Prospectos",    href: "/prospectos",                   icon: TrendingUp,      emoji: "📈" },
  { id: "nav-municipios",   group: "Navegar",      label: "Municipios",          href: "/municipios",                   icon: MapPin,          emoji: "📍" },
  { id: "nav-oguc",         group: "IA Normativa", label: "Chat OGUC",           href: "/herramientas/oguc-chat",       icon: MessageSquare,   emoji: "💬" },
  { id: "nav-verificador",  group: "IA Normativa", label: "Verificador OGUC",    href: "/herramientas/compliance-check",icon: ShieldCheck,     emoji: "🔍" },
  { id: "nav-checklist",    group: "IA Normativa", label: "Checklist Normativo", href: "/herramientas/checklist",       icon: Wrench,          emoji: "✅" },
  { id: "nav-inteldom",     group: "IA Normativa", label: "Inteligencia DOM",    href: "/herramientas/municipios",      icon: BarChart2,       emoji: "🏛️" },
  { id: "nav-predictor",    group: "IA Normativa", label: "Predictor de Riesgo", href: "/herramientas/predictor",       icon: Target,          emoji: "🎯" },
  { id: "nav-auditor",      group: "IA Normativa", label: "Auditor de Expediente", href: "/herramientas/auditor",      icon: FileSearch,      emoji: "📁" },
  { id: "nav-memoria",      group: "IA Normativa", label: "Memoria Descriptiva",  href: "/herramientas/memoria",        icon: BookText,        emoji: "📝" },
  { id: "nav-timeline",     group: "IA Normativa", label: "Timeline de Aprobación", href: "/herramientas/timeline",    icon: CalendarClock,   emoji: "📅" },
  { id: "nav-calc",         group: "IA Normativa", label: "Calculadora derechos",href: "/herramientas/calculadora",     icon: Calculator,      emoji: "🧮" },
  { id: "nav-whatsapp",     group: "IA Normativa", label: "WhatsApp",            href: "/configuracion/whatsapp",       icon: MessageCircle,   emoji: "📱" },
  { id: "nav-docs",         group: "Documentos",   label: "Pitch & Modelo negocio",href: "/documentos",                icon: FileText,        emoji: "📄" },
  { id: "nav-billing",      group: "Configuración",label: "Facturación",         href: "/configuracion/billing",        icon: CreditCard,      emoji: "💳" },
  { id: "nav-config",       group: "Configuración",label: "Configuración",       href: "/configuracion",                icon: Settings,        emoji: "⚙️" },
]

const ACTION_ITEMS: CommandItem[] = [
  { id: "act-nuevo-proyecto", group: "Crear", label: "Nuevo proyecto", href: "/proyectos/nuevo", icon: Plus, emoji: "➕" },
]

function buildDynamicItems(): CommandItem[] {
  const projects: CommandItem[] = MOCK_PROYECTOS.map((p) => ({
    id: `p-${p.id}`,
    group: "Proyectos",
    label: p.nombre,
    sublabel: p.cliente?.nombre ?? p.municipio,
    href: `/proyectos/${p.id}`,
    icon: FolderOpen,
    emoji: "📄",
  }))

  const clients: CommandItem[] = MOCK_CLIENTES.map((c) => ({
    id: `c-${c.id}`,
    group: "Clientes",
    label: c.nombre,
    sublabel: c.contacto_nombre,
    href: `/clientes/${c.id}`,
    icon: Building2,
    emoji: "🏢",
  }))

  return [...projects, ...clients]
}

const ALL_ITEMS: CommandItem[] = [...NAV_ITEMS, ...ACTION_ITEMS, ...buildDynamicItems()]

const GROUP_ORDER = ["Este proyecto", "Navegar", "Crear", "Proyectos", "Clientes", "IA Normativa", "Documentos", "Configuración"]

function buildContextItems(proyectoId: string, proyectoNombre: string, municipio: string): CommandItem[] {
  return [
    { id: "ctx-predictor", group: "Este proyecto", label: `Analizar riesgo: ${proyectoNombre}`, sublabel: municipio, href: `/herramientas/predictor`, icon: Target, emoji: "🎯" },
    { id: "ctx-obs",       group: "Este proyecto", label: "Gestionar observaciones",            sublabel: proyectoNombre, href: `/proyectos/${proyectoId}/observaciones`, icon: FileText, emoji: "📋" },
    { id: "ctx-wa",        group: "Este proyecto", label: "Notificar cliente por WhatsApp",     sublabel: proyectoNombre, href: `/proyectos/${proyectoId}`,                icon: MessageCircle, emoji: "📱" },
  ]
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [activeIndex, setActiveIndex] = useState(0)
  const [contextItems, setContextItems] = useState<CommandItem[]>([])
  const [dynamicItems, setDynamicItems] = useState<CommandItem[]>(buildDynamicItems())
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Load real projects/clients for search
  useEffect(() => {
    Promise.all([
      fetch('/api/proyectos').then((r) => r.json()).catch(() => ({ data: [] })),
      fetch('/api/clientes').then((r) => r.json()).catch(() => ({ data: [] })),
    ]).then(([proyRes, cliRes]) => {
      type PrItem = { id: string; nombre: string; cliente?: { nombre?: string }; municipio?: string }
      type CliItem = { id: string; nombre: string; contacto_nombre?: string }
      const proyectos: PrItem[] = proyRes.data ?? []
      const clientes: CliItem[] = cliRes.data ?? []
      if (proyectos.length === 0 && clientes.length === 0) return
      const projects: CommandItem[] = proyectos.map((p) => ({
        id: `p-${p.id}`, group: "Proyectos", label: p.nombre,
        sublabel: p.cliente?.nombre ?? p.municipio ?? undefined,
        href: `/proyectos/${p.id}`, icon: FolderOpen, emoji: "📄",
      }))
      const clientItems: CommandItem[] = clientes.map((c) => ({
        id: `c-${c.id}`, group: "Clientes", label: c.nombre,
        sublabel: c.contacto_nombre ?? undefined,
        href: `/clientes/${c.id}`, icon: Building2, emoji: "🏢",
      }))
      setDynamicItems([...projects, ...clientItems])
    })
  }, [])

  const allWithContext = [...contextItems, ...NAV_ITEMS, ...ACTION_ITEMS, ...dynamicItems]

  const filtered = query.trim()
    ? allWithContext.filter(
        (item) =>
          item.label.toLowerCase().includes(query.toLowerCase()) ||
          (item.sublabel?.toLowerCase().includes(query.toLowerCase()) ?? false) ||
          item.group.toLowerCase().includes(query.toLowerCase())
      )
    : allWithContext.filter((item) =>
        ["Este proyecto", "Navegar", "Crear"].includes(item.group)
      )

  const grouped = GROUP_ORDER.reduce<{ group: string; items: CommandItem[] }[]>((acc, group) => {
    const items = filtered.filter((i) => i.group === group)
    if (items.length > 0) acc.push({ group, items })
    return acc
  }, [])

  const flatFiltered = grouped.flatMap((g) => g.items)

  const handleOpen = useCallback(() => {
    const ctx = getCommandContext()
    if (ctx) {
      setContextItems(buildContextItems(ctx.proyectoId, ctx.proyectoNombre, ctx.municipio))
    } else {
      setContextItems([])
    }
    setOpen(true)
    setQuery("")
    setActiveIndex(0)
  }, [])

  const handleClose = useCallback(() => {
    setOpen(false)
    setQuery("")
  }, [])

  const handleSelect = useCallback(
    (href: string) => {
      router.push(href)
      handleClose()
    },
    [router, handleClose]
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        if (open) {
          handleClose()
        } else {
          handleOpen()
        }
      }
      if (e.key === "Escape" && open) {
        handleClose()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [open, handleOpen, handleClose])

  // Listen for external open trigger (from sidebar search chip)
  useEffect(() => {
    const handler = () => handleOpen()
    window.addEventListener("ph:open-palette", handler)
    return () => window.removeEventListener("ph:open-palette", handler)
  }, [handleOpen])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault()
      setActiveIndex((i) => Math.min(i + 1, flatFiltered.length - 1))
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      setActiveIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === "Enter") {
      e.preventDefault()
      const item = flatFiltered[activeIndex]
      if (item) handleSelect(item.href)
    }
  }

  // Auto-scroll active item
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const active = list.querySelector("[data-active='true']")
    if (active) {
      active.scrollIntoView({ block: "nearest" })
    }
  }, [activeIndex])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]"
      onClick={handleClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative w-full max-w-[560px] mx-4 rounded-xl border border-border bg-white overflow-hidden"
        style={{ boxShadow: "var(--shadow-elevated)" }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en PermisoHub..."
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[380px] overflow-y-auto py-2">
          {grouped.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Sin resultados para &ldquo;{query}&rdquo;
            </div>
          ) : (
            grouped.map(({ group, items }) => {
              return (
                <div key={group}>
                  <p className="px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/50">
                    {group}
                  </p>
                  {items.map((item) => {
                    const globalIndex = flatFiltered.indexOf(item)
                    const isActive = globalIndex === activeIndex
                    return (
                      <button
                        key={item.id}
                        type="button"
                        data-active={isActive}
                        onClick={() => handleSelect(item.href)}
                        onMouseEnter={() => setActiveIndex(globalIndex)}
                        className={cn(
                          "flex w-full items-center gap-3 px-4 py-2 text-left transition-colors",
                          isActive ? "bg-primary/8 text-primary" : "text-foreground hover:bg-muted/50"
                        )}
                      >
                        {item.emoji ? (
                          <span className="size-6 flex shrink-0 items-center justify-center text-base leading-none">
                            {item.emoji}
                          </span>
                        ) : (
                          <div className={cn(
                            "flex size-6 shrink-0 items-center justify-center rounded-md",
                            isActive ? "bg-primary/10" : "bg-muted"
                          )}>
                            <item.icon className="size-3.5" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{item.label}</span>
                          {item.sublabel && (
                            <span className="block truncate text-xs text-muted-foreground">{item.sublabel}</span>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-border px-4 py-2.5 text-[11px] text-muted-foreground">
          <span><kbd className="font-mono">↑↓</kbd> navegar</span>
          <span><kbd className="font-mono">↵</kbd> ir</span>
          <span><kbd className="font-mono">esc</kbd> cerrar</span>
        </div>
      </div>
    </div>
  )
}
