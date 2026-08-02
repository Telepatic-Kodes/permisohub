"use client"

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import { cn } from "@/lib/utils"

// Donut pequeño para splits categóricos (mezcla bajo/a/sobre-mercado de un
// portafolio, demanda por rubro) — nunca más de 5-6 categorías, si hay más
// un donut deja de comunicar y hay que usar RankingBarChart en su lugar.

export interface SegmentoDistribucion {
  label: string
  valor: number
  color: string
}

interface DistribucionDonutProps {
  titulo?: string
  segmentos: SegmentoDistribucion[]
  size?: number
  className?: string
}

export function DistribucionDonut({ titulo, segmentos, size = 120, className }: DistribucionDonutProps) {
  const total = segmentos.reduce((acc, s) => acc + s.valor, 0)
  const conDato = segmentos.filter((s) => s.valor > 0)

  return (
    <div className={cn("rounded-lg border border-line-fine bg-card p-4", className)}>
      {titulo && <p className="mb-2 text-[10px] uppercase tracking-wide text-muted-foreground">{titulo}</p>}
      {total === 0 ? (
        <p className="py-4 text-center text-[11px] text-muted-foreground/60">Sin datos suficientes</p>
      ) : (
        <div className="flex items-center gap-2.5">
          <div style={{ width: size, height: size }} className="shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={conDato} dataKey="valor" nameKey="label" innerRadius="62%" outerRadius="100%" paddingAngle={2} strokeWidth={0}>
                  {conDato.map((s, i) => (
                    <Cell key={i} fill={s.color} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => (typeof v === "number" ? v.toLocaleString("es-CL") : String(v ?? ""))} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="min-w-0 space-y-1">
            {segmentos.map((s) => (
              <li key={s.label} className="flex items-center gap-1 text-[11px]">
                <span className="size-1.5 shrink-0 rounded-full" style={{ background: s.color }} />
                <span className="truncate text-muted-foreground">{s.label}</span>
                <span className="num shrink-0 font-medium text-foreground">{s.valor}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
