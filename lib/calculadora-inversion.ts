// Port de las fórmulas de app/(app)/calculadora/page.tsx (repo origen PROPRA·BI)
// — fase 3 de la fusión. Sin IA, sin base de datos: fórmulas puras de
// análisis de inversión inmobiliaria comercial, separadas de la UI para que
// sean testeables. Mismo criterio que lib/derechos-municipales.ts ya usa
// para la calculadora de permisos.

export type Semaforo = 'verde' | 'amarillo' | 'rojo'

// Mismos umbrales que el origen para ambos cálculos: >6% excelente/verde,
// 4-6% aceptable/amarillo, <4% bajo/rojo.
export function semaforoRentabilidad(porcentajeNeto: number): Semaforo {
  if (porcentajeNeto > 6) return 'verde'
  if (porcentajeNeto >= 4) return 'amarillo'
  return 'rojo'
}

export interface CapRateInput {
  rentaMensual: number
  precioVenta: number
  vacancia?: number // fracción 0-1, default 0.07
  opex?: number // fracción 0-1, default 0.15
}

export interface CapRateResultado {
  rentaAnual: number
  noi: number
  capBruto: number
  capNeto: number
  paybackAnios: number | null
  semaforo: Semaforo
}

function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n))
}

export function calcularCapRate(input: CapRateInput): CapRateResultado {
  const vacancia = clamp01(input.vacancia ?? 0.07)
  const opex = clamp01(input.opex ?? 0.15)

  const rentaAnual = input.rentaMensual * 12
  const noi = rentaAnual * (1 - vacancia) * (1 - opex)
  const capBruto = input.precioVenta > 0 ? (rentaAnual / input.precioVenta) * 100 : 0
  const capNeto = input.precioVenta > 0 ? (noi / input.precioVenta) * 100 : 0

  return {
    rentaAnual,
    noi,
    capBruto,
    capNeto,
    paybackAnios: capNeto > 0 ? 100 / capNeto : null,
    semaforo: semaforoRentabilidad(capNeto),
  }
}

export interface RoiInput {
  arriendoMensual: number
  precioCompra: number
  gastosCombinados?: number // fracción 0-1 (vacancia + opex combinados), default 0.20
}

export interface RoiResultado {
  arriendoAnual: number
  noi: number
  roiAnual: number
  paybackAnios: number | null
  semaforo: Semaforo
}

export function calcularRoi(input: RoiInput): RoiResultado {
  const gastosCombinados = clamp01(input.gastosCombinados ?? 0.2)

  const arriendoAnual = input.arriendoMensual * 12
  const noi = arriendoAnual * (1 - gastosCombinados)
  const roiAnual = input.precioCompra > 0 ? (noi / input.precioCompra) * 100 : 0

  return {
    arriendoAnual,
    noi,
    roiAnual,
    paybackAnios: roiAnual > 0 ? 100 / roiAnual : null,
    semaforo: semaforoRentabilidad(roiAnual),
  }
}

export function ufToClp(uf: number, valorUf: number): number {
  return Math.round(uf * valorUf)
}

export function clpToUf(clp: number, valorUf: number): number {
  return valorUf > 0 ? clp / valorUf : 0
}
