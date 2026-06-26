"use client"

import Link from "next/link"
import { AlertTriangle, ArrowRight, Clock } from "lucide-react"

import type { Proyecto } from "@/types"

type PatenteConVigencia = Proyecto & {
  dias_para_vencer: number | null
  estado_vigencia: 'vigente' | 'por_vencer' | 'vencida' | 'sin_datos'
}

interface RenovacionAlertProps {
  patentes: PatenteConVigencia[]
}

export function RenovacionAlert({ patentes }: RenovacionAlertProps) {
  const porVencer = patentes.filter((p) => p.estado_vigencia === 'por_vencer').length
  const vencidas = patentes.filter((p) => p.estado_vigencia === 'vencida').length

  if (porVencer === 0 && vencidas === 0) return null

  const hayVencidas = vencidas > 0

  const styles = hayVencidas
    ? "border-red-200 bg-red-50 text-red-800"
    : "border-amber-200 bg-amber-50 text-amber-800"

  const Icon = hayVencidas ? AlertTriangle : Clock

  const mensaje = hayVencidas
    ? `${vencidas} ${vencidas === 1 ? 'patente vencida' : 'patentes vencidas'}. Tramita la renovación urgente para normalizar la operación.`
    : `${porVencer} ${porVencer === 1 ? 'patente vence' : 'patentes vencen'} en menos de 30 días. Inicia las renovaciones a tiempo para evitar recargos.`

  const linkColor = hayVencidas
    ? "text-red-700 hover:text-red-900"
    : "text-amber-700 hover:text-amber-900"

  return (
    <div
      className={`flex flex-col gap-2 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${styles}`}
    >
      <div className="flex items-start gap-2.5">
        <Icon className="mt-0.5 size-4 shrink-0" />
        <p className="text-sm font-medium leading-relaxed">{mensaje}</p>
      </div>
      <Link
        href="/patentes"
        className={`inline-flex shrink-0 items-center gap-1 text-sm font-semibold transition-colors ${linkColor}`}
      >
        Gestionar patentes
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  )
}
