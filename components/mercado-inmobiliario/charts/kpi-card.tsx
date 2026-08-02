"use client"

import { Line, LineChart, ResponsiveContainer } from "recharts"
import { TrendingDown, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

// Pieza base del "Tema Consultora" (ver app/globals.css): reemplaza la
// tarjeta de KPI de solo texto que se repetía a mano en Reportes de Mercado
// y Mi Cartera por una con codificación visual real — cifra grande, flecha
// de tendencia + delta, sparkline opcional, y una línea de "so what" en vez
// de una etiqueta genérica. Sin sparkline si no hay historial real (nunca
// se inventa una serie de tiempo).

export interface KpiCardProps {
  label: string
  valor: string
  /** delta en % vs. periodo anterior — si viene, se muestra flecha+signo. Omitir si no hay dato real. */
  deltaPct?: number | null
  /** serie histórica real para el sparkline — mínimo 2 puntos. Omitir si no hay historial. */
  sparkline?: number[]
  /** frase "so what" — una línea, no una etiqueta genérica ("Sobre el 5.8% de la zona"). */
  contexto?: string
  verificado?: boolean
  className?: string
}

export function KpiCard({ label, valor, deltaPct, sparkline, contexto, verificado, className }: KpiCardProps) {
  return (
    <div className={cn("rounded-lg border border-line-fine bg-card p-4", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        {verificado !== undefined && (
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide",
              verificado ? "bg-blueprint-soft text-blueprint" : "bg-muted text-muted-foreground"
            )}
          >
            {verificado ? "Verificado" : "Estimado"}
          </span>
        )}
      </div>

      <div className="mt-1.5 flex items-end justify-between gap-2">
        <p className="num text-2xl font-semibold leading-none text-primary">{valor}</p>
        {deltaPct !== null && deltaPct !== undefined && (
          <span
            className="num flex items-center gap-0.5 text-xs font-medium"
            style={{ color: deltaPct >= 0 ? "var(--state-ok)" : "var(--state-error)" }}
          >
            {deltaPct >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
            {deltaPct >= 0 ? "+" : ""}
            {deltaPct.toFixed(0)}%
          </span>
        )}
      </div>

      {sparkline && sparkline.length >= 2 && (
        <div className="mt-2 h-8">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkline.map((valor, i) => ({ i, valor }))} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
              <Line type="monotone" dataKey="valor" stroke="var(--blueprint)" strokeWidth={1.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {contexto && <p className="mt-1.5 text-[11px] leading-snug text-muted-foreground">{contexto}</p>}
    </div>
  )
}
