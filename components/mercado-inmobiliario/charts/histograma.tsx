"use client"

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { cn } from "@/lib/utils"

// Histograma de distribución (ej. precios de oportunidades) — a diferencia
// de RankingBarChart (categorías con nombre, ordenadas por valor), esto
// agrupa valores continuos en tramos iguales. El componente calcula los
// tramos, la página solo entrega los valores crudos — nunca se inventa una
// distribución, si hay muy pocos puntos simplemente se ven pocas barras.

interface HistogramaProps {
  titulo?: string
  valores: number[]
  numTramos?: number
  className?: string
}

// Sin prop de formateo custom a propósito: un `formatTramo?: (n) => string`
// es una función que un Server Component no puede pasar a este Client
// Component (rompe la frontera de serialización de RSC — bug ya visto dos
// veces en este proyecto, en Cadenas y Oportunidades). Nada lo necesita hoy;
// si aparece un caso real, un discriminador serializable ("uf" | "m2") es
// la forma segura de extenderlo, no una función.
function formatDefault(n: number): string {
  return n.toLocaleString("es-CL", { maximumFractionDigits: 0 })
}

// Extraído como función pura (sin JSX) para poder testearlo sin infra de
// render de componentes, que este proyecto no tiene configurada. Antes se
// recalculaba desde/hasta por tramo (min + i*ancho) y se filtraba cada valor
// contra ese rango — la acumulación de error de punto flotante hacía que el
// ÚLTIMO tramo a veces terminara justo bajo `max` real, y ese valor (el más
// caro, casi siempre el más interesante) desaparecía del gráfico sin avisar.
// Indexar directamente por posición del bin es exacto por construcción:
// cada valor cae en un solo índice, sin comparación de límites de por medio.
export function binarValores(valores: number[], numTramos: number): number[] {
  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const ancho = (max - min) / numTramos || 1

  const conteos = new Array(numTramos).fill(0) as number[]
  for (const v of valores) {
    const idx = Math.min(numTramos - 1, Math.max(0, Math.floor((v - min) / ancho)))
    conteos[idx]++
  }
  return conteos
}

export function Histograma({ titulo, valores, numTramos = 8, className }: HistogramaProps) {
  if (valores.length < 2) {
    return (
      <div className={cn("rounded-lg border border-line-fine bg-card p-4", className)}>
        {titulo && <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">{titulo}</p>}
        <p className="py-4 text-center text-[11px] text-muted-foreground/60">Sin datos suficientes para una distribución</p>
      </div>
    )
  }

  const min = Math.min(...valores)
  const max = Math.max(...valores)
  const ancho = (max - min) / numTramos || 1
  const conteos = binarValores(valores, numTramos)

  const tramos = conteos.map((cantidad, i) => {
    const desde = min + i * ancho
    const hasta = desde + ancho
    return { rango: `${formatDefault(desde)}–${formatDefault(hasta)}`, cantidad }
  })

  return (
    <div className={cn("rounded-lg border border-line-fine bg-card p-4", className)}>
      {titulo && <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">{titulo}</p>}
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={tramos} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--line-fine)" />
          <XAxis dataKey="rango" tick={{ fontSize: 9 }} interval={0} angle={-30} textAnchor="end" height={40} stroke="var(--line-fine)" />
          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} stroke="var(--line-fine)" />
          <Tooltip formatter={(v) => (typeof v === "number" ? `${v} oportunidad${v === 1 ? "" : "es"}` : String(v ?? ""))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Bar dataKey="cantidad" fill="var(--blueprint)" radius={[3, 3, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
