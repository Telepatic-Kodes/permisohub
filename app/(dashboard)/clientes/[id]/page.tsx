"use client"

import { use } from "react"
import Link from "next/link"
import {
  FileDown,
  Mail,
  MapPin,
  Phone,
  Plus,
  User,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { PageHeader } from "@/components/dashboard/page-header"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { MOCK_CLIENTES, MOCK_PROYECTOS } from "@/lib/mock-data"
import { ESTADO_CONFIG } from "@/types"

// Estimated value per project (mock — no value field on Proyecto).
const VALOR_ESTIMADO_POR_PROYECTO = 1_200_000

function formatDate(value?: string) {
  if (!value) return "—"
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

function formatCLP(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value)
}

export default function ClienteDetallePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)

  const cliente = MOCK_CLIENTES.find((c) => c.id === id)
  const proyectos = MOCK_PROYECTOS.filter((p) => p.cliente_id === id)

  if (!cliente) {
    return (
      <div className="flex min-h-screen flex-col">
        <PageHeader
          emoji="🏢"
          title="Cliente no encontrado"
          breadcrumbs={[
            { label: "Clientes", href: "/clientes" },
            { label: "Cliente no encontrado" },
          ]}
        />
        <div className="flex-1 overflow-auto p-8">
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No se encontró el cliente solicitado.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const activos = proyectos.filter(
    (p) => p.estado !== "aprobado" && p.estado !== "rechazado"
  ).length
  const conObservaciones = proyectos.filter(
    (p) => p.estado === "con_observaciones"
  ).length
  const completados = proyectos.filter((p) => p.estado === "aprobado").length
  const valorTotal = proyectos.length * VALOR_ESTIMADO_POR_PROYECTO

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="🏢"
        title={cliente.nombre}
        breadcrumbs={[
          { label: "Clientes", href: "/clientes" },
          { label: cliente.nombre },
        ]}
      />
      <div className="flex-1 overflow-auto p-8 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
            {cliente.rut && <span>RUT {cliente.rut}</span>}
            {cliente.email && (
              <span className="inline-flex items-center gap-1.5">
                <Mail className="size-4" />
                {cliente.email}
              </span>
            )}
            {cliente.telefono && (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="size-4" />
                {cliente.telefono}
              </span>
            )}
            {cliente.contacto_nombre && (
              <span className="inline-flex items-center gap-1.5">
                <User className="size-4" />
                {cliente.contacto_nombre}
              </span>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="outline" nativeButton={false} render={<Link href="/proyectos/nuevo" />}>
            <Plus className="size-4" />
            Nuevo proyecto
          </Button>
          <Button
            className="bg-primary text-white hover:bg-primary/90"
            nativeButton={false}
            render={<Link href={`/clientes/${cliente.id}/informe`} />}
          >
            <FileDown className="size-4" />
            Generar informe PDF
          </Button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Proyectos activos" value={activos} />
        <StatCard
          label="Con observaciones"
          value={conObservaciones}
          highlight={conObservaciones > 0}
        />
        <StatCard label="Completados" value={completados} />
        <StatCard label="Valor estimado total" value={formatCLP(valorTotal)} />
      </div>

      {/* Projects table */}
      <Card>
        <CardContent className="p-0">
          {proyectos.length === 0 ? (
            <div className="space-y-4 py-12 text-center">
              <p className="text-sm text-muted-foreground">
                No hay proyectos activos para este cliente.
              </p>
              <Button
                variant="outline"
                nativeButton={false}
                render={<Link href="/proyectos/nuevo" />}
              >
                <Plus className="size-4" />
                Nuevo proyecto
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Proyecto</TableHead>
                  <TableHead>Municipio</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Etapa actual</TableHead>
                  <TableHead>Fecha estimada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {proyectos.map((p) => {
                  const estadoCfg = ESTADO_CONFIG[p.estado]
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium text-primary">
                        <Link
                          href={`/proyectos/${p.id}`}
                          className="hover:underline"
                        >
                          {p.nombre}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <MapPin className="size-4" />
                          {p.municipio}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${estadoCfg.color}`}
                        >
                          {estadoCfg.label}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {p.etapa_actual ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(p.fecha_estimada)}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>
    </div>
  )
}

function StatCard({
  label,
  value,
  highlight,
}: {
  label: string
  value: string | number
  highlight?: boolean
}) {
  return (
    <Card>
      <CardContent className="space-y-1 py-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p
          className={`text-2xl font-semibold ${
            highlight ? "text-orange-600" : "text-primary"
          }`}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
