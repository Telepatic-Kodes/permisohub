"use client"

import { useState } from "react"
import { ArrowLeft, Copy, Download, FileSignature, Loader2 } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { PageHeader } from "@/components/dashboard/page-header"
import { Num } from "@/components/arch/dato"
import { EstadoNormativo } from "@/components/arch/estado"

const TIPOS_OBRA = [
  "Reparación de cubierta (techado)",
  "Reparación de pisos o pavimentos interiores",
  "Revestimiento de muros interiores",
  "Cambio de puertas o ventanas (sin modificar vano)",
  "Instalación de cielo falso",
  "Ampliación de instalaciones eléctricas interiores",
  "Reparación de instalaciones sanitarias interiores",
  "Cierre o subdivisión de espacios interiores sin afectar estructura",
  "Construcción de tabiques interiores no estructurales",
  "Habilitación de local comercial en local existente",
  "Otro (especificar en descripción)",
]

interface FormData {
  tipoObra: string
  descripcionObra: string
  propietarioNombre: string
  propietarioRut: string
  direccion: string
  municipio: string
  arquitectoNombre: string
  arquitectoRut: string
  numeroMatricula: string
  superficie: string
}

const INITIAL: FormData = {
  tipoObra: "",
  descripcionObra: "",
  propietarioNombre: "",
  propietarioRut: "",
  direccion: "",
  municipio: "",
  arquitectoNombre: "Estefanía Parada",
  arquitectoRut: "",
  numeroMatricula: "",
  superficie: "",
}

interface GenerateResponse {
  ok: boolean
  texto?: string
  source?: string
  error?: string
}

export default function DeclaracionJuradaPage() {
  const [form, setForm] = useState<FormData>(INITIAL)
  const [generando, setGenerando] = useState(false)
  const [declaracion, setDeclaracion] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)

  function setField(key: keyof FormData, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const camposObligatorios: (keyof FormData)[] = [
    "tipoObra", "descripcionObra", "propietarioNombre", "propietarioRut",
    "direccion", "municipio", "arquitectoNombre", "arquitectoRut", "numeroMatricula",
  ]
  const completo = camposObligatorios.every((k) => form[k].trim().length > 0)

  async function handleGenerar() {
    if (!completo) return
    setGenerando(true)
    try {
      const res = await fetch('/api/ai/declaracion-jurada', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json() as GenerateResponse
      if (data.ok && data.texto) {
        setDeclaracion(data.texto)
      }
    } finally {
      setGenerando(false)
    }
  }

  function handleCopiar() {
    if (!declaracion) return
    void navigator.clipboard.writeText(declaracion).then(() => {
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    })
  }

  function handleDescargar() {
    if (!declaracion) return
    const texto: string = declaracion
    const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `declaracion-jurada-${form.municipio.toLowerCase().replace(/ /g, '-')}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="📋"
        title="Declaración Jurada"
        subtitle="Obras menores · Ley 21.718 / Art. 5.1.2 OGUC"
      />

      <div className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-2xl space-y-6">
          <Link
            href="/herramientas"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-[var(--blueprint)]"
          >
            <ArrowLeft className="size-4" /> Herramientas
          </Link>

          {/* Info banner */}
          <div className="rounded-[4px] border border-line-fine bg-card p-4">
            <div className="flex items-start gap-3">
              <FileSignature className="mt-0.5 size-5 shrink-0 text-muted-foreground/60" />
              <div>
                <p className="font-technical text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Marco normativo
                </p>
                <p className="font-technical mt-1 text-sm font-semibold text-primary">
                  <Num>Ley 21.718</Num> — Obras exentas de permiso
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  El artículo <Num>5.1.2</Num> OGUC permite que ciertas obras menores se ejecuten con una Declaración Jurada en lugar de permiso de edificación. Esta herramienta genera el documento conforme al formato legal chileno vigente.
                </p>
              </div>
            </div>
          </div>

          {!declaracion ? (
            <Card className="rounded-[4px] border-line-fine">
              <CardHeader>
                <p className="font-technical text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                  Formulario
                </p>
                <CardTitle className="font-technical text-base">Datos de la obra</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Tipo de obra */}
                <div className="space-y-1.5">
                  <Label>Tipo de obra menor</Label>
                  <Select value={form.tipoObra} onValueChange={(v) => setField("tipoObra", v ?? "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar tipo..." />
                    </SelectTrigger>
                    <SelectContent>
                      {TIPOS_OBRA.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Descripción */}
                <div className="space-y-1.5">
                  <Label>Descripción detallada de la obra</Label>
                  <Textarea
                    value={form.descripcionObra}
                    onChange={(e) => setField("descripcionObra", e.target.value)}
                    placeholder="Ej: Reemplazo de cubierta de zinc en sector oriente del inmueble, sin modificación de estructura existente, superficie aproximada 45 m²."
                    rows={3}
                  />
                </div>

                {/* Dirección y municipio */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Dirección del inmueble</Label>
                    <Input
                      value={form.direccion}
                      onChange={(e) => setField("direccion", e.target.value)}
                      placeholder="Av. Los Leones 1234"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Municipio</Label>
                    <Input
                      value={form.municipio}
                      onChange={(e) => setField("municipio", e.target.value)}
                      placeholder="Providencia"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Superficie aproximada (opcional)</Label>
                  <Input
                    value={form.superficie}
                    onChange={(e) => setField("superficie", e.target.value)}
                    placeholder="45 m²"
                  />
                </div>

                {/* Separador */}
                <div className="border-t border-line-fine pt-3">
                  <div className="mb-3 flex items-center gap-3">
                    <h3 className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Datos del propietario</h3>
                    <div className="h-px flex-1 bg-line-fine" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Nombre completo</Label>
                      <Input
                        value={form.propietarioNombre}
                        onChange={(e) => setField("propietarioNombre", e.target.value)}
                        placeholder="Juan Pérez González"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>RUT</Label>
                      <Input
                        value={form.propietarioRut}
                        onChange={(e) => setField("propietarioRut", e.target.value)}
                        placeholder="12.345.678-9"
                      />
                    </div>
                  </div>
                </div>

                {/* Arquitecto */}
                <div className="border-t border-line-fine pt-3">
                  <div className="mb-3 flex items-center gap-3">
                    <h3 className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">Datos del arquitecto proyectista</h3>
                    <div className="h-px flex-1 bg-line-fine" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label>Nombre completo</Label>
                      <Input
                        value={form.arquitectoNombre}
                        onChange={(e) => setField("arquitectoNombre", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>RUT</Label>
                      <Input
                        value={form.arquitectoRut}
                        onChange={(e) => setField("arquitectoRut", e.target.value)}
                        placeholder="9.876.543-2"
                      />
                    </div>
                    <div className="space-y-1.5 col-span-2">
                      <Label>N° Matrícula Minvu</Label>
                      <Input
                        value={form.numeroMatricula}
                        onChange={(e) => setField("numeroMatricula", e.target.value)}
                        placeholder="A-12345"
                      />
                    </div>
                  </div>
                </div>

                <Button
                  onClick={() => void handleGenerar()}
                  disabled={!completo || generando}
                  className="w-full bg-primary text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  {generando ? (
                    <><Loader2 className="size-4 animate-spin mr-2" /> Generando declaración...</>
                  ) : (
                    <><FileSignature className="size-4 mr-2" /> Generar Declaración Jurada</>
                  )}
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <EstadoNormativo estado="cumple" label="Declaración generada" />
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleCopiar}
                    className="gap-1.5"
                  >
                    <Copy className="size-3.5" />
                    {copiado ? "Copiado" : "Copiar"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDescargar}
                    className="gap-1.5"
                  >
                    <Download className="size-3.5" />
                    Descargar .txt
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setDeclaracion(null)}
                  >
                    Nueva declaración
                  </Button>
                </div>
              </div>

              <Card className="rounded-[4px] border-line-fine bg-blueprint-grid">
                <CardContent className="pt-6">
                  <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-primary">
                    {declaracion}
                  </pre>
                </CardContent>
              </Card>

              <div className="rounded-[4px] border border-line-fine bg-card p-3">
                <p className="text-xs leading-relaxed text-muted-foreground">
                  <strong className="text-primary">Importante:</strong> Este documento es una plantilla generada con IA. Debe ser revisado por el arquitecto proyectista antes de su firma. Verificar con la DOM de {form.municipio} que el tipo de obra específico se encuentra exento de permiso según el artículo <Num>5.1.2</Num> OGUC. Se recomienda firmar ante Notario.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
