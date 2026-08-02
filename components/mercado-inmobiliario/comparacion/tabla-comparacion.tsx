import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { REASON_LABEL, type OportunidadDetalle } from "@/lib/mercado-locales-server"

// Componente NUEVO — no reutiliza los *-tab.tsx de Fase 13 (Pattern 3 de
// 14-RESEARCH.md): esos están diseñados para una sola oportunidad en layout
// vertical de "ficha" (banners largos, explicaciones de párrafos), no para
// una celda compacta de tabla comparativa (columnas=oportunidades,
// filas=atributos, formato literal de COMPA-02).

interface TablaComparacionProps {
  // Ya validado por el caller (comparar/page.tsx): 2-5 items, mismo
  // tipoPropiedad, misma operacion — este componente es 100% presentacional.
  oportunidades: OportunidadDetalle[]
  rentabilidadPorComuna: Record<string, number | null>
}

function fmt(n: number): string {
  return n.toLocaleString("es-CL", { maximumFractionDigits: 2 })
}

/** Devuelve el id del item con el valor más bajo, ignorando nulls (null-goes-last, nunca ?? 0). */
function idConMenorValor(items: { id: string; valor: number | null }[]): string | null {
  const conValor = items.filter((i): i is { id: string; valor: number } => i.valor !== null)
  if (conValor.length === 0) return null
  return conValor.reduce((min, i) => (i.valor < min.valor ? i : min)).id
}

// Reutiliza el token de color ya establecido para este módulo (mismo que
// selector-comparacion.tsx / mi-cartera / dashboard) — nunca un color nuevo.
const CELL_MEJOR_VALOR = "bg-modulo-mercado-subtle"

export function TablaComparacion({ oportunidades, rentabilidadPorComuna }: TablaComparacionProps) {
  // Fila 1: Precio UF — un precio inválido cae a 0 fabricado dentro de
  // construirOportunidadDetalle(); ese 0 NUNCA debe "ganar" la comparación de
  // más barato, así que se excluye explícitamente (extensión de Pitfall 2).
  const preciosUf = oportunidades.map((o) => ({
    id: o.id,
    valor: o.precioValido && o.precioUfNormalizado > 0 ? o.precioUfNormalizado : null,
  }))
  const mejorPrecioUfId = idConMenorValor(preciosUf)

  // Fila 2: Precio UF/m² — ya es number | null, null-goes-last.
  const preciosUfM2 = oportunidades.map((o) => ({ id: o.id, valor: o.precioUfM2Normalizado }))
  const mejorPrecioUfM2Id = idConMenorValor(preciosUfM2)

  // Fila 3: % vs. mediana de cohorte — solo calculable con precio válido y
  // mediana de banda > 0.
  const desviaciones = oportunidades.map((o) => {
    const medianaUf = o.bandas?.medianaUf ?? null
    const valor =
      o.precioValido && o.precioUfNormalizado > 0 && medianaUf !== null && medianaUf > 0
        ? ((o.precioUfNormalizado - medianaUf) / medianaUf) * 100
        : null
    return { id: o.id, valor }
  })
  const mejorDesviacionId = idConMenorValor(desviaciones)

  return (
    <div className="overflow-hidden rounded-lg border border-line-fine bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40 shrink-0">Atributo</TableHead>
            {oportunidades.map((o) => (
              <TableHead key={o.id} className="min-w-[180px] normal-case">
                <div className="flex flex-col items-start gap-1">
                  <Link
                    href={`/mercado-inmobiliario/oportunidades/${o.id}`}
                    className="text-[13px] font-medium leading-snug text-primary hover:underline"
                  >
                    {o.titulo}
                  </Link>
                  {o.status === "dado_de_baja" && (
                    <Badge variant="outline" className="border-red-200 bg-red-50 text-[10px] text-red-700">
                      Dado de baja
                    </Badge>
                  )}
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          <TableRow>
            <TableCell className="font-medium text-muted-foreground">Precio UF</TableCell>
            {oportunidades.map((o) => (
              <TableCell key={o.id} className={`num ${o.id === mejorPrecioUfId ? CELL_MEJOR_VALOR : ""}`}>
                {o.precioValido && o.precioUfNormalizado > 0 ? `${fmt(o.precioUfNormalizado)} UF` : "—"}
              </TableCell>
            ))}
          </TableRow>

          <TableRow>
            <TableCell className="font-medium text-muted-foreground">Precio UF/m²</TableCell>
            {oportunidades.map((o) => (
              <TableCell key={o.id} className={`num ${o.id === mejorPrecioUfM2Id ? CELL_MEJOR_VALOR : ""}`}>
                {o.precioUfM2Normalizado !== null ? `${fmt(o.precioUfM2Normalizado)} UF/m²` : "—"}
              </TableCell>
            ))}
          </TableRow>

          <TableRow>
            <TableCell className="font-medium text-muted-foreground">% vs. mediana cohorte</TableCell>
            {oportunidades.map((o) => {
              const item = desviaciones.find((d) => d.id === o.id)!
              return (
                <TableCell key={o.id} className={`num ${o.id === mejorDesviacionId ? CELL_MEJOR_VALOR : ""}`}>
                  {item.valor !== null ? `${item.valor > 0 ? "+" : ""}${fmt(item.valor)}%` : "—"}
                </TableCell>
              )
            })}
          </TableRow>

          {/* Superficie — Open Question 1: ambiguo cuál "gana", nunca se resalta. */}
          <TableRow>
            <TableCell className="font-medium text-muted-foreground">Superficie (m²)</TableCell>
            {oportunidades.map((o) => (
              <TableCell key={o.id} className="num">
                {o.superficieM2 !== null ? fmt(o.superficieM2) : "—"}
              </TableCell>
            ))}
          </TableRow>

          {/* Días publicado — mismo motivo, sin resaltado. */}
          <TableRow>
            <TableCell className="font-medium text-muted-foreground">Días publicado</TableCell>
            {oportunidades.map((o) => {
              const dias = Math.floor((Date.now() - new Date(o.primeraVezVistoEl).getTime()) / 86400000)
              return (
                <TableCell key={o.id} className="num">
                  {dias}
                </TableCell>
              )
            })}
          </TableRow>

          {/* Señales — sin "mejor" cuantificable en un conjunto de badges. */}
          <TableRow>
            <TableCell className="font-medium text-muted-foreground">Señales</TableCell>
            {oportunidades.map((o) => (
              <TableCell key={o.id}>
                {o.reasonCodes.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {o.reasonCodes.map((c) => (
                      <span
                        key={c}
                        className="rounded-[3px] border border-modulo-mercado/20 bg-modulo-mercado-subtle px-1.5 py-0.5 text-[10px] text-modulo-mercado"
                      >
                        {REASON_LABEL[c] ?? c}
                      </span>
                    ))}
                  </div>
                ) : (
                  "—"
                )}
              </TableCell>
            ))}
          </TableRow>

          {/* Rentabilidad implícita de zona — estimado de la comuna, no del
              activo específico: dos oportunidades de la misma comuna
              comparten valor, así que resaltar "empate" no aporta y
              sugeriría erróneamente que el activo rinde más (Open Question 2). */}
          <TableRow>
            <TableCell className="font-medium text-muted-foreground">Rentabilidad implícita de zona</TableCell>
            {oportunidades.map((o) => {
              const valor = rentabilidadPorComuna[o.comuna] ?? null
              return (
                <TableCell key={o.id}>
                  {valor !== null ? (
                    <div className="flex items-center gap-1.5">
                      <span className="num">{valor.toFixed(1)}%</span>
                      <Badge className="border border-violet-200 bg-violet-100 text-violet-800">Estimado de zona</Badge>
                    </div>
                  ) : (
                    "—"
                  )}
                </TableCell>
              )
            })}
          </TableRow>
        </TableBody>
      </Table>
    </div>
  )
}
