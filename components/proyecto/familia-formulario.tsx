"use client"

import { ExternalLink, FileStack } from "lucide-react"

import {
  clasificarFamiliaFormulario,
  GRUPOS,
  REGIMEN_LABELS,
  ACTUACION_LABELS,
  type ClasificacionInput,
} from "@/lib/mapa-formularios"

interface Props {
  respuestas: ClasificacionInput["respuestas"]
  /** Mejor dato disponible de m² de ampliación — hoy se usa
   *  `proyecto.superficie_construida_m2` como aproximación (ver nota en UI). */
  superficieAmpliacionM2?: number
}

// Panel determinista que traduce la vía recomendada (lib/via-tramitacion) a la
// familia de formulario oficial Minvu (lib/mapa-formularios): qué documento
// exacto presenta el solicitante y qué emite la DOM. Se apoya en la MISMA
// rama de preguntas que ViaDecision — nunca inventa una fila que no esté en
// el Mapa de Formularios transcrito.
export function FamiliaFormulario({ respuestas, superficieAmpliacionM2 }: Props) {
  const resultado = clasificarFamiliaFormulario({ respuestas, superficieAmpliacionM2 })

  return (
    <div className="rotulo overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line-fine px-4 py-3">
        <FileStack className="size-4 text-[var(--blueprint)]" />
        <div>
          <p className="font-technical text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Familia de formulario · Mapa de Formularios Minvu
          </p>
          <p className="font-technical text-sm font-semibold text-primary">
            Qué documento exacto corresponde
          </p>
        </div>
      </div>

      <div className="px-4 py-3">
        {resultado.determinado ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-[3px] border border-line-med px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                Grupo {resultado.tramite.grupo} · {GRUPOS[resultado.tramite.grupo].nombre}
              </span>
              <span className="inline-flex items-center rounded-[3px] border border-line-med px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {REGIMEN_LABELS[resultado.tramite.regimen]}
              </span>
              <span className="inline-flex items-center rounded-[3px] border border-line-med px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                {ACTUACION_LABELS[resultado.tramite.actuacion]}
              </span>
            </div>

            <dl className="mt-3 space-y-2">
              <div>
                <dt className="font-technical text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Lo que presenta el solicitante
                </dt>
                <dd className="mt-0.5 text-[13px] leading-snug text-foreground">{resultado.tramite.nombreSolicitante}</dd>
              </div>
              <div>
                <dt className="font-technical text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Lo que emite/archiva la DOM
                </dt>
                <dd className="mt-0.5 text-[13px] leading-snug text-foreground">{resultado.tramite.nombreDom}</dd>
              </div>
            </dl>

            {resultado.notas.length > 0 && (
              <ul className="mt-2 space-y-1">
                {resultado.notas.map((n, i) => (
                  <li key={i} className="text-[10.5px] leading-snug text-muted-foreground">
                    {n}
                  </li>
                ))}
              </ul>
            )}

            <a
              href={GRUPOS[resultado.tramite.grupo].fuenteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="num mt-2 inline-flex items-center gap-1 rounded-[3px] border border-line-med px-1.5 py-0.5 text-[10px] text-primary transition-colors hover:border-[var(--blueprint)] hover:text-[var(--blueprint)]"
            >
              Mapa de Formularios Minvu · Grupo {resultado.tramite.grupo}
              <ExternalLink className="size-2.5" />
            </a>

            {superficieAmpliacionM2 != null && respuestas.aumentaSuperficie && (
              <p className="mt-2 text-[10px] leading-snug text-muted-foreground/70">
                m² usado para decidir Grupo 1 vs Grupo 2: superficie construida cargada del proyecto ({superficieAmpliacionM2} m²) — verifica que corresponda al tamaño real de la ampliación, no del predio completo.
              </p>
            )}
          </>
        ) : (
          <p className="text-[12px] leading-relaxed text-muted-foreground">{resultado.razon}</p>
        )}
      </div>

      <footer className="border-t border-line-fine px-4 py-2">
        <p className="text-[10px] leading-snug text-muted-foreground/70">
          Transcripción literal de los 5 PDF &quot;Mapa de Formularios&quot; del Minvu. No es la checklist de
          documentos a adjuntar (eso vive en Completitud del expediente) — es el nombre oficial del trámite.
        </p>
      </footer>
    </div>
  )
}

export default FamiliaFormulario
