"use client"

import { X, Zap } from "lucide-react"
import Link from "next/link"

interface UpgradePromptProps {
  metric: "projects" | "ai_chats" | "pdf_extractions"
  currentPlan: string
  onClose?: () => void
}

const METRIC_MESSAGES: Record<
  UpgradePromptProps["metric"],
  { title: string; description: string }
> = {
  projects: {
    title: "Límite de proyectos alcanzado",
    description:
      "En el plan Starter puedes tener hasta 5 proyectos activos. Pasa al plan Pro para proyectos ilimitados.",
  },
  ai_chats: {
    title: "Límite de consultas IA alcanzado",
    description:
      "Has usado todas tus consultas OGUC de este mes. El plan Pro incluye consultas ilimitadas.",
  },
  pdf_extractions: {
    title: "Límite de extracciones PDF alcanzado",
    description:
      "Has usado todas tus extracciones de observaciones de este mes. El plan Pro incluye extracciones ilimitadas.",
  },
}

export function UpgradePrompt({
  metric,
  currentPlan,
  onClose,
}: UpgradePromptProps) {
  const msg = METRIC_MESSAGES[metric]
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        {onClose && (
          <button
            onClick={onClose}
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        )}
        <div className="mb-4 flex size-12 items-center justify-center rounded-xl bg-[#1A3328]/10">
          <Zap className="size-6 text-[#1A3328]" />
        </div>
        <h3 className="mb-1 text-lg font-semibold text-[#1A3328]">
          {msg.title}
        </h3>
        <p className="mb-5 text-sm text-muted-foreground">{msg.description}</p>
        <div className="flex gap-3">
          <Link
            href="/configuracion/billing"
            className="flex-1 rounded-lg bg-[#1A3328] px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-[#1A3328]/90"
          >
            Ver planes Pro
          </Link>
          {onClose && (
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors hover:border-[#1A3328]/30"
            >
              Cancelar
            </button>
          )}
        </div>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Plan actual:{" "}
          <span className="font-medium capitalize">{currentPlan}</span>
        </p>
      </div>
    </div>
  )
}
