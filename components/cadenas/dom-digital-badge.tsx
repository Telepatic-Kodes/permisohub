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

  if (!result) return null

  const config = STATUS_CONFIG[result.status]
  const showLink =
    (result.status === 'aprobado' || result.status === 'vencido') &&
    result.municipio_url != null

  const badge = (
    <Badge
      className={`${config.className} ${className ?? ''}`}
      title={result.numero_expediente ?? undefined}
    >
      {config.label}
    </Badge>
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
