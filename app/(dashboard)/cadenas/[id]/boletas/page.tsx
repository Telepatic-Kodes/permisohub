"use client"

import { use, useEffect, useState } from 'react'
import { Plus, ArrowLeft, Building2 } from 'lucide-react'
import Link from 'next/link'
import { PageHeader } from '@/components/dashboard/page-header'
import { BoletasComplianceMatrix } from '@/components/boletas/boletas-compliance-matrix'
import { BoletaCard } from '@/components/boletas/boleta-card'
import { BoletaUploadDialog } from '@/components/boletas/boleta-upload-dialog'
import { Button } from '@/components/ui/button'
import type { ResumenCumplimientoBoletas, BoletaServicio } from '@/types'

interface PageProps {
  params: Promise<{ id: string }>
}

export default function CadenaBoletasPage({ params }: PageProps) {
  const { id: cadenaId } = use(params)

  const [resumen,    setResumen   ] = useState<ResumenCumplimientoBoletas[]>([])
  const [boletas,    setBoletas   ] = useState<BoletaServicio[]>([])
  const [loading,    setLoading   ] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch(`/api/cadenas/${cadenaId}/boletas-resumen`).then((r) => r.json()),
      fetch(`/api/boletas?cadena_id=${cadenaId}`).then((r) => r.json()),
    ])
      .then(([resData, boletasData]: [
        { data?: ResumenCumplimientoBoletas[] },
        { data?: BoletaServicio[] },
      ]) => {
        if (Array.isArray(resData.data))    setResumen(resData.data)
        if (Array.isArray(boletasData.data)) setBoletas(boletasData.data)
      })
      .catch(() => undefined)
      .finally(() => setLoading(false))
  }, [cadenaId])

  const pctGlobal = resumen.length
    ? Math.round(resumen.reduce((acc, r) => acc + r.cumplimiento_pct, 0) / resumen.length)
    : 0

  function handleBoletaAdded(boleta: BoletaServicio) {
    setBoletas((prev) => {
      const exists = prev.findIndex(
        (b) => b.local_id === boleta.local_id && b.tipo_servicio === boleta.tipo_servicio && b.periodo === boleta.periodo,
      )
      if (exists >= 0) {
        const updated = [...prev]
        updated[exists] = boleta
        return updated
      }
      return [boleta, ...prev]
    })

    setResumen((prev) =>
      prev.map((row) => {
        if (row.local_id !== boleta.local_id) return row
        const updated = { ...row, [boleta.tipo_servicio]: boleta.estado }
        const scores = ['agua', 'electricidad', 'gas'].filter(
          (s) => (updated as unknown as Record<string, string>)[s] === 'vigente',
        ).length
        return { ...updated, cumplimiento_pct: Math.round((scores / 3) * 100) }
      }),
    )
  }

  function handleBoletaDeleted(id: string) {
    setBoletas((prev) => prev.filter((b) => b.id !== id))
  }

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <Link
        href={`/cadenas/${cadenaId}`}
        className="inline-flex items-center gap-1.5 text-xs text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300"
      >
        <ArrowLeft className="size-3" />
        Volver a la cadena
      </Link>

      <PageHeader
        title="Boletas de Servicios"
        emoji="🧾"
        subtitle={`Cumplimiento global: ${pctGlobal}% · ${resumen.length} local${resumen.length !== 1 ? 'es' : ''}`}
        action={
          <Button onClick={() => setDialogOpen(true)} size="sm">
            <Plus className="mr-1.5 size-3.5" />
            Registrar boleta
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="size-5 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
        </div>
      ) : (
        <>
          {/* Compliance matrix */}
          <section className="space-y-2">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300">
              <Building2 className="size-4" />
              Matriz de cumplimiento
            </h2>
            <BoletasComplianceMatrix data={resumen} onBoletaAdded={handleBoletaAdded} />
          </section>

          {/* Boleta cards recientes */}
          {boletas.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
                Boletas registradas
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {boletas.map((b) => (
                  <BoletaCard
                    key={b.id}
                    boleta={b}
                    onDeleted={handleBoletaDeleted}
                    onEdit={() => {/* TODO: edit flow */}}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <BoletaUploadDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        localId={resumen[0]?.local_id ?? ''}
        onSaved={handleBoletaAdded}
      />
    </div>
  )
}
