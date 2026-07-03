"use client"

import { useState } from "react"
import { ArrowRight, Check, FileText, Loader2, Sparkles } from "lucide-react"

import { Button } from "@/components/ui/button"
import { DocumentUpload } from "@/components/dashboard/document-upload"
import DueDiligenceReport from "@/components/proyecto/due-diligence-report"
import { cn } from "@/lib/utils"

interface Props {
  proyectoId: string
  documentosIniciales: number
  // Se llama cuando el due diligence terminó y pobló la PMO.
  onComplete: () => void
}

const STEPS = [
  { n: 1, label: "Documentos", icon: FileText },
  { n: 2, label: "Due Diligence", icon: Sparkles },
]

export function ExpedienteWizard({ proyectoId, documentosIniciales, onComplete }: Props) {
  const [step, setStep] = useState(documentosIniciales > 0 ? 2 : 1)
  const [docCount, setDocCount] = useState(documentosIniciales)
  const [ddStatus, setDdStatus] = useState<"idle" | "processing" | "done" | "error">("idle")

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-2 text-center">
        <h2 className="heading-section text-xl font-bold text-primary">Preparemos el expediente</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Sube los documentos y genera el Due Diligence. Al terminar, verás el expediente completo.
        </p>
      </div>

      {/* Stepper */}
      <div className="mx-auto mb-8 mt-6 flex max-w-md items-center justify-center gap-2">
        {STEPS.map((s, i) => {
          const done = step > s.n || (s.n === 2 && ddStatus === "done")
          const active = step === s.n
          const processing = s.n === 2 && ddStatus === "processing"
          return (
            <div key={s.n} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
                  done
                    ? "border-primary/30 bg-primary/5 text-primary"
                    : active
                      ? "border-primary bg-primary text-white"
                      : "border-border text-muted-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full text-[11px] font-bold",
                    done ? "bg-primary/15" : active ? "bg-white/20" : "bg-muted",
                  )}
                >
                  {done ? (
                    <Check className="size-3" />
                  ) : processing ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    s.n
                  )}
                </span>
                {processing ? "Analizando…" : s.label}
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("h-px w-8", step > s.n ? "bg-primary/40" : "bg-border")} />
              )}
            </div>
          )
        })}
      </div>

      {step === 1 && (
        <div className="space-y-4 rounded-xl border border-border bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
          <div>
            <p className="text-sm font-semibold text-primary">Paso 1 · Sube los documentos del expediente</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Planos, memorias, certificados, permisos previos, actas de la DOM. Puedes subir varios a la vez.
            </p>
          </div>
          <DocumentUpload proyectoId={proyectoId} onUploadComplete={() => setDocCount((c) => c + 1)} />
          <div className="flex items-center justify-between border-t border-border pt-4">
            <span className="text-xs text-muted-foreground">
              {docCount === 0 ? "Aún no has subido documentos" : `${docCount} documento${docCount === 1 ? "" : "s"} listo${docCount === 1 ? "" : "s"}`}
            </span>
            <Button onClick={() => setStep(2)} disabled={docCount === 0} className="bg-primary text-white hover:bg-primary/90">
              Continuar <ArrowRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-white p-5" style={{ boxShadow: "var(--shadow-card)" }}>
            <p className="text-sm font-semibold text-primary">Paso 2 · Genera el Due Diligence</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              La IA lee todos los documentos, detecta riesgos e inconsistencias, y arma el plan de acción.
              Al terminar se completa el expediente (etapas, observaciones y plazos).
            </p>
            {docCount === 0 && (
              <Button variant="ghost" size="sm" className="mt-2" onClick={() => setStep(1)}>
                ← Volver a subir documentos
              </Button>
            )}
          </div>
          {/* El componente maneja generar/poll/rehidratar y, al completar, puebla la PMO y llama onApplied. */}
          <DueDiligenceReport proyectoId={proyectoId} onApplied={onComplete} onStatusChange={setDdStatus} />
        </div>
      )}
    </div>
  )
}
