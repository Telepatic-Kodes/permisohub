"use client"

import { useEffect, useMemo, useState } from "react"
import { Calculator, Info } from "lucide-react"

import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Num } from "@/components/arch/dato"
import { EstadoNormativo } from "@/components/arch/estado"
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
      <div className="bg-blueprint-grid flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-3xl space-y-6">
      {/* Cabecera en-contenido */}
      <div className="mb-8 flex items-end justify-between gap-4 border-b border-line-med pb-4">
        <div>
          <p className="font-technical text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            IA Normativa · Estimador
          </p>
          <h2 className="font-technical mt-1.5 text-lg font-semibold leading-none text-primary">
            Calculadora de derechos municipales
          </h2>
        </div>
        {ufActual && (
          <div className="flex items-center gap-2">
            <EstadoNormativo
              estado={ufActual.fallback ? "observa" : "neutro"}
              label={ufActual.fallback ? "UF referencial" : "UF vigente"}
            />
            <div className="text-right">
              <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                UF
              </p>
              <p className="num text-sm font-semibold leading-none text-primary">
                ${ufActual.valor.toLocaleString('es-CL', { minimumFractionDigits: 2 })}
              </p>
              <p className="num mt-0.5 text-[10px] text-muted-foreground/70">
                {ufActual.fallback
                  ? 'mindicador.cl no disponible'
                  : ufActual.fecha ? new Date(ufActual.fecha).toLocaleDateString('es-CL') : ''}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit}>
        <Card className="rounded-[4px] border-line-fine shadow-none">
          <CardContent className="space-y-5 p-5">
            <div className="flex items-center gap-3">
              <h3 className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Datos de la obra</h3>
              <div className="h-px flex-1 bg-line-fine" />
              <span className="num text-[10px] text-muted-foreground/60">01</span>
            </div>
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
              ¿Es vivienda DFL2? (descuento <Num>50%</Num> en derechos hasta <Num>140 m²</Num>)
            </label>

            <Button
              type="submit"
              disabled={!formularioValido}
              className="w-full rounded-[3px] bg-primary text-white hover:bg-primary/90"
            >
              <Calculator className="size-4" />
              Calcular derechos
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* Result */}
      {resultado && (
        <Card className="rounded-[4px] border-line-strong shadow-none">
          <div className="flex items-start justify-between gap-4 border-b border-line-fine p-5">
            <div>
              <p className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Resultado del cálculo
              </p>
              <p className="mt-1 text-sm font-medium text-muted-foreground">
                Derechos municipales estimados
              </p>
              <p className="num mt-2 text-3xl font-semibold tracking-tight text-primary">
                ${resultado.montoDerechos.toLocaleString("es-CL")}
              </p>
            </div>
            <EstadoNormativo estado="neutro" label="Estimación" />
          </div>
          <CardContent className="space-y-5 p-5">
            {/* Detalle del cálculo */}
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <h3 className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Detalle del cálculo
                </h3>
                <div className="h-px flex-1 bg-line-fine" />
                <span className="num text-[10px] text-muted-foreground/60">
                  {resultado.detalle.length.toString().padStart(2, "0")}
                </span>
              </div>
              <ul className="divide-y divide-line-fine rounded-[4px] border border-line-fine bg-card">
                {resultado.detalle.map((linea, i) => (
                  <li
                    key={i}
                    className="flex gap-2.5 px-4 py-2.5 text-sm text-foreground/80"
                  >
                    <span className="num shrink-0 text-[10px] text-muted-foreground/60">
                      {(i + 1).toString().padStart(2, "0")}
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
                    className="flex items-start gap-2.5 rounded-[4px] border border-line-fine p-3"
                  >
                    <EstadoNormativo estado="observa" dot={false} label="Observación" className="shrink-0" />
                    <p className="text-sm text-foreground/80">{adv}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <div className="flex gap-2.5 rounded-[4px] border border-line-fine bg-muted/40 p-4">
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
