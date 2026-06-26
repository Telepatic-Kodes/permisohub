"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertTriangle, Clock, ShieldOff, Loader2 } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { AlertaItem } from "@/app/api/cadenas/alertas/route"

type Filtro = 'todos' | 'vencido' | 'proximo_30' | 'proximo_60' | 'sin_permiso'

const FILTROS: { key: Filtro; label: string }[] = [
  { key: 'todos', label: 'Todos' },
  { key: 'vencido', label: 'Vencidos' },
  { key: 'proximo_30', label: 'Próx. 30d' },
  { key: 'proximo_60', label: 'Próx. 60d' },
  { key: 'sin_permiso', label: 'Sin permiso' },
]

function formatFecha(dateStr?: string): string {
  if (!dateStr) return '—'
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

function CategoriaBadge({ categoria }: { categoria: AlertaItem['categoria'] }) {
  switch (categoria) {
    case 'vencido':
      return (
        <Badge className="bg-red-500/10 text-red-600 border border-red-200 hover:bg-red-500/10">
          Vencido
        </Badge>
      )
    case 'proximo_30':
      return (
        <Badge className="bg-amber-500/10 text-amber-600 border border-amber-200 hover:bg-amber-500/10">
          30 días
        </Badge>
      )
    case 'proximo_60':
      return (
        <Badge className="bg-yellow-500/10 text-yellow-600 border border-yellow-200 hover:bg-yellow-500/10">
          60 días
        </Badge>
      )
    case 'proximo_90':
      return (
        <Badge className="bg-yellow-500/10 text-yellow-700 border border-yellow-200 hover:bg-yellow-500/10">
          90 días
        </Badge>
      )
    case 'sin_permiso':
      return (
        <Badge variant="secondary">Sin permiso</Badge>
      )
  }
}

export default function AlertasPage() {
  const [alertas, setAlertas] = useState<AlertaItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtro, setFiltro] = useState<Filtro>('todos')

  useEffect(() => {
    fetch('/api/cadenas/alertas')
      .then((res) => res.json())
      .then((data: { alertas: AlertaItem[] }) => {
        setAlertas(data.alertas ?? [])
      })
      .catch(() => setAlertas([]))
      .finally(() => setLoading(false))
  }, [])

  const filtradas =
    filtro === 'todos' ? alertas : alertas.filter((a) => a.categoria === filtro)

  const countVencido = alertas.filter((a) => a.categoria === 'vencido').length
  const countProximo30 = alertas.filter((a) => a.categoria === 'proximo_30').length
  const countProximo60 = alertas.filter((a) => a.categoria === 'proximo_60').length
  const countSinPermiso = alertas.filter((a) => a.categoria === 'sin_permiso').length

  return (
    <div className="space-y-6">
      <PageHeader
        emoji="⚠️"
        title="Alertas de Cumplimiento"
        subtitle="Permisos vencidos y próximos a vencer en tu cartera"
        breadcrumbs={[{ label: 'Cadenas', href: '/cadenas-comerciales' }]}
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="rounded-xl border border-red-200 bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm text-muted-foreground">Vencidos</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{countVencido}</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="text-sm text-muted-foreground">Próx. 30d</span>
          </div>
          <p className="text-3xl font-bold text-amber-600">{countProximo30}</p>
        </div>

        <div className="rounded-xl border border-yellow-200 bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Clock className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-muted-foreground">Próx. 60d</span>
          </div>
          <p className="text-3xl font-bold text-yellow-600">{countProximo60}</p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <ShieldOff className="h-4 w-4 text-slate-500" />
            <span className="text-sm text-muted-foreground">Sin permiso</span>
          </div>
          <p className="text-3xl font-bold text-slate-600">{countSinPermiso}</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1">
        {FILTROS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFiltro(key)}
            className={
              filtro === key
                ? "bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
                : "text-muted-foreground hover:text-foreground rounded-md px-3 py-1.5 text-sm"
            }
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>CADENA</TableHead>
                <TableHead>CENTRO</TableHead>
                <TableHead>LOCAL</TableHead>
                <TableHead>NEGOCIO</TableHead>
                <TableHead>ESTADO</TableHead>
                <TableHead>FECHA ESTIM.</TableHead>
                <TableHead className="text-right">DÍAS</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    No hay alertas para este filtro.
                  </TableCell>
                </TableRow>
              ) : (
                filtradas.map((alerta) => (
                  <TableRow key={alerta.id}>
                    <TableCell className="font-medium">
                      <Link
                        href={`/cadenas-comerciales/${alerta.cadena_id}`}
                        className="hover:underline"
                      >
                        {alerta.cadena_nombre}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {alerta.centro_nombre}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {alerta.local_numero}
                    </TableCell>
                    <TableCell>{alerta.negocio}</TableCell>
                    <TableCell>
                      <CategoriaBadge categoria={alerta.categoria} />
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatFecha(alerta.fecha_estimada)}
                    </TableCell>
                    <TableCell className="text-right">
                      {alerta.categoria === 'sin_permiso' ? (
                        <span className="text-muted-foreground">—</span>
                      ) : alerta.dias_restantes !== undefined && alerta.dias_restantes < 0 ? (
                        <span className="text-red-600 font-medium">
                          {alerta.dias_restantes}
                        </span>
                      ) : (
                        <span>{alerta.dias_restantes}</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
