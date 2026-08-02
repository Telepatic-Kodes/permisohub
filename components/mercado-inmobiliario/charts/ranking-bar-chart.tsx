"use client"

import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { cn } from "@/lib/utils"

// Barra horizontal genérica para rankings (rubros por demanda, comparables,
// sucursales por cadena) — generaliza el BandaPrecioChart que antes vivía
// solo dentro de pricing/page.tsx. Ordena por valor descendente siempre:
// un ranking sin orden no es un ranking.

export interface ItemRanking {
  label: string
  valor: number
  /** color de barra opcional por item (ej. para distinguir alta/media/baja demanda) — si se omite, usa el acento único. */
  color?: string
}

interface RankingBarChartProps {
  titulo?: string
  items: ItemRanking[]
  formatValor?: (n: number) => string
  height?: number
  className?: string
}

function formatDefault(n: number): string {
  return n.toLocaleString("es-CL", { maximumFractionDigits: 2 })
}

export function RankingBarChart({ titulo, items, formatValor = formatDefault, height, className }: RankingBarChartProps) {
  const ordenados = [...items].sort((a, b) => b.valor - a.valor)
  const alturaCalculada = height ?? Math.max(120, ordenados.length * 32)

  return (
    <div className={cn("rounded-lg border border-line-fine bg-card p-4", className)}>
      {titulo && <p className="mb-3 text-[10px] uppercase tracking-wide text-muted-foreground">{titulo}</p>}
      <ResponsiveContainer width="100%" height={alturaCalculada}>
        <BarChart data={ordenados} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--line-fine)" />
          <XAxis type="number" tick={{ fontSize: 10 }} stroke="var(--line-fine)" tickFormatter={formatValor} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 11 }} width={110} stroke="var(--line-fine)" />
          <Tooltip formatter={(v) => (typeof v === "number" ? formatValor(v) : String(v ?? ""))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Bar dataKey="valor" radius={[0, 3, 3, 0]}>
            {ordenados.map((item, i) => (
              <Cell key={i} fill={item.color ?? "var(--blueprint)"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}
