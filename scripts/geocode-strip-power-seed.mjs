// Uso: node scripts/geocode-strip-power-seed.mjs
// Geocodifica las direcciones REALES (no "no confirmada") de
// .planning/research/SEED-STRIP-POWER-CENTERS-CHILE.md Tablas 1 y 2 — mismo
// proveedor/throttle/User-Agent que lib/geocoding.ts geocodeDireccion() (no
// se importa directo porque ese módulo usa paths TS `@/...` no resolubles
// desde un script .mjs plano — duplicación deliberada y aceptable para un
// script one-off, mismo patrón que otros scripts de scripts/).
//
// Corrida real: 2026-08-02. Salida capturada en
// /tmp/seed-strip-power-geocoded.jsonl y copiada a mano (literal, sin
// redondear) a lib/strip-power-centers-chile.ts (Task 2).
//
// Filas incluidas acá: TODAS las de confianza 'alta'/'media' en el seed doc
// cuya celda de dirección NO es exactamente "no confirmada" (Punta Blanca x8,
// BTG Pactual x8 [7 strip + Paseo Los Trapenses power], Strip center Camino
// Lonquén, BCenter Alto Jahuel). Filas con "no confirmada" literal (Cimenta
// Puente Alto, Terrazas San Cristóbal, Strip center Colina, Strip center
// Pirque Etapa III, los 3 Power Center de Cenco Malls) NO se geocodifican
// acá — quedan lat/lng: null a propósito en lib/strip-power-centers-chile.ts.

const FILAS = [
  // --- Tabla 1: Strip centers ---
  { nombre: 'Punta Blanca Maipú (Los Pajaritos)', direccion: 'Av. Los Pajaritos 1.948', comuna: 'Maipú', formato: 'strip_center', confianza: 'alta' },
  { nombre: 'Punta Blanca Pajaritos', direccion: 'Av. Pajaritos 2.872', comuna: 'Maipú', formato: 'strip_center', confianza: 'alta' },
  { nombre: 'Punta Blanca Irarrázaval', direccion: 'Av. Irarrázaval 2.401', comuna: 'Ñuñoa', formato: 'strip_center', confianza: 'alta' },
  { nombre: 'Punta Blanca Antonio Varas', direccion: 'Av. Antonio Varas 2.284', comuna: 'Ñuñoa', formato: 'strip_center', confianza: 'alta' },
  { nombre: 'Punta Blanca San Bernardo', direccion: 'Av. Padre Hurtado 14.529', comuna: 'San Bernardo', formato: 'strip_center', confianza: 'alta' },
  { nombre: 'Punta Blanca Avenida Perú', direccion: 'Av. Perú 805', comuna: 'Recoleta', formato: 'strip_center', confianza: 'alta' },
  { nombre: 'Punta Blanca Talagante', direccion: "Av. Bernardo O'Higgins 1.116", comuna: 'Talagante', formato: 'strip_center', confianza: 'alta' },
  { nombre: 'Punta Blanca Ciudad Empresarial', direccion: 'Av. del Parque 4.023', comuna: 'Huechuraba', formato: 'strip_center', confianza: 'alta' },
  // direccionGeocode: variante sin paréntesis/símbolos que Nominatim no parseaba bien
  // en la corrida inicial (2026-08-02) — direccion (mostrada al usuario) queda igual
  // que en el seed doc, solo la QUERY de geocoding usa la variante limpia.
  { nombre: 'Plaza Don Carlos', direccion: 'Príncipe de Gales 8.531 (esquina Carlos Ossandón)', direccionGeocode: 'Príncipe de Gales 8531', comuna: 'La Reina', formato: 'strip_center', confianza: 'alta' },
  { nombre: 'Paseo Tobalaba I', direccion: 'Av. Tobalaba 11.835', comuna: 'Peñalolén', formato: 'strip_center', confianza: 'alta' },
  { nombre: 'Paseo Tobalaba II', direccion: 'Av. Tobalaba 11.855', comuna: 'Peñalolén', formato: 'strip_center', confianza: 'alta' },
  { nombre: 'Paseo Maipú II', direccion: 'Av. Tres Poniente 2.600', comuna: 'Maipú', formato: 'strip_center', confianza: 'alta' },
  { nombre: 'Plaza La Fuente', direccion: 'Macul 2.555', comuna: 'Macul', formato: 'strip_center', confianza: 'alta' },
  { nombre: 'Plaza Vivaceta', direccion: 'Fermín Vivaceta 957', comuna: 'Independencia', formato: 'strip_center', confianza: 'alta' },
  { nombre: 'Plaza San Pío', direccion: 'Esquina Pío XI / Av. Vitacura', direccionGeocode: 'Pío XI, Vitacura', comuna: 'Vitacura', formato: 'strip_center', confianza: 'media' },
  { nombre: 'Strip center Camino Lonquén (sin nombre comercial confirmado)', direccion: 'Camino Lonquén 17.723', comuna: 'Maipú', formato: 'strip_center', confianza: 'alta' },
  { nombre: 'BCenter Alto Jahuel', direccion: 'Av. principal Buin–Alto Jahuel, cerca de Miraflores 166-300', direccionGeocode: 'Miraflores 166', comuna: 'Buin', formato: 'strip_center', confianza: 'media' },
  // --- Tabla 2: Power centers ---
  { nombre: 'Paseo Los Trapenses', direccion: 'Camino Los Trapenses N° 3.515', direccionGeocode: 'Camino Los Trapenses 3515', comuna: 'Lo Barnechea', formato: 'power_center', confianza: 'alta' },
]

async function geocode(direccion, comuna) {
  const q = `${direccion}, ${comuna}, Santiago, Chile`
  const params = new URLSearchParams({ q, format: 'json', limit: '1', addressdetails: '1', countrycodes: 'cl' })
  const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
    headers: { 'User-Agent': 'PermisoHub/1.0 (+https://permisohub.cl; contacto@permisohub.cl)', Accept: 'application/json' },
  })
  const results = await res.json()
  if (!Array.isArray(results) || results.length === 0) return null
  return { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon), displayName: results[0].display_name }
}

async function main() {
  for (const fila of FILAS) {
    // direccionGeocode (si existe) es la QUERY que se manda a Nominatim — direccion
    // (mostrada al usuario en lib/strip-power-centers-chile.ts) queda igual que el
    // seed doc; ambas apuntan a la misma calle/cuadra, direccionGeocode solo quita
    // paréntesis/símbolos que Nominatim no parseaba en la corrida inicial.
    const { direccionGeocode, ...filaSinOverride } = fila
    const geo = await geocode(direccionGeocode ?? fila.direccion, fila.comuna)
    console.log(JSON.stringify({ ...filaSinOverride, ...geo }))
    await new Promise((r) => setTimeout(r, 1100)) // mismo throttle 1.1s que lib/geocoding.ts — recurso público compartido
  }
}

main()
