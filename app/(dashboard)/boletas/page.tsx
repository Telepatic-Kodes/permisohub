"use client"

import { useEffect, useState } from 'react'
import { Plus, AlertTriangle, CheckCircle2, XCircle, FileSearch } from 'lucide-react'
import { PageHeader } from '@/components/dashboard/page-header'
import { BoletasComplianceMatrix } from '@/components/boletas/boletas-compliance-matrix'
import { BoletaUploadDialog } from '@/components/boletas/boleta-upload-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ResumenCumplimientoBoletas, BoletaServicio } from '@/types'

interface KpiCardProps {
  label: string
  value: number
  icon: React.ReactNode
  color: string
}

function KpiCard({ label, value, icon, color }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-neutral-500">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
          </div>
          <div className="text-neutral-300">{icon}</div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function BoletasPage() {
  const [data,        setData       ] = useState<ResumenCumplimientoBoletas[]>([])
  const [loading,     setLoading    ] = useState(true)
  const [filtroEstado, setFiltroEstado] = useState('todos')
  const [dialogOpen,  setDialogOpen ] = useState(false)

  useEffect(() => {
    fetch('/api/cadenas/mock/boletas-resumen')
      .then((r) => r.json())
      .then((d: { data?: ResumenCumplimientoBoletas[] }) => {
        if (Array.isArray(d.data)) setData(d.data)
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [])

  function handleBoletaAdded(boleta: BoletaServicio) {
    setData((prev) =>
      prev.map((row) => {
        if (row.local_id !== boleta.local_id) return row
        const updated = {
          ...row,
          [boleta.tipo_servicio]: boleta.estado,
        }
        const scores = ['agua', 'electricidad', 'gas'].filter(
          (s) => (updated as unknown as Record<string, string>)[s] === 'vigente',
        ).length
        return { ...updated, cumplimiento_pct: Math.round((scores / 3) * 100) }
      }),
    )
  }

  const vigentes   = data.filter((r) => r.cumplimiento_pct === 100).length
  const porVencer  = data.filter((r) =>
    r.agua === 'por_vencer' || r.electricidad === 'por_vencer' || r.gas === 'por_vencer',
  ).length
  const vencidas   = data.filter((r) =>
    r.agua === 'vencida' || r.electricidad === 'vencida' || r.gas === 'vencida',
  ).length
  const pctGlobal  = data.length
    ? Math.round(data.reduce((acc, r) => acc + r.cumplimiento_pct, 0) / data.length)
    : 0

  const filtered = filtroEstado === 'todos'
    ? data
    : filtroEstado === 'completos'
      ? data.filter((r) => r.cumplimiento_pct === 100)
      : filtroEstado === 'incompletos'
        ? data.filter((r) => r.cumplimiento_pct < 100)
        : data.filter((r) =>
            r.agua === filtroEstado || r.electricidad === filtroEstado || r.gas === filtroEstado,
          )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Boletas de Servicios"
        emoji="🧾"
        subtitle="Gestiona las boletas de agua, electricidad y gas por local"
        action={
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="mr-1.5 size-3.5" />
            Registrar boleta
          </Button>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Cumplimiento global"
          value={pctGlobal}
          color={pctGlobal === 100 ? 'text-emerald-600' : pctGlobal >= 50 ? 'text-amber-600' : 'text-red-600'}
          icon={<CheckCircle2 className="size-8" />}
        />
        <KpiCard
          label="Locales al 100%"
          value={vigentes}
          color="text-emerald-600"
          icon={<CheckCircle2 className="size-8 text-emerald-200" />}
        />
        <KpiCard
          label="Con boleta por vencer"
          value={porVencer}
          color="text-amber-600"
          icon={<AlertTriangle className="size-8 text-amber-200" />}
        />
        <KpiCard
          label="Con boleta vencida"
          value={vencidas}
          color="text-red-600"
          icon={<XCircle className="size-8 text-red-200" />}
        />
      </div>

      {/* Filtros + Matrix */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
            Matriz de cumplimiento
          </h2>
          <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v ?? 'todos')}>
            <SelectTrigger className="h-8 w-44 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los locales</SelectItem>
              <SelectItem value="completos">Solo completos</SelectItem>
              <SelectItem value="incompletos">Con pendientes</SelectItem>
              <SelectItem value="vencida">Con boleta vencida</SelectItem>
              <SelectItem value="por_vencer">Por vencer (&lt;30d)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center rounded-xl border border-dashed border-neutral-200 py-16 dark:border-neutral-700">
            <div className="size-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
          </div>
        ) : (
          <BoletasComplianceMatrix data={filtered} onBoletaAdded={handleBoletaAdded} />
        )}
      </div>

      {/* Nota regulatoria */}
      <div className="flex gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4 dark:border-blue-900/30 dark:bg-blue-950/20">
        <FileSearch className="mt-0.5 size-4 shrink-0 text-blue-500" />
        <div className="text-xs text-blue-800 dark:text-blue-300">
          <p className="font-semibold">Requisito regulatorio</p>
          <p className="mt-0.5 text-blue-700 dark:text-blue-400">
            La boleta de agua es obligatoria para el <strong>Informe Sanitario SEREMI</strong> (ChileAtiende Ficha 163)
            y la <strong>Autorización Sanitaria de Alimentos</strong> (Ficha 172). Renueva antes de los 30 días de
            vencimiento para evitar observaciones en tus trámites.
          </p>
        </div>
      </div>

      <BoletaUploadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        localId=""
        onSaved={handleBoletaAdded}
      />
    </div>
  )
}
