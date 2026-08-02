// Reajuste de renta comercial — Ley N°18.101, Art. 13: el reajuste debe
// estar PACTADO explícitamente en el contrato de arriendo; no puede
// aplicarse unilateralmente. El problema de negocio real que esto ataca:
// arriendos comerciales que quedan "congelados" porque el
// propietario/administrador se olvida de aplicar el reajuste ya pactado —
// una fuga de ingresos que hoy nadie en el portafolio detecta.
//
// Mismo patrón que lib/obligaciones-regulatorias.ts: estado calculado de
// forma pura y determinista (sin red, sin fabricar una fecha o
// periodicidad cuando el dato no está declarado).
export type EstadoReajuste = 'al_dia' | 'proximo' | 'vencido' | 'sin_registro' | 'no_aplica'

export interface ReajusteInput {
  reajusteAplica: boolean
  periodicidadMeses: number | null
  fechaUltimo: string | null
}

export interface EstadoReajusteResultado {
  estado: EstadoReajuste
  proximaFecha: string | null
  diasParaProximo: number | null
}

const DIAS_ALERTA_PROXIMO = 30

// Formatea en calendario LOCAL (no toISOString(), que convierte a UTC y
// puede correr la fecha un día para cualquier huso horario UTC+) — mismo
// criterio que formatFechaLocal en lib/obligaciones-regulatorias.ts.
function formatFechaLocal(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function calcularEstadoReajuste(input: ReajusteInput, hoy: Date = new Date()): EstadoReajusteResultado {
  if (!input.reajusteAplica) {
    return { estado: 'no_aplica', proximaFecha: null, diasParaProximo: null }
  }

  if (input.periodicidadMeses == null || !input.fechaUltimo) {
    return { estado: 'sin_registro', proximaFecha: null, diasParaProximo: null }
  }

  const hoyMedianoche = new Date(hoy)
  hoyMedianoche.setHours(0, 0, 0, 0)

  // Parsear SIEMPRE con T00:00:00 (nunca `new Date(fechaUltimo)` a secas) —
  // bug de timezone ya conocido en este repo: sin el horario explícito, el
  // motor de JS interpreta el string YYYY-MM-DD como medianoche UTC, que en
  // cualquier huso horario UTC+ (como America/Santiago) cae en el día
  // calendario ANTERIOR al leerlo de vuelta en hora local.
  const ultima = new Date(`${input.fechaUltimo}T00:00:00`)
  const proxima = new Date(ultima)
  proxima.setMonth(proxima.getMonth() + input.periodicidadMeses)

  const diasParaProximo = Math.round((proxima.getTime() - hoyMedianoche.getTime()) / (1000 * 60 * 60 * 24))
  const estado: EstadoReajuste = diasParaProximo <= 0 ? 'vencido' : diasParaProximo <= DIAS_ALERTA_PROXIMO ? 'proximo' : 'al_dia'

  return { estado, proximaFecha: formatFechaLocal(proxima), diasParaProximo }
}

// ---------------------------------------------------------------------------
// Estimación OPCIONAL de la renta reajustada según IPC acumulado real
// (mindicador.cl) — a diferencia de calcularEstadoReajuste (puro, sin red),
// esto SÍ hace fetch: es un enriquecimiento best-effort para mostrar "a
// cuánto debería subir la renta", nunca el estado mismo del reajuste.
//
// mindicador.cl/api/ipc/{año} devuelve la SERIE MENSUAL completa de ese año
// (hasta 12 entradas {fecha, valor} con la variación % de ESE mes, no un
// acumulado) — verificado en vivo el 2 ago 2026:
//   curl https://mindicador.cl/api/ipc/2025 → serie con 12 meses
//   curl https://mindicador.cl/api/ipc/2026 → serie: [] (año en curso, el
//     INE todavía no publica esos meses)
// Por eso la composición es mes a mes, y por eso esta función devuelve
// null completo (nunca un número parcial disfrazado de completo) si falta
// el IPC de CUALQUIER mes de la ventana — típicamente el año en curso
// completo, hasta que mindicador.cl lo publique.
// ---------------------------------------------------------------------------

interface MindicadorIpcResponse {
  serie: { valor: number; fecha: string }[]
}

const ipcPorAnioCache = new Map<number, Promise<Map<number, number> | null>>()

async function obtenerIpcMensualDelAnio(anio: number): Promise<Map<number, number> | null> {
  if (!ipcPorAnioCache.has(anio)) {
    ipcPorAnioCache.set(
      anio,
      (async () => {
        try {
          const res = await fetch(`https://mindicador.cl/api/ipc/${anio}`, {
            next: { revalidate: 3600 },
            signal: AbortSignal.timeout(5000),
          })
          if (!res.ok) return null
          const data = (await res.json()) as MindicadorIpcResponse
          if (!Array.isArray(data.serie)) return null

          const porMes = new Map<number, number>()
          for (const entry of data.serie) {
            // Se lee en UTC (no en hora local): mindicador.cl siempre
            // devuelve el día 1 del mes con un offset horario chileno
            // (+3h/+4h adelante de UTC), así que leerlo en UTC nunca hace
            // rodar la fecha al mes anterior — a diferencia de leerla en
            // hora local si este proceso corriera en un huso horario
            // distinto al del servidor.
            const fecha = new Date(entry.fecha)
            porMes.set(fecha.getUTCMonth() + 1, entry.valor)
          }
          return porMes
        } catch {
          return null
        }
      })(),
    )
  }
  return ipcPorAnioCache.get(anio)!
}

function mesesEntre(fechaUltimo: string, hoy: Date): { anio: number; mes: number }[] {
  const [y0, m0] = fechaUltimo.split('-').map(Number)
  let anio = y0
  let mes = m0 + 1
  if (mes > 12) {
    mes = 1
    anio++
  }

  // El mes EN CURSO de "hoy" casi nunca tiene su IPC publicado todavía — la
  // ventana llega hasta el mes ANTERIOR al actual, nunca el actual.
  let anioFin = hoy.getFullYear()
  let mesFin = hoy.getMonth() + 1 - 1
  if (mesFin === 0) {
    mesFin = 12
    anioFin--
  }

  const meses: { anio: number; mes: number }[] = []
  while (anio < anioFin || (anio === anioFin && mes <= mesFin)) {
    meses.push({ anio, mes })
    mes++
    if (mes > 12) {
      mes = 1
      anio++
    }
  }
  return meses
}

export interface EstimacionReajusteIPC {
  variacionAcumuladaPct: number
  rentaEstimadaUf: number
}

/**
 * Estima cuánto DEBERÍA ser la renta si se aplicara hoy el reajuste
 * pactado, componiendo la variación mensual real del IPC desde el último
 * reajuste hasta hoy. Nunca fabrica un número parcial: si falta el IPC de
 * cualquier mes de la ventana (falla de red, o el mes aún no está
 * publicado), devuelve null — no una estimación incompleta disfrazada de
 * completa.
 */
export async function estimarRentaReajustadaIPC(
  rentaActualUf: number,
  fechaUltimo: string,
  hoy: Date = new Date(),
): Promise<EstimacionReajusteIPC | null> {
  const meses = mesesEntre(fechaUltimo, hoy)
  if (meses.length === 0) {
    return { variacionAcumuladaPct: 0, rentaEstimadaUf: rentaActualUf }
  }

  const anios = Array.from(new Set(meses.map((m) => m.anio)))
  const seriesPorAnio = new Map<number, Map<number, number> | null>()
  await Promise.all(
    anios.map(async (anio) => {
      seriesPorAnio.set(anio, await obtenerIpcMensualDelAnio(anio))
    }),
  )

  let factor = 1
  for (const { anio, mes } of meses) {
    const serie = seriesPorAnio.get(anio)
    const valor = serie?.get(mes)
    if (serie == null || valor === undefined) return null // mes faltante — no se fabrica un parcial
    factor *= 1 + valor / 100
  }

  return {
    variacionAcumuladaPct: (factor - 1) * 100,
    rentaEstimadaUf: rentaActualUf * factor,
  }
}
