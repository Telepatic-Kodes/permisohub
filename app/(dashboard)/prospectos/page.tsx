"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { ExternalLink, LayoutGrid, List, Plus, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PageHeader } from "@/components/dashboard/page-header"
import { SectionTabs } from "@/components/dashboard/section-tabs"
import { MOCK_PROSPECTOS } from "@/lib/mock-data"
import {
  ETAPA_CRM_CONFIG,
  FUENTE_LABELS,
  type EtapaCRM,
  type Prospecto,
} from "@/types"
import { cn } from "@/lib/utils"

const PIPELINE_ETAPAS: EtapaCRM[] = [
  "nuevo_contacto",
  "contactado",
  "reunion_agendada",
  "propuesta_enviada",
  "negociando",
]

const ETAPA_OPTIONS: { value: string; label: string }[] = [
  { value: "todas", label: "Todas las etapas" },
  ...PIPELINE_ETAPAS.map((e) => ({ value: e, label: ETAPA_CRM_CONFIG[e].label })),
  { value: "ganado", label: ETAPA_CRM_CONFIG.ganado.label },
  { value: "descartado", label: ETAPA_CRM_CONFIG.descartado.label },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-CL", {
    style: "currency",
    currency: "CLP",
    maximumFractionDigits: 0,
  }).format(value)
}

function formatCompact(value: number) {
  return `$${(value / 1_000_000).toFixed(1)}M`
}

function formatDate(value?: string) {
  if (!value) return "—"
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

const TODAY = new Date("2026-06-19T00:00:00")

function daysUntil(value?: string) {
  if (!value) return null
  const target = new Date(`${value}T00:00:00`)
  return Math.round((target.getTime() - TODAY.getTime()) / (1000 * 60 * 60 * 24))
}

function proximoLabel(value?: string) {
  const d = daysUntil(value)
  if (d === null) return null
  if (d < 0) return `Atrasado ${Math.abs(d)}d`
  if (d === 0) return "Hoy"
  return `En ${d}d`
}

function proximoColor(value?: string) {
  const d = daysUntil(value)
  if (d === null) return "text-muted-foreground"
  if (d <= 0) return "text-red-600"
  if (d <= 7) return "text-amber-600"
  return "text-muted-foreground"
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-tight text-[#1A3328]">
        {value}
      </p>
    </div>
  )
}

function ProspectoCard({ prospecto }: { prospecto: Prospecto }) {
  const prox = proximoLabel(prospecto.proximo_contacto)
  return (
    <Link
      href={`/prospectos/${prospecto.id}`}
      className="block rounded-xl border border-gray-100 bg-white p-3 shadow-sm transition-colors hover:bg-[#F0EBE1]"
    >
      <p className="text-sm font-semibold text-[#1A3328]">{prospecto.empresa}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">
        {prospecto.contacto_nombre}
        {prospecto.cargo ? ` · ${prospecto.cargo}` : ""}
      </p>
      {prospecto.valor_estimado ? (
        <p className="mt-2 text-sm font-medium text-[#1A3328]">
          {formatCurrency(prospecto.valor_estimado)}
        </p>
      ) : null}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="inline-flex rounded-full bg-[#F0EBE1] px-2 py-0.5 text-[11px] font-medium text-[#1A3328]">
          {FUENTE_LABELS[prospecto.fuente]}
        </span>
        {prox ? (
          <span
            className={cn(
              "text-[11px] font-medium",
              proximoColor(prospecto.proximo_contacto)
            )}
          >
            {prox}
          </span>
        ) : null}
      </div>
    </Link>
  )
}

type NuevoProspectoForm = {
  empresa: string
  contacto_nombre: string
  cargo: string
  email: string
  telefono: string
  fuente: string
  valor_estimado: string
}

const FORM_EMPTY: NuevoProspectoForm = {
  empresa: "", contacto_nombre: "", cargo: "",
  email: "", telefono: "", fuente: "referido", valor_estimado: "",
}

function NuevoProspectoDialog({
  open, onClose, onCreated,
}: { open: boolean; onClose: () => void; onCreated?: (p: Prospecto) => void }) {
  const [form, setForm] = useState<NuevoProspectoForm>(FORM_EMPTY)
  const [saving, setSaving] = useState(false)

  function setField(k: keyof NuevoProspectoForm, v: string) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/prospectos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empresa: form.empresa,
          contacto_nombre: form.contacto_nombre,
          cargo: form.cargo || undefined,
          email: form.email || undefined,
          telefono: form.telefono || undefined,
          fuente: form.fuente,
          valor_estimado: form.valor_estimado ? parseInt(form.valor_estimado, 10) : undefined,
          etapa: 'nuevo_contacto',
        }),
      })
      const json = await res.json() as { ok: boolean; id: string; prospecto?: Prospecto }
      if (json.ok) {
        const nuevo: Prospecto = json.prospecto ?? {
          id: json.id,
          empresa: form.empresa,
          contacto_nombre: form.contacto_nombre,
          cargo: form.cargo || undefined,
          email: form.email || undefined,
          telefono: form.telefono || undefined,
          fuente: form.fuente as Prospecto['fuente'],
          etapa: 'nuevo_contacto',
          valor_estimado: form.valor_estimado ? parseInt(form.valor_estimado, 10) : undefined,
          created_at: new Date().toISOString(),
        }
        onCreated?.(nuevo)
        setForm(FORM_EMPTY)
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[#1A3328]">Nuevo prospecto</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2 space-y-1.5">
              <Label htmlFor="np-empresa">Empresa *</Label>
              <Input id="np-empresa" placeholder="Nombre empresa" required value={form.empresa} onChange={(e) => setField("empresa", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-contacto">Nombre contacto *</Label>
              <Input id="np-contacto" placeholder="Juan Pérez" required value={form.contacto_nombre} onChange={(e) => setField("contacto_nombre", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-cargo">Cargo</Label>
              <Input id="np-cargo" placeholder="Gerente de Expansión" value={form.cargo} onChange={(e) => setField("cargo", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-email">Email</Label>
              <Input id="np-email" type="email" placeholder="email@empresa.cl" value={form.email} onChange={(e) => setField("email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-telefono">Teléfono</Label>
              <Input id="np-telefono" placeholder="+56 9 XXXX XXXX" value={form.telefono} onChange={(e) => setField("telefono", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Fuente</Label>
              <Select value={form.fuente} onValueChange={(v) => setField("fuente", v ?? "otro")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(FUENTE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="np-valor">Valor estimado (CLP)</Label>
              <Input id="np-valor" type="number" placeholder="1500000" value={form.valor_estimado} onChange={(e) => setField("valor_estimado", e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={saving} className="bg-[#1A3328] text-white hover:bg-[#1A3328]/90">
              {saving ? "Guardando…" : "Guardar prospecto"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export default function ProspectosPage() {
  const [view, setView] = useState<"pipeline" | "lista">("pipeline")
  const [search, setSearch] = useState("")
  const [etapaFilter, setEtapaFilter] = useState("todas")
  const [showNuevo, setShowNuevo] = useState(false)
  const [allProspectos, setAllProspectos] = useState<Prospecto[]>(MOCK_PROSPECTOS)

  useEffect(() => {
    fetch('/api/prospectos')
      .then((r) => r.json())
      .then((json: { data: Prospecto[]; source: string }) => {
        if (json.data && json.data.length > 0 && json.source === 'db') {
          setAllProspectos(json.data)
        }
      })
      .catch(() => undefined)
  }, [])

  const stats = useMemo(() => {
    const activos = allProspectos.filter(
      (p) => p.etapa !== "ganado" && p.etapa !== "descartado"
    )
    const enNegociacion = allProspectos.filter(
      (p) => p.etapa === "negociando" || p.etapa === "propuesta_enviada"
    ).length
    const ganadosMes = allProspectos.filter(
      (p) => p.etapa === "ganado"
    ).length
    const valorPipeline = activos.reduce(
      (sum, p) => sum + (p.valor_estimado ?? 0),
      0
    )
    return {
      totalActivos: activos.length,
      enNegociacion,
      ganadosMes,
      valorPipeline,
    }
  }, [allProspectos])

  const ganados = allProspectos.filter((p) => p.etapa === "ganado")
  const descartados = allProspectos.filter((p) => p.etapa === "descartado")

  const byEtapa = useMemo(() => {
    const map: Record<EtapaCRM, Prospecto[]> = {
      nuevo_contacto: [],
      contactado: [],
      reunion_agendada: [],
      propuesta_enviada: [],
      negociando: [],
      ganado: [],
      descartado: [],
    }
    for (const p of allProspectos) map[p.etapa].push(p)
    return map
  }, [allProspectos])

  const listaFiltrada = useMemo(() => {
    const q = search.trim().toLowerCase()
    return allProspectos.filter((p) => {
      const matchSearch =
        !q ||
        p.empresa.toLowerCase().includes(q) ||
        p.contacto_nombre.toLowerCase().includes(q)
      const matchEtapa = etapaFilter === "todas" || p.etapa === etapaFilter
      return matchSearch && matchEtapa
    })
  }, [allProspectos, search, etapaFilter])

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="📈"
        title="CRM / Prospectos"
        subtitle="Pipeline de ventas"
        action={
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-gray-100 bg-white p-0.5 shadow-sm">
              <button
                type="button"
                onClick={() => setView("pipeline")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  view === "pipeline"
                    ? "bg-primary text-white"
                    : "text-primary/70 hover:bg-[#F0EBE1]"
                )}
              >
                <LayoutGrid className="size-4" />
                Pipeline
              </button>
              <button
                type="button"
                onClick={() => setView("lista")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  view === "lista"
                    ? "bg-primary text-white"
                    : "text-primary/70 hover:bg-[#F0EBE1]"
                )}
              >
                <List className="size-4" />
                Lista
              </button>
            </div>
            <Button onClick={() => setShowNuevo(true)}>
              <Plus className="size-4" />
              Nuevo prospecto
            </Button>
            <NuevoProspectoDialog
              open={showNuevo}
              onClose={() => setShowNuevo(false)}
              onCreated={(p) => setAllProspectos((prev) => [p, ...prev])}
            />
          </div>
        }
        toolbar={
          view === "lista" ? (
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar por empresa o contacto..."
                  className="pl-9"
                />
              </div>
              <Select
                value={etapaFilter}
                onValueChange={(v) => setEtapaFilter(v as string)}
              >
                <SelectTrigger className="sm:w-56">
                  <SelectValue placeholder="Etapa" />
                </SelectTrigger>
                <SelectContent>
                  {ETAPA_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : undefined
        }
      />

      <SectionTabs
        tabs={[
          { label: "Clientes", href: "/clientes" },
          { label: "CRM / Prospectos", href: "/prospectos" },
        ]}
        active="/prospectos"
      />

      <div className="flex-1 overflow-auto p-8">
        <div className="space-y-6">
          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard
              label="Prospectos activos"
              value={String(stats.totalActivos)}
            />
            <StatCard
              label="En negociación"
              value={String(stats.enNegociacion)}
            />
            <StatCard
              label="Ganados este mes"
              value={String(stats.ganadosMes)}
            />
            <StatCard
              label="Valor pipeline"
              value={formatCompact(stats.valorPipeline)}
            />
          </div>

          {view === "pipeline" ? (
            <div className="space-y-6">
              {/* Kanban */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
            {PIPELINE_ETAPAS.map((etapa) => {
              const cfg = ETAPA_CRM_CONFIG[etapa]
              const items = byEtapa[etapa]
              return (
                <div key={etapa} className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <div className="flex items-center gap-2">
                      <span className={cn("size-2 rounded-full", cfg.dot)} />
                      <span className="text-sm font-medium text-primary">
                        {cfg.label}
                      </span>
                    </div>
                    <span className="rounded-full bg-[#F0EBE1] px-2 py-0.5 text-xs font-medium text-primary">
                      {items.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {items.map((p) => (
                      <ProspectoCard key={p.id} prospecto={p} />
                    ))}
                    {items.length === 0 && (
                      <p className="rounded-xl border border-dashed border-gray-200 px-3 py-6 text-center text-xs text-muted-foreground">
                        Sin prospectos
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Ganados / Descartados */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-green-50 p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="size-2 rounded-full bg-green-500" />
                <h2 className="text-sm font-medium text-green-800">
                  Ganados ({ganados.length})
                </h2>
              </div>
              <div className="space-y-2">
                {ganados.map((p) => (
                  <Link
                    key={p.id}
                    href={`/prospectos/${p.id}`}
                    className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm transition-colors hover:bg-[#F0EBE1]"
                  >
                    <div>
                      <p className="text-sm font-medium text-primary">
                        {p.empresa}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.contacto_nombre}
                      </p>
                    </div>
                    {p.valor_estimado ? (
                      <span className="text-sm font-medium text-green-700">
                        {formatCurrency(p.valor_estimado)}
                      </span>
                    ) : null}
                  </Link>
                ))}
                {ganados.length === 0 && (
                  <p className="text-xs text-muted-foreground">Sin prospectos.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span className="size-2 rounded-full bg-gray-400" />
                <h2 className="text-sm font-medium text-gray-700">
                  Descartados ({descartados.length})
                </h2>
              </div>
              <div className="space-y-2">
                {descartados.map((p) => (
                  <Link
                    key={p.id}
                    href={`/prospectos/${p.id}`}
                    className="flex items-center justify-between rounded-lg bg-white px-3 py-2 shadow-sm transition-colors hover:bg-[#F0EBE1]"
                  >
                    <div>
                      <p className="text-sm font-medium text-primary">
                        {p.empresa}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {p.contacto_nombre}
                      </p>
                    </div>
                  </Link>
                ))}
                {descartados.length === 0 && (
                  <p className="text-xs text-muted-foreground">Sin prospectos.</p>
                )}
              </div>
            </div>
          </div>
        </div>
          ) : (
            <div className="space-y-4">
              {/* Tabla */}
              <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Contacto</TableHead>
                      <TableHead>Fuente</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Valor estimado</TableHead>
                      <TableHead>Próximo contacto</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {listaFiltrada.map((p) => {
                      const cfg = ETAPA_CRM_CONFIG[p.etapa]
                      return (
                        <TableRow
                          key={p.id}
                          className="group/row hover:bg-primary/[0.02]"
                        >
                          <TableCell className="font-medium text-primary">
                            {p.empresa}
                          </TableCell>
                          <TableCell>
                            <p className="text-primary">{p.contacto_nombre}</p>
                            {p.cargo ? (
                              <p className="text-xs text-muted-foreground">
                                {p.cargo}
                              </p>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {FUENTE_LABELS[p.fuente]}
                          </TableCell>
                          <TableCell>
                            <span
                              className={cn(
                                "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                                cfg.bg,
                                cfg.color
                              )}
                            >
                              {cfg.label}
                            </span>
                          </TableCell>
                          <TableCell className="text-primary">
                            {p.valor_estimado
                              ? formatCurrency(p.valor_estimado)
                              : "—"}
                          </TableCell>
                          <TableCell>
                            {p.proximo_contacto ? (
                              <span
                                className={cn(
                                  "text-sm",
                                  proximoColor(p.proximo_contacto)
                                )}
                              >
                                {formatDate(p.proximo_contacto)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="w-16">
                            <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100">
                              <Button
                                nativeButton={false}
                                render={<Link href={`/prospectos/${p.id}`} />}
                                variant="ghost"
                                size="icon-sm"
                                title="Ver"
                              >
                                <ExternalLink className="size-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {listaFiltrada.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={7}
                          className="py-10 text-center text-muted-foreground"
                        >
                          No se encontraron prospectos con los filtros aplicados.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
