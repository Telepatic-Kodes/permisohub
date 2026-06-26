"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, ChevronRight, Plus, Store } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MOCK_CADENAS, MOCK_CENTROS, MOCK_LOCALES } from "@/lib/mock-data"
import { USO_LOCAL_LABELS } from "@/types"
import type { CentroComercial, Local } from "@/types"

const ESTADO_BADGE: Record<string, string> = {
  borrador:           'bg-slate-100 text-slate-600 border-slate-200',
  ingresado:          'bg-blue-100 text-blue-700 border-blue-200',
  en_revision:        'bg-violet-100 text-violet-700 border-violet-200',
  con_observaciones:  'bg-amber-100 text-amber-700 border-amber-200',
  aprobado:           'bg-green-100 text-green-700 border-green-200',
  rechazado:          'bg-red-100 text-red-700 border-red-200',
}

export default function CentroDetailPage({
  params,
}: {
  params: Promise<{ id: string; centroId: string }>
}) {
  const { id, centroId } = use(params)

  const mockCentro = MOCK_CENTROS.find(cc => cc.id === centroId)
  const mockLocales = MOCK_LOCALES.filter(l => l.centro_id === centroId)
  const mockCadena = MOCK_CADENAS.find(c => c.id === id)

  const [centro, setCentro] = useState<CentroComercial | undefined>(mockCentro)
  const [locales, setLocales] = useState<Local[]>(mockLocales)
  const [filtroUso, setFiltroUso] = useState<string>('todos')

  useEffect(() => {
    fetch(`/api/centros/${centroId}`)
      .then(r => r.json())
      .then((d: { centro?: CentroComercial & { locales?: Local[] } }) => {
        if (d.centro) {
          setCentro(d.centro)
          if (d.centro.locales && d.centro.locales.length > 0) setLocales(d.centro.locales)
        }
      })
      .catch(() => undefined)
  }, [centroId])

  if (!centro) return <div className="p-8 text-muted-foreground">Centro no encontrado.</div>

  const usos = ['todos', ...Array.from(new Set(locales.map(l => l.uso ?? 'otro')))]
  const localesFiltrados = filtroUso === 'todos' ? locales : locales.filter(l => (l.uso ?? 'otro') === filtroUso)

  const conPermiso  = locales.filter(l => (l.proyectos?.length ?? 0) > 0).length
  const sinPermiso  = locales.length - conPermiso

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        emoji="🏪"
        title={centro.nombre}
        subtitle={`${centro.municipio} · ${centro.area_m2?.toLocaleString() ?? '—'} m²`}
        breadcrumbs={[
          { label: 'Cadenas', href: '/cadenas' },
          { label: mockCadena?.nombre ?? 'Cadena', href: `/cadenas/${id}` },
        ]}
        action={
          <Link href={`/cadenas/${id}/centros/${centroId}/locales/nuevo`}>
            <Button size="sm">
              <Plus className="size-4" />
              Nuevo local
            </Button>
          </Link>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border bg-card p-5">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
            <Store className="size-3.5" /> Total locales
          </div>
          <div className="text-3xl font-semibold">{locales.length}</div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="text-xs text-muted-foreground mb-1">Con permiso activo</div>
          <div className="text-3xl font-semibold text-blue-600">{conPermiso}</div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="text-xs text-muted-foreground mb-1">Sin permiso registrado</div>
          <div className="text-3xl font-semibold">{sinPermiso}</div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="text-xs text-muted-foreground mb-1 flex items-center gap-1.5">
            <AlertTriangle className="size-3.5 text-amber-500" /> Con observaciones
          </div>
          <div className="text-3xl font-semibold text-amber-600">0</div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 flex-wrap">
        {usos.map(u => (
          <button
            key={u}
            onClick={() => setFiltroUso(u)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filtroUso === u
                ? 'bg-foreground text-background border-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/40'
            }`}
          >
            {u === 'todos' ? 'Todos' : USO_LOCAL_LABELS[u as keyof typeof USO_LOCAL_LABELS] ?? u}
            {u !== 'todos' && (
              <span className="ml-1.5 opacity-60">
                {locales.filter(l => (l.uso ?? 'otro') === u).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tabla de locales */}
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Local</TableHead>
              <TableHead>Negocio</TableHead>
              <TableHead>Uso</TableHead>
              <TableHead className="text-right">m²</TableHead>
              <TableHead>Permiso vigente</TableHead>
              <TableHead>Contacto tenant</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {localesFiltrados.map(local => {
              const proyectoActivo = local.proyectos?.[0]
              return (
                <TableRow key={local.id} className="hover:bg-muted/40">
                  <TableCell>
                    <Link
                      href={`/cadenas/${id}/centros/${centroId}/locales/${local.id}`}
                      className="font-mono font-semibold text-sm hover:underline"
                    >
                      {local.numero}
                    </Link>
                  </TableCell>
                  <TableCell className="font-medium">{local.nombre_negocio ?? '—'}</TableCell>
                  <TableCell>
                    {local.uso && (
                      <Badge variant="secondary" className="text-xs font-normal">
                        {USO_LOCAL_LABELS[local.uso]}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {local.area_m2 ? `${local.area_m2} m²` : '—'}
                  </TableCell>
                  <TableCell>
                    {proyectoActivo ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${ESTADO_BADGE[proyectoActivo.estado] ?? ''}`}>
                        {proyectoActivo.estado.replace(/_/g, ' ')}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">Sin permiso</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {local.tenant_email ?? '—'}
                  </TableCell>
                  <TableCell>
                    <Link href={`/cadenas/${id}/centros/${centroId}/locales/${local.id}`}>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  </TableCell>
                </TableRow>
              )
            })}
            {localesFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  No hay locales registrados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
