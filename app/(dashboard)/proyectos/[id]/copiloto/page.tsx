"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"

import { Rotulo } from "@/components/arch/rotulo"
import { veredictoDeExpediente } from "@/components/arch/estado"
import { CopilotoPanel } from "@/components/copiloto/copiloto-panel"
import { COPILOTO_PERSONA } from "@/lib/copiloto-persona"
import { TIPO_PERMISO_LABELS, type Proyecto } from "@/types"

export default function CopilotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [proyecto, setProyecto] = useState<Proyecto | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelado = false
    fetch(`/api/proyectos/${id}`)
      .then((r) => r.json())
      .then((data: { proyecto?: Proyecto }) => {
        if (cancelado) return
        setProyecto(data.proyecto ?? null)
        setLoading(false)
      })
      .catch(() => {
        if (!cancelado) setLoading(false)
      })
    return () => {
      cancelado = true
    }
  }, [id])

  if (loading) {
    return (
      <div className="bg-blueprint-grid flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Cargando expediente…</p>
      </div>
    )
  }

  if (!proyecto) {
    return (
      <div className="bg-blueprint-grid flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">No se encontró el proyecto.</p>
        <Link href="/proyectos" className="text-sm font-medium underline hover:no-underline">
          Volver a Proyectos
        </Link>
      </div>
    )
  }

  const { veredicto, label } = veredictoDeExpediente(proyecto.estado)

  return (
    <div className="flex min-h-screen flex-col">
      <div className="relative flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card px-8 py-3">
        <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-primary/30 to-transparent" />
        <nav className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <Link href="/proyectos" className="transition-colors hover:text-primary">
            Proyectos
          </Link>
          <span className="text-muted-foreground/30">/</span>
          <Link
            href={`/proyectos/${proyecto.id}`}
            className="truncate transition-colors hover:text-primary"
          >
            {proyecto.nombre}
          </Link>
          <span className="text-muted-foreground/30">/</span>
          <span className="text-muted-foreground/60">Copiloto</span>
        </nav>
        <Link
          href={`/proyectos/${proyecto.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          Volver al expediente
        </Link>
      </div>

      <div className="bg-blueprint-grid flex-1 overflow-auto p-6 md:p-8">
        <Rotulo
          className="mb-6"
          clase={`Copiloto · ${COPILOTO_PERSONA.nombre}`}
          titulo={proyecto.nombre}
          subtitulo={COPILOTO_PERSONA.rol}
          estado={{ veredicto, label }}
          campos={[
            { label: "Expediente", valor: proyecto.numero_expediente || "—" },
            { label: "Comuna / DOM", valor: proyecto.municipio || "—", mono: false },
            {
              label: "Tipo de trámite",
              valor: TIPO_PERMISO_LABELS[proyecto.tipo] ?? proyecto.tipo ?? "—",
              mono: false,
            },
          ]}
        />

        <CopilotoPanel proyecto={proyecto} />

        <p className="mt-8 max-w-3xl border-t border-line-fine pt-4 text-[11px] leading-5 text-muted-foreground">
          Los análisis del copiloto son apoyo a la revisión, no un pronunciamiento de la
          Dirección de Obras. Las citas normativas que no se pueden verificar contra el corpus
          curado se marcan como tales, y los plazos son estimaciones.
        </p>
      </div>
    </div>
  )
}
