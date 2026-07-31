import { describe, it, expect } from "vitest"
import {
  conMargen,
  recorteAHoja,
  recorteEnPixeles,
  sanearBBox,
  valeLaPenaRecortar,
  cuadrantesConTraslape,
  type BBox,
} from "@/lib/plano-recorte"

describe("sanearBBox", () => {
  it("usa el fallback cuando faltan valores o no son finitos", () => {
    const fb: BBox = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 }
    expect(sanearBBox(undefined, fb)).toEqual(fb)
    expect(sanearBBox({ x: NaN, y: 0.5 }, fb)).toEqual({ x: 0.1, y: 0.5, w: 0.3, h: 0.4 })
  })

  it("nunca deja el recuadro fuera de la hoja", () => {
    const r = sanearBBox({ x: 0.9, y: 0.9, w: 0.5, h: 0.5 }, { x: 0, y: 0, w: 1, h: 1 })
    expect(r.x + r.w).toBeLessThanOrEqual(1)
    expect(r.y + r.h).toBeLessThanOrEqual(1)
  })

  it("acota coordenadas negativas a cero", () => {
    const r = sanearBBox({ x: -0.4, y: -1, w: 0.2, h: 0.2 }, { x: 0, y: 0, w: 1, h: 1 })
    expect(r.x).toBe(0)
    expect(r.y).toBe(0)
  })
})

describe("conMargen", () => {
  it("expande proporcionalmente al tamaño del sub-dibujo", () => {
    const r = conMargen({ x: 0.4, y: 0.4, w: 0.2, h: 0.2 }, 0.1)
    expect(r.x).toBeCloseTo(0.38)
    expect(r.y).toBeCloseTo(0.38)
    expect(r.w).toBeCloseTo(0.24)
    expect(r.h).toBeCloseTo(0.24)
  })

  it("no se sale de la hoja al expandir en un borde", () => {
    const r = conMargen({ x: 0, y: 0, w: 0.5, h: 0.5 }, 0.2)
    expect(r.x).toBe(0)
    expect(r.y).toBe(0)
    expect(r.x + r.w).toBeLessThanOrEqual(1)
  })
})

describe("recorteAHoja", () => {
  // El caso que importa: el modelo mira el recorte y responde en coordenadas
  // del recorte. Si esta conversión falla, la marca aparece en otro lugar de
  // la lámina — exactamente el defecto que este pipeline vino a corregir.
  it("mapea el centro del recorte al centro del sub-dibujo en la hoja", () => {
    const recorte: BBox = { x: 0.5, y: 0.25, w: 0.4, h: 0.4 }
    const rel: BBox = { x: 0.5, y: 0.5, w: 0.1, h: 0.1 }
    const hoja = recorteAHoja(rel, recorte)
    expect(hoja.x).toBeCloseTo(0.7) // 0.5 + 0.5*0.4
    expect(hoja.y).toBeCloseTo(0.45) // 0.25 + 0.5*0.4
    expect(hoja.w).toBeCloseTo(0.04) // 0.1*0.4
    expect(hoja.h).toBeCloseTo(0.04)
  })

  it("el origen del recorte mapea al origen del sub-dibujo", () => {
    const recorte: BBox = { x: 0.3, y: 0.6, w: 0.25, h: 0.2 }
    const hoja = recorteAHoja({ x: 0, y: 0, w: 1, h: 1 }, recorte)
    expect(hoja.x).toBeCloseTo(0.3)
    expect(hoja.y).toBeCloseTo(0.6)
    expect(hoja.w).toBeCloseTo(0.25)
    expect(hoja.h).toBeCloseTo(0.2)
  })

  it("una marca en un recorte del borde derecho no se sale de la hoja", () => {
    const recorte: BBox = { x: 0.8, y: 0.1, w: 0.2, h: 0.2 }
    const hoja = recorteAHoja({ x: 0.9, y: 0.9, w: 0.5, h: 0.5 }, recorte)
    expect(hoja.x + hoja.w).toBeLessThanOrEqual(1)
    expect(hoja.y + hoja.h).toBeLessThanOrEqual(1)
  })

  it("recortar la hoja completa es la identidad", () => {
    const rel: BBox = { x: 0.31, y: 0.42, w: 0.13, h: 0.07 }
    expect(recorteAHoja(rel, { x: 0, y: 0, w: 1, h: 1 })).toEqual(rel)
  })
})

describe("recorteEnPixeles", () => {
  it("convierte a píxeles enteros dentro de la imagen", () => {
    const r = recorteEnPixeles({ x: 0.5, y: 0.25, w: 0.25, h: 0.5 }, 2600, 1950)
    expect(r).toEqual({ left: 1300, top: 488, width: 650, height: 975 })
  })

  it("nunca pide un rectángulo que exceda la imagen", () => {
    const r = recorteEnPixeles({ x: 0.99, y: 0.99, w: 0.5, h: 0.5 }, 1000, 800)
    expect(r.left + r.width).toBeLessThanOrEqual(1000)
    expect(r.top + r.height).toBeLessThanOrEqual(800)
    expect(r.width).toBeGreaterThan(0)
    expect(r.height).toBeGreaterThan(0)
  })
})

describe("valeLaPenaRecortar", () => {
  it("descarta recortes diminutos, que solo aportan interpolación", () => {
    expect(valeLaPenaRecortar({ x: 0.1, y: 0.1, w: 0.05, h: 0.05 })).toBe(false)
  })

  it("descarta recortes que son casi la hoja entera", () => {
    expect(valeLaPenaRecortar({ x: 0, y: 0, w: 0.95, h: 0.95 })).toBe(false)
  })

  it("acepta un sub-dibujo típico de lámina", () => {
    expect(valeLaPenaRecortar({ x: 0.66, y: 0.02, w: 0.34, h: 0.44 })).toBe(true)
  })
})

describe("cuadrantesConTraslape", () => {
  it("cubre la hoja completa sin dejar huecos", () => {
    const q = cuadrantesConTraslape(2, 2, 0.06)
    expect(q).toHaveLength(4)
    // Las esquinas de la hoja tienen que estar cubiertas.
    const cubre = (px: number, py: number) =>
      q.some((b) => px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h)
    for (const [px, py] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5]]) {
      expect(cubre(px, py)).toBe(true)
    }
  })

  it("traslapa los cuadrantes contiguos, para no partir un elemento en el corte", () => {
    const [sup_izq, sup_der] = cuadrantesConTraslape(2, 2, 0.06)
    expect(sup_izq.x + sup_izq.w).toBeGreaterThan(sup_der.x)
  })

  it("ningún cuadrante se sale de la hoja", () => {
    for (const b of cuadrantesConTraslape(3, 2, 0.08)) {
      expect(b.x).toBeGreaterThanOrEqual(0)
      expect(b.y).toBeGreaterThanOrEqual(0)
      expect(b.x + b.w).toBeLessThanOrEqual(1.0000001)
      expect(b.y + b.h).toBeLessThanOrEqual(1.0000001)
    }
  })

  it("cada cuadrante sigue siendo un recorte que vale la pena", () => {
    for (const b of cuadrantesConTraslape()) {
      expect(valeLaPenaRecortar(b)).toBe(true)
    }
  })
})
