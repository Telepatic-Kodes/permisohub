import Link from "next/link"
import { Printer } from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { TablaComparacion } from "@/components/mercado-inmobiliario/comparacion/tabla-comparacion"
import { obtenerOportunidadesPorIds, obtenerBandasMercadoLocales } from "@/lib/mercado-locales-server"
import { calcularCapRate } from "@/lib/calculadora-inversion"

export const dynamic = "force-dynamic"

// Protege el .in('id', ids) de Supabase de basura en el querystring (Don't
// Hand-Roll de 14-RESEARCH.md línea 158) — cualquier token que no matchee se
// descarta silenciosamente en el paso de parseo.
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface Props {
  searchParams: Promise<{ ids?: string }>
}

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="⚖️"
        title="Comparación de oportunidades"
        subtitle="Compara hasta 5 oportunidades del mismo tipo de propiedad y operación, lado a lado"
        breadcrumbs={[
          { label: "Oportunidades", href: "/mercado-inmobiliario/oportunidades" },
          { label: "Comparación" },
        ]}
      />
      <div className="flex-1 p-8">
        <div className="mx-auto max-w-6xl space-y-6">{children}</div>
      </div>
    </div>
  )
}

function MensajeError({ titulo, detalle }: { titulo: string; detalle: string }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-lg border border-line-fine bg-card p-10 text-center">
      <p className="text-sm font-medium text-foreground">{titulo}</p>
      <p className="text-sm text-muted-foreground">{detalle}</p>
      <Link href="/mercado-inmobiliario/oportunidades" className="text-sm text-primary hover:underline">
        Volver a la lista
      </Link>
    </div>
  )
}

export default async function CompararPage({ searchParams }: Props) {
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

  // 2. Validación de rango 2-5 (Pitfall 4) — nunca se sigue con un array
  // vacío o de 1 elemento hacia obtenerOportunidadesPorIds.
  if (idsSolicitados.length < 2 || idsSolicitados.length > 5) {
    return (
      <Layout>
        <MensajeError
          titulo="Selección inválida"
          detalle="Selecciona entre 2 y 5 oportunidades desde la lista para compararlas."
        />
      </Layout>
    )
  }

  // 3. Fetch en lote (Plan 14-01).
  const oportunidades = await obtenerOportunidadesPorIds(idsSolicitados)

  // 4. Ids faltantes (Open Question 3) — si tras excluir los que no existen
  // queda menos de 2, mismo mensaje de rango pero con contexto de causa.
  const faltantes = idsSolicitados.length - oportunidades.length
  if (oportunidades.length < 2) {
    return (
      <Layout>
        <MensajeError
          titulo="Selección inválida"
          detalle="No se encontraron suficientes oportunidades válidas — puede que algunas ya no existan. Selecciona entre 2 y 5 desde la lista."
        />
      </Layout>
    )
  }

  // 5. Validación de homogeneidad — LA DEFENSA REAL de COMPA-03 (Pattern 1 de
  // 14-RESEARCH.md). Se ejecuta SIEMPRE, sin importar cómo se llegó acá: el
  // checkbox de SelectorComparacion (Plan 14-02) solo previene el error
  // accidental dentro de una lista ya homogénea por construcción, nunca
  // bloquea una URL armada a mano.
  const tipos = new Set(oportunidades.map((o) => o.tipoPropiedad))
  const operaciones = new Set(oportunidades.map((o) => o.operacion))
  if (tipos.size > 1 || operaciones.size > 1) {
    return (
      <Layout>
        <MensajeError
          titulo="Comparación inválida"
          detalle="Esta comparación mezcla tipos de propiedad u operaciones distintas — vuelve a seleccionar desde la lista."
        />
      </Layout>
    )
  }

  // 6. Rentabilidad implícita de zona en lote — 1 vez por comuna distinta,
  // no por oportunidad (ya homogéneo en tipoPropiedad tras el paso 5).
  const tipoPropiedad = oportunidades[0].tipoPropiedad
  const comunasDistintas = Array.from(new Set(oportunidades.map((o) => o.comuna)))
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

  // 7. Render final.
  return (
    <Layout>
      {faltantes > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {faltantes} de {idsSolicitados.length} oportunidades seleccionadas ya no existen — se muestran las {oportunidades.length}{" "}
          restantes.
        </div>
      )}
      <div className="flex justify-end">
        <Link
          href={`/mercado-inmobiliario/oportunidades/comparar/informe?ids=${oportunidades.map((o) => o.id).join(",")}`}
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <Printer className="size-3.5" /> Exportar informe
        </Link>
      </div>
      <TablaComparacion oportunidades={oportunidades} rentabilidadPorComuna={rentabilidadPorComuna} />
    </Layout>
  )
}
