"use client"

import { useCallback, useEffect, useState } from "react"
import { AlertCircle, Download, Loader2, PencilRuler, RefreshCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { esPlano } from "@/lib/planos"
import { cn } from "@/lib/utils"
import {
  CONVENCION_LINEA,
  SEVERIDAD_COLOR,
  colorDeMarca,
  type Anotacion,
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

export default function PlanosAnotados({ proyectoId, result }: Props) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [laminas, setLaminas] = useState<LaminaConImagen[]>([])
  const [activeIdx, setActiveIdx] = useState(0)
  const [hoverId, setHoverId] = useState<string | null>(null)
  const [done, setDone] = useState(false)
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
      } catch {
        // silencioso: si falla la rehidratación, queda el estado inicial (botón)
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
        error={error}
        done={done}
        active={active}
        hoverId={hoverId}
        setHoverId={setHoverId}
        onGenerar={generar}
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
  error: string | null
  done: boolean
  active: LaminaConImagen | undefined
  hoverId: string | null
  setHoverId: (id: string | null) => void
  onGenerar: () => void
  cuadro: CuadroResultado | null
}

function CardBody({ loading, error, done, active, hoverId, setHoverId, onGenerar, cuadro }: BodyProps) {
  if (!done) {
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
    <div className="grid gap-4 p-5 lg:grid-cols-[1fr_300px]">
      {/* Lámina con overlay */}
      <div className="space-y-2">
        <div className="relative overflow-hidden rounded-lg border border-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={active.dataUrl} alt={active.nombre} className="block w-full" />
          {active.anotaciones.map((a, i) => {
            const color = colorDeMarca(a.convencionLinea, a.severidad)
            const on = hoverId === a.id
            return (
              <div
                key={a.id}
                onMouseEnter={() => setHoverId(a.id)}
                onMouseLeave={() => setHoverId(null)}
                className="absolute"
                style={{
                  left: `${a.bbox.x * 100}%`,
                  top: `${a.bbox.y * 100}%`,
                  width: `${a.bbox.w * 100}%`,
                  height: `${a.bbox.h * 100}%`,
                  border: `2px ${a.convencionLinea ? "dashed" : "solid"} ${color}`,
                  borderRadius: a.tipoMarca === "circulo" ? "9999px" : "4px",
                  background: on ? `${color}1f` : "transparent",
                  boxShadow: on ? `0 0 0 2px ${color}55` : "none",
                  opacity: a.confianza < 0.5 ? 0.7 : 1,
                }}
              >
                <span
                  className="absolute -left-2 -top-2 flex size-5 items-center justify-center rounded-full text-[10px] font-bold text-white"
                  style={{ background: color }}
                >
                  {i + 1}
                </span>
              </div>
            )
          })}
          {cuadro && <CuadroVineta cuadro={cuadro} />}
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
          {Object.values(CONVENCION_LINEA).map((c) => (
            <span key={c.label} className="inline-flex items-center gap-1.5">
              <span className="inline-block h-0 w-5 border-t-2 border-dashed" style={{ borderColor: c.color }} />
              {c.label}
            </span>
          ))}
        </div>
      </div>

      {/* Panel de observaciones */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          {active.anotaciones.length} observaciones en esta lámina
        </p>
        {active.anotaciones.length === 0 && (
          <p className="rounded-lg border border-dashed border-border bg-muted/20 px-3 py-4 text-center text-xs text-muted-foreground">
            Sin marcas en esta lámina.
          </p>
        )}
        {active.anotaciones.map((a, i) => {
          const color = colorDeMarca(a.convencionLinea, a.severidad)
          const on = hoverId === a.id
          return (
            <div
              key={a.id}
              onMouseEnter={() => setHoverId(a.id)}
              onMouseLeave={() => setHoverId(null)}
              className={cn(
                "rounded-lg border bg-white p-2.5 transition-all",
                on ? "border-primary/40 shadow-sm" : "border-border",
              )}
            >
              <div className="mb-1 flex items-start gap-2">
                <span
                  className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
                  style={{ background: color }}
                >
                  {i + 1}
                </span>
                <span className="text-xs font-semibold text-primary">{a.textoCorto}</span>
                <span
                  className="ml-auto shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-semibold"
                  style={{ background: `${SEVERIDAD_COLOR[a.severidad]}1a`, color: SEVERIDAD_COLOR[a.severidad] }}
                >
                  {a.severidad}
                </span>
              </div>
              {a.articulo && (
                <span className="mb-1 inline-block rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                  {a.articulo}
                </span>
              )}
              <p className="text-[11px] leading-relaxed text-foreground/75">{a.observacion}</p>
              {a.sugerencia && (
                <p className="mt-1 rounded bg-primary/5 px-1.5 py-1 text-[10px] leading-relaxed text-primary/80">
                  <span className="font-semibold">Corregir: </span>
                  {a.sugerencia}
                </p>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Viñeta del cuadro de cálculo normativo, anclada en la esquina de la lámina
// (como un cuadro de superficies en un plano real). Solo lectura; se edita en PMO.
function CuadroVineta({ cuadro }: { cuadro: CuadroResultado }) {
  const vColor = (v: string) =>
    v === "excede" ? "#dc2626" : v === "cumple" ? "#16a34a" : "#6b7280"
  const filas = cuadro.filas.filter((f) =>
    ["Constructibilidad", "Ocupación de suelo", "Altura de edificación"].includes(f.concepto),
  )
  const corto: Record<string, string> = {
    "Ocupación de suelo": "Ocupación",
    "Altura de edificación": "Altura",
  }
  return (
    <div className="absolute bottom-2 right-2 w-[186px] rounded-md border border-black/25 bg-white/95 p-2 text-[10px] shadow-md">
      <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-primary">
        Cuadro de cálculo
      </p>
      <div className="space-y-0.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">Sup. edificada</span>
          <span className="font-semibold text-primary">{cuadro.superficieTotalEdificada} m²</span>
        </div>
        {filas.map((f) => (
          <div key={f.concepto} className="flex items-center justify-between gap-2">
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
        <p className="mt-1 text-[9px] font-semibold text-red-600">
          Excede {cuadro.incumplimientos.length} límite{cuadro.incumplimientos.length > 1 ? "s" : ""}
        </p>
      )}
    </div>
  )
}
