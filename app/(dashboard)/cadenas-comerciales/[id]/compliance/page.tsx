import { PrintButton } from './print-button'

type EstadoPermiso = 'vigente' | 'vencido' | 'sin_permiso' | 'en_tramite'

type LocalCompliance = {
  id: string
  numero: string
  nombre_negocio: string
  centro_nombre: string
  municipio: string
  uso: string
  area_m2: number
  estado_permiso: EstadoPermiso
  numero_permiso: string | null
  fecha_vencimiento: string | null
  especialidades_obtenidas: number
  especialidades_total: number
  observaciones_abiertas: number
  dom_digital_url: string | null
}

type CentroCompliance = {
  id: string
  nombre: string
  municipio: string
  total_locales: number
  con_permiso: number
  sin_permiso: number
  cobertura_pct: number
  locales: LocalCompliance[]
}

type ComplianceData = {
  cadena: {
    id: string
    nombre: string
    rut: string
    contacto_nombre: string
  }
  fecha_reporte: string
  generado_por: string
  resumen: {
    total_locales: number
    con_permiso_vigente: number
    sin_permiso: number
    cobertura_global_pct: number
    locales_en_riesgo: number
    observaciones_abiertas_total: number
  }
  centros: CentroCompliance[]
}

const ESTADO_BADGE: Record<EstadoPermiso, { label: string; className: string }> = {
  vigente:    { label: 'Vigente',     className: 'bg-green-100 text-green-800 ring-green-200' },
  en_tramite: { label: 'En trámite',  className: 'bg-blue-100 text-blue-800 ring-blue-200' },
  vencido:    { label: 'Vencido',     className: 'bg-red-100 text-red-800 ring-red-200' },
  sin_permiso:{ label: 'Sin permiso', className: 'bg-gray-100 text-gray-700 ring-gray-200' },
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-CL', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

function coberturaColor(pct: number) {
  if (pct >= 80) return 'text-green-600'
  if (pct >= 60) return 'text-amber-600'
  return 'text-red-600'
}

export default async function CompliancePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:7891'

  let compliance: ComplianceData | null = null

  try {
    const res = await fetch(`${baseUrl}/api/cadenas/${id}/compliance-export`, {
      cache: 'no-store',
    })
    if (!res.ok) throw new Error('fetch-failed')
    const json = await res.json() as { ok: boolean; data: ComplianceData }
    compliance = json.data
  } catch {
    compliance = null
  }

  if (!compliance) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm text-muted-foreground">Error al cargar datos</p>
      </div>
    )
  }

  const { cadena, resumen, centros, fecha_reporte, generado_por } = compliance
  const fechaFormateada = formatDate(fecha_reporte)

  return (
    <>
      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          body { background: white; }
          @page { size: A4 portrait; margin: 15mm 12mm; }
        }
      `}</style>

      <div className="mx-auto max-w-[210mm] bg-white text-gray-900">

        {/* ── Screen toolbar ── */}
        <div className="print:hidden sticky top-0 z-10 -mx-6 -mt-6 mb-6 flex items-center justify-between border-b bg-white/90 px-6 py-3 backdrop-blur">
          <span className="text-sm font-semibold text-[#1A3328]">
            Reporte de Compliance — {cadena.nombre}
          </span>
          <PrintButton />
        </div>

        {/* ── Report header ── */}
        <header className="rounded-t-xl bg-[#1A3328] px-10 py-8 text-white">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold tracking-widest text-white/60 uppercase">
                PermisoHub
              </p>
              <p className="mt-1 text-lg font-medium text-white/80">
                Reporte de Compliance
              </p>
            </div>
            <div className="text-right text-xs text-white/50">
              <p>Confidencial</p>
              <p className="mt-0.5">{fechaFormateada}</p>
            </div>
          </div>

          <div className="mt-6">
            <h1 className="text-4xl font-bold tracking-tight">{cadena.nombre}</h1>
            <p className="mt-1 text-lg text-white/70">RUT {cadena.rut}</p>
            <p className="mt-0.5 text-sm text-white/50">{cadena.contacto_nombre}</p>
          </div>
        </header>

        {/* ── Executive summary ── */}
        <section className="border-x border-b border-gray-200 px-10 py-8">
          <h2 className="mb-5 text-base font-semibold uppercase tracking-widest text-[#1A3328]">
            Resumen ejecutivo
          </h2>
          <div className="grid grid-cols-3 gap-4">
            <SummaryCard
              label="Total Locales"
              value={String(resumen.total_locales)}
              valueClass="text-[#1A3328]"
            />
            <SummaryCard
              label="Cobertura Global"
              value={`${resumen.cobertura_global_pct}%`}
              valueClass={coberturaColor(resumen.cobertura_global_pct)}
            />
            <SummaryCard
              label="Locales en Riesgo"
              value={String(resumen.locales_en_riesgo)}
              valueClass={resumen.locales_en_riesgo > 0 ? 'text-red-600' : 'text-green-600'}
            />
            <SummaryCard
              label="Observaciones Abiertas"
              value={String(resumen.observaciones_abiertas_total)}
              valueClass={resumen.observaciones_abiertas_total > 0 ? 'text-amber-600' : 'text-green-600'}
            />
            <SummaryCard
              label="Con Permiso Vigente"
              value={String(resumen.con_permiso_vigente)}
              valueClass="text-green-600"
            />
            <SummaryCard
              label="Sin Permiso"
              value={String(resumen.sin_permiso)}
              valueClass={resumen.sin_permiso > 0 ? 'text-red-600' : 'text-green-600'}
            />
          </div>
        </section>

        {/* ── Per-centro sections ── */}
        {centros.map(centro => (
          <section
            key={centro.id}
            className="border-x border-b border-gray-200 px-10 py-8"
          >
            <div className="mb-4 flex items-baseline justify-between">
              <div>
                <h3 className="text-lg font-bold text-[#1A3328]">{centro.nombre}</h3>
                <p className="text-sm text-gray-500">{centro.municipio}</p>
              </div>
              <span className={`text-2xl font-bold ${coberturaColor(centro.cobertura_pct)}`}>
                {centro.cobertura_pct}% cobertura
              </span>
            </div>

            {centro.locales.length === 0 ? (
              <p className="text-sm text-gray-400">Sin locales registrados.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="pb-2 pr-4">Número</th>
                      <th className="pb-2 pr-4">Negocio</th>
                      <th className="pb-2 pr-4">Uso</th>
                      <th className="pb-2 pr-4 text-right">m²</th>
                      <th className="pb-2 pr-4">Estado Permiso</th>
                      <th className="pb-2 pr-4 text-center">Especialidades</th>
                      <th className="pb-2 text-center">Obs.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {centro.locales.map(local => {
                      const badge = ESTADO_BADGE[local.estado_permiso]
                      return (
                        <tr key={local.id} className="text-gray-700">
                          <td className="py-2.5 pr-4 font-mono text-xs text-gray-500">
                            {local.numero}
                          </td>
                          <td className="py-2.5 pr-4 font-medium">{local.nombre_negocio}</td>
                          <td className="py-2.5 pr-4 capitalize text-gray-500">{local.uso}</td>
                          <td className="py-2.5 pr-4 text-right text-gray-500">
                            {local.area_m2.toLocaleString('es-CL')}
                          </td>
                          <td className="py-2.5 pr-4">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${badge.className}`}>
                              {badge.label}
                            </span>
                          </td>
                          <td className="py-2.5 pr-4 text-center text-gray-500">
                            {local.especialidades_obtenidas}/{local.especialidades_total}
                          </td>
                          <td className="py-2.5 text-center">
                            {local.observaciones_abiertas > 0 ? (
                              <span className="font-semibold text-amber-600">
                                {local.observaciones_abiertas}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ))}

        {/* ── Report footer ── */}
        <footer className="rounded-b-xl border-x border-b border-gray-200 bg-gray-50 px-10 py-5">
          <p className="text-center text-xs text-gray-400">
            Generado por {generado_por} · {fechaFormateada} · Documento confidencial para uso interno y due diligence
          </p>
        </footer>
      </div>
    </>
  )
}

function SummaryCard({
  label,
  value,
  valueClass,
}: {
  label: string
  value: string
  valueClass: string
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className={`mt-2 text-4xl font-bold tracking-tight ${valueClass}`}>{value}</p>
    </div>
  )
}
