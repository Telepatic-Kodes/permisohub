"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"

import { EstadoNormativo, type Veredicto } from "@/components/arch/estado"
import { createClient } from "@/lib/supabase/client"
import {
  evaluarCompletitud,
  type ResultadoCompletitud,
} from "@/lib/completitud-expediente"

interface Props {
  proyectoId: string
  /** Tipo de trámite (TipoPermiso). Si no llega, el componente lo obtiene del
   *  proyecto; si aún así no hay tipo, degrada a una checklist genérica. */
  tipo?: string
  /** Cambia este valor (p. ej. el conteo de documentos) para re-evaluar en vivo
   *  a medida que se suben documentos. */
  refreshKey?: number
}

interface DocRow {
  tipo?: string
  nombre: string
}

// El veredicto solo codifica presencia documental, NO cumplimiento normativo:
//   presente            → cumple  (verde)
//   obligatorio ausente → observa (ámbar)
//   opcional ausente    → neutro  (tinta)
function veredictoDe(presente: boolean, obligatorio: boolean): Veredicto {
  if (presente) return "cumple"
  return obligatorio ? "observa" : "neutro"
}

export function ChecklistCompletitud({ proyectoId, tipo, refreshKey }: Props) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [resultado, setResultado] = useState<ResultadoCompletitud | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(false)

    void (async () => {
      try {
        const supabase = createClient()

        // Documentos subidos (con su tipo clasificado).
        const { data: docsData, error: docsError } = await supabase
          .from("documentos")
          .select("nombre, tipo")
          .eq("proyecto_id", proyectoId)
        if (docsError) throw new Error(docsError.message)

        // Tipo de trámite: usa el prop; si no vino, lo obtiene del proyecto.
        let tipoTramite = tipo
        if (!tipoTramite) {
          const { data: pRow } = await supabase
            .from("proyectos")
            .select("tipo")
            .eq("id", proyectoId)
            .maybeSingle()
          tipoTramite = (pRow?.tipo as string | undefined) ?? undefined
        }

        if (cancelled) return
        const docs = (docsData ?? []) as DocRow[]
        setResultado(evaluarCompletitud(tipoTramite, docs))
      } catch {
        if (!cancelled) setError(true)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [proyectoId, tipo, refreshKey])

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-[3px] border border-line-fine bg-card px-4 py-3 text-xs text-muted-foreground">
        <Loader2 className="size-3.5 animate-spin" />
        Revisando completitud del expediente…
      </div>
    )
  }

  if (error || !resultado) {
    // Silencioso y honesto: si no se pudo evaluar, no bloqueamos ni afirmamos nada.
    return null
  }

  const { items, resumen } = resultado

  return (
    <section className="overflow-hidden rounded-[3px] border border-line-strong bg-card">
      {/* Encabezado técnico */}
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line-med px-4 py-2.5">
        <h3 className="font-technical text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Completitud del expediente
          <span className="num ml-2 text-primary">
            {resumen.presentes} de {resumen.total}
          </span>
        </h3>
        {resumen.faltantes > 0 ? (
          <span className="num text-[11px]" style={{ color: "var(--state-warn)" }}>
            {resumen.faltantes} pendiente{resumen.faltantes === 1 ? "" : "s"}
          </span>
        ) : (
          <span className="num text-[11px]" style={{ color: "var(--state-ok)" }}>
            Documentos habituales presentes
          </span>
        )}
      </header>

      {/* Filas hairline por requisito */}
      <ul className="divide-y divide-line-fine">
        {items.map(({ requisito, presente }) => (
          <li
            key={requisito.clave}
            className="flex items-center justify-between gap-3 px-4 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-primary">{requisito.label}</p>
              <div className="flex items-center gap-1.5">
                {!requisito.obligatorio && (
                  <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
                    Opcional
                  </span>
                )}
                {requisito.fuente && (
                  <span className="truncate text-[10px] text-muted-foreground/60">{requisito.fuente}</span>
                )}
              </div>
            </div>
            <EstadoNormativo
              estado={veredictoDe(presente, requisito.obligatorio)}
              label={presente ? "Presente" : requisito.obligatorio ? "Falta" : "No cargado"}
            />
          </li>
        ))}
      </ul>

      {/* Aclaración de alcance */}
      <footer className="border-t border-line-med px-4 py-2">
        <p className="text-[11px] italic leading-snug text-muted-foreground/70">
          Chequeo orientativo de completitud, no un pronunciamiento de la DOM. Cada
          municipio fija su propio listado de requisitos; verifícalo contra la fuente oficial.
        </p>
      </footer>
    </section>
  )
}

export default ChecklistCompletitud
