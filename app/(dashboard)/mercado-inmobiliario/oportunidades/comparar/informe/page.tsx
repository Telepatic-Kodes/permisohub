import Link from "next/link"
import { TablaComparacion } from "@/components/mercado-inmobiliario/comparacion/tabla-comparacion"
import { PortadaInforme } from "@/components/mercado-inmobiliario/informe/portada-informe"
import { MetodologiaInforme, type FuenteMetodologia } from "@/components/mercado-inmobiliario/informe/metodologia-informe"
import { PrintButton } from "@/components/mercado-inmobiliario/informe/print-button"
import { obtenerOportunidadesPorIds, obtenerBandasMercadoLocales } from "@/lib/mercado-locales-server"
import { calcularCapRate } from "@/lib/calculadora-inversion"
import { formatTimestampCorto } from "@/lib/formato-fecha"
import { TIPO_PROPIEDAD_LABEL } from "@/lib/scrapers/mercado-locales-common"

export const dynamic = "force-dynamic"

// Duplicado deliberado de comparar/page.tsx (Pitfall 5) — esta ruta es
// navegable de forma independiente por URL, así que se defiende sola sin
// asumir que /comparar/page.tsx ya validó la selección. No se importa desde
// ahí: un módulo page.tsx de App Router solo debería exportar la config de
// ruta reconocida + el componente default.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Props {
  searchParams: Promise<{ ids?: string }>
}

function ErrorInforme({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-10 text-center">
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      <p className="text-sm text-muted-foreground">{detalle}</p>
      <Link href="/mercado-inmobiliario/oportunidades/comparar" className="text-sm text-primary hover:underline">
        Volver a la comparación
      </Link>
    </div>
  )
}

export default async function InformeComparacionPage({ searchParams }: Props) {
  const { ids: idsParam } = await searchParams

  // 1. Parseo + deduplicación + validación de formato UUID.
  const idsSolicitados = Array.from(
    new Set(
      (idsParam ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => UUID_REGEX.test(s)),
    ),
  )

  // 2. Rango 2-5 (Pitfall 4).
  if (idsSolicitados.length < 2 || idsSolicitados.length > 5) {
    return (
      <ErrorInforme
        titulo="Selección inválida"
        detalle="Selecciona entre 2 y 5 oportunidades desde la lista para generar un informe."
      />
    )
  }

  // 3. Fetch en lote.
  const oportunidades = await obtenerOportunidadesPorIds(idsSolicitados)

  // 4. Ids faltantes — algunos ids solicitados pueden ya no existir.
  const faltantes = idsSolicitados.length - oportunidades.length
  if (oportunidades.length < 2) {
    return (
      <ErrorInforme
        titulo="Selección inválida"
        detalle="No se encontraron suficientes oportunidades válidas — puede que algunas ya no existan."
      />
    )
  }

  // 5. Homogeneidad — LA DEFENSA REAL de Pitfall 5, re-validada
  // independientemente de comparar/page.tsx.
  const tipos = new Set(oportunidades.map((o) => o.tipoPropiedad))
  const operaciones = new Set(oportunidades.map((o) => o.operacion))
  if (tipos.size > 1 || operaciones.size > 1) {
    return (
      <ErrorInforme
        titulo="Comparación inválida"
        detalle="Esta comparación mezcla tipos de propiedad u operaciones distintas."
      />
    )
  }

  const tipoPropiedad = oportunidades[0].tipoPropiedad
  const operacion = oportunidades[0].operacion
  const comunasDistintas = Array.from(new Set(oportunidades.map((o) => o.comuna)))

  // 6. Rentabilidad implícita de zona en lote — 1 vez por comuna distinta,
  // mismo cálculo que comparar/page.tsx (cap rate arriendo/venta).
  const entradasRentabilidad = await Promise.all(
    comunasDistintas.map(async (comuna) => {
      const [bandasArriendo, bandasVenta] = await Promise.all([
        obtenerBandasMercadoLocales(comuna, "arriendo", tipoPropiedad),
        obtenerBandasMercadoLocales(comuna, "venta", tipoPropiedad),
      ])
      const arriendoUfM2 = bandasArriendo?.medianaUfM2 ?? null
      const ventaUfM2 = bandasVenta?.medianaUfM2 ?? null
      const capNeto =
        arriendoUfM2 !== null && ventaUfM2 !== null && ventaUfM2 > 0
          ? calcularCapRate({ rentaMensual: arriendoUfM2, precioVenta: ventaUfM2 }).capNeto
          : null
      return [comuna, capNeto] as const
    }),
  )
  const rentabilidadPorComuna: Record<string, number | null> = Object.fromEntries(entradasRentabilidad)

  // 7. Fuentes de metodología — un tercer set de lookups distinto al de
  // rentabilidad: solo la banda que matchea la operación comparada, una
  // entrada por comuna distinta.
  const fuentesMetodologia: FuenteMetodologia[] = await Promise.all(
    comunasDistintas.map(async (comuna) => ({
      comuna,
      operacion,
      tipoPropiedad,
      bandas: await obtenerBandasMercadoLocales(comuna, operacion, tipoPropiedad),
    })),
  )

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 12mm; }
        }
      `}</style>
      <div className="mx-auto max-w-[297mm] space-y-6 p-8">
        <div className="flex justify-end print:hidden">
          <PrintButton />
        </div>

        <PortadaInforme
          titulo={`Comparación de ${oportunidades.length} oportunidades`}
          subtitulo={`${comunasDistintas.join(", ")} · ${TIPO_PROPIEDAD_LABEL[tipoPropiedad].singular} · ${
            operacion === "venta" ? "Venta" : "Arriendo"
          }`}
          generadoEl={new Date()}
        />

        {faltantes > 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {faltantes} de {idsSolicitados.length} oportunidades seleccionadas ya no existen — se muestran las{" "}
            {oportunidades.length} restantes.
          </div>
        )}

        <TablaComparacion oportunidades={oportunidades} rentabilidadPorComuna={rentabilidadPorComuna} />

        <section className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          {oportunidades.map((o) => (
            <span key={o.id}>
              {o.titulo}: verificado {formatTimestampCorto(o.ultimaVezVistoEl)}
            </span>
          ))}
        </section>

        <MetodologiaInforme fuentes={fuentesMetodologia} />
      </div>
    </>
  )
}
