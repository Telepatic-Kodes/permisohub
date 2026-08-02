"use client"

import { useState, Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { AlertCircle, Download, Loader2, ShieldCheck } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { MarkdownRenderer } from "@/components/ui/markdown-renderer"
import { AvaluoFiscalCard } from "@/components/mercado-inmobiliario/avaluo-fiscal-card"
import { InformeEjecutivo } from "@/components/mercado-inmobiliario/informe-ejecutivo"
import { DistribucionDonut } from "@/components/mercado-inmobiliario/charts/distribucion-donut"
import { extraerRiesgosPorNivel } from "@/lib/informe-charts"
import type { SIILookupServerData } from "@/lib/sii-lookup-server"

const TIPOS_DOMINIO = ["Individual", "Sucesión", "Comunidad"]

function DueDiligencePageInner() {
  const searchParams = useSearchParams()
  const [loading, setLoading] = useState(false)
  const [checklistLoading, setChecklistLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState("")
  const [result, setResult] = useState<string | null>(null)
  const [avaluoFiscal, setAvaluoFiscal] = useState<SIILookupServerData | null>(null)

  const [form, setForm] = useState({
    direccion: searchParams.get("direccion") ?? "",
    rol: searchParams.get("rolSii") ?? "",
    tipo: "",
    superficie: "",
    precioOferta: "",
    tipoDominio: TIPOS_DOMINIO[0],
    propietario: "",
    numHerederos: "",
    tienePosesionEfectiva: false,
    tieneInscripcionCBR: false,
    deudaTGR: "",
    deudaMunicipio: "",
    hipotecas: "",
    impuestoHerencia: "",
    zonificacion: searchParams.get("comuna") ?? "",
    documentos: "",
    observaciones: "",
  })

  function setField<K extends keyof typeof form>(k: K, v: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [k]: v }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.direccion) {
      setError("Dirección requerida")
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)
    setStreamingText("")
    setStatus(null)
    setAvaluoFiscal(null)

    try {
      const response = await fetch("/api/due-diligence-propiedad", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (!response.ok) {
        const err = (await response.json()) as { error?: string }
        throw new Error(err.error ?? "Error del servidor")
      }

      const reader = response.body?.getReader()
      if (!reader) throw new Error("No stream")

      const decoder = new TextDecoder()
      let accumulated = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split("\n").filter((l) => l.startsWith("data: "))

        for (const line of lines) {
          const data = line.slice(6)
          if (data === "[DONE]") continue
          try {
            const parsed = JSON.parse(data) as { text?: string; status?: string; error?: string; avaluoFiscal?: SIILookupServerData }
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.avaluoFiscal) setAvaluoFiscal(parsed.avaluoFiscal)
            if (parsed.status) setStatus(parsed.status)
            if (parsed.text) {
              accumulated += parsed.text
              setStreamingText(accumulated)
              setStatus(null)
            }
          } catch (parseErr) {
            if (parseErr instanceof Error && parseErr.message !== data) throw parseErr
          }
        }
      }

      setResult(accumulated)
      setStreamingText("")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
      setStatus(null)
    }
  }

  async function handleDescargarChecklist() {
    setChecklistLoading(true)
    try {
      const semaforoMatch = result?.match(/^(APTO|CONDICIONADO|OBSERVADO)/m)
      const res = await fetch("/api/due-diligence-propiedad/checklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          direccion: form.direccion,
          rol: form.rol,
          tipo: form.tipo,
          superficie: form.superficie,
          tipoDominio: form.tipoDominio,
          propietario: form.propietario,
          numHerederos: form.numHerederos,
          deudaTGR: form.deudaTGR,
          deudaMunicipio: form.deudaMunicipio,
          hipotecas: form.hipotecas,
          impuestoHerencia: form.impuestoHerencia,
          zonificacion: form.zonificacion,
          documentos: form.documentos ? form.documentos.split(",").map((d) => d.trim()) : [],
          observaciones: form.observaciones,
          semaforo: semaforoMatch?.[1],
        }),
      })
      if (!res.ok) throw new Error("No se pudo generar el checklist")
      const html = await res.text()
      const ventana = window.open("", "_blank")
      if (ventana) {
        ventana.document.write(html)
        ventana.document.close()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el checklist")
    } finally {
      setChecklistLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="🛡️"
        title="Due Diligence de Propiedad"
        subtitle="Riesgo legal de dominio, sucesión y gravámenes antes de comprar — con checklist de documentos"
        breadcrumbs={[{ label: "Due Diligence" }]}
      />

      <div className="flex-1 p-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <form onSubmit={(e) => void handleSubmit(e)}>
            <Card className="rounded-lg border-line-fine">
              <CardHeader>
                <CardTitle className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Propiedad y dominio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Dirección *</Label>
                    <Input value={form.direccion} onChange={(e) => setField("direccion", e.target.value)} placeholder="ej: Av. Principal 1234" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Rol SII</Label>
                    <Input value={form.rol} onChange={(e) => setField("rol", e.target.value)} placeholder="ej: 1234-56" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Tipo de propiedad</Label>
                    <Input value={form.tipo} onChange={(e) => setField("tipo", e.target.value)} placeholder="ej: Casa, sitio, local" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Superficie (m²)</Label>
                    <Input type="number" value={form.superficie} onChange={(e) => setField("superficie", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Precio de oferta (UF)</Label>
                    <Input type="number" value={form.precioOferta} onChange={(e) => setField("precioOferta", e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Tipo de dominio</Label>
                    <select
                      className="flex h-9 w-full rounded-lg border border-line-fine bg-card px-3 py-1 text-sm"
                      value={form.tipoDominio}
                      onChange={(e) => setField("tipoDominio", e.target.value)}
                    >
                      {TIPOS_DOMINIO.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Propietario / Causante</Label>
                    <Input value={form.propietario} onChange={(e) => setField("propietario", e.target.value)} />
                  </div>
                  {form.tipoDominio !== "Individual" && (
                    <div className="space-y-1.5">
                      <Label>N° de herederos</Label>
                      <Input type="number" value={form.numHerederos} onChange={(e) => setField("numHerederos", e.target.value)} />
                    </div>
                  )}

                  <div className="flex items-center gap-2 pt-6">
                    <Checkbox checked={form.tienePosesionEfectiva} onCheckedChange={(v) => setField("tienePosesionEfectiva", v === true)} />
                    <Label className="font-normal">Posesión efectiva inscrita</Label>
                  </div>
                  <div className="flex items-center gap-2 pt-6">
                    <Checkbox checked={form.tieneInscripcionCBR} onCheckedChange={(v) => setField("tieneInscripcionCBR", v === true)} />
                    <Label className="font-normal">Inscripción CBR al día</Label>
                  </div>

                  <div className="space-y-1.5">
                    <Label>Deuda TGR</Label>
                    <Input value={form.deudaTGR} onChange={(e) => setField("deudaTGR", e.target.value)} placeholder="ej: sin deuda, o monto" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Deuda municipalidad</Label>
                    <Input value={form.deudaMunicipio} onChange={(e) => setField("deudaMunicipio", e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Hipotecas / prohibiciones</Label>
                    <Input value={form.hipotecas} onChange={(e) => setField("hipotecas", e.target.value)} placeholder="ej: sí, banco X — o no" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Impuesto de herencia</Label>
                    <Input value={form.impuestoHerencia} onChange={(e) => setField("impuestoHerencia", e.target.value)} />
                  </div>

                  <div className="space-y-1.5">
                    <Label>Zonificación PRC</Label>
                    <Input value={form.zonificacion} onChange={(e) => setField("zonificacion", e.target.value)} />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Documentos ya disponibles</Label>
                    <Input
                      value={form.documentos}
                      onChange={(e) => setField("documentos", e.target.value)}
                      placeholder="separados por coma — ej: dominio vigente, certificado TGR"
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label>Observaciones adicionales</Label>
                    <Textarea value={form.observaciones} onChange={(e) => setField("observaciones", e.target.value)} />
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button type="submit" disabled={loading} className="bg-primary text-white hover:bg-primary/90">
                    {loading ? (
                      <><Loader2 className="size-4 animate-spin" /> Analizando…</>
                    ) : (
                      <><ShieldCheck className="size-4" /> Analizar due diligence</>
                    )}
                  </Button>
                  <Button type="button" variant="outline" disabled={checklistLoading} onClick={() => void handleDescargarChecklist()}>
                    {checklistLoading ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    Descargar checklist
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>

          {error && (
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
              <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {avaluoFiscal && <AvaluoFiscalCard data={avaluoFiscal} />}

          {status && !streamingText && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> {status}
            </div>
          )}

          {result ? (
            (() => {
              const riesgos = extraerRiesgosPorNivel(result)
              return (
                <>
                  {riesgos && (
                    <DistribucionDonut
                      titulo="Riesgos identificados por nivel"
                      segmentos={[
                        { label: "Alto", valor: riesgos.alto, color: "var(--state-error, #dc2626)" },
                        { label: "Medio", valor: riesgos.medio, color: "var(--state-warn, #d97706)" },
                        { label: "Bajo", valor: riesgos.bajo, color: "var(--state-ok, #16a34a)" },
                      ]}
                    />
                  )}
                  <InformeEjecutivo
                    content={result}
                    fuentes={[
                      { label: "Avalúo fiscal SII", disponible: avaluoFiscal !== null },
                      { label: "Posesión efectiva declarada", disponible: form.tienePosesionEfectiva },
                      { label: "Inscripción CBR declarada", disponible: form.tieneInscripcionCBR },
                      { label: "Búsqueda web en vivo", disponible: true },
                    ]}
                  />
                </>
              )
            })()
          ) : (
            streamingText && (
              <div className="rounded-lg border border-line-fine bg-card px-5 py-4">
                <MarkdownRenderer content={streamingText} />
                {loading && <span className="inline-block w-1 h-4 bg-[var(--blueprint)] animate-pulse ml-0.5 align-middle" />}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  )
}

export default function DueDiligencePropiedadPage() {
  return (
    <Suspense>
      <DueDiligencePageInner />
    </Suspense>
  )
}
