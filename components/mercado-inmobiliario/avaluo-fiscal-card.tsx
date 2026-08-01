import { Landmark } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatDestinoSII } from "@/lib/sii-lookup"
import type { SIILookupServerData } from "@/lib/sii-lookup-server"

// Tarjeta deliberadamente distinta de BandaPrecioChart (pricing/page.tsx):
// sin gráfico, sin P25/mediana/P75 — el avalúo fiscal SII es un valor
// tasado para contribuciones, no un precio de mercado, y no debe poder
// confundirse visualmente con una banda real (Fase 1). Compartida entre
// tasación y due-diligence-propiedad para que el labeling no diverja.
export function AvaluoFiscalCard({ data }: { data: SIILookupServerData }) {
  const CLP = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 })

  return (
    <div className="rounded-[4px] border border-line-fine bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Landmark className="size-4 text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Avalúo fiscal SII</p>
        </div>
        <Badge variant="outline">No es dato de mercado</Badge>
      </div>

      <p className="mt-1.5 text-xs text-muted-foreground">
        Valor tasado por el SII para efectos de contribuciones — no es un precio de mercado ni una transacción cerrada.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
        <span className="text-muted-foreground">Rol SII</span>
        <span className="num text-right font-mono font-medium">{data.rol}</span>

        <span className="text-muted-foreground">Avalúo fiscal</span>
        <span className="num text-right font-medium text-primary">
          {data.avaluo_fiscal_clp !== null ? CLP.format(data.avaluo_fiscal_clp) : "no disponible"}
          {data.avaluo_fiscal_uf !== null && (
            <span className="ml-1 text-muted-foreground">
              ({data.avaluo_fiscal_uf.toLocaleString("es-CL")} UF)
            </span>
          )}
        </span>

        {data.destino && (
          <>
            <span className="text-muted-foreground">Destino</span>
            <span className="text-right capitalize">{formatDestinoSII(data.destino).toLowerCase()}</span>
          </>
        )}

        {data.superficie_terreno_m2 !== null && (
          <>
            <span className="text-muted-foreground">Sup. terreno (SII)</span>
            <span className="num text-right">{data.superficie_terreno_m2.toLocaleString("es-CL")} m²</span>
          </>
        )}

        {data.superficie_construida_m2 !== null && (
          <>
            <span className="text-muted-foreground">Sup. construida (SII)</span>
            <span className="num text-right">{data.superficie_construida_m2.toLocaleString("es-CL")} m²</span>
          </>
        )}

        {data.direccion_normalizada && (
          <>
            <span className="text-muted-foreground">Dirección SII</span>
            <span className="text-right leading-snug">{data.direccion_normalizada}</span>
          </>
        )}
      </div>
    </div>
  )
}
