"use client"

import { use, useRef, useState } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CheckCircle2,
  Download,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react"

import { Button, buttonVariants } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Tipos (contrato compartido con la API /bulk-import)
// ---------------------------------------------------------------------------

interface ImportRow {
  nombre_negocio: string
  numero_local: string
  centro: string
  municipio: string
  area_m2?: number
  tenant_email?: string
}

interface ValidationError {
  row: number
  field: string
  message: string
}

interface PreviewResponse {
  ok: boolean
  preview?: ImportRow[]
  errors?: ValidationError[]
}

interface CreateResponse {
  ok: boolean
  created?: { centros: number; locales: number }
  error?: string
  errors?: ValidationError[]
}

const TOTAL_STEPS = 3

// Plantilla CSV: cabecera + 2 filas de ejemplo.
const CSV_TEMPLATE = [
  "nombre_negocio,numero_local,centro,municipio,area_m2,tenant_email",
  "Farmacia Cruz Verde,L-101,Mall Plaza Norte,Quilicura,85,contacto@cruz-verde.cl",
  "Café Juan Valdez,L-204,Mall Plaza Norte,Quilicura,42,local@juanvaldez.cl",
].join("\n")

// ---------------------------------------------------------------------------

export default function OnboardingPage({
  params,
}: {
  params: Promise<{ cadenaId: string }>
}) {
  const { cadenaId } = use(params)

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  const [fileName, setFileName] = useState<string | null>(null)
  const [preview, setPreview] = useState<ImportRow[]>([])
  const [errors, setErrors] = useState<ValidationError[]>([])
  const [created, setCreated] = useState<{
    centros: number
    locales: number
  } | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const fileInputRef = useRef<HTMLInputElement>(null)

  const hasErrors = errors.length > 0
  const centrosCount = new Set(preview.map((r) => r.centro)).size

  // -------------------------------------------------------------------------
  // Acciones
  // -------------------------------------------------------------------------

  function descargarPlantilla() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = "plantilla-locales.csv"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setFileName(file.name)
    setLoading(true)
    setSubmitError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch(
        `/api/admin/cadenas/${cadenaId}/bulk-import?preview=1`,
        { method: "POST", body: formData },
      )
      const data: PreviewResponse = await res.json()

      setPreview(data.preview ?? [])
      setErrors(data.errors ?? [])
    } catch {
      setSubmitError("No se pudo procesar el archivo. Intenta de nuevo.")
      setPreview([])
      setErrors([])
    } finally {
      setLoading(false)
    }
  }

  async function handleConfirmar() {
    setLoading(true)
    setSubmitError(null)

    try {
      // Reconstruimos el CSV desde la previsualización validada.
      const csv = [
        "nombre_negocio,numero_local,centro,municipio,area_m2,tenant_email",
        ...preview.map((r) =>
          [
            r.nombre_negocio,
            r.numero_local,
            r.centro,
            r.municipio,
            r.area_m2 ?? "",
            r.tenant_email ?? "",
          ].join(","),
        ),
      ].join("\n")

      const formData = new FormData()
      formData.append(
        "file",
        new Blob([csv], { type: "text/csv" }),
        fileName ?? "locales.csv",
      )

      const res = await fetch(`/api/admin/cadenas/${cadenaId}/bulk-import`, {
        method: "POST",
        body: formData,
      })
      const data: CreateResponse = await res.json()

      if (!data.ok || !data.created) {
        setSubmitError(data.error ?? "No se pudo completar la importación.")
        return
      }

      setCreated(data.created)
    } catch {
      setSubmitError("No se pudo completar la importación. Intenta de nuevo.")
    } finally {
      setLoading(false)
    }
  }

  // -------------------------------------------------------------------------
  // Helpers de render
  // -------------------------------------------------------------------------

  function fieldHasError(rowIndex: number, field: keyof ImportRow): boolean {
    // `row` en la API es 1-based respecto a filas de datos.
    return errors.some((e) => e.row === rowIndex + 1 && e.field === field)
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="mx-auto max-w-4xl p-6">
      {/* Indicador de pasos */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
          <div key={n} className="flex items-center gap-2">
            <div
              className={cn(
                "flex size-8 items-center justify-center rounded-full border text-sm font-medium transition-colors",
                n <= step
                  ? "border-[#1A3328] bg-[#1A3328] text-[#F9F7F3]"
                  : "border-border bg-white text-muted-foreground",
              )}
            >
              {n < step ? <CheckCircle2 className="size-4" /> : n}
            </div>
            {n < TOTAL_STEPS && (
              <div
                className={cn(
                  "h-px w-12 transition-colors",
                  n < step ? "bg-[#1A3328]" : "bg-border",
                )}
              />
            )}
          </div>
        ))}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* Paso 1 — Descargar plantilla */}
      {/* ------------------------------------------------------------------- */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-[#1A3328]">
              Importar locales desde CSV
            </CardTitle>
            <CardDescription>
              Carga masiva de locales para esta cadena. El archivo debe ser un
              CSV con las siguientes columnas:
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-xl border border-border bg-[#F9F7F3] p-4 text-sm">
              <p className="font-medium text-[#1A3328]">Columnas esperadas</p>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                <li>
                  <code className="font-mono">nombre_negocio</code> — requerido
                </li>
                <li>
                  <code className="font-mono">numero_local</code> — requerido
                </li>
                <li>
                  <code className="font-mono">centro</code> — requerido (agrupa
                  los locales por centro comercial)
                </li>
                <li>
                  <code className="font-mono">municipio</code> — requerido
                </li>
                <li>
                  <code className="font-mono">area_m2</code> — opcional
                  (numérico)
                </li>
                <li>
                  <code className="font-mono">tenant_email</code> — opcional
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <Button variant="outline" onClick={descargarPlantilla}>
                <Download />
                Descargar plantilla CSV
              </Button>
              <Button onClick={() => setStep(2)}>
                Siguiente
                <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Paso 2 — Subir archivo */}
      {/* ------------------------------------------------------------------- */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-[#1A3328]">
              Subir archivo CSV
            </CardTitle>
            <CardDescription>
              Selecciona el archivo. Validaremos cada fila antes de importar.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <Upload />
                )}
                {fileName ?? "Seleccionar archivo .csv"}
              </Button>
            </div>

            {submitError && (
              <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <XCircle className="size-4 shrink-0" />
                {submitError}
              </div>
            )}

            {/* Resumen de errores */}
            {hasErrors && (
              <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                <div className="flex items-center gap-2 font-medium">
                  <XCircle className="size-4 shrink-0" />
                  {errors.length} error
                  {errors.length === 1 ? "" : "es"} de validación. Corrige el
                  archivo y vuelve a subirlo.
                </div>
                <ul className="mt-2 list-inside list-disc space-y-0.5">
                  {errors.slice(0, 8).map((e, i) => (
                    <li key={i}>
                      {e.row > 0 ? `Fila ${e.row}: ` : ""}
                      <span className="font-mono">{e.field}</span> —{" "}
                      {e.message}
                    </li>
                  ))}
                  {errors.length > 8 && (
                    <li>…y {errors.length - 8} más.</li>
                  )}
                </ul>
              </div>
            )}

            {/* Tabla de previsualización */}
            {preview.length > 0 && (
              <div className="rounded-xl border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Negocio</TableHead>
                      <TableHead>Local</TableHead>
                      <TableHead>Centro</TableHead>
                      <TableHead>Municipio</TableHead>
                      <TableHead>m²</TableHead>
                      <TableHead>Email tenant</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.map((row, idx) => (
                      <TableRow key={idx}>
                        <TableCell
                          className={cn(
                            fieldHasError(idx, "nombre_negocio") &&
                              "text-destructive",
                          )}
                        >
                          {row.nombre_negocio || "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            fieldHasError(idx, "numero_local") &&
                              "text-destructive",
                          )}
                        >
                          {row.numero_local || "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            fieldHasError(idx, "centro") && "text-destructive",
                          )}
                        >
                          {row.centro || "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            fieldHasError(idx, "municipio") &&
                              "text-destructive",
                          )}
                        >
                          {row.municipio || "—"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            fieldHasError(idx, "area_m2") &&
                              "text-destructive",
                          )}
                        >
                          {row.area_m2 ?? "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {row.tenant_email ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <Button variant="ghost" onClick={() => setStep(1)}>
                Volver
              </Button>
              <Button
                onClick={() => setStep(3)}
                disabled={loading || preview.length === 0 || hasErrors}
              >
                Confirmar importación
                <ArrowRight />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* Paso 3 — Confirmar */}
      {/* ------------------------------------------------------------------- */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl text-[#1A3328]">
              {created ? "Importación completada" : "Confirmar importación"}
            </CardTitle>
            <CardDescription>
              {created
                ? "Los registros se crearon correctamente."
                : "Revisa el resumen antes de crear los registros."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!created ? (
              <>
                <div className="rounded-xl border border-border bg-[#F9F7F3] p-6 text-center">
                  <p className="text-sm text-muted-foreground">Se crearán</p>
                  <p className="mt-1 text-2xl font-semibold text-[#1A3328]">
                    {centrosCount} centro{centrosCount === 1 ? "" : "s"} y{" "}
                    {preview.length} local
                    {preview.length === 1 ? "" : "es"}
                  </p>
                </div>

                {submitError && (
                  <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                    <XCircle className="size-4 shrink-0" />
                    {submitError}
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <Button
                    variant="ghost"
                    onClick={() => setStep(2)}
                    disabled={loading}
                  >
                    Volver
                  </Button>
                  <Button onClick={handleConfirmar} disabled={loading}>
                    {loading ? (
                      <Loader2 className="animate-spin" />
                    ) : (
                      <CheckCircle2 />
                    )}
                    Crear registros
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center gap-3 rounded-xl border border-border bg-[#F9F7F3] p-8 text-center">
                  <CheckCircle2 className="size-12 text-[#1A3328]" />
                  <p className="text-lg font-semibold text-[#1A3328]">
                    Importación completada
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {created.centros} centro
                    {created.centros === 1 ? "" : "s"} y {created.locales}{" "}
                    local{created.locales === 1 ? "" : "es"} creados.
                  </p>
                </div>

                <div className="flex justify-center">
                  <Link
                    href={`/admin/cuentas/${cadenaId}`}
                    className={buttonVariants()}
                  >
                    Volver a la cuenta
                    <ArrowRight />
                  </Link>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
