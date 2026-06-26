"use client"
// cadenas-v2
import { useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { AlertTriangle, Building2, ChevronRight, MapPin, Pencil, Plus, Store } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import {
  Dialog, DialogClose, DialogContent, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { MOCK_CADENAS, MOCK_CENTROS } from "@/lib/mock-data"
import { EnterpriseGate } from "@/components/cadenas/enterprise-gate"
import { getLimits } from "@/lib/plan-limits"
import type { Cadena } from "@/types"
import type { PlanId } from "@/lib/stripe"

type CadenaConStats = Cadena & { num_centros: number; num_locales: number; proyectos_activos: number }

// In production this comes from the session. For demo: override with ?plan=enterprise in URL
function useWorkspacePlan(): PlanId {
  if (typeof window !== 'undefined') {
    const p = new URLSearchParams(window.location.search).get('plan') as PlanId | null
    if (p && ['free', 'starter', 'pro', 'estudio', 'enterprise'].includes(p)) return p
  }
  return 'enterprise' // default to enterprise for demo
}

export default function CadenasPage() {
  const plan = useWorkspacePlan()
  const limits = getLimits(plan)
  const router = useRouter()
  const [cadenas, setCadenas] = useState<CadenaConStats[]>(
    MOCK_CADENAS.map(c => ({
      ...c,
      num_centros: MOCK_CENTROS.filter(cc => cc.cadena_id === c.id).length,
      num_locales: MOCK_CENTROS.filter(cc => cc.cadena_id === c.id).reduce((s, cc) => s + (cc.num_locales ?? 0), 0),
      proyectos_activos: 0,
    }))
  )
  const [saving, setSaving] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const [editingCadena, setEditingCadena] = useState<CadenaConStats | null>(null)
  const [savingEdit, setSavingEdit] = useState(false)
  const closeEditRef = useRef<HTMLButtonElement>(null)
  const [rutStatus, setRutStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle')
  const [rutData, setRutData] = useState<{ razon_social: string; giro: string } | null>(null)

  async function handleRutBlur(rut: string) {
    if (!rut || rut.length < 8) { setRutStatus('idle'); return }
    setRutStatus('loading')
    try {
      const res = await fetch(`/api/enrich/rut?rut=${encodeURIComponent(rut)}`)
      const data = await res.json() as { ok: boolean; razon_social?: string; giro?: string; error?: string }
      if (data.ok) {
        setRutStatus('valid')
        setRutData({ razon_social: data.razon_social ?? '', giro: data.giro ?? '' })
      } else {
        setRutStatus('invalid')
        setRutData(null)
      }
    } catch {
      setRutStatus('idle')
    }
  }

  useEffect(() => {
    fetch('/api/cadenas')
      .then(r => r.json())
      .then((d: { data?: CadenaConStats[] }) => {
        if (d.data && d.data.length > 0) setCadenas(d.data)
      })
      .catch(() => undefined)
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const form = new FormData(e.currentTarget)
    const municipiosRaw = (form.get('municipios') as string) ?? ''
    const body = {
      nombre: form.get('nombre') as string,
      rut: form.get('rut') as string,
      contacto_nombre: form.get('contacto_nombre') as string,
      email: form.get('email') as string,
      municipios: municipiosRaw.split(',').map(m => m.trim()).filter(Boolean),
    }
    try {
      const res = await fetch('/api/cadenas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { ok: boolean; cadena?: Cadena }
      if (json.ok) {
        const nueva: CadenaConStats = json.cadena
          ? { ...json.cadena, num_centros: 0, num_locales: 0, proyectos_activos: 0 }
          : { id: crypto.randomUUID(), workspace_id: '', ...body, created_at: new Date().toISOString(), num_centros: 0, num_locales: 0, proyectos_activos: 0 }
        setCadenas(prev => [nueva, ...prev])
        setRutStatus('idle')
        setRutData(null)
        closeRef.current?.click()
      }
    } finally {
      setSaving(false)
    }
  }

  async function handleEditCadena(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!editingCadena) return
    setSavingEdit(true)
    const form = new FormData(e.currentTarget)
    const municipiosRaw = (form.get('municipios') as string) ?? ''
    const body = {
      nombre: form.get('nombre') as string,
      rut: form.get('rut') as string,
      contacto_nombre: form.get('contacto_nombre') as string,
      email: form.get('email') as string,
      municipios: municipiosRaw.split(',').map(m => m.trim()).filter(Boolean),
    }
    try {
      const res = await fetch(`/api/cadenas/${editingCadena.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const json = await res.json() as { ok: boolean }
      if (json.ok) {
        setCadenas(prev => prev.map(c => c.id === editingCadena.id ? { ...c, ...body } : c))
        setEditingCadena(null)
        closeEditRef.current?.click()
      }
    } finally { setSavingEdit(false) }
  }

  if (!limits.cadenaModule) return <EnterpriseGate />

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        emoji="🏬"
        title="Cadenas Comerciales"
        subtitle="Carteras de centros comerciales y locales"
        action={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => router.push('/cadenas-comerciales/alertas')}>
              <AlertTriangle className="size-4" />Alertas
            </Button>
          <Dialog onOpenChange={open => { if (!open) { setRutStatus('idle'); setRutData(null) } }}>
            <DialogTrigger render={<Button size="sm" />}>
              <Plus className="size-4" /> Nueva cadena
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nueva cadena comercial</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Razón social *</Label>
                  <Input id="nombre" name="nombre" placeholder="Parque Arauco S.A." required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rut">RUT</Label>
                    <Input id="rut" name="rut" placeholder="93.308.000-5" onBlur={(e) => void handleRutBlur(e.target.value)} />
                    {rutStatus === 'loading' && <p className="text-xs text-muted-foreground mt-1">Verificando RUT...</p>}
                    {rutStatus === 'valid' && rutData && (
                      <p className="text-xs text-green-600 mt-1">✓ {rutData.razon_social} — {rutData.giro}</p>
                    )}
                    {rutStatus === 'invalid' && <p className="text-xs text-destructive mt-1">RUT inválido</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contacto_nombre">Contacto</Label>
                    <Input id="contacto_nombre" name="contacto_nombre" placeholder="Nombre del contacto" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email corporativo</Label>
                  <Input id="email" name="email" type="email" placeholder="gerencia@cadena.cl" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="municipios">Municipios (separados por coma)</Label>
                  <Input id="municipios" name="municipios" placeholder="Las Condes, Maipú, Quilicura" />
                </div>
                <DialogFooter>
                  <DialogClose render={<Button ref={closeRef} variant="outline" />}>
                    Cancelar
                  </DialogClose>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Guardando…" : "Crear cadena"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
          </div>
        }
      />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Building2 className="size-4" /> Cadenas activas
          </div>
          <div className="text-3xl font-semibold">{cadenas.length}</div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <MapPin className="size-4" /> Centros comerciales
          </div>
          <div className="text-3xl font-semibold">
            {cadenas.reduce((s, c) => s + c.num_centros, 0)}
          </div>
        </div>
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <Store className="size-4" /> Locales gestionados
          </div>
          <div className="text-3xl font-semibold">
            {cadenas.reduce((s, c) => s + c.num_locales, 0)}
          </div>
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cadena</TableHead>
              <TableHead>RUT</TableHead>
              <TableHead>Municipios</TableHead>
              <TableHead className="text-right">Centros</TableHead>
              <TableHead className="text-right">Locales</TableHead>
              <TableHead className="text-right">Permisos activos</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {cadenas.map(c => (
              <TableRow key={c.id} className="cursor-pointer hover:bg-muted/40">
                <TableCell>
                  <Link href={`/cadenas-comerciales/${c.id}`} className="font-medium hover:underline">
                    {c.nombre}
                  </Link>
                  {c.contacto_nombre && (
                    <div className="text-xs text-muted-foreground">{c.contacto_nombre}</div>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{c.rut ?? '—'}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {(c.municipios ?? []).slice(0, 3).map(m => (
                      <Badge key={m} variant="secondary" className="text-xs font-normal">{m}</Badge>
                    ))}
                    {(c.municipios ?? []).length > 3 && (
                      <Badge variant="outline" className="text-xs font-normal">
                        +{(c.municipios ?? []).length - 3}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-medium">{c.num_centros}</TableCell>
                <TableCell className="text-right font-medium">{c.num_locales}</TableCell>
                <TableCell className="text-right">
                  {c.proyectos_activos > 0 ? (
                    <Badge className="bg-blue-500/10 text-blue-600 border-blue-200">{c.proyectos_activos}</Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setEditingCadena(c)}
                      className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="Editar cadena"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <Link href={`/cadenas-comerciales/${c.id}`}>
                      <ChevronRight className="size-4 text-muted-foreground" />
                    </Link>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {cadenas.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  No hay cadenas registradas.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Edit cadena dialog */}
      <Dialog open={!!editingCadena} onOpenChange={open => { if (!open) setEditingCadena(null) }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar cadena</DialogTitle></DialogHeader>
          {editingCadena && (
            <form onSubmit={handleEditCadena} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-nombre">Razón social *</Label>
                <Input id="edit-nombre" name="nombre" defaultValue={editingCadena.nombre} required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-rut">RUT</Label>
                  <Input id="edit-rut" name="rut" defaultValue={editingCadena.rut ?? ''} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-contacto">Contacto</Label>
                  <Input id="edit-contacto" name="contacto_nombre" defaultValue={editingCadena.contacto_nombre ?? ''} />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-email">Email corporativo</Label>
                <Input id="edit-email" name="email" type="email" defaultValue={editingCadena.email ?? ''} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-municipios">Municipios (separados por coma)</Label>
                <Input id="edit-municipios" name="municipios" defaultValue={(editingCadena.municipios ?? []).join(', ')} />
              </div>
              <DialogFooter>
                <DialogClose render={<Button ref={closeEditRef} variant="outline" onClick={() => setEditingCadena(null)} />}>
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
