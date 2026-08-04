"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ChevronDown, ListFilter, Loader2, MapPin, Plus, SlidersHorizontal, Store, Tag, TrendingDown, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { EstadoNormativo, type Veredicto } from "@/components/arch/estado"
import { PageHeader } from "@/components/dashboard/page-header"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { cn } from "@/lib/utils"
import { UF_FALLBACK_CLP, type UfData } from "@/lib/uf"
import { fixMojibakeArcGIS } from "@/lib/zonificacion-format"
import { formatoComercial, FORMATO_COMERCIAL_LABEL, type FormatoComercial } from "@/lib/terrenos-comercial"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { Terreno } from "@/types"

type ZonaStatus = NonNullable<Terreno["zona_status"]>

const ZONA_STATUS_LABEL: Record<ZonaStatus, string> = {
  pendiente: "Consultando…",
  encontrado: "Zonificación encontrada",
  sin_cobertura: "Sin cobertura",
  error: "Error al consultar",
}

const ZONA_STATUS_VEREDICTO: Record<ZonaStatus, Veredicto> = {
  pendiente: "neutro",
  encontrado: "cumple",
  sin_cobertura: "observa",
  error: "rechaza",
}

const FUENTE_LABEL: Record<Terreno["fuente"], string> = {
  manual: "Manual",
  portalinmobiliario: "Portalinmobiliario",
  portalterreno: "PortalTerreno",
  doomos: "Doomos",
  yapo: "Yapo",
  chilepropiedades: "Chilepropiedades",
}

type UsoComercialStatus = NonNullable<Terreno["uso_comercial_status"]>

const USO_COMERCIAL_LABEL: Record<UsoComercialStatus, string> = {
  pendiente: "Sin evaluar",
  permitido: "Permitido",
  no_permitido: "No permitido",
  no_especificado: "No especificado",
}

const USO_COMERCIAL_VEREDICTO: Record<UsoComercialStatus, Veredicto> = {
  pendiente: "neutro",
  permitido: "cumple",
  no_permitido: "rechaza",
  no_especificado: "observa",
}

type Orden = "recientes" | "precio_asc" | "precio_desc" | "superficie_asc" | "superficie_desc" | "precio_m2_asc" | "precio_m2_desc"

const ORDEN_LABEL: Record<Orden, string> = {
  recientes: "Más recientes",
  precio_asc: "Precio: menor a mayor",
  precio_desc: "Precio: mayor a menor",
  superficie_asc: "Superficie: menor a mayor",
  superficie_desc: "Superficie: mayor a menor",
  precio_m2_asc: "$/m² (aprox.): menor a mayor",
  precio_m2_desc: "$/m² (aprox.): mayor a menor",
}

const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })
const CLP_COMPACTO = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 })
const UF_PRECIO = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 })
const UF_M2 = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 })

function precioPorM2(t: Terreno): number | null {
  if (!t.precio_clp || !t.superficie_lote_m2 || t.superficie_lote_m2 <= 0) return null
  return t.precio_clp / t.superficie_lote_m2
}

// Señal 1 de oportunidad: precio bajo mercado. Percentil 25 de $/m² POR
// COMUNA, calculado sobre todos los terrenos con precio+superficie válidos
// (no solo los filtrados — el benchmark de mercado no debe moverse cuando el
// usuario cambia un filtro). Comunas con pocos datos (<4) no generan
// percentil — un P25 sobre 2-3 puntos no dice nada real.
const MUESTRA_MINIMA_PERCENTIL = 4

function calcularPercentil25PorComuna(terrenos: Terreno[]): Map<string, number> {
  const valoresPorComuna = new Map<string, number[]>()
  for (const t of terrenos) {
    const clpM2 = precioPorM2(t)
    if (clpM2 === null) continue
    const lista = valoresPorComuna.get(t.comuna) ?? []
    lista.push(clpM2)
    valoresPorComuna.set(t.comuna, lista)
  }
  const resultado = new Map<string, number>()
  for (const [comuna, valores] of valoresPorComuna) {
    if (valores.length < MUESTRA_MINIMA_PERCENTIL) continue
    const ordenados = [...valores].sort((a, b) => a - b)
    resultado.set(comuna, ordenados[Math.floor(ordenados.length * 0.25)])
  }
  return resultado
}

// Señal 2: bajó de precio entre corridas del scraper — el trigger de
// Postgres registrar_historial_precio_terreno() llena precio_clp_anterior
// solo cuando el precio realmente cambió (nunca desde null).
function bajoDePrecio(t: Terreno): boolean {
  return t.precio_clp_anterior != null && t.precio_clp != null && t.precio_clp < t.precio_clp_anterior
}

export default function TerrenosPage() {
  const [terrenos, setTerrenos] = useState<Terreno[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroComuna, setFiltroComuna] = useState("todas")
  const [filtroEstado, setFiltroEstado] = useState("todos")
  const [filtroFuente, setFiltroFuente] = useState("todas")
  const [filtroFormato, setFiltroFormato] = useState("todos")
  const [filtroUsoComercial, setFiltroUsoComercial] = useState("todos")
  const [precioMin, setPrecioMin] = useState("")
  const [precioMax, setPrecioMax] = useState("")
  const [superficieMin, setSuperficieMin] = useState("")
  const [superficieMax, setSuperficieMax] = useState("")
  const [orden, setOrden] = useState<Orden>("recientes")
  const [soloOportunidadPrecio, setSoloOportunidadPrecio] = useState(false)
  const [soloBajoDePrecio, setSoloBajoDePrecio] = useState(false)
  const [soloCercaAvenida, setSoloCercaAvenida] = useState(false)
  const [mostrarMasFiltros, setMostrarMasFiltros] = useState(false)
  const [ufActual, setUfActual] = useState<UfData>({ valor: UF_FALLBACK_CLP, fecha: null, fallback: true })
  const [reintentando, setReintentando] = useState(false)
  const [progresoReintento, setProgresoReintento] = useState<{ procesados: number; resueltos: number } | null>(null)
  const reintentoCancelado = useRef(false)

  const cargarTerrenos = useCallback(async () => {
    const r = await fetch("/api/terrenos")
    const data = (await r.json()) as { data?: Terreno[] }
    setTerrenos(data.data ?? [])
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    cargarTerrenos()
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [])

  // Mismo patrón que /mercado-inmobiliario/calculadora y /herramientas/
  // calculadora: fetch una vez, fallback explícito (UF_FALLBACK_CLP) nunca
  // silencioso — ufActual.fallback se muestra en la UI, no se oculta.
  useEffect(() => {
    let cancelled = false
    fetch("/api/utils/uf")
      .then((r) => r.json() as Promise<UfData & { ok: boolean }>)
      .then((data) => { if (!cancelled) setUfActual({ valor: data.valor, fecha: data.fecha, fallback: data.fallback ?? false }) })
      .catch(() => { if (!cancelled) setUfActual({ valor: UF_FALLBACK_CLP, fecha: null, fallback: true }) })
    return () => { cancelled = true }
  }, [])

  const comunas = useMemo(
    () => Array.from(new Set(terrenos.map((t) => t.comuna))).sort(),
    [terrenos],
  )
  const fuentesPresentes = useMemo(
    () => Array.from(new Set(terrenos.map((t) => t.fuente))),
    [terrenos],
  )
  const pendientesCount = useMemo(
    () => terrenos.filter((t) => (t.zona_status ?? "pendiente") === "pendiente").length,
    [terrenos],
  )

  // Reintenta en lotes de 20 (mismo tope que el cron de descubrimiento) hasta
  // que no queden "pendiente" o el usuario navegue fuera de la página. Nunca
  // toca "error" — sondeo manual (04-08) mostró que la mayoría son direcciones
  // no geocodificables (título del aviso guardado como dirección), reintentar
  // no las arregla. Ver .planning/PROJECT.md.
  const reintentarPendientes = useCallback(async () => {
    reintentoCancelado.current = false
    setReintentando(true)
    setProgresoReintento({ procesados: 0, resueltos: 0 })
    try {
      let restantes = Infinity
      let totalProcesados = 0
      let totalResueltos = 0
      while (restantes > 0 && !reintentoCancelado.current) {
        const res = await fetch("/api/terrenos/reintentar-pendientes?limit=20", { method: "POST" })
        if (!res.ok) break
        const data = (await res.json()) as { procesados: number; resueltos: number; restantes: number }
        if (data.procesados === 0) break
        totalProcesados += data.procesados
        totalResueltos += data.resueltos
        restantes = data.restantes
        setProgresoReintento({ procesados: totalProcesados, resueltos: totalResueltos })
        await cargarTerrenos()
      }
    } finally {
      setReintentando(false)
    }
  }, [cargarTerrenos])

  useEffect(() => () => { reintentoCancelado.current = true }, [])

  // Filtros "secundarios": los que viven detrás de "Más filtros". Comuna,
  // estado de viabilidad y orden se dejan siempre visibles porque son los
  // que se usan en casi toda sesión; el resto son refinamientos ocasionales.
  const filtrosSecundariosActivos = [
    filtroFuente !== "todas",
    filtroFormato !== "todos",
    filtroUsoComercial !== "todos",
    precioMin !== "",
    precioMax !== "",
    superficieMin !== "",
    superficieMax !== "",
    soloOportunidadPrecio,
    soloBajoDePrecio,
    soloCercaAvenida,
  ].filter(Boolean).length

  const hayFiltrosActivos = filtroComuna !== "todas" || filtroEstado !== "todos" || filtrosSecundariosActivos > 0

  function limpiarFiltros() {
    setFiltroComuna("todas")
    setFiltroEstado("todos")
    setFiltroFuente("todas")
    setFiltroFormato("todos")
    setFiltroUsoComercial("todos")
    setPrecioMin("")
    setPrecioMax("")
    setSuperficieMin("")
    setSuperficieMax("")
    setSoloOportunidadPrecio(false)
    setSoloBajoDePrecio(false)
    setSoloCercaAvenida(false)
  }

  const percentil25PorComuna = useMemo(() => calcularPercentil25PorComuna(terrenos), [terrenos])

  const esOportunidadPrecio = useCallback((t: Terreno): boolean => {
    const clpM2 = precioPorM2(t)
    const p25 = percentil25PorComuna.get(t.comuna)
    return clpM2 !== null && p25 !== undefined && clpM2 <= p25
  }, [percentil25PorComuna])

  const filtrados = useMemo(() => {
    const min = precioMin ? Number(precioMin) : null
    const max = precioMax ? Number(precioMax) : null
    const supMin = superficieMin ? Number(superficieMin) : null
    const supMax = superficieMax ? Number(superficieMax) : null

    const resultado = terrenos.filter((t) => {
      if (filtroComuna !== "todas" && t.comuna !== filtroComuna) return false
      if (filtroEstado !== "todos" && (t.zona_status ?? "pendiente") !== filtroEstado) return false
      if (filtroFuente !== "todas" && t.fuente !== filtroFuente) return false
      if (filtroFormato !== "todos" && formatoComercial(t.superficie_lote_m2) !== filtroFormato) return false
      if (filtroUsoComercial !== "todos" && (t.uso_comercial_status ?? "pendiente") !== filtroUsoComercial) return false
      if (min !== null && (!t.precio_clp || t.precio_clp < min)) return false
      if (max !== null && (!t.precio_clp || t.precio_clp > max)) return false
      if (supMin !== null && (!t.superficie_lote_m2 || t.superficie_lote_m2 < supMin)) return false
      if (supMax !== null && (!t.superficie_lote_m2 || t.superficie_lote_m2 > supMax)) return false
      if (soloOportunidadPrecio && !esOportunidadPrecio(t)) return false
      if (soloBajoDePrecio && !bajoDePrecio(t)) return false
      if (soloCercaAvenida && !t.cerca_avenida_principal) return false
      return true
    })

    const conNulosAlFinal = (valor: number | null) => valor === null ? Number.POSITIVE_INFINITY : valor
    const comparadores: Record<Orden, (a: Terreno, b: Terreno) => number> = {
      recientes: (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      precio_asc: (a, b) => conNulosAlFinal(a.precio_clp ?? null) - conNulosAlFinal(b.precio_clp ?? null),
      precio_desc: (a, b) => conNulosAlFinal(b.precio_clp ?? null) - conNulosAlFinal(a.precio_clp ?? null),
      superficie_asc: (a, b) => conNulosAlFinal(a.superficie_lote_m2 ?? null) - conNulosAlFinal(b.superficie_lote_m2 ?? null),
      superficie_desc: (a, b) => conNulosAlFinal(b.superficie_lote_m2 ?? null) - conNulosAlFinal(a.superficie_lote_m2 ?? null),
      precio_m2_asc: (a, b) => conNulosAlFinal(precioPorM2(a)) - conNulosAlFinal(precioPorM2(b)),
      precio_m2_desc: (a, b) => conNulosAlFinal(precioPorM2(b)) - conNulosAlFinal(precioPorM2(a)),
    }
    return [...resultado].sort(comparadores[orden])
  }, [terrenos, filtroComuna, filtroEstado, filtroFuente, filtroFormato, filtroUsoComercial, precioMin, precioMax, superficieMin, superficieMax, orden, soloOportunidadPrecio, soloBajoDePrecio, soloCercaAvenida, esOportunidadPrecio])

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="🗺️"
        title="Terrenos"
        subtitle="Evalúa viabilidad normativa de terrenos en venta antes de tener un proyecto formal"
        action={
          <Link href="/terrenos/nuevo">
            <Button size="sm" className="gap-1.5">
              <Plus className="size-4" /> Nuevo terreno
            </Button>
          </Link>
        }
      />
      <div className="flex-1 overflow-auto p-8">
        <div className="mb-4 space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Comuna</Label>
              <Select value={filtroComuna} onValueChange={(v) => setFiltroComuna(v as string)}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Comuna" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todas">Todas las comunas</SelectItem>
                  {comunas.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Estado de viabilidad</Label>
              <Select value={filtroEstado} onValueChange={(v) => setFiltroEstado(v as string)}>
                <SelectTrigger className="w-52"><SelectValue placeholder="Estado de viabilidad" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  {(Object.keys(ZONA_STATUS_LABEL) as ZonaStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>{ZONA_STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Ordenar por</Label>
              <Select value={orden} onValueChange={(v) => setOrden(v as Orden)}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Ordenar por" /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(ORDEN_LABEL) as Orden[]).map((o) => (
                    <SelectItem key={o} value={o}>{ORDEN_LABEL[o]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant={mostrarMasFiltros ? "secondary" : "outline"}
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setMostrarMasFiltros((v) => !v)}
            >
              <SlidersHorizontal className="size-3.5" />
              Más filtros
              {filtrosSecundariosActivos > 0 && (
                <span className="ml-0.5 inline-flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-medium text-primary-foreground">
                  {filtrosSecundariosActivos}
                </span>
              )}
              <ChevronDown className={cn("size-3.5 transition-transform", mostrarMasFiltros && "rotate-180")} />
            </Button>
            {hayFiltrosActivos && (
              <Button variant="ghost" size="sm" className="gap-1.5 text-xs text-muted-foreground" onClick={limpiarFiltros}>
                <X className="size-3.5" /> Limpiar filtros
              </Button>
            )}
          </div>

          {mostrarMasFiltros && (
            <div className="space-y-3 rounded-lg border border-dashed border-border p-3">
              <div className="flex flex-wrap items-end gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Fuente</Label>
                  <Select value={filtroFuente} onValueChange={(v) => setFiltroFuente(v as string)}>
                    <SelectTrigger className="w-44"><SelectValue placeholder="Fuente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todas">Todas las fuentes</SelectItem>
                      {fuentesPresentes.map((f) => <SelectItem key={f} value={f}>{FUENTE_LABEL[f]}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Formato comercial</Label>
                  <Select value={filtroFormato} onValueChange={(v) => setFiltroFormato(v as string)}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Formato comercial" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los formatos</SelectItem>
                      {(Object.keys(FORMATO_COMERCIAL_LABEL) as FormatoComercial[]).map((f) => (
                        <SelectItem key={f} value={f}>{FORMATO_COMERCIAL_LABEL[f]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Uso comercial</Label>
                  <Select value={filtroUsoComercial} onValueChange={(v) => setFiltroUsoComercial(v as string)}>
                    <SelectTrigger className="w-48"><SelectValue placeholder="Uso comercial" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos</SelectItem>
                      {(Object.keys(USO_COMERCIAL_LABEL) as UsoComercialStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>{USO_COMERCIAL_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3">
                <div className="flex items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Precio mín. (CLP)</Label>
                    <Input type="number" value={precioMin} onChange={(e) => setPrecioMin(e.target.value)} placeholder="0" className="h-8 w-32 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Precio máx. (CLP)</Label>
                    <Input type="number" value={precioMax} onChange={(e) => setPrecioMax(e.target.value)} placeholder="Sin tope" className="h-8 w-32 text-xs" />
                  </div>
                </div>
                <div className="flex items-end gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Superficie mín. (m²)</Label>
                    <Input type="number" value={superficieMin} onChange={(e) => setSuperficieMin(e.target.value)} placeholder="0" className="h-8 w-32 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Superficie máx. (m²)</Label>
                    <Input type="number" value={superficieMax} onChange={(e) => setSuperficieMax(e.target.value)} placeholder="Sin tope" className="h-8 w-32 text-xs" />
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Oportunidad:</span>
                <Button
                  variant={soloOportunidadPrecio ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSoloOportunidadPrecio((v) => !v)}
                >
                  Precio bajo mercado (comuna)
                </Button>
                <Button
                  variant={soloBajoDePrecio ? "default" : "outline"}
                  size="sm"
                  className="h-7 gap-1 text-xs"
                  onClick={() => setSoloBajoDePrecio((v) => !v)}
                >
                  <TrendingDown className="size-3.5" /> Bajó de precio
                </Button>
                <Button
                  variant={soloCercaAvenida ? "default" : "outline"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setSoloCercaAvenida((v) => !v)}
                >
                  Cerca de avenida principal
                </Button>
              </div>
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Cargando terrenos…</p>
        ) : filtrados.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {terrenos.length === 0
              ? "Aún no has evaluado ningún terreno. Crea el primero para verificar su viabilidad normativa."
              : "Ningún terreno calza con los filtros seleccionados."}
          </div>
        ) : (
          <>
            {(pendientesCount > 0 || reintentando) && (
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-dashed border-border bg-muted/30 p-3 text-xs">
                <div className="text-muted-foreground">
                  {reintentando && progresoReintento ? (
                    <>
                      Reintentando zonificación… {progresoReintento.procesados} procesados,{" "}
                      {progresoReintento.resueltos} resueltos.
                    </>
                  ) : (
                    <>{pendientesCount} terreno(s) con zonificación sin consultar todavía.</>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => void reintentarPendientes()}
                  disabled={reintentando || pendientesCount === 0}
                >
                  {reintentando ? (
                    <>
                      <Loader2 className="size-3.5 animate-spin" /> Reintentando…
                    </>
                  ) : (
                    <>Reintentar {pendientesCount} pendiente(s)</>
                  )}
                </Button>
              </div>
            )}
            <p className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <ListFilter className="size-3.5" /> {filtrados.length} de {terrenos.length} terrenos
              </span>
              <span>
                UF {ufActual.fallback ? "referencial" : "vigente"}: {UF_PRECIO.format(ufActual.valor)} CLP
                {ufActual.fallback && " — mindicador.cl no disponible"}
              </span>
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dirección</TableHead>
                  <TableHead>Comuna</TableHead>
                  <TableHead>Zona</TableHead>
                  <TableHead>Formato</TableHead>
                  <TableHead>Uso comercial</TableHead>
                  <TableHead>Precio</TableHead>
                  <TableHead>Superficie</TableHead>
                  <TableHead>$/m² aprox.</TableHead>
                  <TableHead>Oportunidad</TableHead>
                  <TableHead>Ubicación</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtrados.map((t) => {
                  const status = t.zona_status ?? "pendiente"
                  const usoComercial = t.uso_comercial_status ?? "pendiente"
                  const formato = formatoComercial(t.superficie_lote_m2)
                  const clpPorM2 = precioPorM2(t)
                  const zonaNombreCompleto = fixMojibakeArcGIS(t.zona_nombre)
                  return (
                    <TableRow key={t.id} className="cursor-pointer">
                      <TableCell>
                        <Link href={`/terrenos/${t.id}`} className="flex items-center gap-1.5 font-medium hover:underline">
                          <MapPin className="size-3.5 shrink-0 text-muted-foreground" />
                          {t.direccion}
                        </Link>
                        <span className="mt-0.5 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Tag className="size-2.5" /> {FUENTE_LABEL[t.fuente]}
                        </span>
                      </TableCell>
                      <TableCell>{t.comuna}</TableCell>
                      <TableCell className="text-sm">
                        {status === "encontrado" ? (
                          <span className="inline-flex items-center gap-1">
                            <span className="num" title={zonaNombreCompleto ?? undefined}>
                              {t.zona_codigo ?? zonaNombreCompleto ?? "—"}
                            </span>
                            {t.zona_precision === "centroide_comuna" && (
                              <span
                                title="Zona aproximada: la dirección no se pudo geocodificar con precisión, se usó el centroide de la comuna — puede no ser la zona real de este predio. Verifica contra el CIP oficial."
                                className="rounded-[3px] border border-amber-300 px-1 text-[9px] font-medium text-amber-700"
                              >
                                aprox.
                              </span>
                            )}
                          </span>
                        ) : (
                          <EstadoNormativo estado={ZONA_STATUS_VEREDICTO[status]} label={ZONA_STATUS_LABEL[status]} />
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formato ? FORMATO_COMERCIAL_LABEL[formato] : "—"}
                      </TableCell>
                      <TableCell>
                        <EstadoNormativo estado={USO_COMERCIAL_VEREDICTO[usoComercial]} label={USO_COMERCIAL_LABEL[usoComercial]} />
                      </TableCell>
                      <TableCell className="text-sm">
                        {t.precio_clp ? (
                          <>
                            <div>{CLP.format(t.precio_clp)}</div>
                            <div className="num text-[11px] text-muted-foreground">
                              {UF_PRECIO.format(t.precio_clp / ufActual.valor)} UF
                            </div>
                          </>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {t.superficie_lote_m2 ? `${t.superficie_lote_m2.toLocaleString("es-CL")} m²` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {clpPorM2 ? (
                          <>
                            <div>${CLP_COMPACTO.format(clpPorM2)}</div>
                            <div className="num text-[11px]">{UF_M2.format(clpPorM2 / ufActual.valor)} UF/m²</div>
                          </>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="flex flex-col gap-1">
                          {esOportunidadPrecio(t) && (
                            <span className="w-fit rounded-[3px] border border-[var(--state-ok)] px-1.5 py-0.5 text-[10px] font-medium" style={{ color: "var(--state-ok)" }}>
                              Bajo mercado
                            </span>
                          )}
                          {bajoDePrecio(t) && (
                            <span className="flex w-fit items-center gap-1 rounded-[3px] border border-[var(--state-ok)] px-1.5 py-0.5 text-[10px] font-medium" style={{ color: "var(--state-ok)" }}>
                              <TrendingDown className="size-3" /> Bajó de precio
                            </span>
                          )}
                          {!esOportunidadPrecio(t) && !bajoDePrecio(t) && "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {t.ubicacion_status === "resuelto" ? (
                          <div className="flex items-center gap-1.5">
                            {t.cerca_avenida_principal && (
                              <span
                                title="Cerca de avenida principal"
                                className="inline-flex size-5 items-center justify-center rounded-[3px] border border-line-med text-[9px] font-medium"
                              >
                                Av
                              </span>
                            )}
                            <span
                              title={`${t.anchors_comerciales_cercanos ?? 0} anchor(s) comercial(es) a 1km`}
                              className="num inline-flex items-center gap-1"
                            >
                              <Store className="size-3" /> {t.anchors_comerciales_cercanos ?? 0}
                            </span>
                          </div>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </>
        )}
      </div>
    </div>
  )
}
