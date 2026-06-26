"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Building2, ChevronRight, MapPin, Plus, Store, Zap } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { MOCK_CADENAS, MOCK_CENTROS, MOCK_LOCALES } from "@/lib/mock-data"
import type { Cadena, CentroComercial } from "@/types"

type CentroConStats = CentroComercial & {
  locales_count: number
  activos: number
  alertas: number
}

const ESTADO_COLOR: Record<string, string> = {
  ok:     'bg-green-500/10 text-green-700 border-green-200',
  alert:  'bg-amber-500/10 text-amber-700 border-amber-200',
  urgent: 'bg-red-500/10 text-red-700 border-red-200',
}

function centroEstado(c: CentroConStats): 'ok' | 'alert' | 'urgent' {
  if (c.alertas > 0) return 'urgent'
  if (c.activos > 0) return 'alert'
  return 'ok'
}

export default function CadenaDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)

  const mockCadena = MOCK_CADENAS.find(c => c.id === id)
  const mockCentros: CentroConStats[] = MOCK_CENTROS
    .filter(cc => cc.cadena_id === id)
    .map(cc => ({
      ...cc,
      locales_count: MOCK_LOCALES.filter(l => l.centro_id === cc.id).length,
      activos: 0,
      alertas: 0,
    }))

  const [cadena, setCadena] = useState<Cadena | undefined>(mockCadena)
  const [centros, setCentros] = useState<CentroConStats[]>(mockCentros)

  useEffect(() => {
    fetch(`/api/cadenas/${id}`)
      .then(r => r.json())
      .then((d: { cadena?: Cadena & { centros?: CentroComercial[] } }) => {
        if (d.cadena) {
          setCadena(d.cadena)
          if (d.cadena.centros) {
            setCentros(d.cadena.centros.map(cc => ({
              ...cc,
              locales_count: cc.locales?.length ?? cc.num_locales ?? 0,
              activos: 0,
              alertas: 0,
            })))
          }
        }
      })
      .catch(() => undefined)
  }, [id])

  if (!cadena) {
    return <div className="p-8 text-muted-foreground">Cadena no encontrada.</div>
  }

  const totalLocales = centros.reduce((s, cc) => s + cc.locales_count, 0)
  const totalAlertas = centros.reduce((s, cc) => s + cc.alertas, 0)
  const totalActivos = centros.reduce((s, cc) => s + cc.activos, 0)

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        emoji="🏬"
        title={cadena.nombre}
        subtitle={cadena.rut ? `RUT ${cadena.rut}` : 'Cadena comercial'}
        breadcrumbs={[{ label: 'Cadenas', href: '/cadenas' }]}
        action={
          <Link href={`/cadenas/${id}/centros/nuevo`}>
            <Button size="sm">
              <Plus className="size-4" />
              Nuevo centro
            </Button>
          </Link>
        }
      />

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-5">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
            <MapPin className="size-3.5" /> Centros
          </div>
          <div className="text-3xl font-semibold">{centros.length}</div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
            <Store className="size-3.5" /> Locales
          </div>
          <div className="text-3xl font-semibold">{totalLocales}</div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
            <Building2 className="size-3.5" /> Permisos activos
          </div>
          <div className="text-3xl font-semibold">{totalActivos}</div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-amber-500" /> Con alertas
          </div>
          <div className={`text-3xl font-semibold ${totalAlertas > 0 ? 'text-amber-600' : ''}`}>
            {totalAlertas}
          </div>
        </div>
      </div>

      {/* Municipios */}
      {(cadena.municipios ?? []).length > 0 && (
        <div className="flex flex-wrap gap-2">
          {(cadena.municipios ?? []).map(m => (
            <Badge key={m} variant="secondary">{m}</Badge>
          ))}
        </div>
      )}

      {/* Widget boletas */}
      <Link
        href={`/cadenas/${id}/boletas`}
        className="flex items-center justify-between rounded-xl border border-blue-100 bg-blue-50 px-5 py-4 transition-colors hover:bg-blue-100/60 dark:border-blue-900/30 dark:bg-blue-950/20 dark:hover:bg-blue-900/20"
      >
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/40">
            <Zap className="size-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-200">Boletas de Servicios Básicos</p>
            <p className="text-xs text-blue-600 dark:text-blue-400">Gestiona cumplimiento de agua, luz y gas por local</p>
          </div>
        </div>
        <ChevronRight className="size-4 text-blue-400" />
      </Link>

      {/* Grid de centros */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
          Centros comerciales
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {centros.map(cc => {
            const estado = centroEstado(cc)
            return (
              <Link
                key={cc.id}
                href={`/cadenas/${id}/centros/${cc.id}`}
                className="rounded-xl border bg-card p-5 hover:border-primary/40 hover:bg-muted/30 transition-colors group"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-sm">{cc.nombre}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="size-3" /> {cc.municipio}
                    </div>
                  </div>
                  <div className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ESTADO_COLOR[estado]}`}>
                    {estado === 'urgent' ? 'Alerta' : estado === 'alert' ? 'En curso' : 'OK'}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-center border-t pt-3">
                  <div>
                    <div className="text-xl font-semibold">{cc.locales_count}</div>
                    <div className="text-xs text-muted-foreground">locales</div>
                  </div>
                  <div>
                    <div className="text-xl font-semibold">{cc.activos}</div>
                    <div className="text-xs text-muted-foreground">permisos activos</div>
                  </div>
                </div>

                <div className="flex items-center justify-end mt-3 text-xs text-muted-foreground group-hover:text-primary transition-colors">
                  Ver locales <ChevronRight className="size-3.5 ml-1" />
                </div>
              </Link>
            )
          })}

          {/* Card "Nuevo centro" */}
          <Link
            href={`/cadenas/${id}/centros/nuevo`}
            className="rounded-xl border-2 border-dashed border-muted-foreground/20 p-5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors min-h-[160px]"
          >
            <Plus className="size-6" />
            <span className="text-sm font-medium">Agregar centro</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
