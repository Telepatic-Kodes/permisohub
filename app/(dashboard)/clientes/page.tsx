"use client"

import { type FormEvent } from "react"
import { Plus } from "lucide-react"

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

export default function ClientesPage() {
  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    // eslint-disable-next-line no-console
    console.log("Nuevo cliente:", Object.fromEntries(form.entries()))
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1A3328]">
          Clientes
        </h1>
        <Dialog>
          <DialogTrigger
            render={
              <Button className="bg-[#1A3328] text-white hover:bg-[#1A3328]/90" />
            }
          >
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
                <DialogClose render={<Button variant="outline" />}>
                  Cancelar
                </DialogClose>
                <Button
                  type="submit"
                  className="bg-[#1A3328] text-white hover:bg-[#1A3328]/90"
                >
                  Guardar cliente
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

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
            {MOCK_CLIENTES.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium text-[#1A3328]">
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
                  <span className="inline-flex min-w-6 justify-center rounded-full bg-[#1A3328]/10 px-2 py-0.5 text-xs font-medium text-[#1A3328]">
                    {PROYECTOS_ACTIVOS_POR_CLIENTE[c.id] ?? 0}
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" className="text-[#1A3328]">
                    Ver
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
