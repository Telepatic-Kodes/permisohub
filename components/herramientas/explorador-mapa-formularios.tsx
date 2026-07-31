"use client"

import type { ReactNode } from "react"
import { useState } from "react"
import { ExternalLink, FileStack } from "lucide-react"

import {
  GRUPOS,
  REGIMEN_LABELS,
  ACTUACION_LABELS,
  regimenesDeGrupo,
  actuacionesDe,
  obrasEspecificasDe,
  buscarTramite,
  type GrupoId,
  type Regimen,
  type ActuacionId,
} from "@/lib/mapa-formularios"
import { cn } from "@/lib/utils"

const GRUPO_IDS: GrupoId[] = [1, 2, 3, 4, 5]

// Explorador manual de los 5 grupos del Mapa de Formularios Minvu. A
// diferencia del catálogo de abajo (curado, orientativo), esto es una
// transcripción literal navegable: Grupo → Régimen → Actuación → Obra
// específica → nombre exacto del trámite (solicitante y DOM). Reusa
// lib/mapa-formularios.ts, la misma fuente que alimenta el panel "Familia de
// formulario" del proyecto (components/proyecto/familia-formulario.tsx), que
// solo cubre Grupo 1/2 porque se deriva de las respuestas de vía. Este
// explorador expone también Grupo 3 (Urbanización), 4 (Subdivisión/Fusión) y
// 5 (Otras Obras), que no tienen clasificador automático.
export function ExploradorMapaFormularios() {
  const [grupo, setGrupo] = useState<GrupoId>(1)
  const [regimen, setRegimen] = useState<Regimen>(regimenesDeGrupo(1)[0])
  const [actuacion, setActuacion] = useState<ActuacionId>(actuacionesDe(1, regimenesDeGrupo(1)[0])[0])
  const [obraEspecificaId, setObraEspecificaId] = useState<string>(
    obrasEspecificasDe(1, regimenesDeGrupo(1)[0], actuacionesDe(1, regimenesDeGrupo(1)[0])[0])[0]?.id ?? "",
  )

  function elegirGrupo(g: GrupoId) {
    const r = regimenesDeGrupo(g)[0]
    const a = actuacionesDe(g, r)[0]
    const o = obrasEspecificasDe(g, r, a)[0]?.id ?? ""
    setGrupo(g)
    setRegimen(r)
    setActuacion(a)
    setObraEspecificaId(o)
  }

  function elegirRegimen(r: Regimen) {
    const a = actuacionesDe(grupo, r)[0]
    const o = obrasEspecificasDe(grupo, r, a)[0]?.id ?? ""
    setRegimen(r)
    setActuacion(a)
    setObraEspecificaId(o)
  }

  function elegirActuacion(a: ActuacionId) {
    const o = obrasEspecificasDe(grupo, regimen, a)[0]?.id ?? ""
    setActuacion(a)
    setObraEspecificaId(o)
  }

  const regimenes = regimenesDeGrupo(grupo)
  const actuaciones = actuacionesDe(grupo, regimen)
  const obras = obrasEspecificasDe(grupo, regimen, actuacion)
  const tramite = buscarTramite(grupo, regimen, actuacion, obraEspecificaId)

  return (
    <div className="rounded-[4px] border border-line-fine bg-card">
      <div className="flex items-center gap-3 border-b border-line-fine p-4">
        <FileStack className="size-5 shrink-0 text-muted-foreground/60" />
        <div>
          <p className="font-technical text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Transcripción literal · 5 PDF Minvu
          </p>
          <p className="font-technical text-sm font-semibold text-primary">Explorador del Mapa de Formularios</p>
        </div>
      </div>

      <div className="space-y-4 p-4">
        <Nivel label="Grupo">
          {GRUPO_IDS.map((g) => (
            <Opcion key={g} activo={g === grupo} onClick={() => elegirGrupo(g)}>
              {g} · {GRUPOS[g].nombre}
            </Opcion>
          ))}
        </Nivel>

        <Nivel label="Régimen">
          {regimenes.map((r) => (
            <Opcion key={r} activo={r === regimen} onClick={() => elegirRegimen(r)}>
              {REGIMEN_LABELS[r]}
            </Opcion>
          ))}
        </Nivel>

        <Nivel label="Actuación">
          {actuaciones.map((a) => (
            <Opcion key={a} activo={a === actuacion} onClick={() => elegirActuacion(a)}>
              {ACTUACION_LABELS[a]}
            </Opcion>
          ))}
        </Nivel>

        <Nivel label="Obra específica">
          {obras.map((o) => (
            <Opcion key={o.id} activo={o.id === obraEspecificaId} onClick={() => setObraEspecificaId(o.id)}>
              {o.label}
            </Opcion>
          ))}
        </Nivel>

        {tramite ? (
          <div className="rounded-[4px] border border-line-med bg-muted/30 p-3">
            <dl className="space-y-2">
              <div>
                <dt className="font-technical text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Lo que presenta el solicitante
                </dt>
                <dd className="mt-0.5 text-[13px] leading-snug text-foreground">{tramite.nombreSolicitante}</dd>
              </div>
              <div>
                <dt className="font-technical text-[9px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Lo que emite/archiva la DOM
                </dt>
                <dd className="mt-0.5 text-[13px] leading-snug text-foreground">{tramite.nombreDom}</dd>
              </div>
            </dl>
            <a
              href={GRUPOS[grupo].fuenteUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="num mt-3 inline-flex items-center gap-1 rounded-[3px] border border-line-med px-1.5 py-0.5 text-[10px] text-primary transition-colors hover:border-[var(--blueprint)] hover:text-[var(--blueprint)]"
            >
              Mapa de Formularios Minvu · Grupo {grupo}
              <ExternalLink className="size-2.5" />
            </a>
          </div>
        ) : (
          <p className="text-[12px] text-muted-foreground">Esta combinación no existe en el Mapa de Formularios transcrito.</p>
        )}
      </div>
    </div>
  )
}

function Nivel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="font-technical mb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}

function Opcion({ activo, onClick, children }: { activo: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "font-technical rounded-[4px] px-2.5 py-1 text-[11px] font-medium transition-colors",
        activo
          ? "border border-[var(--blueprint)] bg-[var(--blueprint)]/[0.05] text-[var(--blueprint)]"
          : "border border-line-fine text-muted-foreground hover:border-[var(--blueprint)] hover:text-[var(--blueprint)]",
      )}
    >
      {children}
    </button>
  )
}

export default ExploradorMapaFormularios
