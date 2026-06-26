"use client"

import { Bot } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Proyecto } from '@/types'

interface CopilotoTriggerProps {
  proyecto: Pick<Proyecto, 'id' | 'nombre' | 'municipio' | 'tipo' | 'estado'>
  onClick: (proyecto: Pick<Proyecto, 'id' | 'nombre' | 'municipio' | 'tipo' | 'estado'>) => void
}

export function CopilotoTrigger({ proyecto, onClick }: CopilotoTriggerProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => onClick(proyecto)}
      className="gap-1.5"
    >
      <Bot className="size-3.5 text-primary" />
      Copiloto IA
    </Button>
  )
}
