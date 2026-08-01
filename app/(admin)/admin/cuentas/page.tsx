import Link from "next/link"
import { headers } from "next/headers"
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Layers,
  TrendingUp,
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
import type { Cadena, CentroComercial, Local } from "@/types"

export const dynamic = "force-dynamic"

/** Shape returned by `/api/cadenas/alertas` (owned by another component). */
interface Alerta {
  cadena_id: string
  cadena_nombre: string
  tipo: string
  descripcion: string
  prioridad: "critica" | "alta" | "media" | "baja" | string
  local_id?: string
}

/** Per-cadena KPIs computed from the cadena tree + alertas feed. */
interface CadenaRow {
  cadena: Cadena
  numCentros: number
  numLocales: number
  compliancePct: number | null
  alertasActivas: number
  alertasCriticas: number
}

async function baseUrl(): Promise<string> {
  const h = await headers()
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:7891"
  const proto = h.get("x-forwarded-proto") ?? "http"
  return `${proto}://${host}`
}

async function fetchCadenas(): Promise<Cadena[]> {
  try {
    const res = await fetch(`${await baseUrl()}/api/cadenas`, {
      cache: "no-store",
      headers: { cookie: (await headers()).get("cookie") ?? "" },
    })
    if (!res.ok) return []
    const json = (await res.json()) as { cadenas?: Cadena[] }
    return json.cadenas ?? []
  } catch {
    return []
  }
}

async function fetchAlertas(): Promise<Alerta[]> {
  try {
    const res = await fetch(`${await baseUrl()}/api/cadenas/alertas`, {
      cache: "no-store",
      headers: { cookie: (await headers()).get("cookie") ?? "" },
    })
    if (!res.ok) return []
    const json = (await res.json()) as { alertas?: Alerta[] }
    return json.alertas ?? []
  } catch {
    return []
  }
}

function countLocales(centros: CentroComercial[] | undefined): number {
  if (!centros) return 0
  return centros.reduce((acc, c) => {
    const locales: Local[] = c.locales ?? []
    return acc + (locales.length || c.num_locales || 0)
  }, 0)
}

/**
 * Compliance ratio = locales con proyecto/permiso vigente sobre el total de
 * locales. Un permiso se considera "vigente" si está aprobado y, de tener
 * fecha de vencimiento, ésta es futura.
 */
function computeCompliance(centros: CentroComercial[] | undefined): number | null {
  if (!centros) return null
  let total = 0
  let vigentes = 0
  const now = Date.now()

  for (const centro of centros) {
    for (const local of centro.locales ?? []) {
      total += 1
      const tieneVigente = (local.proyectos ?? []).some((p) => {
        if (p.estado !== "aprobado") return false
        if (!p.fecha_vencimiento_permiso) return true
        return new Date(`${p.fecha_vencimiento_permiso}T00:00:00`).getTime() > now
      })
      if (tieneVigente) vigentes += 1
    }
  }

  if (total === 0) return null
  return Math.round((vigentes / total) * 100)
}

function CompliancePill({ pct }: { pct: number | null }) {
  if (pct === null) {
    return <span className="text-sm text-muted-foreground">Sin datos</span>
  }
  const cls =
    pct >= 80
      ? "bg-emerald-50 text-emerald-700"
      : pct >= 50
        ? "bg-amber-50 text-amber-700"
        : "bg-red-50 text-red-700"
  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {pct}%
    </span>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Building2
  label: string
  value: string | number
  accent?: string
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 px-5 py-4">
        <div
          className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
            accent ?? "bg-primary/10 text-primary"
          }`}
        >
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

export default async function AdminCuentasPage() {
  const [cadenas, alertas] = await Promise.all([fetchCadenas(), fetchAlertas()])

  const alertasPorCadena = new Map<string, { total: number; criticas: number }>()
  for (const a of alertas) {
    const cur = alertasPorCadena.get(a.cadena_id) ?? { total: 0, criticas: 0 }
    cur.total += 1
    if (a.prioridad === "critica") cur.criticas += 1
    alertasPorCadena.set(a.cadena_id, cur)
  }

  const rows: CadenaRow[] = cadenas.map((cadena) => {
    const counts = alertasPorCadena.get(cadena.id) ?? { total: 0, criticas: 0 }
    return {
      cadena,
      numCentros: cadena.centros?.length ?? 0,
      numLocales: countLocales(cadena.centros),
      compliancePct: computeCompliance(cadena.centros),
      alertasActivas: counts.total,
      alertasCriticas: counts.criticas,
    }
  })

  const totalCadenas = rows.length
  const totalLocales = rows.reduce((acc, r) => acc + r.numLocales, 0)
  const complianceValues = rows
    .map((r) => r.compliancePct)
    .filter((v): v is number => v !== null)
  const avgCompliance =
    complianceValues.length > 0
      ? Math.round(
          complianceValues.reduce((a, b) => a + b, 0) / complianceValues.length,
        )
      : null
  const alertasCriticas = rows.reduce((acc, r) => acc + r.alertasCriticas, 0)

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-border bg-card px-8 py-6">
        <h1 className="text-2xl font-semibold text-primary">Cuentas</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadenas comerciales bajo gestión outsourcing
        </p>
      </header>

      <div className="flex-1 space-y-6 p-8">
        {/* KPIs */}
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard icon={Building2} label="Cadenas gestionadas" value={totalCadenas} />
          <KpiCard
            icon={Layers}
            label="Locales bajo gestión"
            value={totalLocales}
            accent="bg-sky-50 text-sky-600"
          />
          <KpiCard
            icon={TrendingUp}
            label="Compliance promedio"
            value={avgCompliance === null ? "—" : `${avgCompliance}%`}
            accent="bg-emerald-50 text-emerald-600"
          />
          <KpiCard
            icon={AlertTriangle}
            label="Alertas críticas"
            value={alertasCriticas}
            accent={
              alertasCriticas > 0
                ? "bg-red-50 text-red-600"
                : "bg-emerald-50 text-emerald-600"
            }
          />
        </div>

        {/* Table */}
        {rows.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted">
                <Building2 className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium text-foreground">Sin cadenas registradas</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Aún no hay cadenas comerciales bajo gestión.
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-semibold">Cadena</TableHead>
                  <TableHead className="font-semibold">Centros</TableHead>
                  <TableHead className="font-semibold">Locales</TableHead>
                  <TableHead className="font-semibold">Compliance</TableHead>
                  <TableHead className="font-semibold">Alertas</TableHead>
                  <TableHead className="text-right font-semibold">Detalle</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.cadena.id} className="hover:bg-background">
                    <TableCell>
                      <p className="font-medium text-primary">{r.cadena.nombre}</p>
                      {r.cadena.rut && (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {r.cadena.rut}
                        </p>
                      )}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {r.numCentros}
                    </TableCell>
                    <TableCell className="text-sm tabular-nums text-muted-foreground">
                      {r.numLocales}
                    </TableCell>
                    <TableCell>
                      <CompliancePill pct={r.compliancePct} />
                    </TableCell>
                    <TableCell>
                      {r.alertasActivas > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-700">
                          <AlertTriangle className="size-3" />
                          {r.alertasActivas}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 className="size-3" />
                          OK
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/admin/cuentas/${r.cadena.id}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Ver detalle →
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </div>
  )
}
