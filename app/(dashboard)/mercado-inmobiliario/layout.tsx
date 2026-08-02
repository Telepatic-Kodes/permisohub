// Scope del "Tema Consultora" (ver app/globals.css) a todo el módulo Mercado
// Inmobiliario — automático por routing de Next.js, sin detección en
// runtime. `display: contents` para que el wrapper sea invisible al layout
// de flex/scroll del <main> de app/(dashboard)/layout.tsx (las variables CSS
// igual cascadean a través de un elemento `contents`).
export default function MercadoInmobiliarioLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <div className="tema-consultora contents">{children}</div>
}
