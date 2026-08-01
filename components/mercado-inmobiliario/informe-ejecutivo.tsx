import { cn } from "@/lib/utils"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"

// Piloto de "look world-class" para los informes de IA que ya generan las
// herramientas de Mercado Inmobiliario (Tasación, Due Diligence, Auditor,
// Predictor) — Torre de Control §6. En vez de un wrapper genérico que
// adivina un resumen a partir de texto libre, exige que el propio prompt
// del modelo produzca una sección "## 🎯 Resumen Ejecutivo" (ver
// lib/tasacion-prompts.ts) — este componente solo la extrae y la
// promueve visualmente. Si esa sección no aparece (streaming parcial,
// modelo desvía del formato), degrada con gracia mostrando el contenido
// completo tal cual, nunca fabrica un resumen que no está en el texto real.
//
// `fuentes`: señales YA existentes en la respuesta de la ruta (ej.
// `avaluoFiscal !== null`), no metadata inventada — la trazabilidad debe
// ser honesta o no vale nada.

export interface FuenteInforme {
  label: string
  disponible: boolean
}

interface InformeEjecutivoProps {
  content: string
  fuentes: FuenteInforme[]
  className?: string
}

const MARCADOR_RESUMEN = /res(u|ú)men ejecutivo/i

function splitResumenEjecutivo(content: string): { resumen: string | null; resto: string } {
  const secciones = content.split(/\n(?=## )/)
  const idx = secciones.findIndex((s) => MARCADOR_RESUMEN.test(s.split("\n")[0] ?? ""))
  if (idx === -1) return { resumen: null, resto: content }

  const resumen = secciones[idx].replace(/^##[^\n]*\n?/, "")
  const resto = secciones.filter((_, i) => i !== idx).join("\n")
  return { resumen, resto }
}

export function InformeEjecutivo({ content, fuentes, className }: InformeEjecutivoProps) {
  const { resumen, resto } = splitResumenEjecutivo(content)

  return (
    <div className={cn("space-y-4", className)}>
      {resumen && (
        <div className="rounded-[4px] border-2 border-[var(--blueprint)] bg-[var(--blueprint-soft)] px-5 py-4">
          <p className="mb-2 font-technical text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--blueprint)]">
            Resumen ejecutivo
          </p>
          <MarkdownRenderer content={resumen} />
        </div>
      )}

      {fuentes.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {fuentes.map((f) => (
            <span
              key={f.label}
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-medium",
                f.disponible ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"
              )}
            >
              {f.disponible ? "✓" : "—"} {f.label}
            </span>
          ))}
        </div>
      )}

      <div className="rounded-[4px] border border-line-fine bg-card px-5 py-4">
        <MarkdownRenderer content={resto} />
      </div>
    </div>
  )
}
