"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, Calculator, Info } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
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
  calcularDerechosMunicipales,
  TIPO_OBRA_LABELS,
  type CalculoDerechos,
  type TipoObra,
} from "@/lib/derechos-municipales"
import { COMUNAS_CHILE } from "@/lib/comunas-chile"

const TIPOS_OBRA = Object.entries(TIPO_OBRA_LABELS) as [TipoObra, string][]

interface UfData {
  valor: number
  fecha: string | null
  fallback: boolean
}

export default function CalculadoraDerechosPage() {
  const [resultado, setResultado] = useState<CalculoDerechos | null>(null)
  const [ufActual, setUfActual] = useState<UfData | null>(null)

  useEffect(() => {
    fetch('/api/utils/uf')
      .then(r => r.json() as Promise<UfData & { ok: boolean }>)
      .then(data => setUfActual({ valor: data.valor, fecha: data.fecha, fallback: data.fallback ?? false }))
      .catch(() => setUfActual({ valor: 38000, fecha: null, fallback: true }))
  }, [])

  const [form, setForm] = useState({
    municipio: "",
    tipoObra: "obra_nueva" as TipoObra,
    presupuestoObra: "",
    superficieConstruida: "",
    esDFL2: false,
  })

  function setField<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const formularioValido = useMemo(
    () =>
      form.municipio !== "" &&
      form.presupuestoObra !== "" &&
      Number(form.presupuestoObra) > 0 &&
      form.superficieConstruida !== "" &&
      Number(form.superficieConstruida) > 0,
    [form]
  )

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formularioValido) return
    setResultado(
      calcularDerechosMunicipales(
        Number(form.presupuestoObra),
        form.tipoObra,
        Number(form.superficieConstruida),
        form.esDFL2,
        form.municipio,
        ufActual?.valor ?? 38000
      )
    )
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="🧮"
        title="Calculadora de derechos"
        breadcrumbs={[
          { label: "IA Normativa" },
          { label: "Calculadora de derechos" },
        ]}
      />
      <div className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-3xl space-y-6">
      {/* UF badge */}
      {ufActual && (
        <div className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
          ufActual.fallback
            ? 'border-amber-200 bg-amber-50 text-amber-700'
            : 'border-border bg-muted/40 text-muted-foreground'
        }`}>
          <span className="font-medium">
            UF: ${ufActual.valor.toLocaleString('es-CL', { minimumFractionDigits: 2 })}
          </span>
          <span>·</span>
          <span>
            {ufActual.fallback
              ? 'valor referencial (mindicador.cl no disponible)'
              : `actualizado ${new Date(ufActual.fecha!).toLocaleDateString('es-CL')}`}
          </span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-primary">
              Datos de la obra
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Municipio *</Label>
                <Select
                  value={form.municipio}
                  onValueChange={(v) => setField("municipio", v as string)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
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

              <div className="space-y-2">
                <Label>Tipo de obra *</Label>
                <Select
                  value={form.tipoObra}
                  onValueChange={(v) => setField("tipoObra", v as TipoObra)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPOS_OBRA.map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Presupuesto de obra (CLP) *</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.presupuestoObra}
                  onChange={(e) => setField("presupuestoObra", e.target.value)}
                  placeholder="85000000"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label>Superficie construida (m²) *</Label>
                <Input
                  type="number"
                  min="0"
                  value={form.superficieConstruida}
                  onChange={(e) =>
                    setField("superficieConstruida", e.target.value)
                  }
                  placeholder="120"
                  required
                />
              </div>
            </div>

            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-primary">
              <Checkbox
                checked={form.esDFL2}
                onCheckedChange={(checked) =>
                  setField("esDFL2", checked === true)
                }
              />
              ¿Es vivienda DFL2? (descuento 50% en derechos hasta 140 m²)
            </label>

            <Button
              type="submit"
              disabled={!formularioValido}
              className="w-full bg-primary text-white hover:bg-primary/90"
            >
              <Calculator className="size-4" />
              Calcular derechos
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* Result */}
      {resultado && (
        <Card className="border-2 border-primary/30">
          <CardHeader className="rounded-t-xl bg-primary/5">
            <CardTitle className="text-sm font-medium text-primary">
              Derechos municipales estimados
            </CardTitle>
            <p className="text-3xl font-semibold tracking-tight text-primary">
              ${resultado.montoDerechos.toLocaleString("es-CL")}
            </p>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            {/* Detalle del cálculo */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Detalle del cálculo
              </h3>
              <ul className="space-y-1.5 rounded-lg bg-primary/5 p-4">
                {resultado.detalle.map((linea, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm text-gray-700"
                  >
                    <span className="shrink-0 font-bold text-primary">
                      ·
                    </span>
                    {linea}
                  </li>
                ))}
              </ul>
            </div>

            {/* Advertencias */}
            {resultado.advertencias.length > 0 && (
              <div className="space-y-2">
                {resultado.advertencias.map((adv, i) => (
                  <div
                    key={i}
                    className="flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3"
                  >
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    <p className="text-sm text-amber-800">{adv}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <div className="flex gap-2.5 rounded-lg border border-border bg-muted/40 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <p className="text-xs text-muted-foreground">
          Estimación referencial. Los montos exactos son determinados por cada
          DOM según su tabla de cobros vigente.
        </p>
      </div>
        </div>
      </div>
    </div>
  )
}
