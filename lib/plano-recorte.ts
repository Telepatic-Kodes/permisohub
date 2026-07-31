// ---------------------------------------------------------------------------
// Geometría de recortes sobre una lámina.
//
// Por qué existe: una lámina chilena típica es formato grande (A1/A0) con 6-8
// sub-dibujos en la misma hoja. Al enviarla completa a un modelo de visión, la
// API la reescala hasta dejar el lado corto en 768 px — una hoja de 3456×2592
// pt termina percibida a ~1024×768, donde cada sub-dibujo mide ~340×250 px y un
// muro concreto ~15 px. A esa escala el modelo no puede ubicar un elemento: lo
// aproxima, y la marca cae en un espacio vacío.
//
// La solución es recortar el sub-dibujo y enviarlo como su propia imagen: el
// recorte recibe sus propios 768 px de lado corto, multiplicando por ~4 la
// resolución efectiva sobre la zona que importa. Este módulo hace la conversión
// de coordenadas de ida y vuelta, que es pura y por eso se testea aparte.
// ---------------------------------------------------------------------------

export interface BBox {
  x: number
  y: number
  w: number
  h: number
}

const clamp01 = (n: number) => Math.min(1, Math.max(0, n))

/** Normaliza un bbox posiblemente inválido y lo deja dentro de la hoja. */
export function sanearBBox(b: Partial<BBox> | undefined, fallback: BBox): BBox {
  const num = (v: unknown, f: number) =>
    typeof v === "number" && Number.isFinite(v) ? v : f
  const x = clamp01(num(b?.x, fallback.x))
  const y = clamp01(num(b?.y, fallback.y))
  // El ancho/alto no puede salirse del borde derecho/inferior de la hoja.
  const w = Math.min(1 - x, Math.max(0.001, num(b?.w, fallback.w)))
  const h = Math.min(1 - y, Math.max(0.001, num(b?.h, fallback.h)))
  return { x, y, w, h }
}

/**
 * Expande el recorte con un margen relativo a su propio tamaño, para que el
 * modelo vea algo de contexto alrededor del sub-dibujo (líneas oficiales,
 * cotas del borde) y no un fragmento descontextualizado.
 */
export function conMargen(b: BBox, margen = 0.04): BBox {
  const mx = b.w * margen
  const my = b.h * margen
  const x = clamp01(b.x - mx)
  const y = clamp01(b.y - my)
  return {
    x,
    y,
    w: Math.min(1 - x, b.w + mx * 2),
    h: Math.min(1 - y, b.h + my * 2),
  }
}

/**
 * Lleva un bbox expresado en coordenadas del RECORTE (0..1 dentro del recorte)
 * a coordenadas de la HOJA completa. Es la operación inversa del recorte y la
 * razón por la que las marcas terminan donde corresponde.
 */
export function recorteAHoja(rel: BBox, recorte: BBox): BBox {
  const x = clamp01(recorte.x + rel.x * recorte.w)
  const y = clamp01(recorte.y + rel.y * recorte.h)
  return {
    x,
    y,
    w: Math.min(1 - x, rel.w * recorte.w),
    h: Math.min(1 - y, rel.h * recorte.h),
  }
}

/** Rectángulo en píxeles para recortar una imagen de W×H. */
export function recorteEnPixeles(
  b: BBox,
  W: number,
  H: number,
): { left: number; top: number; width: number; height: number } {
  const left = Math.max(0, Math.min(W - 1, Math.round(b.x * W)))
  const top = Math.max(0, Math.min(H - 1, Math.round(b.y * H)))
  return {
    left,
    top,
    width: Math.max(1, Math.min(W - left, Math.round(b.w * W))),
    height: Math.max(1, Math.min(H - top, Math.round(b.h * H))),
  }
}

/**
 * Un recorte demasiado chico no aporta resolución (el modelo lo reescala hacia
 * arriba y solo ve interpolación) y uno que cubre casi toda la hoja no aporta
 * nada sobre enviar la hoja entera. Solo recortamos cuando vale la pena.
 */
export function valeLaPenaRecortar(b: BBox): boolean {
  const area = b.w * b.h
  return area >= 0.01 && area <= 0.72
}

/**
 * Cuadrantes con traslape para cuando el modelo no logra inventariar la hoja.
 *
 * Es la red de seguridad correcta: no sabemos dónde están los sub-dibujos, pero
 * seguimos partiendo la hoja, así que cada trozo conserva la ganancia de
 * resolución que es el objetivo de todo esto. La alternativa —volver a mandar
 * la hoja completa— devuelve justamente las marcas aproximadas que este
 * pipeline vino a eliminar.
 *
 * El traslape evita que un elemento que cae en el corte quede partido entre dos
 * cuadrantes y no se vea entero en ninguno.
 */
export function cuadrantesConTraslape(cols = 2, filas = 2, traslape = 0.06): BBox[] {
  const out: BBox[] = []
  for (let f = 0; f < filas; f++) {
    for (let c = 0; c < cols; c++) {
      const x0 = c / cols
      const y0 = f / filas
      const x = clamp01(x0 - (c > 0 ? traslape : 0))
      const y = clamp01(y0 - (f > 0 ? traslape : 0))
      const derecha = clamp01((c + 1) / cols + (c < cols - 1 ? traslape : 0))
      const abajo = clamp01((f + 1) / filas + (f < filas - 1 ? traslape : 0))
      out.push({ x, y, w: derecha - x, h: abajo - y })
    }
  }
  return out
}
