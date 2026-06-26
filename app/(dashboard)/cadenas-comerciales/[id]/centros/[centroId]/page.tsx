"use client"

import { use, useCallback, useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { AlertTriangle, ChevronRight, ClipboardCheck, Copy, Download, History, Mail, MessageCircle, Pencil, Plus, Store, Upload } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { LocalHistorialDrawer } from "@/components/cadenas/local-historial-drawer"
import { DomDigitalBadge } from "@/components/cadenas/dom-digital-badge"
import { EspecialidadesTracker } from "@/components/cadenas/especialidades-tracker"
import { ObservacionesDOM } from "@/components/cadenas/observaciones-dom"
import { OnboardingWizard } from "@/components/cadenas/onboarding-wizard"
import { Button, buttonVariants } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog, DialogClose, DialogContent, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { MOCK_CADENAS, MOCK_CENTROS, MOCK_LOCALES } from "@/lib/mock-data"
import { USO_LOCAL_LABELS } from "@/types"
import type { CentroComercial, Local, UsoLocal } from "@/types"

const ESTADO_BADGE: Record<string, string> = {
  borrador:           'bg-slate-100 text-slate-600 border-slate-200',
  ingresado:          'bg-blue-100 text-blue-700 border-blue-200',
  en_revision:        'bg-violet-100 text-violet-700 border-violet-200',
  con_observaciones:  'bg-amber-100 text-amber-700 border-amber-200',
  aprobado:           'bg-green-100 text-green-700 border-green-200',
  rechazado:          'bg-red-100 text-red-700 border-red-200',
}

type BulkInvite = { local_id: string; numero: string; negocio: string; email: string | null; url: string }
type CsvRow = { numero: string; nombre_negocio: string; uso: string; area_m2: string; tenant_nombre: string; tenant_email: string }

function parseCSV(text: string): CsvRow[] {
  const lines = text.trim().split('\n').filter(Boolean)
  if (lines.length < 2) return []
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
    const row: Record<string, string> = {}
    headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
    return {
      numero: row['numero'] ?? '',
      nombre_negocio: row['nombre_negocio'] ?? '',
      uso: row['uso'] ?? '',
      area_m2: row['area_m2'] ?? '',
      tenant_nombre: row['tenant_nombre'] ?? '',
      tenant_email: row['tenant_email'] ?? '',
    }
  }).filter(r => r.numero)
}

function downloadTemplate() {
  const csv = 'numero,nombre_negocio,uso,area_m2,tenant_nombre,tenant_email\nL-101,Starbucks,food,120,Juan García,juan@starbucks.cl\nL-102,H&M,retail,850,María López,contacto@hm.cl'
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'plantilla-locales.csv'; a.click()
  URL.revokeObjectURL(url)
}

function downloadBulkCSV(invites: BulkInvite[]) {
  const header = 'numero,negocio,email,url_portal'
  const rows = invites.map(i => `${i.numero},${i.negocio},${i.email ?? ''},${i.url}`)
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'portales-tenants.csv'; a.click()
  URL.revokeObjectURL(url)
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

  // Nuevo local
  const [savingLocal, setSavingLocal] = useState(false)
  const closeLocalRef = useRef<HTMLButtonElement>(null)

  // Edit local
  const [editingLocal, setEditingLocal] = useState<Local | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const closeEditRef = useRef<HTMLButtonElement>(null)

  // CSV import
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [csvDragging, setCsvDragging] = useState(false)
  const [importingCSV, setImportingCSV] = useState(false)
  const [importResult, setImportResult] = useState<{ created: number; skipped: number } | null>(null)
  const closeCSVRef = useRef<HTMLButtonElement>(null)

  // Bulk portal
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkInvites, setBulkInvites] = useState<BulkInvite[]>([])
  const [bulkDone, setBulkDone] = useState(false)
  const closeBulkRef = useRef<HTMLButtonElement>(null)

  // Local historial drawer
  const [historialLocal, setHistorialLocal] = useState<{ id: string; numero: string; negocio: string } | null>(null)

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

  async function handleSubmitLocal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSavingLocal(true)
    const form = new FormData(e.currentTarget)
    const body = {
      numero: form.get('numero') as string,
      nombre_negocio: form.get('nombre_negocio') as string,
      uso: (form.get('uso') as UsoLocal) || undefined,
      area_m2: Number(form.get('area_m2') ?? 0) || undefined,
      tenant_nombre: form.get('tenant_nombre') as string,
      tenant_email: form.get('tenant_email') as string,
    }
    try {
      const res = await fetch(`/api/centros/${centroId}/locales`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const json = await res.json() as { ok: boolean; local?: Local }
      if (json.ok) {
        const nuevo: Local = json.local ?? { id: crypto.randomUUID(), centro_id: centroId, created_at: new Date().toISOString(), ...body }
        setLocales(prev => [nuevo, ...prev])
        closeLocalRef.current?.click()
      }
    } finally { setSavingLocal(false) }
  }

  async function handleEditLocal(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingLocal) return
    setSavingEdit(true)
    const form = new FormData(e.currentTarget)
    const body = {
      numero: form.get('numero') as string,
      nombre_negocio: form.get('nombre_negocio') as string,
      uso: (form.get('uso') as UsoLocal) || undefined,
      area_m2: Number(form.get('area_m2') ?? 0) || undefined,
      tenant_nombre: form.get('tenant_nombre') as string,
      tenant_email: form.get('tenant_email') as string,
    }
    try {
      const res = await fetch(`/api/locales/${editingLocal.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const json = await res.json() as { ok: boolean; local?: Local }
      if (json.ok) {
        setLocales(prev => prev.map(l => l.id === editingLocal.id ? { ...l, ...body } : l))
        setEditingLocal(null)
        closeEditRef.current?.click()
      }
    } finally { setSavingEdit(false) }
  }

  const handleCSVFile = useCallback((file: File) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setCsvRows(parseCSV(text))
      setImportResult(null)
    }
    reader.readAsText(file)
  }, [])

  async function handleImportCSV() {
    if (csvRows.length === 0) return
    setImportingCSV(true)
    const rows = csvRows.map(r => ({
      numero: r.numero,
      nombre_negocio: r.nombre_negocio || undefined,
      uso: r.uso || undefined,
      area_m2: r.area_m2 ? Number(r.area_m2) : undefined,
      tenant_nombre: r.tenant_nombre || undefined,
      tenant_email: r.tenant_email || undefined,
    }))
    try {
      const res = await fetch(`/api/centros/${centroId}/locales/import`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rows }),
      })
      const json = await res.json() as { ok: boolean; created: number; skipped: number }
      if (json.ok) {
        setImportResult({ created: json.created, skipped: json.skipped })
        // Refresh locales list
        const updated = await fetch(`/api/centros/${centroId}`)
          .then(r => r.json())
          .then((d: { centro?: CentroComercial & { locales?: Local[] } }) => d.centro?.locales ?? null)
          .catch(() => null)
        if (updated) setLocales(updated)
        else {
          const newLocales: Local[] = rows.map(r => ({
            id: crypto.randomUUID(), centro_id: centroId, created_at: new Date().toISOString(),
            numero: r.numero, nombre_negocio: r.nombre_negocio, uso: r.uso as UsoLocal,
            area_m2: r.area_m2, tenant_nombre: r.tenant_nombre, tenant_email: r.tenant_email,
          }))
          setLocales(prev => [...newLocales, ...prev])
        }
      }
    } finally { setImportingCSV(false) }
  }

  async function handleBulkPortal() {
    setBulkLoading(true)
    setBulkDone(false)
    try {
      const res = await fetch(`/api/centros/${centroId}/portal-bulk`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      })
      const json = await res.json() as { ok: boolean; invites: BulkInvite[] }
      if (json.ok) {
        setBulkInvites(json.invites)
        setBulkDone(true)
      }
    } finally { setBulkLoading(false) }
  }

  if (!centro) return <div className="p-8 text-muted-foreground">Centro no encontrado.</div>

  const usos = ['todos', ...Array.from(new Set(locales.map(l => l.uso ?? 'otro')))]
  const localesFiltrados = filtroUso === 'todos' ? locales : locales.filter(l => (l.uso ?? 'otro') === filtroUso)
  const conPermiso = locales.filter(l => (l.proyectos?.length ?? 0) > 0).length
  const sinPermiso = locales.length - conPermiso
  const conEmail = locales.filter(l => l.tenant_email).length

  const dialogNuevoLocal = (
    <Dialog>
      <DialogTrigger render={<Button size="sm" />}>
        <Plus className="size-4" /> Nuevo local
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Nuevo local</DialogTitle></DialogHeader>
        <form onSubmit={handleSubmitLocal} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="numero">N° local *</Label>
              <Input id="numero" name="numero" placeholder="L-101" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="area_m2">Área (m²)</Label>
              <Input id="area_m2" name="area_m2" type="number" placeholder="120" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="nombre_negocio">Nombre del negocio</Label>
            <Input id="nombre_negocio" name="nombre_negocio" placeholder="Starbucks" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="uso">Tipo de uso</Label>
            <select id="uso" name="uso" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">Seleccionar…</option>
              {Object.entries(USO_LOCAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tenant_nombre">Contacto locatario</Label>
              <Input id="tenant_nombre" name="tenant_nombre" placeholder="Nombre" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tenant_email">Email locatario</Label>
              <Input id="tenant_email" name="tenant_email" type="email" placeholder="contacto@negocio.cl" />
            </div>
          </div>
          <DialogFooter>
            <DialogClose render={<Button ref={closeLocalRef} variant="outline" />}>Cancelar</DialogClose>
            <Button type="submit" disabled={savingLocal}>{savingLocal ? "Guardando…" : "Crear local"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        emoji="🏪"
        title={centro.nombre}
        subtitle={`${centro.municipio} · ${centro.area_m2?.toLocaleString() ?? '—'} m²`}
        breadcrumbs={[
          { label: 'Cadenas', href: '/cadenas-comerciales' },
          { label: mockCadena?.nombre ?? 'Cadena', href: `/cadenas-comerciales/${id}` },
        ]}
        action={
          <div className="flex gap-2">
            {/* Importar CSV */}
            <Dialog onOpenChange={open => { if (!open) { setCsvRows([]); setImportResult(null) } }}>
              <DialogTrigger render={<Button size="sm" variant="outline" />}>
                <Upload className="size-4" /> Importar CSV
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Importar locales desde CSV</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <p className="text-muted-foreground">Descarga la plantilla, complétala y súbela.</p>
                    <Button size="sm" variant="outline" onClick={downloadTemplate}>
                      <Download className="size-3.5" /> Descargar plantilla
                    </Button>
                  </div>

                  {/* Drop zone */}
                  <div
                    onDragOver={e => { e.preventDefault(); setCsvDragging(true) }}
                    onDragLeave={() => setCsvDragging(false)}
                    onDrop={e => {
                      e.preventDefault(); setCsvDragging(false)
                      const file = e.dataTransfer.files[0]
                      if (file) handleCSVFile(file)
                    }}
                    className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${csvDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/20 hover:border-primary/40'}`}
                    onClick={() => document.getElementById('csv-upload')?.click()}
                  >
                    <Upload className="size-8 mx-auto mb-2 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {csvRows.length > 0
                        ? <span className="font-medium text-foreground">{csvRows.length} filas cargadas</span>
                        : <>Arrastra tu archivo CSV o <span className="underline">haz clic para seleccionar</span></>}
                    </p>
                    <input id="csv-upload" type="file" accept=".csv" className="hidden"
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleCSVFile(f) }} />
                  </div>

                  {/* Preview */}
                  {csvRows.length > 0 && !importResult && (
                    <div className="rounded-lg border overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-muted">
                          <tr>
                            {['Local', 'Negocio', 'Uso', 'm²', 'Tenant', 'Email'].map(h => (
                              <th key={h} className="text-left px-2 py-1.5 font-medium text-muted-foreground">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {csvRows.slice(0, 5).map((r, i) => (
                            <tr key={i} className="border-t">
                              <td className="px-2 py-1.5 font-mono font-semibold">{r.numero}</td>
                              <td className="px-2 py-1.5">{r.nombre_negocio || '—'}</td>
                              <td className="px-2 py-1.5">{r.uso || '—'}</td>
                              <td className="px-2 py-1.5">{r.area_m2 || '—'}</td>
                              <td className="px-2 py-1.5">{r.tenant_nombre || '—'}</td>
                              <td className="px-2 py-1.5 text-muted-foreground">{r.tenant_email || '—'}</td>
                            </tr>
                          ))}
                          {csvRows.length > 5 && (
                            <tr className="border-t bg-muted/30">
                              <td colSpan={6} className="px-2 py-1.5 text-center text-muted-foreground">
                                … y {csvRows.length - 5} filas más
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Result */}
                  {importResult && (
                    <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800">
                      ✓ {importResult.created} locales importados correctamente
                      {importResult.skipped > 0 && ` · ${importResult.skipped} omitidos (ya existían)`}
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <DialogClose render={<Button ref={closeCSVRef} variant="outline" />}>Cerrar</DialogClose>
                  {!importResult && (
                    <Button onClick={handleImportCSV} disabled={csvRows.length === 0 || importingCSV}>
                      {importingCSV ? "Importando…" : `Importar ${csvRows.length} locales`}
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Enviar portales */}
            <Dialog onOpenChange={open => { if (!open) { setBulkInvites([]); setBulkDone(false) } }}>
              <DialogTrigger render={<Button size="sm" variant="outline" />}>
                <Mail className="size-4" /> Enviar portales
              </DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>Envío masivo de portales a tenants</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  {!bulkDone ? (
                    <div className="rounded-xl border bg-muted/30 p-5 space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Total locales en este centro</span>
                        <span className="font-semibold">{locales.length}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Con email registrado</span>
                        <span className="font-semibold text-primary">{conEmail}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Sin email (no recibirán link)</span>
                        <span className="font-semibold text-amber-600">{locales.length - conEmail}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-800 flex items-center justify-between">
                        <span>✓ {bulkInvites.length} links generados</span>
                        <Button size="sm" variant="outline" onClick={() => downloadBulkCSV(bulkInvites)}>
                          <Download className="size-3.5" /> Descargar CSV
                        </Button>
                      </div>
                      <div className="rounded-lg border overflow-hidden max-h-64 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="bg-muted sticky top-0">
                            <tr>
                              {['Local', 'Negocio', 'Email', 'URL', ''].map(h => (
                                <th key={h} className="text-left px-2 py-1.5 font-medium text-muted-foreground">{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {bulkInvites.map(inv => (
                              <tr key={inv.local_id} className="border-t hover:bg-muted/30">
                                <td className="px-2 py-1.5 font-mono font-semibold">{inv.numero}</td>
                                <td className="px-2 py-1.5">{inv.negocio}</td>
                                <td className="px-2 py-1.5 text-muted-foreground">{inv.email ?? '—'}</td>
                                <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[140px]">{inv.url}</td>
                                <td className="px-2 py-1.5">
                                  <button
                                    onClick={() => navigator.clipboard.writeText(inv.url)}
                                    className="text-muted-foreground hover:text-foreground"
                                    title="Copiar URL"
                                  >
                                    <Copy className="size-3.5" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
                <DialogFooter>
                  <DialogClose render={<Button ref={closeBulkRef} variant="outline" />}>Cerrar</DialogClose>
                  {!bulkDone && (
                    <Button onClick={handleBulkPortal} disabled={bulkLoading || conEmail === 0}>
                      {bulkLoading ? "Generando…" : `Generar ${conEmail} links`}
                    </Button>
                  )}
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {dialogNuevoLocal}
          </div>
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
          <button key={u} onClick={() => setFiltroUso(u)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filtroUso === u
                ? 'bg-foreground text-background border-foreground'
                : 'border-border text-muted-foreground hover:border-foreground/40'
            }`}
          >
            {u === 'todos' ? 'Todos' : USO_LOCAL_LABELS[u as keyof typeof USO_LOCAL_LABELS] ?? u}
            {u !== 'todos' && <span className="ml-1.5 opacity-60">{locales.filter(l => (l.uso ?? 'otro') === u).length}</span>}
          </button>
        ))}
      </div>

      {/* Tabla */}
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
              <TableHead>DOM Digital</TableHead>
              <TableHead>Especialidades</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {localesFiltrados.map(local => {
              const proyectoActivo = local.proyectos?.[0]
              return (
                <TableRow key={local.id} className="hover:bg-muted/40 group">
                  <TableCell>
                    <Link href={`/cadenas-comerciales/${id}/centros/${centroId}/locales/${local.id}`}
                      className="font-mono font-semibold text-sm hover:underline">
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
                  <TableCell className="text-sm text-muted-foreground">{local.tenant_email ?? '—'}</TableCell>
                  <TableCell>
                    <DomDigitalBadge
                      localId={local.id}
                      municipio={centro?.municipio ?? ''}
                      numero={local.numero}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setHistorialLocal({ id: local.id, numero: local.numero, negocio: local.nombre_negocio ?? local.numero })}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Ver historial"
                      >
                        <History className="size-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingLocal(local)}
                        className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                        title="Editar local"
                      >
                        <Pencil className="size-3.5" />
                      </button>
                      <Link href={`/cadenas-comerciales/${id}/centros/${centroId}/receptor?localId=${local.id}`} className={buttonVariants({ variant: "ghost", size: "sm" })}>
                          <ClipboardCheck className="size-3.5" />
                          Receptor
                      </Link>
                      <OnboardingWizard
                        localId={local.id}
                        localNombre={local.nombre_negocio ?? `Local ${local.numero}`}
                        municipio={centro?.municipio ?? ''}
                      />
                      <button
                        title="Enviar WhatsApp al tenant"
                        className="p-1 rounded hover:bg-green-50 text-green-600 hover:text-green-700 cursor-pointer"
                        onClick={() => {
                          void fetch(`/api/cadenas/${id}/whatsapp-bulk`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ localIds: [local.id], tipo: 'recordatorio' }),
                          }).then(() => alert('WhatsApp enviado'))
                        }}
                      >
                        <MessageCircle className="size-3.5" />
                      </button>
                      <Link href={`/cadenas-comerciales/${id}/centros/${centroId}/locales/${local.id}`}>
                        <ChevronRight className="size-4 text-muted-foreground" />
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              )
            })}
            {localesFiltrados.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center py-10 text-muted-foreground">
                  No hay locales registrados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {locales.length > 0 && (
        <div className="space-y-6">
          {locales.map((local) => (
            <div key={`esp-${local.id}`} className="rounded-xl border bg-card p-4 space-y-4">
              <div className="text-sm font-medium text-muted-foreground">
                Local {local.numero}{local.nombre_negocio ? ` — ${local.nombre_negocio}` : ''}
              </div>
              <EspecialidadesTracker localId={local.id} />
              <ObservacionesDOM localId={local.id} municipio={centro?.municipio ?? ''} localNumero={local.numero} />
            </div>
          ))}
        </div>
      )}

      <LocalHistorialDrawer
        localId={historialLocal?.id ?? ''}
        localNumero={historialLocal?.numero ?? ''}
        negocio={historialLocal?.negocio ?? ''}
        open={!!historialLocal}
        onClose={() => setHistorialLocal(null)}
      />

      {/* Edit local dialog (controlled externally) */}
      <Dialog open={!!editingLocal} onOpenChange={open => { if (!open) setEditingLocal(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar local {editingLocal?.numero}</DialogTitle></DialogHeader>
          {editingLocal && (
            <form onSubmit={handleEditLocal} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-numero">N° local *</Label>
                  <Input id="edit-numero" name="numero" defaultValue={editingLocal.numero} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-area_m2">Área (m²)</Label>
                  <Input id="edit-area_m2" name="area_m2" type="number" defaultValue={editingLocal.area_m2 ?? ''} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-nombre_negocio">Nombre del negocio</Label>
                <Input id="edit-nombre_negocio" name="nombre_negocio" defaultValue={editingLocal.nombre_negocio ?? ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-uso">Tipo de uso</Label>
                <select id="edit-uso" name="uso" defaultValue={editingLocal.uso ?? ''}
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring">
                  <option value="">Seleccionar…</option>
                  {Object.entries(USO_LOCAL_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-tenant_nombre">Contacto locatario</Label>
                  <Input id="edit-tenant_nombre" name="tenant_nombre" defaultValue={editingLocal.tenant_nombre ?? ''} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-tenant_email">Email locatario</Label>
                  <Input id="edit-tenant_email" name="tenant_email" type="email" defaultValue={editingLocal.tenant_email ?? ''} />
                </div>
              </div>
              <DialogFooter>
                <DialogClose render={<Button ref={closeEditRef} variant="outline" onClick={() => setEditingLocal(null)} />}>
                  Cancelar
                </DialogClose>
                <Button type="submit" disabled={savingEdit}>{savingEdit ? "Guardando…" : "Guardar cambios"}</Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
