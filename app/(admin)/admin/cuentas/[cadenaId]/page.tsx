import Link from "next/link"
import { headers } from "next/headers"
import { notFound } from "next/navigation"
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  HelpCircle,
  Layers,
  XCircle,
} from "lucide-react"

import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Cadena, CentroComercial } from "@/types"

export const dynamic = "force-dynamic"

type NivelRiesgo = "CRITICO" | "ALTO" | "MEDIO" | "BAJO" | string

/** Shape returned by `/api/cadenas/[id]/risk-scores` (owned by another component). */
interface LocalRiskScore {
  local_id: string
  nombre_negocio: string
  centro: string
  score: number
  nivel: NivelRiesgo
  factores: string[]
}

async function getCtx() {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000"
  const proto = h.get("x-forwarded-proto") ?? "http"
  return { base: `${proto}://${host}`, cookie: h.get("cookie") ?? "" }
}

async function fetchCadena(id: string): Promise<Cadena | null> {
  try {
    const { base, cookie } = await getCtx()
    const res = await fetch(`${base}/api/cadenas/${id}`, {
      cache: "no-store",
      headers: { cookie },
    })
    if (!res.ok) return null
    const json = (await res.json()) as { cadena?: Cadena }
    return json.cadena ?? null
  } catch {
    return null
  }
}

async function fetchRiskScores(id: string): Promise<LocalRiskScore[]> {
  try {
    const { base, cookie } = await getCtx()
    const res = await fetch(`${base}/api/cadenas/${id}/risk-scores`, {
      cache: "no-store",
      headers: { cookie },
    })
    if (!res.ok) return []
    const json = (await res.json()) as { locales?: LocalRiskScore[] }
    return json.locales ?? []
  } catch {
    return []
  }
}

interface LocalStatusCounts {
  total: number
  vigentes: number
  porVencer: number
  vencidos: number
  sinDatos: number
}

/** Clasifica cada local según el estado de su permiso vigente más reciente. */
function computeStatusCounts(
  centros: CentroComercial[] | undefined,
): LocalStatusCounts {
  const counts: LocalStatusCounts = {
    total: 0,
    vigentes: 0,
    porVencer: 0,
    vencidos: 0,
    sinDatos: 0,
  }
  if (!centros) return counts

  const now = Date.now()
  const en30Dias = now + 30 * 24 * 60 * 60 * 1000

  for (const centro of centros) {
    for (const local of centro.locales ?? []) {
      counts.total += 1
      const aprobado = (local.proyectos ?? [])
        .filter((p) => p.estado === "aprobado")
        .sort((a, b) => (b.fecha_otorgamiento ?? "").localeCompare(a.fecha_otorgamiento ?? ""))[0]

      if (!aprobado) {
        counts.sinDatos += 1
        continue
      }
      if (!aprobado.fecha_vencimiento_permiso) {
        counts.vigentes += 1
        continue
      }
      const venc = new Date(`${aprobado.fecha_vencimiento_permiso}T00:00:00`).getTime()
      if (venc < now) counts.vencidos += 1
      else if (venc <= en30Dias) counts.porVencer += 1
      else counts.vigentes += 1
    }
  }
  return counts
}

const NIVEL_STYLES: Record<string, string> = {
  CRITICO: "bg-red-100 text-red-700",
  ALTO: "bg-orange-100 text-orange-700",
  MEDIO: "bg-amber-100 text-amber-700",
  BAJO: "bg-emerald-100 text-emerald-700",
}

function NivelBadge({ nivel }: { nivel: NivelRiesgo }) {
  const cls = NIVEL_STYLES[nivel] ?? "bg-muted text-muted-foreground"
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {nivel}
    </span>
  )
}

function StatusCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Building2
  label: string
  value: number
  accent: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 px-5 py-4">
        <div className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${accent}`}>
          <Icon className="size-4" />
        </div>
        <div className="leading-tight">
          <p className="text-xl font-semibold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )
}

const NIVEL_ORDER: Record<string, number> = {
  CRITICO: 0,
  ALTO: 1,
  MEDIO: 2,
  BAJO: 3,
}

export default async function AdminCadenaDetailPage({
  params,
}: {
  params: Promise<{ cadenaId: string }>
}) {
  const { cadenaId } = await params
  const [cadena, riskScores] = await Promise.all([
    fetchCadena(cadenaId),
    fetchRiskScores(cadenaId),
  ])

  if (!cadena) notFound()

  const counts = computeStatusCounts(cadena.centros)
  const sortedRisk = [...riskScores].sort(
    (a, b) => (NIVEL_ORDER[a.nivel] ?? 9) - (NIVEL_ORDER[b.nivel] ?? 9) || b.score - a.score,
  )

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-card px-8 py-6">
        <Link
          href="/admin/cuentas"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-4" />
          Cuentas
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-primary">{cadena.nombre}</h1>
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {cadena.rut && <span>RUT {cadena.rut}</span>}
          {cadena.email && <span>{cadena.email}</span>}
          {cadena.municipios && cadena.municipios.length > 0 && (
            <span>{cadena.municipios.join(", ")}</span>
          )}
        </div>
      </header>

      <div className="flex-1 space-y-6 p-8">
        {/* Status KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          <StatusCard
            icon={Layers}
            label="Locales"
            value={counts.total}
            accent="bg-primary/10 text-primary"
          />
          <StatusCard
            icon={CheckCircle2}
            label="Vigentes"
            value={counts.vigentes}
            accent="bg-emerald-50 text-emerald-600"
          />
          <StatusCard
            icon={Clock}
            label="Por vencer (30d)"
            value={counts.porVencer}
            accent="bg-amber-50 text-amber-600"
          />
          <StatusCard
            icon={XCircle}
            label="Vencidos"
            value={counts.vencidos}
            accent="bg-red-50 text-red-600"
          />
          <StatusCard
            icon={HelpCircle}
            label="Sin datos"
            value={counts.sinDatos}
            accent="bg-muted text-muted-foreground"
          />
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap gap-3">
          <Link
            href={`/cadenas-comerciales/${cadena.id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            <ExternalLink className="size-4" />
            Ver compliance completo →
          </Link>
          <button
            type="button"
            disabled
            className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground"
            title="Próximamente"
          >
            <FileText className="size-4" />
            Generar reporte PDF
          </button>
        </div>

        {/* Risk table */}
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            <AlertTriangle className="size-4 text-amber-500" />
            Riesgo por local
          </h2>
          {sortedRisk.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                No hay datos de riesgo disponibles para esta cadena.
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-card">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-semibold">Local</TableHead>
                    <TableHead className="font-semibold">Centro</TableHead>
                    <TableHead className="font-semibold">Nivel</TableHead>
                    <TableHead className="font-semibold">Score</TableHead>
                    <TableHead className="font-semibold">Factores</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRisk.map((r) => (
                    <TableRow key={r.local_id} className="hover:bg-background">
                      <TableCell className="font-medium text-primary">
                        {r.nombre_negocio}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {r.centro}
                      </TableCell>
                      <TableCell>
                        <NivelBadge nivel={r.nivel} />
                      </TableCell>
                      <TableCell className="text-sm tabular-nums text-muted-foreground">
                        {r.score}
                      </TableCell>
                      <TableCell className="max-w-xs text-xs text-muted-foreground">
                        {r.factores.length > 0 ? r.factores.join(" · ") : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
