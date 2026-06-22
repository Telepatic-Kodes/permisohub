"use client"

import { useCallback, useRef, useState } from "react"
import {
  AlertCircle,
  CheckCircle,
  FileText,
  Loader2,
  Upload,
  X,
} from "lucide-react"

import { cn } from "@/lib/utils"

interface DocumentUploadProps {
  proyectoId: string
  onUploadComplete?: (doc: {
    nombre: string
    tipo: string
    url: string
    tamano: number
  }) => void
}

type QueueStatus = "queued" | "uploading" | "complete" | "error"

interface QueueItem {
  id: string
  file: File
  tipo: string
  status: QueueStatus
  progress: number
  error?: string
  url?: string
}

interface UploadedDoc {
  nombre: string
  tipo: string
  url: string
  tamano: number
}

const TIPOS_DOCUMENTO = [
  "Plano de arquitectura",
  "Plano estructural",
  "Memoria de cálculo",
  "Certificado DOM",
  "Certificado SEC",
  "Certificado sanitario",
  "Formulario municipal",
  "Correspondencia",
  "Otro",
] as const

const DEFAULT_TIPO = TIPOS_DOCUMENTO[0]
const ACCEPT = ".pdf,.dwg,.png,.jpg,.jpeg,.webp"
const MAX_FILE_SIZE = 50 * 1024 * 1024

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`
}

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

export function DocumentUpload({
  proyectoId,
  onUploadComplete,
}: DocumentUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [uploaded, setUploaded] = useState<UploadedDoc[]>([])

  const updateItem = useCallback(
    (id: string, patch: Partial<QueueItem>) => {
      setQueue((prev) =>
        prev.map((item) => (item.id === id ? { ...item, ...patch } : item)),
      )
    },
    [],
  )

  const addFiles = useCallback((files: FileList | File[]) => {
    const incoming = Array.from(files)
    if (incoming.length === 0) return

    const items: QueueItem[] = incoming.map((file) => {
      const tooLarge = file.size > MAX_FILE_SIZE
      return {
        id: makeId(),
        file,
        tipo: DEFAULT_TIPO,
        status: tooLarge ? "error" : "queued",
        progress: 0,
        error: tooLarge ? "Supera el máximo de 50MB." : undefined,
      }
    })

    setQueue((prev) => [...prev, ...items])
  }, [])

  const handleInputChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      if (event.target.files) {
        addFiles(event.target.files)
      }
      // Permite volver a seleccionar el mismo archivo.
      event.target.value = ""
    },
    [addFiles],
  )

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setIsDragOver(false)
      if (event.dataTransfer.files) {
        addFiles(event.dataTransfer.files)
      }
    },
    [addFiles],
  )

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setIsDragOver(true)
    },
    [],
  )

  const handleDragLeave = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      setIsDragOver(false)
    },
    [],
  )

  const openFilePicker = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const removeItem = useCallback((id: string) => {
    setQueue((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const uploadItem = useCallback(
    async (item: QueueItem) => {
      updateItem(item.id, { status: "uploading", progress: 0, error: undefined })

      // Progreso simulado mientras se realiza la petición real.
      const progressTimer = setInterval(() => {
        setQueue((prev) =>
          prev.map((q) =>
            q.id === item.id && q.status === "uploading"
              ? { ...q, progress: Math.min(q.progress + 8, 90) }
              : q,
          ),
        )
      }, 160)

      try {
        const formData = new FormData()
        formData.append("file", item.file)
        formData.append("proyectoId", proyectoId)
        formData.append("tipo", item.tipo)

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        clearInterval(progressTimer)

        const result = await response
          .json()
          .catch(() => ({ error: "Respuesta inválida del servidor." }))

        if (!response.ok || !result?.success) {
          updateItem(item.id, {
            status: "error",
            progress: 0,
            error: result?.error ?? "No se pudo subir el archivo.",
          })
          return
        }

        const doc: UploadedDoc = result.documento

        updateItem(item.id, {
          status: "complete",
          progress: 100,
          url: doc.url,
        })

        setUploaded((prev) => [...prev, doc])
        onUploadComplete?.(doc)
      } catch {
        clearInterval(progressTimer)
        updateItem(item.id, {
          status: "error",
          progress: 0,
          error: "Error de red. Inténtalo nuevamente.",
        })
      }
    },
    [onUploadComplete, proyectoId, updateItem],
  )

  const uploadAll = useCallback(() => {
    queue
      .filter((item) => item.status === "queued")
      .forEach((item) => {
        void uploadItem(item)
      })
  }, [queue, uploadItem])

  const pendingCount = queue.filter((item) => item.status === "queued").length

  return (
    <div className="space-y-5">
      {/* Drag & drop zone */}
      <div
        role="button"
        tabIndex={0}
        onClick={openFilePicker}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault()
            openFilePicker()
          }
        }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-gray-200 px-6 py-10 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#1A3328]/40",
          isDragOver && "border-primary bg-muted",
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Upload className="size-6 text-primary" />
        </div>
        <p className="text-sm font-medium text-primary">
          Arrastra archivos aquí o haz clic para subir
        </p>
        <p className="text-xs text-muted-foreground">
          PDF, DWG, PNG, JPG · Máx. 50MB por archivo
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPT}
          onChange={handleInputChange}
          className="hidden"
        />
      </div>

      {/* Upload queue */}
      {queue.length > 0 && (
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-primary">
              Archivos en cola
            </h3>
            {pendingCount > 0 && (
              <button
                type="button"
                onClick={uploadAll}
                className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90"
              >
                <Upload className="size-3.5" />
                Subir {pendingCount}{" "}
                {pendingCount === 1 ? "archivo" : "archivos"}
              </button>
            )}
          </div>

          <ul className="space-y-3">
            {queue.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <FileText className="size-4.5 text-primary" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-primary">
                          {item.file.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatBytes(item.file.size)}
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        <StatusIndicator status={item.status} />
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          aria-label="Quitar archivo"
                          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-primary"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    </div>

                    {/* Type selector (antes de subir) */}
                    {item.status === "queued" && (
                      <select
                        value={item.tipo}
                        onChange={(event) =>
                          updateItem(item.id, { tipo: event.target.value })
                        }
                        className="mt-2 h-8 w-full rounded-lg border border-input bg-card px-2 text-xs text-primary outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-[#1A3328]/30"
                      >
                        {TIPOS_DOCUMENTO.map((tipo) => (
                          <option key={tipo} value={tipo}>
                            {tipo}
                          </option>
                        ))}
                      </select>
                    )}

                    {/* Tipo asignado (durante / después de subir) */}
                    {item.status !== "queued" && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.tipo}
                      </p>
                    )}

                    {/* Progress bar */}
                    {item.status === "uploading" && (
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-primary transition-all duration-150"
                          style={{ width: `${item.progress}%` }}
                        />
                      </div>
                    )}

                    {/* Error + retry */}
                    {item.status === "error" && (
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <p className="text-xs text-red-600">{item.error}</p>
                        {item.file.size <= MAX_FILE_SIZE && (
                          <button
                            type="button"
                            onClick={() => void uploadItem(item)}
                            className="shrink-0 rounded-md border border-primary px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-muted"
                          >
                            Reintentar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Completed uploads */}
      {uploaded.length > 0 && (
        <div className="rounded-xl border border-border bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-primary">
            Archivos subidos
          </h3>
          <ul className="space-y-2">
            {uploaded.map((doc, index) => (
              <li
                key={`${doc.url}-${index}`}
                className="flex items-center gap-3 rounded-lg border border-border bg-card p-2.5"
              >
                <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-green-100">
                  <CheckCircle className="size-4 text-green-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-primary">
                    {doc.nombre}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {doc.tipo} · {formatBytes(doc.tamano)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function StatusIndicator({ status }: { status: QueueStatus }) {
  if (status === "uploading") {
    return (
      <Loader2 className="size-4 animate-spin text-primary" aria-label="Subiendo" />
    )
  }
  if (status === "complete") {
    return <CheckCircle className="size-4 text-green-600" aria-label="Completado" />
  }
  if (status === "error") {
    return <AlertCircle className="size-4 text-red-600" aria-label="Error" />
  }
  return null
}
