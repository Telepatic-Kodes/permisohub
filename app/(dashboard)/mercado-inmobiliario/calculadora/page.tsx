"use client"

import { useEffect, useState } from "react"
import { Calculator } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Num } from "@/components/arch/dato"
import { GaugeArc } from "@/components/mercado-inmobiliario/charts/gauge-arc"
import {
  calcularCapRate,
  calcularRoi,
  ufToClp,
  clpToUf,
  type Semaforo,
} from "@/lib/calculadora-inversion"
import { UF_FALLBACK_CLP, type UfData } from "@/lib/uf"

const SEMAFORO_COLOR: Record<Semaforo, string> = {
  verde: "var(--state-ok, #16a34a)",
  amarillo: "var(--state-warn, #d97706)",
  rojo: "var(--state-error, #dc2626)",
}

const SEMAFORO_LABEL: Record<Semaforo, string> = {
  verde: "Excelente",
  amarillo: "Aceptable",
  rojo: "Bajo",
}

function formatCLP(n: number): string {
  return n.toLocaleString("es-CL", { maximumFractionDigits: 0 })
}

function formatPct(n: number): string {
  return n.toLocaleString("es-CL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function ConversorUfPage({ ufValor }: { ufValor: number }) {
  const [uf, setUf] = useState("1")
  const [clp, setClp] = useState(String(Math.round(ufValor)))

  return (
    <Card className="rounded-lg border-line-fine">
      <CardContent className="space-y-4 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>UF</Label>
            <Input
              type="number"
              value={uf}
              onChange={(e) => {
                setUf(e.target.value)
                setClp(String(Math.round(ufToClp(Number(e.target.value) || 0, ufValor))))
              }}
            />
          </div>
          <div className="space-y-1.5">
            <Label>CLP</Label>
            <Input
              type="number"
              value={clp}
              onChange={(e) => {
                setClp(e.target.value)
                setUf(clpToUf(Number(e.target.value) || 0, ufValor).toFixed(2))
              }}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Valor UF de hoy: <Num>{formatCLP(ufValor)}</Num> CLP
        </p>
      </CardContent>
    </Card>
  )
}

function CapRatePanel() {
  const [rentaMensual, setRentaMensual] = useState("")
  const [precioVenta, setPrecioVenta] = useState("")
  const [vacancia, setVacancia] = useState("7")
  const [opex, setOpex] = useState("15")

  const resultado = calcularCapRate({
    rentaMensual: Number(rentaMensual) || 0,
    precioVenta: Number(precioVenta) || 0,
    vacancia: (Number(vacancia) || 0) / 100,
    opex: (Number(opex) || 0) / 100,
  })

  return (
    <Card className="rounded-lg border-line-fine">
      <CardContent className="space-y-5 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Renta mensual (UF)</Label>
            <Input type="number" placeholder="ej: 50" value={rentaMensual} onChange={(e) => setRentaMensual(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Precio de venta (UF)</Label>
            <Input type="number" placeholder="ej: 8000" value={precioVenta} onChange={(e) => setPrecioVenta(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Vacancia (%)</Label>
            <Input type="number" value={vacancia} onChange={(e) => setVacancia(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>OPEX (%)</Label>
            <Input type="number" value={opex} onChange={(e) => setOpex(e.target.value)} />
          </div>
        </div>

        {precioVenta && rentaMensual && (
          <div className="rounded-lg border border-line-fine bg-card p-4 text-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
              <div className="grid grid-cols-3 gap-x-4 gap-y-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cap bruto</p>
                  <p className="num text-lg font-semibold text-primary">{formatPct(resultado.capBruto)}%</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Cap neto</p>
                  <p className="num text-lg font-semibold text-primary">{formatPct(resultado.capNeto)}%</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Payback</p>
                  <p className="num text-lg font-semibold text-primary">
                    {resultado.paybackAnios !== null ? `${formatPct(resultado.paybackAnios)} años` : "—"}
                  </p>
                </div>
              </div>
              <GaugeArc
                value={resultado.capNeto}
                max={12}
                label={SEMAFORO_LABEL[resultado.semaforo]}
                valueLabel={`${formatPct(resultado.capNeto)}%`}
                color={SEMAFORO_COLOR[resultado.semaforo]}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function RoiPanel() {
  const [arriendoMensual, setArriendoMensual] = useState("")
  const [precioCompra, setPrecioCompra] = useState("")
  const [gastos, setGastos] = useState("20")

  const resultado = calcularRoi({
    arriendoMensual: Number(arriendoMensual) || 0,
    precioCompra: Number(precioCompra) || 0,
    gastosCombinados: (Number(gastos) || 0) / 100,
  })

  return (
    <Card className="rounded-lg border-line-fine">
      <CardContent className="space-y-5 p-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Arriendo mensual (UF)</Label>
            <Input type="number" placeholder="ej: 45" value={arriendoMensual} onChange={(e) => setArriendoMensual(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Precio de compra (UF)</Label>
            <Input type="number" placeholder="ej: 7000" value={precioCompra} onChange={(e) => setPrecioCompra(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label>Gastos combinados — vacancia + OPEX (%)</Label>
            <Input type="number" value={gastos} onChange={(e) => setGastos(e.target.value)} />
          </div>
        </div>

        {precioCompra && arriendoMensual && (
          <div className="rounded-lg border border-line-fine bg-card p-4 text-sm">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-[1fr_auto]">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">ROI anual</p>
                  <p className="num text-lg font-semibold text-primary">{formatPct(resultado.roiAnual)}%</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Payback</p>
                  <p className="num text-lg font-semibold text-primary">
                    {resultado.paybackAnios !== null ? `${formatPct(resultado.paybackAnios)} años` : "—"}
                  </p>
                </div>
              </div>
              <GaugeArc
                value={resultado.roiAnual}
                max={20}
                label={SEMAFORO_LABEL[resultado.semaforo]}
                valueLabel={`${formatPct(resultado.roiAnual)}%`}
                color={SEMAFORO_COLOR[resultado.semaforo]}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default function CalculadoraInversionPage() {
  const [ufActual, setUfActual] = useState<UfData>({ valor: UF_FALLBACK_CLP, fecha: null, fallback: true })

  useEffect(() => {
    fetch("/api/utils/uf")
      .then((r) => r.json() as Promise<UfData & { ok: boolean }>)
      .then((data) => setUfActual({ valor: data.valor, fecha: data.fecha, fallback: data.fallback ?? false }))
      .catch(() => setUfActual({ valor: UF_FALLBACK_CLP, fecha: null, fallback: true }))
  }, [])

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="🧮"
        title="Calculadora de Inversión"
        subtitle="UF/CLP, Cap Rate y ROI para locales comerciales — sin IA, resultado instantáneo"
        breadcrumbs={[{ label: "Calculadora" }]}
      />

      <div className="flex-1 p-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <Tabs defaultValue="uf">
            <TabsList>
              <TabsTrigger value="uf">
                <Calculator className="size-3.5" /> UF ↔ CLP
              </TabsTrigger>
              <TabsTrigger value="caprate">Cap Rate</TabsTrigger>
              <TabsTrigger value="roi">ROI / Payback</TabsTrigger>
            </TabsList>

            <div className="mt-4">
              <TabsContent value="uf">
                {/*
                  key=ufActual.valor: ConversorUfPage siembra su estado `clp`
                  desde el prop SOLO al montar — sin esto, el tab por defecto
                  mostraba la UF de respaldo (UF_FALLBACK_CLP) hasta que el
                  usuario tocaba algo, aunque el valor real ya había llegado
                  (fetch en el useEffect de arriba) y el texto justo debajo
                  ya mostraba el valor correcto. La key fuerza un remount con
                  el valor real una vez que llega.
                */}
                <ConversorUfPage key={ufActual.valor} ufValor={ufActual.valor} />
              </TabsContent>
              <TabsContent value="caprate">
                <CapRatePanel />
              </TabsContent>
              <TabsContent value="roi">
                <RoiPanel />
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
