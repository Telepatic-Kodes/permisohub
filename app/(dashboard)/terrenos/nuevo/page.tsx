"use client"

import { useState, type FormEvent } from "react"
import { useRouter } from "next/navigation"
import { AlertCircle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { COMUNAS_CHILE } from "@/lib/comunas-chile"
import { nombresComunasConCobertura } from "@/lib/zonificacion-comunas"
import { SIIEnricher } from "@/components/proyecto/sii-enricher"
import type { SIIData } from "@/lib/sii-lookup"

function listaConY(items: string[]): string {
  if (items.length <= 1) return items.join("")
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`
}

export default function NuevoTerrenoPage() {
  const router = useRouter()
  const [direccion, setDireccion] = useState("")
  const [comuna, setComuna] = useState("")
  const [precioClp, setPrecioClp] = useState("")
  const [superficieLote, setSuperficieLote] = useState("")
  const [rolSii, setRolSii] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  function handleSIIEnrich(data: SIIData) {
    setRolSii(data.rol)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setErrorMsg(null)

    if (!direccion.trim() || !comuna) {
      setErrorMsg("Dirección y comuna son obligatorias")
      return
    }

    setGuardando(true)
    try {
      const res = await fetch("/api/terrenos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direccion: direccion.trim(),
          comuna,
          rol_sii: rolSii.trim() || undefined,
          precio_clp: precioClp ? Number(precioClp) : undefined,
          superficie_lote_m2: superficieLote ? Number(superficieLote) : undefined,
        }),
      })
      const data = await res.json() as { ok?: boolean; id?: string; error?: string }
      if (!data.ok || !data.id) {
        setErrorMsg(data.error ?? "Error al crear el terreno")
        return
      }
      router.push(`/terrenos/${data.id}`)
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error de red")
    } finally {
      setGuardando(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="➕"
        title="Nuevo terreno"
        breadcrumbs={[
          { label: "Terrenos", href: "/terrenos" },
          { label: "Nuevo terreno" },
        ]}
      />
      <div className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-2xl">
          <form onSubmit={handleSubmit}>
            <Card>
              <CardContent className="space-y-5 pt-6">
                <div className="space-y-1.5">
                  <Label htmlFor="direccion">Dirección del terreno</Label>
                  <Input
                    id="direccion"
                    value={direccion}
                    onChange={(e) => setDireccion(e.target.value)}
                    placeholder="Ej: Av. Apoquindo 4500"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="comuna">Comuna</Label>
                  <Select value={comuna} onValueChange={(v) => setComuna(v as string)}>
                    <SelectTrigger id="comuna"><SelectValue placeholder="Selecciona comuna" /></SelectTrigger>
                    <SelectContent>
                      {COMUNAS_CHILE.map((c) => (
                        <SelectItem key={c.id} value={c.nombre}>{c.nombre}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    La zonificación automática hoy cubre {listaConY(nombresComunasConCobertura())} —
                    otras comunas quedarán marcadas &quot;sin cobertura&quot;.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="precio">Precio (CLP, opcional)</Label>
                    <Input
                      id="precio"
                      type="number"
                      value={precioClp}
                      onChange={(e) => setPrecioClp(e.target.value)}
                      placeholder="Ej: 250000000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="superficie">Superficie del lote m² (opcional)</Label>
                    <Input
                      id="superficie"
                      type="number"
                      value={superficieLote}
                      onChange={(e) => setSuperficieLote(e.target.value)}
                      placeholder="Ej: 1200"
                    />
                  </div>
                </div>

                <SIIEnricher onEnrich={handleSIIEnrich} municipio={comuna} applyLabel="Aplicar al terreno" />

                {errorMsg && (
                  <div className="flex items-start gap-2 rounded-md bg-destructive/10 px-3 py-2 text-xs text-destructive">
                    <AlertCircle className="size-3.5 mt-0.5 shrink-0" />
                    {errorMsg}
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button type="submit" disabled={guardando}>
                    {guardando ? "Guardando…" : "Verificar viabilidad"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>
      </div>
    </div>
  )
}
