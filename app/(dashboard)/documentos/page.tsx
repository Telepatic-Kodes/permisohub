"use client"

import { useState } from "react"
import { FileText, TrendingUp, ExternalLink, Download } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { cn } from "@/lib/utils"

type Tab = "pitch" | "modelo"

const TABS: Array<{
  id: Tab
  label: string
  icon: typeof FileText
  src: string
  title: string
  categoria: string
  formato: string
}> = [
  {
    id: "pitch",
    label: "Pitch Deck",
    icon: TrendingUp,
    src: "/docs/pitch-deck.html",
    title: "PermisoHub — Pitch Deck",
    categoria: "Inversión",
    formato: "HTML",
  },
  {
    id: "modelo",
    label: "Modelo de Negocio",
    icon: FileText,
    src: "/docs/business-model.html",
    title: "PermisoHub — Modelo de Negocio",
    categoria: "Estrategia",
    formato: "HTML",
  },
]

export default function DocumentosPage() {
  const [activeTab, setActiveTab] = useState<Tab>("pitch")

  const current = TABS.find((t) => t.id === activeTab)!

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="📄"
        title="Documentos"
        subtitle="Índice documental — expediente institucional"
      />

      <div className="flex flex-1 flex-col gap-5 overflow-auto bg-blueprint-grid p-6 lg:p-8">
        {/* ── Índice documental ──────────────────────────────────────────── */}
        <section className="rotulo overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-line-fine px-4 py-2.5">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              <span
                className="inline-block h-2 w-2 border border-[var(--blueprint)]"
                style={{ borderRightWidth: 0, borderBottomWidth: 0 }}
              />
              Índice documental
            </p>
            <span className="num text-[11px] text-muted-foreground/70">
              {String(TABS.length).padStart(2, "0")} piezas
            </span>
          </div>

          <div>
            {TABS.map((tab, i) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  aria-pressed={active}
                  className={cn(
                    "group flex w-full items-center gap-4 border-b border-line-fine px-4 py-3 text-left transition-colors last:border-b-0",
                    active
                      ? "bg-[color-mix(in_oklch,var(--blueprint)_6%,transparent)]"
                      : "hover:bg-[color-mix(in_oklch,var(--blueprint)_4%,transparent)]",
                  )}
                >
                  {/* índice */}
                  <span className="num w-6 shrink-0 text-xs text-muted-foreground">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  {/* glifo del documento */}
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-[3px] border transition-colors",
                      active
                        ? "border-[var(--blueprint)] text-[var(--blueprint)]"
                        : "border-line-med text-muted-foreground group-hover:border-[var(--blueprint)] group-hover:text-[var(--blueprint)]",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>

                  {/* nombre + categoría */}
                  <div className="min-w-0 flex-1">
                    <p className="font-technical truncate text-sm font-medium text-foreground">
                      {tab.label}
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                      {tab.categoria}
                    </p>
                  </div>

                  {/* formato */}
                  <span className="num hidden shrink-0 text-[11px] text-muted-foreground sm:block">
                    {tab.formato}
                  </span>

                  {/* selección */}
                  <span
                    className={cn(
                      "shrink-0 rounded-[3px] border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors",
                      active
                        ? "border-[var(--blueprint)] text-[var(--blueprint)]"
                        : "border-transparent text-transparent",
                    )}
                  >
                    En vista
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {/* ── Visor de lámina ────────────────────────────────────────────── */}
        <div className="flex min-h-[520px] flex-1 flex-col overflow-hidden rounded-[3px] border border-line-strong bg-card">
          {/* Cajetín del visor */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line-fine px-4 py-2.5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                Visor
              </span>
              <span className="h-3.5 w-px bg-line-med" />
              <span className="font-technical truncate text-sm font-medium text-foreground">
                {current.label}
              </span>
              <span className="num shrink-0 text-[11px] text-muted-foreground">
                {current.formato}
              </span>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <a
                href={current.src}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-[3px] border border-line-med px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-[var(--blueprint)] hover:text-[var(--blueprint)]"
              >
                <ExternalLink className="size-3.5" />
                Abrir en nueva pestaña
              </a>
              <a
                href={current.src}
                download
                className="flex items-center gap-1.5 rounded-[3px] border border-[var(--blueprint)] px-3 py-1.5 text-xs text-[var(--blueprint)] transition-colors hover:bg-[color-mix(in_oklch,var(--blueprint)_10%,transparent)]"
              >
                <Download className="size-3.5" />
                Descargar HTML
              </a>
            </div>
          </div>

          {/* Lámina — se mantienen todos los iframes montados para no recargar */}
          {TABS.map((tab) => (
            <iframe
              key={tab.id}
              src={tab.src}
              title={tab.title}
              className={cn(
                "w-full flex-1 border-0 bg-white",
                activeTab === tab.id ? "block" : "hidden",
              )}
              allow="fullscreen"
            />
          ))}
        </div>
      </div>
    </div>
  )
}
