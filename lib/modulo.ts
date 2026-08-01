// Fuente única de verdad para el rediseño de separación Permisos vs. Mercado
// Inmobiliario — usado tanto por el sidebar (qué grupos de nav mostrar) como
// por PageHeader (qué badge de módulo mostrar). El módulo activo se infiere
// SIEMPRE desde la ruta, nunca desde un estado manual — así el switcher, el
// sidebar y el badge de página nunca pueden desincronizarse entre sí.

export type Modulo = 'permisos' | 'mercado-inmobiliario'

const PREFIX_MERCADO = '/mercado-inmobiliario'

// Rutas que no pertenecen a ningún módulo: /dashboard es el hub compartido,
// /configuracion y /admin son transversales (sistema/admin), no de un flujo
// de negocio específico.
const RUTAS_COMPARTIDAS = ['/dashboard', '/configuracion', '/admin']

export function inferirModuloDesdeRuta(pathname: string): Modulo {
  return pathname === PREFIX_MERCADO || pathname.startsWith(`${PREFIX_MERCADO}/`)
    ? 'mercado-inmobiliario'
    : 'permisos'
}

export function esRutaCompartida(pathname: string): boolean {
  return RUTAS_COMPARTIDAS.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

export const MODULO_CONFIG: Record<Modulo, { label: string; hrefDefault: string }> = {
  permisos: { label: 'Permisos', hrefDefault: '/dashboard' },
  'mercado-inmobiliario': { label: 'Mercado Inmobiliario', hrefDefault: '/mercado-inmobiliario/pricing' },
}
