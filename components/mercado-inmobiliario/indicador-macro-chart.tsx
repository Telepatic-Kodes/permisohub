"use client"

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"

// Client component — Recharts necesita DOM/medición en navegador, así que
// esto vive separado de app/(dashboard)/mercado-inmobiliario/macro/page.tsx
// (server component: sigue haciendo el fetch a Supabase en el servidor,
// solo pasa los datos ya resueltos como props serializables a este chart).

export interface PuntoMacro {
  fecha: string // ISO date, ya en orden cronológico ascendente
  valor: number | null
}

export type FormatoIndicadorMacro = "clp" | "porcentaje"

interface IndicadorMacroChartProps {
  titulo: string
  data: PuntoMacro[]
  formato: FormatoIndicadorMacro
  color?: string
}

function formatFechaCorta(iso: string): string {
  return new Intl.DateTimeFormat("es-CL", { day: "numeric", month: "short" }).format(new Date(iso))
}

// Recibe `formato` (string serializable) en vez de una función formateadora
// — un Server Component no puede pasar funciones como prop a un Client
// Component (React Server Components no las serializa a través del límite
// servidor→cliente; visto en vivo: "Functions cannot be passed directly to
// Client Components" al cargar /mercado-inmobiliario/macro).
function formatearValor(n: number, formato: FormatoIndicadorMacro): string {
  if (formato === "porcentaje") return `${n.toFixed(2)}%`
  return `$${n.toLocaleString("es-CL", { maximumFractionDigits: 0 })}`
}

export function IndicadorMacroChart({ titulo, data, formato, color = "var(--blueprint)" }: IndicadorMacroChartProps) {
  const puntos = data.filter((d) => d.valor !== null) as { fecha: string; valor: number }[]

  return (
    <div className="rounded-lg border border-line-fine bg-card p-3">
      <div className="mb-1.5 flex items-baseline justify-between">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{titulo}</p>
        {puntos.length > 0 && (
          <span className="num text-sm font-semibold text-primary">{formatearValor(puntos[puntos.length - 1].valor, formato)}</span>
        )}
      </div>
      {puntos.length < 2 ? (
        <p className="py-6 text-center text-[11px] text-muted-foreground/60">Sin suficiente historial todavía</p>
      ) : (
        <ResponsiveContainer width="100%" height={100}>
          <LineChart data={puntos} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <XAxis dataKey="fecha" tickFormatter={formatFechaCorta} tick={{ fontSize: 9 }} interval="preserveStartEnd" stroke="var(--line-fine)" />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip
              labelFormatter={(v) => (typeof v === "string" ? formatFechaCorta(v) : String(v ?? ""))}
              formatter={(v) => (typeof v === "number" ? formatearValor(v, formato) : String(v ?? ""))}
              contentStyle={{ fontSize: 12, borderRadius: 4 }}
            />
            <Line type="monotone" dataKey="valor" stroke={color} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
