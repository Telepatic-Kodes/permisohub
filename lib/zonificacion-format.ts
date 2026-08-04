// Repara mojibake de doble-codificación (UTF-8 leído como Latin-1, luego
// re-codificado) en texto proveniente de ArcGIS: nombreZona/uperm/uproh/sector.
// Ver Pitfall 6, 11-RESEARCH.md. Corre en cliente Y servidor — usa TextDecoder,
// no Buffer (no disponible en el bundle de un componente "use client").
// Defensivo: solo transforma si detecta el patrón, y solo si el resultado es
// UTF-8 válido — nunca corrompe texto que ya estaba bien.
export function fixMojibakeArcGIS(s: string | null | undefined): string | null {
  if (!s) return s ?? null
  if (!/[ÃÂ]/.test(s)) return s
  let fixed: string
  try {
    const bytes = Uint8Array.from(s, (c) => c.charCodeAt(0))
    fixed = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return s // no era mojibake reversible (p. ej. contenía un carácter >255) — dejar tal cual
  }
  // Backlog (checkpoint 11-08): residuo de doble-codificación en un
  // subconjunto de nombres de zona de Las Condes — verificado en vivo contra
  // el FeatureServer real (PRC_Las_Condes) que la fuente ArcGIS misma ya
  // sirve el dato doble-corrupto (Observatorio de Ciudades UC), no algo que
  // introduzca nuestro pipeline. El signo "°" queda precedido por un "â"
  // espurio que un solo pase de decodificación no puede consumir — la
  // secuencia de bytes que le sigue no forma UTF-8 válido para un segundo
  // pase genérico (confirmado: ni un segundo decode ni la librería ftfy
  // logran resolverlo por sí solos). El "N" antes y el resto del texto YA
  // quedan correctos tras el pase de arriba; el único residuo verificado es
  // ese "â" pegado justo antes de "°" — se recorta puntualmente en vez de
  // adivinar un segundo algoritmo de decodificación.
  return fixed.replace(/â(?=°)/g, '')
}
