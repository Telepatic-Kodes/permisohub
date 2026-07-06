"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { AlertCircle, Check, CircleDashed, Download, ExternalLink, Eye, EyeOff, Loader2, Maximize2, PencilRuler, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EstadoNormativo, type Veredicto } from "@/components/arch/estado"
import { createClient } from "@/lib/supabase/client"
import { esPlano } from "@/lib/planos"
import { getArticuloById, urlDeCitable, type FuenteNormativa } from "@/lib/normativa-retrieval"
import { cn } from "@/lib/utils"

// Resuelve el texto libre `articulo` de una marca a un link de fuente cuando el
// artículo existe en la base curada. Devuelve null si no matchea o si viene
// marcado "(por verificar)" (se muestra como texto/warn, sin link falso).
function citaDesdeTexto(articulo: string): { url: string } | null {
  if (!articulo || /por verificar/i.test(articulo)) return null
  const ddu = articulo.match(/DDU[\s-]*(?:ESP[\s-]*)?N?[°º]?\s*([\d-]+)/i)
  if (ddu) {
    const a = getArticuloById("DDU", ddu[1])
    if (a?.verificado) return { url: urlDeCitable(a) }
  }
  const art = articulo.match(/\b(\d+(?:\.\d+)*(?:\s*bis)?)\s*(OGUC|LGUC)\b/i)
  if (art) {
    const a = getArticuloById(art[2].toUpperCase() as FuenteNormativa, art[1])
    if (a?.verificado) return { url: urlDeCitable(a) }
  }
  return null
}
import {
  CONVENCION_LINEA,
  colorDeMarca,
  type Anotacion,
  type Severidad,
} from "@/lib/anotacion-convenciones"
import {
  generarInformePDF,
  observacionesDesdeReporte,
  pdfUrlToImages,
  type CoverInfo,
} from "@/lib/informe-pdf"
import type { DueDiligenceResult } from "@/lib/due-diligence"
import {
  calcularCuadro,
  type CuadroInput,
  type CuadroResultado,
} from "@/lib/cuadros-calculo"

interface PlanoDoc {
  id: string
  nombre: string
  url: string
  tipo?: string
}

interface LaminaConImagen {
  id: string
  nombre: string
  dataUrl: string
  anotaciones: Anotacion[]
  documentoId: string
  pagina: number
}

interface Props {
  proyectoId: string
  result: DueDiligenceResult
}

// Severidad de la observación → veredicto normativo (único color saturado):
// crítica = rechaza, media = observa, menor = neutro. Así el chip de la lista
// habla el idioma del <EstadoNormativo> del resto de la ficha.
const SEVERIDAD_VEREDICTO: Record<Severidad, Veredicto> = {
  crítica: "rechaza",
  media: "observa",
  menor: "neutro",
}

// `estado` ausente (filas anteriores a jul 2026) se trata como "pendiente".
const estaResuelta = (a: Anotacion): boolean => a.estado === "resuelta"

export default function PlanosAnotados({ proyectoId, result }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [laminas, setLaminas] = useState<LaminaConImagen[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  // true mientras se buscan/rasterizan anotaciones guardadas (varios segundos
  // en láminas PDF pesadas) — sin esto el usuario ve el botón como si no
  // hubiera nada guardado.
  const [rehidratando, setRehidratando] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [info, setInfo] = useState<CoverInfo>({ documentos: [] })
  // Cuadro de cálculo normativo (viñeta sobre la lámina). Se carga guardado.
  const [cuadro, setCuadro] = useState<CuadroResultado | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch(`/api/proyectos/${proyectoId}/cuadro-calculo`)
        if (!res.ok) return
        const json = (await res.json()) as { data: CuadroInput | null }
        if (cancelled || !json.data) return
        const r = calcularCuadro(json.data)
        if (!r.incompleto) setCuadro(r)
      } catch {
        // silencioso: la viñeta es opcional
      }
    })()
    return () => {
      cancelled = true
    }
  }, [proyectoId])

  // Carga documentos + info del proyecto y rasteriza los planos (sin visión).
  // Reutilizado por generar() y por la rehidratación al montar.
  const cargar = useCallback(async () => {
    const supabase = createClient()
    const { data, error: dbError } = await supabase
      .from("documentos")
      .select("id, nombre, url, tipo")
      .eq("proyecto_id", proyectoId)
    if (dbError) throw new Error(dbError.message)
    const allDocs = (data ?? []) as PlanoDoc[]
    const planos = allDocs.filter((d) => esPlano(d.tipo))
    const { data: pRow } = await supabase
      .from("proyectos")
      .select("numero_expediente, tipo, cliente:clientes(nombre)")
      .eq("id", proyectoId)
      .maybeSingle()
    const cli = pRow?.cliente as { nombre?: string } | { nombre?: string }[] | null
    const coverInfo: CoverInfo = {
      cliente: (Array.isArray(cli) ? cli[0]?.nombre : cli?.nombre) ?? null,
      numeroExpediente: (pRow?.numero_expediente as string | null) ?? null,
      tipo: (pRow?.tipo as string | null) ?? null,
      documentos: allDocs.map((d) => ({ nombre: d.nombre, tipo: d.tipo ?? "—" })),
    }
    const rasterizadas: LaminaConImagen[] = []
    for (const p of planos) {
      const base = p.nombre.replace(/\.pdf$/i, "")
      const imgs = /\.pdf$/i.test(p.nombre)
        ? await pdfUrlToImages(p.url, base)
        : [{ nombre: base, dataUrl: p.url }]
      imgs.forEach((im, i) =>
        rasterizadas.push({
          id: `${p.id}-${i}`,
          documentoId: p.id,
          pagina: i,
          nombre: im.nombre,
          dataUrl: im.dataUrl,
          anotaciones: [],
        }),
      )
    }
    return { recorte: rasterizadas.slice(0, 6), coverInfo }
  }, [proyectoId])

  // Persiste las anotaciones por (documento, página).
  const guardar = useCallback(
    async (lams: LaminaConImagen[]) => {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return
      const rows = lams.map((l) => ({
        proyecto_id: proyectoId,
        user_id: user.id,
        documento_id: l.documentoId,
        pagina: l.pagina,
        anotaciones: l.anotaciones,
        updated_at: new Date().toISOString(),
      }))
      await supabase
        .from("planos_anotaciones")
        .upsert(rows, { onConflict: "proyecto_id,documento_id,pagina" })
    },
    [proyectoId],
  )

  const generar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const { recorte, coverInfo } = await cargar()
      if (recorte.length === 0) {
        setError("No hay planos en este proyecto. Sube una lámina (tipo Plano) para marcar observaciones.")
        return
      }
      setInfo(coverInfo)
      const observaciones = observacionesDesdeReporte(result)
      const contexto = `${result.proyecto.nombre} — ${result.proyecto.municipio ?? ""}. Due diligence: ${result.resumenEjecutivo}`

      // Marca observaciones sobre cada lámina — UN request por lámina para no
      // exceder el límite de 10MB del body con imágenes grandes.
      const merged: LaminaConImagen[] = []
      for (const r of recorte) {
        const res = await fetch("/api/ai/anotacion-plano", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            laminas: [{ id: r.id, nombre: r.nombre, dataUrl: r.dataUrl }],
            observaciones,
            contexto,
          }),
        })
        const json = (await res.json()) as {
          ok?: boolean
          laminas?: { id: string; nombre: string; anotaciones: Anotacion[] }[]
          error?: string
        }
        if (!res.ok || json.error) throw new Error(json.error ?? "Error del servidor")
        merged.push({ ...r, anotaciones: json.laminas?.[0]?.anotaciones ?? [] })
      }
      setLaminas(merged)
      setActiveIdx(0)
      setDone(true)
      await guardar(merged)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [cargar, guardar, result])

  // Rehidratación: si hay anotaciones guardadas, re-rasteriza y las aplica
  // (sin volver a llamar a visión).
  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const supabase = createClient()
        const { data: stored } = await supabase
          .from("planos_anotaciones")
          .select("documento_id, pagina, anotaciones")
          .eq("proyecto_id", proyectoId)
        if (!stored || stored.length === 0 || cancelled) return
        const { recorte, coverInfo } = await cargar()
        if (cancelled || recorte.length === 0) return
        const map = new Map(
          stored.map((s) => [`${s.documento_id}-${s.pagina}`, (s.anotaciones ?? []) as Anotacion[]]),
        )
        const merged = recorte.map((r) => ({
          ...r,
          anotaciones: map.get(`${r.documentoId}-${r.pagina}`) ?? [],
        }))
        if (cancelled) return
        setInfo(coverInfo)
        setLaminas(merged)
        setActiveIdx(0)
        setDone(true)
      } catch (err) {
        // La rehidratación no bloquea el flujo (queda el botón), pero dejamos
        // rastro para diagnosticar planos que no cargan.
        console.warn("[planos-anotados] rehidratación falló:", err)
      } finally {
        if (!cancelled) setRehidratando(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [proyectoId, cargar])

  const exportarPDF = useCallback(async () => {
    if (laminas.length === 0) return
    setExporting(true)
    try {
      await generarInformePDF(proyectoId, result)
    } finally {
      setExporting(false)
    }
  }, [laminas.length, proyectoId, result])

  // El arquitecto ajusta la marca arrastrándola (la IA propone, el humano
  // corrige). Persiste al soltar y marca la anotación como verificada.
  const moverMarca = useCallback(
    (laminaId: string, anotacionId: string, x: number, y: number) => {
      setLaminas((prev) => {
        const next = prev.map((l) =>
          l.id !== laminaId
            ? l
            : {
                ...l,
                anotaciones: l.anotaciones.map((a) =>
                  a.id !== anotacionId
                    ? a
                    : { ...a, bbox: { ...a.bbox, x, y }, confianza: Math.max(a.confianza, 0.9) },
                ),
              },
        )
        const moved = next.find((l) => l.id === laminaId)
        if (moved) void guardar([moved])
        return next
      })
    },
    [guardar],
  )

  // Alterna pendiente ⇄ resuelta de una marca y persiste la lámina activa
  // reusando el mismo upsert de guardar() (array completo de anotaciones).
  const toggleEstado = useCallback(
    (laminaId: string, anotacionId: string) => {
      setLaminas((prev) => {
        const next = prev.map((l) =>
          l.id !== laminaId
            ? l
            : {
                ...l,
                anotaciones: l.anotaciones.map((a) =>
                  a.id !== anotacionId
                    ? a
                    : {
                        ...a,
                        estado: estaResuelta(a) ? ("pendiente" as const) : ("resuelta" as const),
                      },
                ),
              },
        )
        const changed = next.find((l) => l.id === laminaId)
        if (changed) void guardar([changed])
        return next
      })
    },
    [guardar],
  )

  const active = laminas[activeIdx]

  return (
    <Card>
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <PencilRuler className="size-4 text-primary" />
            <p className="text-sm font-semibold text-primary">Observaciones sobre los planos</p>
          </div>
          {done && laminas.length > 0 && (
            <div className="flex items-center gap-2">
              {laminas.length > 1 && (
                <div className="flex gap-1">
                  {laminas.map((l, i) => (
                    <button
                      key={l.id}
                      onClick={() => setActiveIdx(i)}
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-[10px] font-medium",
                        i === activeIdx
                          ? "border-primary/40 bg-primary/5 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/20",
                      )}
                    >
                      Lámina {i + 1}
                      {l.anotaciones.length > 0 && ` · ${l.anotaciones.length}`}
                    </button>
                  ))}
                </div>
              )}
              <Button variant="ghost" size="sm" onClick={() => void generar()} disabled={loading} title="Volver a marcar con IA">
                {loading ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
                Regenerar
              </Button>
              <Button variant="outline" size="sm" onClick={() => void exportarPDF()} disabled={exporting}>
                {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
                Informe completo PDF
              </Button>
            </div>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Marca las observaciones de la DOM y los hallazgos del due diligence directamente sobre la lámina,
          como lo haría el revisor a mano.
        </p>
      </div>

      <CardBody
        loading={loading}
        rehidratando={rehidratando}
        error={error}
        done={done}
        active={active}
        hoverId={hoverId}
        setHoverId={setHoverId}
        onGenerar={generar}
        onMoverMarca={moverMarca}
        onToggleEstado={toggleEstado}
        cuadro={cuadro}
      />
    </Card>
  )
}

// Card wrapper local (evita importar Card genérico dos veces con estilos duplicados).
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-white" style={{ boxShadow: "var(--shadow-card)" }}>
      {children}
    </div>
  )
}

interface BodyProps {
  loading: boolean
  rehidratando: boolean
  error: string | null
  done: boolean
  active: LaminaConImagen | undefined
  hoverId: string | null
  setHoverId: (id: string | null) => void
  onGenerar: () => void
  onMoverMarca: (laminaId: string, anotacionId: string, x: number, y: number) => void
  onToggleEstado: (laminaId: string, anotacionId: string) => void
  cuadro: CuadroResultado | null
}

function CardBody({ loading, rehidratando, error, done, active, hoverId, setHoverId, onGenerar, onMoverMarca, onToggleEstado, cuadro }: BodyProps) {
  const [zoom, setZoom] = useState(false)
  const [vinetaVisible, setVinetaVisible] = useState(true)

  if (!done) {
    if (rehidratando && !loading && !error) {
      return (
        <div className="flex items-center gap-2 p-5 text-xs text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Buscando marcas guardadas…
        </div>
      )
    }
    return (
      <div className="space-y-3 p-5">
        {error && (
          <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-600" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}
        <Button onClick={onGenerar} disabled={loading} className="bg-primary text-white hover:bg-primary/90">
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" /> Marcando observaciones sobre los planos…
            </>
          ) : (
            <>
              <PencilRuler className="size-4" /> Marcar observaciones sobre los planos
            </>
          )}
        </Button>
      </div>
    )
  }

  if (!active) {
    return <p className="p-5 text-xs text-muted-foreground">No se pudieron marcar los planos.</p>
  }

  return (
    <div className="space-y-4 p-5">
      {/* Lámina con overlay — ancho completo: el dibujo es el protagonista */}
      <div className="space-y-2">
        <LaminaOverlay
          lamina={active}
          hoverId={hoverId}
          setHoverId={setHoverId}
          cuadro={vinetaVisible ? cuadro : null}
          onZoom={() => setZoom(true)}
          onMoverMarca={onMoverMarca}
        />
        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
          {Object.values(CONVENCION_LINEA).map((c) => (
            <span key={c.label} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0 w-5 border-t-2 border-dashed" style={{ borderColor: c.color }} />
              {c.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block size-2.5 rounded-full border-2 border-dashed border-muted-foreground/50 opacity-70" />
            Marca tenue = ubicación aproximada
          </span>
          <span>Arrastra una marca para corregir su posición</span>
          <span className="ml-auto inline-flex items-center gap-2">
            <button
              onClick={() => setZoom(true)}
              className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] hover:border-primary/40 hover:text-primary"
            >
              <Maximize2 className="size-3" /> Ampliar lámina
            </button>
            {cuadro && (
              <button
                onClick={() => setVinetaVisible((v) => !v)}
                className="inline-flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] hover:border-primary/40 hover:text-primary"
              >
                {vinetaVisible ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                {vinetaVisible ? "Ocultar cuadro" : "Mostrar cuadro"}
              </button>
            )}
          </span>
        </div>
      </div>

      {/* Markups List (patrón Bluebeam): registro compacto de observaciones,
          hairlines, número que enlaza con la marca, artículo en mono, chip de
          estado normativo y control pendiente ⇄ resuelta por fila. */}
      <MarkupsList
        anotaciones={active.anotaciones}
        hoverId={hoverId}
        setHoverId={setHoverId}
        onToggle={(id) => onToggleEstado(active.id, id)}
      />

      {/* Lightbox de zoom: lámina a pantalla (casi) completa con las marcas */}
      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setZoom(false)}
          role="dialog"
          aria-label={`Lámina ampliada: ${active.nombre}`}
        >
          <div
            className="max-h-[94vh] max-w-[96vw] overflow-auto rounded-lg bg-white p-2 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-1 flex items-center justify-between gap-3 px-1">
              <p className="truncate text-xs font-semibold text-primary">{active.nombre}</p>
              <button
                onClick={() => setZoom(false)}
                className="rounded border border-border px-2 py-0.5 text-[11px] text-muted-foreground hover:border-primary/40 hover:text-primary"
              >
                Cerrar ✕
              </button>
            </div>
            <div className="min-w-[900px]">
              <LaminaOverlay
                lamina={active}
                hoverId={hoverId}
                setHoverId={setHoverId}
                cuadro={vinetaVisible ? cuadro : null}
                onMoverMarca={onMoverMarca}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Markups List (patrón Bluebeam): el panel de observaciones como registro
// técnico, no como tarjetas. Cada fila enlaza con su marca por número (hover
// bidireccional), muestra el artículo en mono, el chip de estado normativo por
// severidad y un control pendiente ⇄ resuelta. Fila resuelta = atenuada/tachada.
function MarkupsList({
  anotaciones,
  hoverId,
  setHoverId,
  onToggle,
}: {
  anotaciones: Anotacion[]
  hoverId: string | null
  setHoverId: (id: string | null) => void
  onToggle: (id: string) => void
}) {
  const total = anotaciones.length
  const resueltas = anotaciones.filter(estaResuelta).length

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-technical text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Markups · observaciones
        </p>
        <p className="num text-[11px] text-muted-foreground">
          {total} observaciones · {resueltas} resueltas
        </p>
      </div>

      {total === 0 ? (
        <p className="rounded-[3px] border border-dashed border-line-fine bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
          Sin marcas en esta lámina.
        </p>
      ) : (
        <div className="overflow-hidden rounded-[3px] border border-line-fine">
          <div className="divide-y divide-line-fine">
            {anotaciones.map((a, i) => {
              const color = colorDeMarca(a.convencionLinea, a.severidad)
              const on = hoverId === a.id
              const resuelta = estaResuelta(a)
              return (
                <div
                  key={a.id}
                  onMouseEnter={() => setHoverId(a.id)}
                  onMouseLeave={() => setHoverId(null)}
                  className={cn(
                    "flex items-start gap-3 px-3 py-2.5 transition-colors",
                    on && "bg-[color-mix(in_oklch,var(--blueprint)_8%,transparent)]",
                    resuelta && "opacity-55",
                  )}
                >
                  {/* Número — clave visual que enlaza fila ⇄ marca */}
                  <span
                    className="num mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                    style={{ background: color }}
                  >
                    {i + 1}
                  </span>

                  {/* Cuerpo */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <span
                        className={cn(
                          "text-xs font-semibold text-primary",
                          resuelta && "line-through",
                        )}
                      >
                        {a.textoCorto}
                      </span>
                      {a.articulo && (() => {
                        const cita = citaDesdeTexto(a.articulo)
                        const porVerificar = /por verificar/i.test(a.articulo)
                        if (cita) {
                          return (
                            <a
                              href={cita.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="num inline-flex items-center gap-1 rounded-[3px] border border-line-med px-1.5 py-0.5 text-[10px] text-primary transition-colors hover:border-[var(--blueprint)] hover:text-[var(--blueprint)]"
                              title={`Ver ${a.articulo} en la fuente`}
                            >
                              {a.articulo}
                              <ExternalLink className="size-2.5" />
                            </a>
                          )
                        }
                        return (
                          <span
                            className="num rounded-[3px] border px-1.5 py-0.5 text-[10px]"
                            style={
                              porVerificar
                                ? { color: "var(--state-warn)", borderColor: "var(--state-warn)", background: "color-mix(in oklch, var(--state-warn) 12%, transparent)" }
                                : { borderColor: "var(--line-fine)", color: "var(--muted-foreground)", background: "color-mix(in oklch, var(--muted-foreground) 8%, transparent)" }
                            }
                          >
                            {a.articulo}
                          </span>
                        )
                      })()}
                    </div>
                    {a.ancla && (
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        <span className="num">↳</span> {a.ancla}
                      </p>
                    )}
                    {a.confianza < 0.5 && (
                      <p className="mt-1 text-[10px] font-medium" style={{ color: "var(--state-warn)" }}>
                        Ubicación aproximada — verificar sobre el plano
                      </p>
                    )}
                    <p className="mt-1 text-[11px] leading-relaxed text-foreground/75">{a.observacion}</p>
                    {a.fundamento && (
                      <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
                        <span className="font-semibold">Fundamento: </span>
                        {a.fundamento}
                      </p>
                    )}
                    {a.sugerencia && (
                      <p className="mt-1 rounded-[3px] bg-[color-mix(in_oklch,var(--blueprint)_8%,transparent)] px-1.5 py-1 text-[10px] leading-relaxed text-[var(--blueprint)]">
                        <span className="font-semibold">Corregir: </span>
                        {a.sugerencia}
                      </p>
                    )}
                  </div>

                  {/* Estado: severidad normativa + toggle pendiente/resuelta */}
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <EstadoNormativo estado={SEVERIDAD_VEREDICTO[a.severidad]} label={a.severidad} />
                    <button
                      type="button"
                      onClick={() => onToggle(a.id)}
                      aria-pressed={resuelta}
                      title={resuelta ? "Marcar como pendiente" : "Marcar como resuelta"}
                      className={cn(
                        "num inline-flex items-center gap-1 rounded-[3px] border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
                        resuelta ? "border-transparent text-white" : "border-line-med text-muted-foreground hover:border-line-strong",
                      )}
                      style={resuelta ? { background: "var(--state-ok)" } : undefined}
                    >
                      {resuelta ? <Check className="size-3" strokeWidth={3} /> : <CircleDashed className="size-3" />}
                      {resuelta ? "Resuelta" : "Pendiente"}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// Imagen de la lámina + marcas + viñeta. Reutilizada por el visor y el zoom
// (coordenadas en %, así que escala sola). Las marcas se pueden ARRASTRAR
// para corregir la ubicación propuesta por la IA (persiste al soltar).
function LaminaOverlay({
  lamina,
  hoverId,
  setHoverId,
  cuadro,
  onZoom,
  onMoverMarca,
}: {
  lamina: LaminaConImagen
  hoverId: string | null
  setHoverId: (id: string | null) => void
  cuadro: CuadroResultado | null
  onZoom?: () => void
  onMoverMarca?: (laminaId: string, anotacionId: string, x: number, y: number) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  // Posición transitoria durante el arrastre (evita persistir en cada move).
  const [dragPos, setDragPos] = useState<{ id: string; x: number; y: number } | null>(null)
  const dragRef = useRef<{
    id: string
    startClientX: number
    startClientY: number
    startX: number
    startY: number
    w: number
    h: number
    moved: boolean
    // Última posición calculada — el pointerup puede llegar antes del
    // re-render, así que no puede depender del estado dragPos.
    lastX: number
    lastY: number
  } | null>(null)

  const onPointerDown = (a: Anotacion) => (e: React.PointerEvent<HTMLDivElement>) => {
    if (!onMoverMarca) return
    e.stopPropagation()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    dragRef.current = {
      id: a.id,
      startClientX: e.clientX,
      startClientY: e.clientY,
      startX: a.bbox.x,
      startY: a.bbox.y,
      w: a.bbox.w,
      h: a.bbox.h,
      moved: false,
      lastX: a.bbox.x,
      lastY: a.bbox.y,
    }
  }

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    const rect = containerRef.current?.getBoundingClientRect()
    if (!d || !rect) return
    const dx = (e.clientX - d.startClientX) / rect.width
    const dy = (e.clientY - d.startClientY) / rect.height
    if (!d.moved && Math.abs(dx) < 0.004 && Math.abs(dy) < 0.004) return
    d.moved = true
    d.lastX = Math.min(1 - d.w, Math.max(0, d.startX + dx))
    d.lastY = Math.min(1 - d.h, Math.max(0, d.startY + dy))
    setDragPos({ id: d.id, x: d.lastX, y: d.lastY })
  }

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    e.stopPropagation()
    if (d.moved && onMoverMarca) {
      onMoverMarca(lamina.id, d.id, d.lastX, d.lastY)
    }
    setDragPos(null)
  }

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative overflow-hidden rounded-lg border border-border",
        onZoom && "cursor-zoom-in",
      )}
      onClick={onZoom}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={lamina.dataUrl} alt={lamina.nombre} className="block w-full" />
      {lamina.anotaciones.map((a, i) => {
        const color = colorDeMarca(a.convencionLinea, a.severidad)
        const on = hoverId === a.id
        const dragging = dragPos?.id === a.id
        const resuelta = estaResuelta(a)
        const x = dragging ? dragPos.x : a.bbox.x
        const y = dragging ? dragPos.y : a.bbox.y
        return (
          <div
            key={a.id}
            onMouseEnter={() => setHoverId(a.id)}
            onMouseLeave={() => setHoverId(null)}
            onPointerDown={onPointerDown(a)}
            onClick={(e) => e.stopPropagation()}
            className={cn("absolute touch-none", onMoverMarca && "cursor-move")}
            style={{
              left: `${x * 100}%`,
              top: `${y * 100}%`,
              width: `${a.bbox.w * 100}%`,
              height: `${a.bbox.h * 100}%`,
              border: `2px ${a.convencionLinea ? "dashed" : "solid"} ${color}`,
              borderRadius: a.tipoMarca === "circulo" ? "9999px" : "4px",
              background: on || dragging ? `${color}1f` : "transparent",
              boxShadow: on || dragging ? `0 0 0 2px ${color}55` : "none",
              // Marca resuelta = muy atenuada; ubicación incierta = tenue.
              opacity: resuelta ? 0.4 : a.confianza < 0.5 ? 0.7 : 1,
            }}
            title={a.ancla ? `${i + 1}. ${a.textoCorto} — ${a.ancla}` : `${i + 1}. ${a.textoCorto}`}
          >
            <span
              className="absolute -left-2 -top-2 flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
              style={{ background: color }}
            >
              {i + 1}
            </span>
            {resuelta && (
              <span
                className="absolute -right-2 -top-2 flex size-4 items-center justify-center rounded-full border border-white text-white"
                style={{ background: "var(--state-ok)" }}
                title="Resuelta"
              >
                <Check className="size-2.5" strokeWidth={3} />
              </span>
            )}
          </div>
        )
      })}
      {cuadro && <CuadroVineta cuadro={cuadro} />}
    </div>
  )
}

// Viñeta del cuadro de cálculo normativo, anclada en la esquina de la lámina
// (como un cuadro de superficies en un plano real). Solo lectura; se edita en
// PMO. Compacta a propósito: no debe tapar el dibujo (ancho relativo, tope).
function CuadroVineta({ cuadro }: { cuadro: CuadroResultado }) {
  const vColor = (v: string) =>
    v === "excede" ? "#dc2626" : v === "cumple" ? "#16a34a" : "#6b7280"
  const filas = cuadro.filas.filter((f) =>
    ["Constructibilidad", "Ocupación de suelo", "Altura de edificación", "Rasante", "Distanciamiento"].includes(
      f.concepto,
    ),
  )
  const corto: Record<string, string> = {
    "Ocupación de suelo": "Ocupación",
    "Altura de edificación": "Altura",
    Distanciamiento: "Distanc.",
  }
  return (
    <div className="absolute bottom-1.5 right-1.5 w-[22%] min-w-[110px] max-w-[170px] rounded border border-black/25 bg-white/95 p-1.5 text-[9px] leading-tight shadow-md">
      <p className="mb-0.5 text-[8px] font-bold uppercase tracking-wide text-primary">
        Cuadro de cálculo
      </p>
      <div className="space-y-px">
        <div className="flex items-center justify-between gap-1">
          <span className="text-muted-foreground">Sup. edif.</span>
          <span className="font-semibold text-primary">{cuadro.superficieTotalEdificada} m²</span>
        </div>
        {filas.map((f) => (
          <div key={f.concepto} className="flex items-center justify-between gap-1">
            <span className="text-muted-foreground">{corto[f.concepto] ?? f.concepto}</span>
            <span className="font-semibold" style={{ color: vColor(f.veredicto) }}>
              {f.valor}
              {f.unidad}
              {f.limite !== null ? ` / ${f.limite}${f.unidad}` : ""}
            </span>
          </div>
        ))}
      </div>
      {cuadro.incumplimientos.length > 0 && (
        <p className="mt-0.5 text-[8px] font-semibold text-red-600">
          Excede {cuadro.incumplimientos.length} límite{cuadro.incumplimientos.length > 1 ? "s" : ""}
        </p>
      )}
    </div>
  )
}
