import { notFound } from "next/navigation"
import { obtenerOportunidadPorId, obtenerComparablesOportunidad, REASON_LABEL_DETALLE } from "@/lib/mercado-locales-server"
import { TIPO_PROPIEDAD_LABEL } from "@/lib/scrapers/mercado-locales-common"
import { formatTimestampCorto } from "@/lib/formato-fecha"
import { PrintButton } from "@/components/mercado-inmobiliario/informe/print-button"
import { PortadaInforme } from "@/components/mercado-inmobiliario/informe/portada-informe"
import { MetodologiaInforme } from "@/components/mercado-inmobiliario/informe/metodologia-informe"

export const dynamic = "force-dynamic"

function fmt(n: number): string {
  return n.toLocaleString("es-CL", { maximumFractionDigits: 2 })
}

interface Props {
  params: Promise<{ id: string }>
}

export default async function InformeOportunidadPage({ params }: Props) {
  const { id } = await params
  const oportunidad = await obtenerOportunidadPorId(id)
  if (!oportunidad) notFound()

  const comparables = await obtenerComparablesOportunidad({
    comuna: oportunidad.comuna,
    operacion: oportunidad.operacion,
    tipoPropiedad: oportunidad.tipoPropiedad,
    excludeId: oportunidad.id,
    precioUfM2Objetivo: oportunidad.precioUfM2Normalizado,
    precioUfObjetivo: oportunidad.precioUfNormalizado,
  })

  const tipoPropiedadLabel = TIPO_PROPIEDAD_LABEL[oportunidad.tipoPropiedad].singular
  const subtitulo = `${oportunidad.comuna} · ${tipoPropiedadLabel} · ${oportunidad.operacion === "venta" ? "Venta" : "Arriendo"}`

  return (
    <>
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white; }
          @page { size: A4 portrait; margin: 15mm 12mm; }
        }
      `}</style>

      <div className="mx-auto max-w-[210mm] bg-white p-8 text-gray-900 print:p-0">
        <div className="print:hidden mb-6 flex items-center justify-between">
          <span className="text-sm font-semibold text-[#1A3328]">Informe de oportunidad</span>
          <PrintButton />
        </div>

        <PortadaInforme titulo={oportunidad.titulo} subtitulo={subtitulo} generadoEl={new Date()} />

        {oportunidad.status === "dado_de_baja" && (
          <div className="mt-6 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <span className="mt-0.5 text-red-500">⚠</span>
            <div className="text-sm">
              <span className="font-semibold text-red-800">Aviso dado de baja</span>
              <span className="ml-1 text-red-700">
                Este aviso ya no está activo en el portal de origen (dado de baja el{" "}
                {formatTimestampCorto(oportunidad.dadoDeBajaEl)}) — los datos que ves son los últimos capturados
                antes de darse de baja.
              </span>
            </div>
          </div>
        )}

        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Precio</h2>
          <p className="mt-2 text-2xl font-semibold text-primary num">
            {oportunidad.precioValido ? `${fmt(oportunidad.precioUfNormalizado)} UF` : "Precio no disponible en moneda reconocida"}
          </p>
          {oportunidad.precioUfM2Normalizado !== null && (
            <p className="num text-sm text-muted-foreground">{fmt(oportunidad.precioUfM2Normalizado)} UF/m²</p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Última verificación de este dato: {formatTimestampCorto(oportunidad.ultimaVezVistoEl)}
          </p>
        </section>

        <section className="mt-6">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            Posicionamiento vs. cohorte
          </h2>
          {oportunidad.bandas ? (
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b border-line-fine text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4">Percentil</th>
                  <th className="pb-2 text-right">UF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-fine">
                <tr>
                  <td className="py-2 pr-4">P25</td>
                  <td className="py-2 text-right num">{oportunidad.bandas.p25Uf !== null ? fmt(oportunidad.bandas.p25Uf) : "—"}</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">Mediana</td>
                  <td className="py-2 text-right num">
                    {oportunidad.bandas.medianaUf !== null ? fmt(oportunidad.bandas.medianaUf) : "—"}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 pr-4">P75</td>
                  <td className="py-2 text-right num">{oportunidad.bandas.p75Uf !== null ? fmt(oportunidad.bandas.p75Uf) : "—"}</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
              Sin banda de mercado disponible para esta comuna/tipo/operación.
            </p>
          )}
        </section>

        {oportunidad.reasonCodes.length > 0 && (
          <section className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Señales</h2>
            <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-foreground">
              {oportunidad.reasonCodes.map((code) => (
                <li key={code}>{REASON_LABEL_DETALLE[code] ?? code}</li>
              ))}
            </ul>
          </section>
        )}

        {comparables.length > 0 && (
          <section className="mt-6">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Comparables</h2>
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b border-line-fine text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <th className="pb-2 pr-4">Título</th>
                  <th className="pb-2 pr-4 text-right">UF</th>
                  <th className="pb-2 text-right">UF/m²</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-fine">
                {comparables.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2 pr-4">{c.titulo}</td>
                    <td className="py-2 pr-4 text-right num">{fmt(c.precioUfNormalizado)}</td>
                    <td className="py-2 text-right num">{c.precioUfM2Normalizado !== null ? fmt(c.precioUfM2Normalizado) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        <MetodologiaInforme
          fuentes={[
            {
              comuna: oportunidad.comuna,
              operacion: oportunidad.operacion,
              tipoPropiedad: oportunidad.tipoPropiedad,
              bandas: oportunidad.bandas,
            },
          ]}
        />
      </div>
    </>
  )
}
