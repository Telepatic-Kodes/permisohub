"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { ExternalLink, Plus } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { SectionTabs } from "@/components/dashboard/section-tabs"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  MOCK_CLIENTES,
  PROYECTOS_ACTIVOS_POR_CLIENTE,
} from "@/lib/mock-data"
import type { Cliente } from "@/types"

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>(MOCK_CLIENTES)
  const [proyectosCount, setProyectosCount] = useState<Record<string, number>>(
    PROYECTOS_ACTIVOS_POR_CLIENTE,
  )
  const [saving, setSaving] = useState(false)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    fetch('/api/clientes')
      .then((r) => r.json())
      .then((json: { data: Cliente[]; source: string }) => {
        if (json.data && json.data.length > 0 && json.source === 'db') {
          setClientes(json.data)
          setProyectosCount({})
        }
      })
      .catch(() => undefined)
  }, [])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    const form = new FormData(e.currentTarget)
    const body = {
      nombre: form.get('nombre') as string,
      rut: form.get('rut') as string,
      contacto_nombre: form.get('contacto') as string,
      email: form.get('email') as string,
      telefono: form.get('telefono') as string,
      notas: form.get('notas') as string,
    }

    try {
      const res = await fetch('/api/clientes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json() as { ok: boolean; id: string; cliente?: Cliente }
      if (json.ok) {
        const nuevoCliente: Cliente = json.cliente ?? {
          id: json.id,
          nombre: body.nombre,
          rut: body.rut || undefined,
          contacto_nombre: body.contacto_nombre || undefined,
          email: body.email || undefined,
          telefono: body.telefono || undefined,
          notas: body.notas || undefined,
          created_at: new Date().toISOString(),
        }
        setClientes((prev) => [nuevoCliente, ...prev])
        closeRef.current?.click()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="🏢"
        title="Clientes"
        action={
          <Dialog>
            <DialogTrigger render={<Button />}>
              <Plus className="size-4" />
              Nuevo cliente
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Nuevo cliente</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="nombre">Nombre</Label>
                  <Input id="nombre" name="nombre" placeholder="Razón social" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="rut">RUT</Label>
                    <Input id="rut" name="rut" placeholder="76.123.456-7" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="contacto">Contacto</Label>
                    <Input
                      id="contacto"
                      name="contacto"
                      placeholder="Nombre del contacto"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      name="email"
                      type="email"
                      placeholder="correo@empresa.cl"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="telefono">Teléfono</Label>
                    <Input
                      id="telefono"
                      name="telefono"
                      placeholder="+56 9 1234 5678"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notas">Notas</Label>
                  <Textarea id="notas" name="notas" rows={3} />
                </div>
                <DialogFooter>
                  <DialogClose render={<Button ref={closeRef} variant="outline" />}>
                    Cancelar
                  </DialogClose>
                  <Button type="submit" disabled={saving}>
                    {saving ? "Guardando…" : "Guardar cliente"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <SectionTabs
        tabs={[
          { label: "Clientes", href: "/clientes" },
          { label: "CRM / Prospectos", href: "/prospectos" },
        ]}
        active="/clientes"
      />

      <div className="flex-1 overflow-auto p-8">
        <div className="rounded-xl border border-border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>RUT</TableHead>
                <TableHead>Contacto</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Teléfono</TableHead>
                <TableHead>Proyectos activos</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {clientes.map((c) => (
                <TableRow
                  key={c.id}
                  className="group/row hover:bg-primary/[0.02]"
                >
                  <TableCell className="font-medium text-primary">
                    {c.nombre}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.rut ?? "—"}
                  </TableCell>
                  <TableCell>{c.contacto_nombre ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.email ?? "—"}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.telefono ?? "—"}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex min-w-6 justify-center rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                      {proyectosCount[c.id] ?? 0}
                    </span>
                  </TableCell>
                  <TableCell className="w-16">
                    <div className="flex justify-end gap-0.5 opacity-0 transition-opacity group-hover/row:opacity-100">
                      <Button
                        nativeButton={false}
                        render={<Link href={`/clientes/${c.id}`} />}
                        variant="ghost"
                        size="icon-sm"
                        title="Ver"
                      >
                        <ExternalLink className="size-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  )
}
