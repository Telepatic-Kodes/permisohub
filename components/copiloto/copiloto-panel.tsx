"use client"

import { useCallback, useState } from "react"
import { FileStack, Landmark, Loader2, RefreshCw, ScrollText, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { TabOguc } from "@/components/copiloto/tabs/tab-oguc"
import { TabObservaciones } from "@/components/copiloto/tabs/tab-observaciones"
import { TabChecklist } from "@/components/copiloto/tabs/tab-checklist"
import { TabEstimacion } from "@/components/copiloto/tabs/tab-estimacion"
import type { CopilotoResult, TabId } from "@/components/copiloto/tipos"
import type { Proyecto } from "@/types"

// ---------------------------------------------------------------------------
// Panel del copiloto — pensado para ocupar una página, no un cajón lateral.
//
// Antes vivía en un Sheet de 480 px: los cuadros de artículo quedaban con la
// fórmula y la normativa apretadas en dos columnas de ~200 px, y el texto
// normativo se partía palabra por palabra. Aquí el ancho es el del contenido,
// así que las celdas de dato se leen como el cuadro de una lámina.
// ---------------------------------------------------------------------------

type Estado = "idle" | "loading" | "loaded" | "error"

const ANALISIS: {
  id: TabId
  titulo: string
  descripcion: string
  Icon: typeof ScrollText
}[] = [
  {
    id: "oguc",
    titulo: "Diagnóstico OGUC",
    descripcion: "Verifica FOT, FOS, rasantes y distanciamientos con los artículos citados.",
    Icon: ScrollText,
  },
  {
    id: "observaciones",
    titulo: "Predicción de observaciones",
    descripcion: "Anticipa las observaciones más probables de la DOM y cómo prevenirlas.",
    Icon: Sparkles,
  },
  {
    id: "checklist",
    titulo: "Checklist de documentos",
    descripcion: "Los documentos requeridos para este trámite, con seguimiento de estado.",
    Icon: FileStack,
  },
  {
    id: "estimacion",
    titulo: "Estimación de plazo y derechos",
    descripcion: "Días hábiles estimados y derechos municipales en CLP y UF.",
    Icon: Landmark,
  },
]

const TABS: { id: TabId; codigo: string; label: string }[] = [
  { id: "oguc", codigo: "C-01", label: "OGUC" },
  { id: "observaciones", codigo: "C-02", label: "Observaciones" },
  { id: "checklist", codigo: "C-03", label: "Checklist" },
  { id: "estimacion", codigo: "C-04", label: "Estimación" },
]

type ProyectoCopiloto = Pick<Proyecto, "id" | "nombre" | "municipio" | "tipo" | "estado">

export function CopilotoPanel({ proyecto }: { proyecto: ProyectoCopiloto }) {
  const [estado, setEstado] = useState<Estado>("idle")
  const [activeTab, setActiveTab] = useState<TabId>("oguc")
  const [result, setResult] = useState<CopilotoResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const analizar = useCallback(
    async (tabId: TabId, forzar = false, regenerarChecklist = false) => {
      // Los cuatro análisis llegan en una sola respuesta: si ya está cargada,
      // cambiar de pestaña no vuelve a llamar al modelo.
      if (result && !forzar && !regenerarChecklist) {
        setActiveTab(tabId)
        return
      }
      setEstado("loading")
      setActiveTab(tabId)
      setErrorMsg(null)
      try {
        const res = await fetch("/api/ai/copiloto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proyectoId: proyecto.id,
            ...(regenerarChecklist ? { regenerarChecklist: true } : {}),
          }),
        })
        const json = (await res.json()) as { ok?: boolean; error?: string } & Partial<CopilotoResult>
        if (!json.ok || !json.oguc) throw new Error(json.error ?? "Error al cargar el análisis")
        setResult({
          oguc: json.oguc,
          observaciones: json.observaciones!,
          checklist: json.checklist!,
          estimacion: json.estimacion!,
        })
        setEstado("loaded")
      } catch (err) {
        setErrorMsg(err instanceof Error ? err.message : "Error desconocido")
        setEstado("error")
      }
    },
    [proyecto.id, result],
  )

  const handleItemToggle = useCallback(
    (itemKey: string, nuevoEstado: "pendiente" | "ok") => {
      setResult((prev) =>
        prev
          ? {
              ...prev,
              checklist: {
                ...prev.checklist,
                items: prev.checklist.items.map((it) =>
                  it.item_key === itemKey ? { ...it, estado: nuevoEstado } : it,
                ),
              },
            }
          : prev,
      )
    },
    [],
  )

  // ── Inicio: los cuatro análisis disponibles ──
  if (estado === "idle") {
    return (
      <section>
        <p className="mb-4 max-w-2xl text-sm leading-6 text-muted-foreground">
          Elige un análisis para empezar. Todos leen el expediente: no necesitas ingresar
          nada. La primera consulta ejecuta los cuatro y demora entre 20 y 40 segundos.
        </p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {ANALISIS.map((a) => (
            <button
              key={a.id}
              type="button"
              onClick={() => void analizar(a.id)}
              className="rotulo group flex items-start gap-4 bg-card p-5 text-left transition-colors hover:border-[var(--blueprint)]/40"
            >
              <a.Icon className="mt-0.5 size-5 shrink-0 text-[var(--blueprint)]" strokeWidth={1.5} />
              <div>
                <p className="font-technical text-[15px] font-semibold text-foreground">
                  {a.titulo}
                </p>
                <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{a.descripcion}</p>
              </div>
            </button>
          ))}
        </div>
      </section>
    )
  }

  if (estado === "loading") {
    return (
      <div className="rotulo flex flex-col items-center justify-center gap-3 bg-card py-24 text-center">
        <Loader2 className="size-7 animate-spin text-[var(--blueprint)]" />
        <p className="font-technical text-sm font-semibold">Analizando el expediente…</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Se ejecutan los cuatro análisis sobre los datos del proyecto. Toma entre 20 y 40
          segundos.
        </p>
      </div>
    )
  }

  if (estado === "error") {
    return (
      <div
        className="rounded-[3px] border p-5 text-sm"
        style={{
          borderColor: "var(--state-error)",
          background: "color-mix(in oklch, var(--state-error) 8%, transparent)",
        }}
      >
        <p className="font-technical font-semibold" style={{ color: "var(--state-error)" }}>
          No se pudo completar el análisis
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{errorMsg}</p>
        <button
          type="button"
          onClick={() => setEstado("idle")}
          className="mt-4 text-xs font-medium underline hover:no-underline"
        >
          Volver a intentar
        </button>
      </div>
    )
  }

  if (!result) return null

  return (
    <section>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        {/* Índice de análisis, mismo lenguaje que las láminas del expediente */}
        <div className="rotulo flex overflow-x-auto bg-card">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => void analizar(t.id)}
              className={cn(
                "border-r border-line-fine px-4 py-2.5 last:border-r-0",
                activeTab === t.id
                  ? "shadow-[inset_0_-2px_0_var(--blueprint)]"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="num mr-2 text-[10px] text-muted-foreground">{t.codigo}</span>
              <span className="font-technical text-[13px]">{t.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void analizar(activeTab, true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <RefreshCw className="size-3.5" />
          Volver a analizar
        </button>
      </div>

      {activeTab === "oguc" && <TabOguc data={result.oguc} />}
      {activeTab === "observaciones" && <TabObservaciones data={result.observaciones} />}
      {activeTab === "checklist" && (
        <TabChecklist
          data={result.checklist}
          onToggle={handleItemToggle}
          onRegenerar={() => void analizar("checklist", true, true)}
        />
      )}
      {activeTab === "estimacion" && <TabEstimacion data={result.estimacion} />}
    </section>
  )
}
