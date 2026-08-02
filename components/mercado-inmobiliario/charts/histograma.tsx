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
  formatTramo?: (n: number) => string
  className?: string
}

function formatDefault(n: number): string {
  return n.toLocaleString("es-CL", { maximumFractionDigits: 0 })
}

export function Histograma({ titulo, valores, numTramos = 8, formatTramo = formatDefault, className }: HistogramaProps) {
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

  const tramos = Array.from({ length: numTramos }, (_, i) => {
    const desde = min + i * ancho
    const hasta = desde + ancho
    const cantidad = valores.filter((v) => (i === numTramos - 1 ? v >= desde && v <= hasta : v >= desde && v < hasta)).length
    return { rango: `${formatTramo(desde)}–${formatTramo(hasta)}`, cantidad }
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
