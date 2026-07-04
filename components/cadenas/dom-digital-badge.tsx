"use client"

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import type { DomStatus } from '@/app/api/dom-digital/consulta/route'

interface DomDigitalBadgeProps {
  localId: string
  municipio: string
  numero: string
  className?: string
}

interface DomConsultaResult {
  ok: true
  status: DomStatus
  descripcion: string
  numero_expediente: string | null
  fecha_ingreso: string | null
  municipio_url: string | null
  simulado?: boolean
}

const STATUS_CONFIG: Record<
  DomStatus,
  { label: string; className: string }
> = {
  sin_inicio: {
    label: 'Sin inicio',
    className: 'bg-gray-100 text-gray-600 border border-gray-200',
  },
  en_revision: {
    label: 'En revisión',
    className: 'bg-blue-100 text-blue-700 border border-blue-200',
  },
  con_observaciones: {
    label: 'Con obs.',
    className: 'bg-amber-100 text-amber-700 border border-amber-200',
  },
  aprobado: {
    label: 'Aprobado DOM',
    className: 'bg-green-100 text-green-700 border border-green-200',
  },
  vencido: {
    label: 'Vencido',
    className: 'bg-red-100 text-red-700 border border-red-200',
  },
}

export function DomDigitalBadge({
  localId,
  municipio,
  numero,
  className,
}: DomDigitalBadgeProps) {
  const [result, setResult] = useState<DomConsultaResult | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function fetchStatus() {
      try {
        const res = await fetch('/api/dom-digital/consulta', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ localId, municipio, numero }),
        })

        if (res.status === 503) {
          // Integración DOM Digital no disponible (aún no implementada)
          if (!cancelled) setUnavailable(true)
          return
        }

        if (!res.ok) return

        const data = (await res.json()) as DomConsultaResult
        if (!cancelled) setResult(data)
      } catch {
        // silently ignore fetch errors — badge just won't show
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void fetchStatus()

    return () => {
      cancelled = true
    }
  }, [localId, municipio, numero])

  if (loading) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded-full px-2.5 py-0.5 ${className ?? ''}`}
        aria-label="Consultando DOM Digital…"
      >
        <span className="animate-spin h-3 w-3 rounded-full border border-muted-foreground border-t-transparent" />
      </span>
    )
  }

  if (unavailable) {
    // Estado discreto: la consulta a DOM Digital no está disponible todavía
    return (
      <span
        className={`inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-2.5 py-0.5 text-[10.5px] text-gray-400 ${className ?? ''}`}
        title="La consulta a DOM Digital aún no está integrada"
      >
        No disponible
      </span>
    )
  }

  if (!result) return null

  const config = STATUS_CONFIG[result.status]
  const showLink =
    (result.status === 'aprobado' || result.status === 'vencido') &&
    result.municipio_url != null

  const badge = (
    <span className="inline-flex items-center gap-1">
      <Badge
        className={`${config.className} ${className ?? ''}`}
        title={result.numero_expediente ?? undefined}
      >
        {config.label}
      </Badge>
      {result.simulado && (
        <Badge
          className="border border-dashed border-amber-300 bg-amber-50 text-amber-700"
          title="Datos simulados — la integración con DOM Digital está en beta"
        >
          Simulado (beta)
        </Badge>
      )}
    </span>
  )

  if (showLink && result.municipio_url) {
    return (
      <a
        href={result.municipio_url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex"
      >
        {badge}
      </a>
    )
  }

  return badge
}
