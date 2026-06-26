"use client"

import { use, useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { AlertTriangle, Building2, ChevronRight, Download, FileText, MapPin, Pencil, Plus, Sparkles, Store, TrendingUp } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { NotificacionesDialog } from "@/components/cadenas/notificaciones-dialog"
import { BenchmarkCentros } from "@/components/cadenas/benchmark-centros"
import { CostForecast } from "@/components/cadenas/cost-forecast"
import { AiPermisosDialog } from "@/components/cadenas/ai-permisos-dialog"
import { RiskDashboard } from "@/components/cadenas/risk-dashboard"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogClose, DialogContent, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { MOCK_CADENAS, MOCK_CENTROS, MOCK_LOCALES } from "@/lib/mock-data"
import type { Cadena, CentroComercial } from "@/types"

type CentroConStats = CentroComercial & {
  locales_count: number
  activos: number
  alertas: number
  cobertura_pct: number
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
    .map(cc => {
      const locCount = MOCK_LOCALES.filter(l => l.centro_id === cc.id).length
      return { ...cc, locales_count: locCount, activos: 0, alertas: 0, cobertura_pct: 0 }
    })

  const [cadena, setCadena] = useState<Cadena | undefined>(mockCadena)
  const [centros, setCentros] = useState<CentroConStats[]>(mockCentros)
  const [saving, setSaving] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [downloadingPDF, setDownloadingPDF] = useState(false)

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
              cobertura_pct: 0,
            })))
          }
        }
      })
      .catch(() => undefined)
  }, [id])

  async function handleSubmitCentro(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const form = new FormData(e.currentTarget)
    const body = {
      nombre: form.get('nombre') as string,
      municipio: form.get('municipio') as string,
      direccion: form.get('direccion') as string,
      area_m2: Number(form.get('area_m2') ?? 0) || undefined,
      num_locales: Number(form.get('num_locales') ?? 0) || undefined,
      gerente_nombre: form.get('gerente_nombre') as string,
      gerente_email: form.get('gerente_email') as string,
    }
    try {
      const res = await fetch(`/api/cadenas/${id}/centros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { ok: boolean; centro?: CentroComercial }
      if (json.ok) {
        const nuevo: CentroConStats = json.centro
          ? { ...json.centro, locales_count: 0, activos: 0, alertas: 0, cobertura_pct: 0 }
          : { id: crypto.randomUUID(), cadena_id: id, created_at: new Date().toISOString(), municipio: body.municipio, nombre: body.nombre, locales_count: 0, activos: 0, alertas: 0, cobertura_pct: 0 }
        setCentros(prev => [nuevo, ...prev])
        closeRef.current?.click()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleDownloadPDF() {
    setDownloadingPDF(true)
    try {
      const res = await fetch(`/api/cadenas/${id}/reporte`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `reporte-${(cadena?.nombre ?? 'cadena').toLowerCase().replace(/[^a-z0-9]/g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setDownloadingPDF(false)
    }
  }

  if (!cadena) return <div className="p-8 text-muted-foreground">Cadena no encontrada.</div>

  const totalLocales = centros.reduce((s, cc) => s + cc.locales_count, 0)
  const totalAlertas = centros.reduce((s, cc) => s + cc.alertas, 0)
  const totalActivos = centros.reduce((s, cc) => s + cc.activos, 0)
  const coberturaGlobal = totalLocales > 0 ? Math.round((totalActivos / totalLocales) * 100) : 0

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        emoji="🏬"
        title={cadena.nombre}
        subtitle={cadena.rut ? `RUT ${cadena.rut}` : 'Cadena comercial'}
        breadcrumbs={[{ label: 'Cadenas', href: '/cadenas-comerciales' }]}
        action={
          <div className="flex gap-2">
            <AiPermisosDialog cadenaId={id} cadenaNombre={cadena?.nombre ?? ''} />
            <NotificacionesDialog cadenaId={id} />
            <Link href={`/cadenas-comerciales/${id}/compliance`}>
              <Button size="sm" variant="outline">
                <FileText className="size-4" /> Pack Compliance
              </Button>
            </Link>
            <Button size="sm" variant="outline" onClick={handleDownloadPDF} disabled={downloadingPDF}>
              {downloadingPDF ? <><FileText className="size-4 animate-pulse" /> Generando…</> : <><Download className="size-4" /> Reporte PDF</>}
            </Button>
            <Dialog>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="size-4" /> Nuevo centro
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo centro comercial</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmitCentro} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre del centro *</Label>
                  <Input id="nombre" name="nombre" placeholder="Mall Arauco Maipú" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="municipio">Municipio *</Label>
                    <Input id="municipio" name="municipio" placeholder="Maipú" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="area_m2">Área total (m²)</Label>
                    <Input id="area_m2" name="area_m2" type="number" placeholder="65000" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="direccion">Dirección</Label>
                  <Input id="direccion" name="direccion" placeholder="Av. Pajaritos 3000" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="num_locales">N° locales estimados</Label>
                    <Input id="num_locales" name="num_locales" type="number" placeholder="120" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gerente_nombre">Gerente de centro</Label>
                    <Input id="gerente_nombre" name="gerente_nombre" placeholder="Nombre" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="gerente_email">Email gerente</Label>
                  <Input id="gerente_email" name="gerente_email" type="email" placeholder="gerente@centro.cl" />
                </div>
                <DialogFooter>
                  <DialogClose render={<Button ref={closeRef} variant="outline" />}>
                    Cancelar
                  </DialogClose>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Guardando…" : "Crear centro"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
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

      {/* Cobertura de permisos */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="size-4 text-muted-foreground" />
            <span className="text-sm font-semibold">Cobertura de permisos por centro</span>
          </div>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {coberturaGlobal}% cobertura global
          </span>
        </div>
        <div className="flex flex-col gap-4">
          {centros.map(cc => {
            const pct = cc.locales_count > 0 ? Math.round((cc.activos / cc.locales_count) * 100) : 0
            return (
              <div key={cc.id}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <Link href={`/cadenas-comerciales/${id}/centros/${cc.id}`} className="font-medium hover:underline">
                    {cc.nombre}
                  </Link>
                  <span className="text-muted-foreground">
                    {cc.activos}/{cc.locales_count} con permiso · <span className="font-medium">{pct}%</span>
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${pct >= 80 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-blue-400'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
          {centros.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">Sin centros registrados.</p>
          )}
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

      {/* Grid de centros */}
      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">Centros comerciales</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {centros.map(cc => {
            const estado = centroEstado(cc)
            return (
              <Link
                key={cc.id}
                href={`/cadenas-comerciales/${id}/centros/${cc.id}`}
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
          <button
            onClick={() => document.querySelector<HTMLButtonElement>('[data-dialog-trigger]')?.click()}
            className="rounded-xl border-2 border-dashed border-muted-foreground/20 p-5 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/40 hover:text-primary transition-colors min-h-[160px] cursor-pointer"
          >
            <Plus className="size-6" />
            <span className="text-sm font-medium">Agregar centro</span>
          </button>
        </div>
      </div>

      <RiskDashboard cadenaId={id} />

      <BenchmarkCentros cadenaId={id} />

      <CostForecast cadenaId={id} />
    </div>
  )
}
