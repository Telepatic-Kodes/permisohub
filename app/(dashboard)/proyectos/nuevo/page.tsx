"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { AlertCircle, ArrowLeft, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { PageHeader } from "@/components/dashboard/page-header"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { MOCK_CLIENTES } from "@/lib/mock-data"
import { COMUNAS_CHILE } from "@/lib/comunas-chile"
import { ETAPAS_PERMISO, TIPO_PERMISO_LABELS, type TipoPermiso } from "@/types"

const TIPOS = Object.entries(TIPO_PERMISO_LABELS) as [TipoPermiso, string][]

export default function NuevoProyectoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const clienteNombreParam = searchParams.get("cliente") ?? ""
  // Try to match an existing client by name; fall back to "" (user must pick/create)
  const clienteMatch = clienteNombreParam
    ? (MOCK_CLIENTES.find((c) => c.nombre.toLowerCase() === clienteNombreParam.toLowerCase())?.id ?? "")
    : ""
  const [cliente, setCliente] = useState(clienteMatch)
  const [municipio, setMunicipio] = useState(searchParams.get("municipio") ?? "")
  const [tipo, setTipo] = useState("")
  const [etapas, setEtapas] = useState<Record<string, boolean>>(
    Object.fromEntries(ETAPAS_PERMISO.map((e) => [e, true]))
  )
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function toggleEtapa(nombre: string, checked: boolean) {
    setEtapas((prev) => ({ ...prev, [nombre]: checked }))
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMsg(null)
    setGuardando(true)

    const form = new FormData(e.currentTarget)
    const payload = {
      nombre: form.get("nombre") as string,
      cliente_id: cliente,
      municipio,
      tipo,
      direccion: form.get("direccion") as string,
      numero_expediente: (form.get("numero_expediente") as string) || undefined,
      fecha_inicio: form.get("fecha_inicio") as string,
      fecha_estimada: (form.get("fecha_estimada") as string) || undefined,
      notas: (form.get("notas") as string) || undefined,
    }

    try {
      const res = await fetch('/api/proyectos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json() as { ok: boolean; id?: string; error?: string }
      if (!data.ok || !data.id) {
        setErrorMsg(data.error ?? 'Error al crear el proyecto')
        return
      }
      router.push(`/proyectos/${data.id}`)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error de red')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="➕"
        title="Nuevo proyecto"
        breadcrumbs={[
          { label: "Proyectos", href: "/proyectos" },
          { label: "Nuevo proyecto" },
        ]}
      />
      <div className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-3xl">
          <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-2">
              <Label htmlFor="nombre">
                Nombre del proyecto <span className="text-destructive">*</span>
              </Label>
              <Input
                id="nombre"
                name="nombre"
                required
                placeholder="Ej: Tienda Retail Andino — Providencia"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  Cliente <span className="text-destructive">*</span>
                </Label>
                <Select value={cliente} onValueChange={(v) => setCliente(v as string)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_CLIENTES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                    <SelectItem value="nuevo">+ Nuevo cliente</SelectItem>
                  </SelectContent>
                </Select>
                {clienteNombreParam && !clienteMatch && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Prospecto: <span className="font-medium">{clienteNombreParam}</span> — selecciona un cliente existente o crea uno nuevo.
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label>
                  Municipio <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={municipio}
                  onValueChange={(v) => setMunicipio(v as string)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar municipio" />
                  </SelectTrigger>
                  <SelectContent>
                    {COMUNAS_CHILE
                      .slice()
                      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
                      .map((c) => (
                        <SelectItem key={c.id} value={c.nombre}>
                          {c.nombre}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Tipo de permiso <span className="text-destructive">*</span>
              </Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as string)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar tipo de permiso" />
                </SelectTrigger>
                <SelectContent>
                  {TIPOS.map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="direccion">
                Dirección del local <span className="text-destructive">*</span>
              </Label>
              <Input
                id="direccion"
                name="direccion"
                required
                placeholder="Ej: Av. Providencia 1455, Local 3"
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="numero_expediente">N° Expediente DOM</Label>
                <Input
                  id="numero_expediente"
                  name="numero_expediente"
                  placeholder="Ej: EXP-2026-0142"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha_inicio">
                  Fecha de inicio <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="fecha_inicio"
                  name="fecha_inicio"
                  type="date"
                  required
                />
              </div>
            </div>

            <div className="space-y-2 sm:w-1/2 sm:pr-2.5">
              <Label htmlFor="fecha_estimada">
                Fecha estimada de aprobación
              </Label>
              <Input id="fecha_estimada" name="fecha_estimada" type="date" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notas">Notas</Label>
              <Textarea
                id="notas"
                name="notas"
                rows={4}
                placeholder="Observaciones, contexto del cliente, plazos críticos..."
              />
            </div>

            <div className="space-y-3 border-t border-border pt-5">
              <div>
                <Label>Etapas iniciales</Label>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Desmarca las etapas que no apliquen a este proyecto.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {ETAPAS_PERMISO.map((etapa) => (
                  <label
                    key={etapa}
                    className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border p-2.5 text-sm"
                  >
                    <Checkbox
                      checked={etapas[etapa]}
                      onCheckedChange={(checked) =>
                        toggleEtapa(etapa, Boolean(checked))
                      }
                    />
                    {etapa}
                  </label>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {errorMsg && (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            {errorMsg}
          </div>
        )}

        <div className="mt-6 flex items-center justify-between">
          <Link
            href="/proyectos"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-4" />
            Volver
          </Link>
          <Button
            type="submit"
            disabled={guardando}
            className="bg-primary text-white hover:bg-primary/90 disabled:opacity-60"
          >
            {guardando ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Crear proyecto'
            )}
          </Button>
        </div>
          </form>
        </div>
      </div>
    </div>
  )
}
