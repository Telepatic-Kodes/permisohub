"use client"

import { useMemo, useState } from "react"
import { AlertTriangle, Calculator, Info } from "lucide-react"

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
import { MUNICIPIOS_PRINCIPALES } from "@/lib/mock-data"

const TIPOS_OBRA = Object.entries(TIPO_OBRA_LABELS) as [TipoObra, string][]

export default function CalculadoraDerechosPage() {
  const [resultado, setResultado] = useState<CalculoDerechos | null>(null)

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
        form.municipio
      )
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 rounded-xl bg-[#1A3328] p-5 text-white">
        <div className="flex size-11 items-center justify-center rounded-xl bg-white/10">
          <Calculator className="size-6" />
        </div>
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Calculadora de Derechos DOM
          </h1>
          <p className="text-sm text-white/70">
            Estimación de derechos municipales para permisos de edificación
            (Art. 130 LGUC)
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[#1A3328]">
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
                    {MUNICIPIOS_PRINCIPALES.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
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

            <label className="flex cursor-pointer items-center gap-2.5 text-sm text-[#1A3328]">
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
              className="w-full bg-[#1A3328] text-white hover:bg-[#1A3328]/90"
            >
              <Calculator className="size-4" />
              Calcular derechos
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* Result */}
      {resultado && (
        <Card className="border-2 border-[#1A3328]/30">
          <CardHeader className="rounded-t-xl bg-[#1A3328]/5">
            <CardTitle className="text-sm font-medium text-[#1A3328]">
              Derechos municipales estimados
            </CardTitle>
            <p className="text-3xl font-semibold tracking-tight text-[#1A3328]">
              ${resultado.montoDerechos.toLocaleString("es-CL")}
            </p>
          </CardHeader>
          <CardContent className="space-y-5 pt-5">
            {/* Detalle del cálculo */}
            <div className="space-y-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Detalle del cálculo
              </h3>
              <ul className="space-y-1.5 rounded-lg bg-[#1A3328]/5 p-4">
                {resultado.detalle.map((linea, i) => (
                  <li
                    key={i}
                    className="flex gap-2 text-sm text-gray-700"
                  >
                    <span className="shrink-0 font-bold text-[#1A3328]">
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
  )
}
