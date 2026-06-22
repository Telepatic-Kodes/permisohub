"use client"

import { useState } from "react"
import { FileText, TrendingUp, ExternalLink, Download } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"

type Tab = "pitch" | "modelo"

const TABS: Array<{ id: Tab; label: string; icon: typeof FileText; src: string; title: string }> = [
  {
    id: "pitch",
    label: "Pitch Deck",
    icon: TrendingUp,
    src: "/docs/pitch-deck.html",
    title: "PermisoHub — Pitch Deck",
  },
  {
    id: "modelo",
    label: "Modelo de Negocio",
    icon: FileText,
    src: "/docs/business-model.html",
    title: "PermisoHub — Modelo de Negocio",
  },
]

export default function DocumentosPage() {
  const [activeTab, setActiveTab] = useState<Tab>("pitch")

  const current = TABS.find((t) => t.id === activeTab)!

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader emoji="📄" title="Documentos" />
      <div className="flex flex-1 flex-col overflow-auto p-8">
        {/* Tab bar */}
        <div className="flex items-center justify-between border-b border-border bg-white px-6 py-0 shrink-0">
          <div className="flex">
            {TABS.map((tab) => {
              const Icon = tab.icon
              const active = activeTab === tab.id
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 border-b-2 px-5 py-3.5 text-sm font-medium transition-colors ${
                    active
                      ? "border-primary text-primary"
                      : "border-transparent text-muted-foreground hover:text-primary"
                  }`}
                >
                  <Icon className="size-4" />
                  {tab.label}
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-2">
            <a
              href={current.src}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
            >
              <ExternalLink className="size-3.5" />
              Abrir en nueva pestaña
            </a>
            <a
              href={current.src}
              download
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs text-white hover:bg-primary/90 transition-colors"
            >
              <Download className="size-3.5" />
              Descargar HTML
            </a>
          </div>
        </div>

        {/* Iframe area */}
        {TABS.map((tab) => (
          <iframe
            key={tab.id}
            src={tab.src}
            title={tab.title}
            className={`flex-1 w-full border-0 ${activeTab === tab.id ? "block" : "hidden"}`}
            allow="fullscreen"
          />
        ))}
      </div>
    </div>
  )
}
