"use client"

import { useState } from 'react'
import { Download, Pencil, Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { BoletaStatusBadge } from './boleta-status-badge'
import { SERVICIO_CONFIG, formatPeriodo } from '@/lib/boletas'
import type { BoletaServicio } from '@/types'
import { toast } from 'sonner'

interface BoletaCardProps {
  boleta: BoletaServicio
  onDeleted?: (id: string) => void
  onEdit?: (boleta: BoletaServicio) => void
}

export function BoletaCard({ boleta, onDeleted, onEdit }: BoletaCardProps) {
  const [deleting, setDeleting] = useState(false)
  const cfg = SERVICIO_CONFIG[boleta.tipo_servicio]
  const Icon = cfg.icon

  async function handleDelete() {
    if (!confirm('¿Eliminar esta boleta?')) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/boletas/${boleta.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Boleta eliminada')
      onDeleted?.(boleta.id)
    } catch {
      toast.error('Error al eliminar la boleta')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Card className="group relative overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          {/* Icon + servicio */}
          <div className="flex items-center gap-3">
            <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${cfg.iconBg}`}>
              <Icon className={`size-4 ${cfg.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {cfg.label}
              </p>
              <p className="text-xs text-neutral-500">{formatPeriodo(boleta.periodo)}</p>
            </div>
          </div>

          <BoletaStatusBadge estado={boleta.estado} size="sm" />
        </div>

        {/* Meta */}
        <div className="mt-3 space-y-1">
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            <span className="font-medium">Proveedor:</span>{' '}
            {boleta.proveedor.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </p>
          {boleta.numero_cuenta && (
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              <span className="font-medium">N° cuenta:</span> {boleta.numero_cuenta}
            </p>
          )}
          {boleta.monto_clp != null && (
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              <span className="font-medium">Monto:</span>{' '}
              {boleta.monto_clp.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })}
            </p>
          )}
          {boleta.fecha_vencimiento && (
            <p className="text-xs text-neutral-600 dark:text-neutral-400">
              <span className="font-medium">Vence:</span>{' '}
              {new Date(boleta.fecha_vencimiento).toLocaleDateString('es-CL')}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="mt-3 flex items-center gap-1.5 border-t border-neutral-100 pt-3 dark:border-neutral-800">
          {boleta.url && (
            <a
              href={boleta.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              <Download className="size-3" /> PDF
            </a>
          )}
          <div className="ml-auto flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => onEdit?.(boleta)}
            >
              <Pencil className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
