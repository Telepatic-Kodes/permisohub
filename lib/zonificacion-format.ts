// Repara mojibake de doble-codificación (UTF-8 leído como Latin-1, luego
// re-codificado) en texto proveniente de ArcGIS: nombreZona/uperm/uproh/sector.
// Ver Pitfall 6, 11-RESEARCH.md. Corre en cliente Y servidor — usa TextDecoder,
// no Buffer (no disponible en el bundle de un componente "use client").
// Defensivo: solo transforma si detecta el patrón, y solo si el resultado es
// UTF-8 válido — nunca corrompe texto que ya estaba bien.
export function fixMojibakeArcGIS(s: string | null | undefined): string | null {
  if (!s) return s ?? null
  if (!/[ÃÂ]/.test(s)) return s
  try {
    const bytes = Uint8Array.from(s, (c) => c.charCodeAt(0))
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch {
    return s // no era mojibake reversible (p. ej. contenía un carácter >255) — dejar tal cual
  }
}
