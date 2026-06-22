"use client"

import { use, useEffect, useState } from "react"
import Link from "next/link"
import { ArrowLeft, CheckCircle2, Circle, ExternalLink, FileText, Upload, AlertCircle, ChevronRight, ChevronLeft, Package } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { MOCK_PROYECTOS } from "@/lib/mock-data"
import { TIPO_PERMISO_LABELS } from "@/types"
import {
  getDocumentosRequeridos,
  getMunicipioInfo,
  CATEGORIAS_LABEL,
  type CategoriaDocumento,
  type DocumentoRequerido,
} from "@/lib/dom-requirements"

const STEPS = ['Datos', 'Checklist', 'Documentos', 'Exportar'] as const

export default function IngresoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const [proyecto, setProyecto] = useState(MOCK_PROYECTOS.find((p) => p.id === id))

  useEffect(() => {
    fetch(`/api/proyectos/${id}`)
      .then(r => r.json())
      .then((d: { proyecto?: (typeof MOCK_PROYECTOS)[number]; source?: string }) => {
        if (d.source === 'db' && d.proyecto) setProyecto(d.proyecto)
      })
      .catch(() => undefined)
  }, [id])

  const [step, setStep] = useState(0)
  const [checkedDocs, setCheckedDocs] = useState<Set<string>>(new Set())
  const [uploadedDocs, setUploadedDocs] = useState<Record<string, string>>({})

  if (!proyecto) {
    return (
      <div className="space-y-4">
        <Link href="/proyectos" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-[#1A3328]">
          <ArrowLeft className="size-4" /> Proyectos
        </Link>
        <p className="text-sm text-muted-foreground">Proyecto no encontrado.</p>
      </div>
    )
  }

  const documentos = getDocumentosRequeridos(proyecto.tipo, proyecto.municipio)
  const municipioInfo = getMunicipioInfo(proyecto.municipio)
  const obligatorios = documentos.filter((d) => d.obligatorio)
  const opcionales = documentos.filter((d) => !d.obligatorio)
  const totalObligatorios = obligatorios.length
  const listos = obligatorios.filter((d) => checkedDocs.has(d.id)).length
  const pct = totalObligatorios > 0 ? Math.round((listos / totalObligatorios) * 100) : 0
  const listo = listos === totalObligatorios

  // Group docs by category
  const porCategoria = documentos.reduce<Record<string, DocumentoRequerido[]>>(
    (acc, doc) => {
      const cat = doc.categoria
      if (!acc[cat]) acc[cat] = []
      acc[cat].push(doc)
      return acc
    },
    {}
  )

  function toggleDoc(id: string) {
    setCheckedDocs((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function handleMockUpload(docId: string) {
    // Simulate upload — in production this would call /api/upload
    setUploadedDocs((prev) => ({ ...prev, [docId]: `${docId}_uploaded.pdf` }))
    setCheckedDocs((prev) => new Set([...prev, docId]))
  }

  function openDomEnLinea() {
    window.open(municipioInfo.urlDomEnLinea, '_blank', 'noopener')
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header */}
      <div className="space-y-3">
        <Link
          href={`/proyectos/${id}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground transition-colors hover:text-[#1A3328]"
        >
          <ArrowLeft className="size-4" />
          {proyecto.nombre}
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-[#1A3328]">
              Preparar ingreso DOM en Línea
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {proyecto.municipio} · {TIPO_PERMISO_LABELS[proyecto.tipo]}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold text-[#1A3328]">{pct}%</p>
            <p className="text-xs text-muted-foreground">{listos}/{totalObligatorios} docs obligatorios</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-[#1A3328] transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Step tabs */}
      <div className="flex gap-0 rounded-xl border border-border bg-[#F9F7F3] p-1">
        {STEPS.map((label, i) => (
          <button
            key={label}
            onClick={() => setStep(i)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${
              step === i
                ? 'bg-white text-[#1A3328] shadow-sm'
                : 'text-muted-foreground hover:text-[#1A3328]'
            }`}
          >
            <span className={`mr-1.5 inline-flex size-5 items-center justify-center rounded-full text-xs ${
              step === i ? 'bg-[#1A3328] text-white' : 'bg-gray-200 text-gray-500'
            }`}>{i + 1}</span>
            {label}
          </button>
        ))}
      </div>

      {/* STEP 0 — Datos */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-[#1A3328]">Datos del expediente</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {municipioInfo.notaEspecial && (
              <div className="flex gap-3 rounded-lg bg-amber-50 border border-amber-200 p-3">
                <AlertCircle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-800">{municipioInfo.notaEspecial}</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4 text-sm">
              {[
                ['Municipio', proyecto.municipio],
                ['Tipo de permiso', TIPO_PERMISO_LABELS[proyecto.tipo]],
                ['Dirección', proyecto.direccion],
                ['N° expediente', proyecto.numero_expediente ?? 'Pendiente de asignar'],
                ['Fecha inicio', proyecto.fecha_inicio],
                ['Estado actual', proyecto.estado],
              ].map(([label, value]) => (
                <div key={label} className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">{label}</p>
                  <p className="font-medium text-[#1A3328]">{value}</p>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-[#1A3328]/20 bg-[#1A3328]/5 p-3">
              <p className="text-xs font-medium text-[#1A3328]">Portal DOM en Línea</p>
              <p className="text-xs text-muted-foreground mt-0.5">{municipioInfo.urlDomEnLinea}</p>
            </div>
            <div className="flex justify-end">
              <Button
                className="bg-[#1A3328] text-white hover:bg-[#1A3328]/90"
                onClick={() => setStep(1)}
              >
                Continuar <ChevronRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* STEP 1 — Checklist */}
      {step === 1 && (
        <div className="space-y-4">
          {Object.entries(porCategoria).map(([cat, docs]) => (
            <Card key={cat}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold text-[#1A3328]">
                  {CATEGORIAS_LABEL[cat as CategoriaDocumento]}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {docs.map((doc) => {
                  const checked = checkedDocs.has(doc.id)
                  return (
                    <button
                      key={doc.id}
                      onClick={() => toggleDoc(doc.id)}
                      className={`w-full flex items-start gap-3 rounded-lg border p-3 text-left transition-colors ${
                        checked
                          ? 'border-[#1A3328]/30 bg-[#1A3328]/5'
                          : 'border-border bg-white hover:border-[#1A3328]/20'
                      }`}
                    >
                      {checked ? (
                        <CheckCircle2 className="size-5 shrink-0 text-[#1A3328] mt-0.5" />
                      ) : (
                        <Circle className="size-5 shrink-0 text-gray-300 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-[#1A3328]">{doc.nombre}</span>
                          {!doc.obligatorio && (
                            <Badge variant="outline" className="text-xs py-0">Opcional</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{doc.descripcion}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          Formatos: {doc.formatoAceptado.join(', ')} · Nombre DOM: {doc.nomenclaturaDom}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </CardContent>
            </Card>
          ))}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(0)}>
              <ChevronLeft className="size-4" /> Atrás
            </Button>
            <Button className="bg-[#1A3328] text-white hover:bg-[#1A3328]/90" onClick={() => setStep(2)}>
              Continuar <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 2 — Upload */}
      {step === 2 && (
        <div className="space-y-4">
          {obligatorios.map((doc) => {
            const uploaded = !!uploadedDocs[doc.id]
            return (
              <Card key={doc.id}>
                <CardContent className="flex items-center gap-4 pt-4">
                  <div className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${
                    uploaded ? 'bg-[#1A3328]/10' : 'bg-gray-100'
                  }`}>
                    <FileText className={`size-5 ${uploaded ? 'text-[#1A3328]' : 'text-gray-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#1A3328]">{doc.nombre}</p>
                    {uploaded ? (
                      <p className="text-xs text-green-600">{uploadedDocs[doc.id]}</p>
                    ) : (
                      <p className="text-xs text-muted-foreground">{doc.formatoAceptado.join(', ').toUpperCase()}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleMockUpload(doc.id)}
                    className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                      uploaded
                        ? 'bg-green-50 text-green-700 hover:bg-green-100'
                        : 'bg-[#F0EBE1] text-[#1A3328] hover:bg-[#E8E0D4]'
                    }`}
                  >
                    {uploaded ? (
                      <><CheckCircle2 className="size-4" /> Subido</>
                    ) : (
                      <><Upload className="size-4" /> Subir</>
                    )}
                  </button>
                </CardContent>
              </Card>
            )
          })}
          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(1)}>
              <ChevronLeft className="size-4" /> Atrás
            </Button>
            <Button className="bg-[#1A3328] text-white hover:bg-[#1A3328]/90" onClick={() => setStep(3)}>
              Ver resumen <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3 — Export */}
      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className={`rounded-xl p-4 text-center ${listo ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                {listo ? (
                  <>
                    <CheckCircle2 className="size-8 text-green-600 mx-auto mb-2" />
                    <p className="font-semibold text-green-800">Expediente completo</p>
                    <p className="text-sm text-green-700 mt-1">Todos los documentos obligatorios están listos</p>
                  </>
                ) : (
                  <>
                    <AlertCircle className="size-8 text-amber-600 mx-auto mb-2" />
                    <p className="font-semibold text-amber-800">Expediente incompleto</p>
                    <p className="text-sm text-amber-700 mt-1">Faltan {totalObligatorios - listos} documento(s) obligatorio(s)</p>
                  </>
                )}
              </div>

              {/* Summary list */}
              <div className="space-y-2">
                {obligatorios.map((doc) => {
                  const ok = checkedDocs.has(doc.id)
                  return (
                    <div key={doc.id} className="flex items-center gap-2 text-sm">
                      {ok ? (
                        <CheckCircle2 className="size-4 text-green-600 shrink-0" />
                      ) : (
                        <Circle className="size-4 text-gray-300 shrink-0" />
                      )}
                      <span className={ok ? 'text-[#1A3328]' : 'text-muted-foreground'}>{doc.nombre}</span>
                      <span className="text-xs text-gray-400 ml-auto">{doc.nomenclaturaDom}</span>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="grid grid-cols-2 gap-3">
            <a href={`/api/proyectos/${id}/export-zip`} download>
              <Card className="cursor-pointer hover:border-[#1A3328]/30 transition-colors h-full">
                <CardContent className="flex flex-col items-center justify-center gap-2 py-6 text-center h-full">
                  <Package className="size-8 text-[#1A3328]" />
                  <p className="text-sm font-semibold text-[#1A3328]">Descargar paquete ZIP</p>
                  <p className="text-xs text-muted-foreground">Todos los docs con nomenclatura DOM</p>
                  <Badge className="text-xs bg-[#1A3328] text-white">Exportar →</Badge>
                </CardContent>
              </Card>
            </a>
            <Card
              className="cursor-pointer hover:border-[#1A3328]/30 transition-colors"
              onClick={openDomEnLinea}
            >
              <CardContent className="flex flex-col items-center justify-center gap-2 py-6 text-center">
                <ExternalLink className="size-8 text-[#1A3328]" />
                <p className="text-sm font-semibold text-[#1A3328]">Abrir DOM en Línea</p>
                <p className="text-xs text-muted-foreground">{municipioInfo.municipio} — {municipioInfo.urlDomEnLinea}</p>
                <Badge className="text-xs bg-[#1A3328] text-white">Abrir portal →</Badge>
              </CardContent>
            </Card>
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft className="size-4" /> Atrás
            </Button>
            <Button
              nativeButton={false}
              render={<Link href={`/proyectos/${id}`} />}
              variant="outline"
            >
              Volver al proyecto
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
