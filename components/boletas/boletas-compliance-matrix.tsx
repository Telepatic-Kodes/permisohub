"use client"

import { useState } from 'react'
import { CheckCircle2, AlertTriangle, XCircle, Circle, Plus } from 'lucide-react'
import { BoletaUploadDialog } from './boleta-upload-dialog'
import { SERVICIO_CONFIG } from '@/lib/boletas'
import type { EstadoBoleta, ResumenCumplimientoBoletas, TipoServicioBasico, BoletaServicio } from '@/types'
import { cn } from '@/lib/utils'

interface BoletasComplianceMatrixProps {
  data: ResumenCumplimientoBoletas[]
  onBoletaAdded?: (boleta: BoletaServicio) => void
}

const SERVICIOS: TipoServicioBasico[] = ['agua', 'electricidad', 'gas']

function CellIcon({ estado }: { estado: EstadoBoleta }) {
  if (estado === 'vigente')    return <CheckCircle2 className="size-4 text-emerald-500" />
  if (estado === 'por_vencer') return <AlertTriangle className="size-4 text-amber-500"  />
  if (estado === 'vencida')    return <XCircle       className="size-4 text-red-500"    />
  return <Circle className="size-4 text-neutral-300" />
}

interface CellProps {
  estado: EstadoBoleta
  onClick: () => void
}

function MatrixCell({ estado, onClick }: CellProps) {
  const cursor = estado === 'pendiente' ? 'cursor-pointer' : 'cursor-default'
  return (
    <td
      className={cn(
        'whitespace-nowrap px-4 py-3 text-center transition-colors',
        cursor,
        estado === 'pendiente' && 'group/cell hover:bg-neutral-50 dark:hover:bg-neutral-800/50',
      )}
      onClick={estado === 'pendiente' ? onClick : undefined}
      title={estado === 'pendiente' ? 'Click para registrar boleta' : undefined}
    >
      <div className="flex items-center justify-center gap-1">
        <CellIcon estado={estado} />
        {estado === 'pendiente' && (
          <Plus className="size-3 text-neutral-300 opacity-0 transition-opacity group-hover/cell:opacity-100" />
        )}
      </div>
    </td>
  )
}

export function BoletasComplianceMatrix({ data, onBoletaAdded }: BoletasComplianceMatrixProps) {
  const [dialogOpen,      setDialogOpen     ] = useState(false)
  const [selectedLocalId, setSelectedLocalId] = useState('')
  const [selectedNumero,  setSelectedNumero ] = useState('')
  const [selectedTipo,    setSelectedTipo   ] = useState<TipoServicioBasico>('agua')

  function openDialog(localId: string, localNumero: string, tipo: TipoServicioBasico) {
    setSelectedLocalId(localId)
    setSelectedNumero(localNumero)
    setSelectedTipo(tipo)
    setDialogOpen(true)
  }

  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 py-16 text-neutral-400 dark:border-neutral-700">
        <Circle className="mb-2 size-8 opacity-30" />
        <p className="text-sm">Sin locales registrados</p>
      </div>
    )
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-neutral-200 dark:border-neutral-800">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 bg-neutral-50 dark:border-neutral-800 dark:bg-neutral-900">
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Local
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Centro
              </th>
              {SERVICIOS.map((s) => {
                const cfg  = SERVICIO_CONFIG[s]
                const Icon = cfg.icon
                return (
                  <th key={s} className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    <span className="flex items-center justify-center gap-1.5">
                      <Icon className={`size-3.5 ${cfg.color}`} />
                      {cfg.label}
                    </span>
                  </th>
                )
              })}
              <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-neutral-500">
                Cumplimiento
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
            {data.map((row) => (
              <tr
                key={row.local_id}
                className="bg-white transition-colors hover:bg-neutral-50/50 dark:bg-neutral-950 dark:hover:bg-neutral-900/50"
              >
                <td className="px-4 py-3 font-medium text-neutral-900 dark:text-neutral-100">
                  {row.local_numero}
                </td>
                <td className="px-4 py-3 text-neutral-500">
                  {row.centro_nombre}
                </td>
                <MatrixCell estado={row.agua}         onClick={() => openDialog(row.local_id, row.local_numero, 'agua')} />
                <MatrixCell estado={row.electricidad} onClick={() => openDialog(row.local_id, row.local_numero, 'electricidad')} />
                <MatrixCell estado={row.gas}          onClick={() => openDialog(row.local_id, row.local_numero, 'gas')} />
                <td className="px-4 py-3 text-center">
                  <div className="inline-flex items-center gap-1.5">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700">
                      <div
                        className={cn(
                          'h-full rounded-full transition-all',
                          row.cumplimiento_pct === 100 ? 'bg-emerald-500' :
                          row.cumplimiento_pct >= 50  ? 'bg-amber-400'   : 'bg-red-400',
                        )}
                        style={{ width: `${row.cumplimiento_pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-neutral-600 dark:text-neutral-400">
                      {row.cumplimiento_pct}%
                    </span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <BoletaUploadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        localId={selectedLocalId}
        localNumero={selectedNumero}
        defaultTipo={selectedTipo}
        onSaved={onBoletaAdded}
      />
    </>
  )
}
