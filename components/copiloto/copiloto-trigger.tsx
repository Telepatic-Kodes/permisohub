"use client"

import Link from "next/link"
import { Bot } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { Proyecto } from "@/types"

// El copiloto es una página propia, no un cajón lateral: en 480 px los cuadros
// de artículo quedaban ilegibles. Al ser un enlace, además se puede abrir en
// otra pestaña y compartir la URL del análisis.
export function CopilotoTrigger({
  proyecto,
}: {
  proyecto: Pick<Proyecto, "id" | "nombre" | "municipio" | "tipo" | "estado">
}) {
  return (
    <Button
      nativeButton={false}
      render={<Link href={`/proyectos/${proyecto.id}/copiloto`} />}
      variant="outline"
      size="sm"
      className="gap-1.5"
    >
      <Bot className="size-3.5 text-primary" />
      Copiloto IA
    </Button>
  )
}
