import Link from "next/link"
import { Check, ArrowRight, Zap } from "lucide-react"

interface PlanFeature {
  text: string
  highlight?: boolean
}

interface Plan {
  id: string
  name: string
  price: number
  priceAnual: number
  description: string
  features: PlanFeature[]
  cta: string
  href: string
  highlighted?: boolean
  badge?: string
}

const PLANS: Plan[] = [
  {
    id: "free",
    name: "Gratis",
    price: 0,
    priceAnual: 0,
    description: "Para conocer la plataforma",
    cta: "Comenzar gratis",
    href: "/login",
    features: [
      { text: "1 proyecto activo" },
      { text: "5 consultas IA / mes" },
      { text: "Checklist normativo OGUC" },
      { text: "Calculadora de plazos Ley 21.718" },
      { text: "Municipios: cobertura DOM" },
    ],
  },
  {
    id: "starter",
    name: "Starter",
    price: 29990,
    priceAnual: 24900,
    description: "Para arquitectos independientes",
    cta: "Empezar Starter",
    href: "/login?plan=starter",
    features: [
      { text: "Hasta 10 proyectos activos" },
      { text: "50 consultas IA / mes" },
      { text: "Chat OGUC ilimitado", highlight: true },
      { text: "Generador Memoria Descriptiva" },
      { text: "Predictor de observaciones DOM" },
      { text: "Inteligencia DOM por municipio" },
      { text: "Checklist + Auditor de expediente" },
      { text: "Soporte por email" },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 79990,
    priceAnual: 66300,
    description: "Para oficinas con múltiples proyectos",
    cta: "Empezar Pro",
    href: "/login?plan=pro",
    highlighted: true,
    badge: "Más popular",
    features: [
      { text: "Proyectos ilimitados", highlight: true },
      { text: "IA sin límite mensual", highlight: true },
      { text: "Todo lo de Starter" },
      { text: "Declaración Jurada obras menores" },
      { text: "CRM de prospectos" },
      { text: "Alertas Ley 21.718 automáticas" },
      { text: "Export expediente ZIP" },
      { text: "Soporte prioritario" },
    ],
  },
  {
    id: "estudio",
    name: "Estudio",
    price: 149990,
    priceAnual: 124400,
    description: "Para estudios con equipo",
    cta: "Contactar ventas",
    href: "mailto:tomas@aiaiai.cl?subject=PermisoHub Estudio",
    features: [
      { text: "Todo lo de Pro" },
      { text: "Multiusuario (equipo completo)", highlight: true },
      { text: "Reportes y analítica avanzada" },
      { text: "Integraciones a medida" },
      { text: "Onboarding personalizado" },
      { text: "Gerente de cuenta dedicado" },
    ],
  },
]

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
})

const FAQS = [
  {
    q: "¿Puedo cambiar de plan en cualquier momento?",
    a: "Sí. Los upgrades son inmediatos y los downgrades se aplican al final del período de facturación.",
  },
  {
    q: "¿Los precios incluyen IVA?",
    a: "No. Los precios mostrados son netos. Se agrega IVA (19%) al momento del pago según la ley chilena.",
  },
  {
    q: "¿Qué pasa con mis datos si cancelo?",
    a: "Tus proyectos y datos permanecen durante 30 días después de cancelar. Puedes exportarlos en cualquier momento.",
  },
  {
    q: "¿Hay descuento por pago anual?",
    a: "Sí, el plan anual equivale a 2 meses gratis (aprox. 17% de descuento).",
  },
  {
    q: "¿La IA usa OGUC chileno real?",
    a: "Sí. El chat OGUC y el verificador de cumplimiento están entrenados sobre la OGUC vigente, DDUs y normativa sectorial chilena.",
  },
]

export const metadata = {
  title: "Precios — PermisoHub",
  description: "El copiloto del arquitecto chileno. Planes desde $0.",
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-[#F9F7F3]">
      {/* Nav mínima */}
      <header className="flex h-14 items-center justify-between border-b border-border bg-white px-6">
        <Link href="/" className="text-sm font-semibold text-primary">
          PermisoHub
        </Link>
        <div className="flex items-center gap-4">
          <Link href="/login" className="text-sm text-muted-foreground hover:text-primary">
            Iniciar sesión
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white hover:bg-primary/90"
          >
            Comenzar gratis
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-16">
        {/* Header */}
        <div className="mb-12 text-center">
          <div className="mb-4 inline-flex items-center gap-1.5 rounded-full border border-primary/20 bg-primary/6 px-3 py-1 text-xs font-medium text-primary">
            <Zap className="size-3" />
            Sin tarjeta de crédito para el plan gratis
          </div>
          <h1 className="text-4xl font-semibold tracking-tight text-primary">
            El copiloto del arquitecto chileno
          </h1>
          <p className="mt-3 text-lg text-muted-foreground">
            Gestiona permisos DOM, anticipa observaciones, y cumple la Ley 21.718
          </p>
        </div>

        {/* Plan cards */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                plan.highlighted
                  ? "border-primary bg-primary text-white shadow-xl shadow-primary/20"
                  : "border-border bg-white"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="rounded-full bg-white px-3 py-0.5 text-xs font-semibold text-primary shadow-sm">
                    {plan.badge}
                  </span>
                </div>
              )}

              <div className="mb-4">
                <p className={`text-xs font-semibold uppercase tracking-widest ${plan.highlighted ? "text-white/60" : "text-muted-foreground/60"}`}>
                  {plan.name}
                </p>
                <div className="mt-2 flex items-end gap-1">
                  {plan.price === 0 ? (
                    <span className={`text-3xl font-semibold ${plan.highlighted ? "text-white" : "text-primary"}`}>
                      Gratis
                    </span>
                  ) : (
                    <>
                      <span className={`text-3xl font-semibold ${plan.highlighted ? "text-white" : "text-primary"}`}>
                        {CLP.format(plan.price)}
                      </span>
                      <span className={`mb-1 text-xs ${plan.highlighted ? "text-white/60" : "text-muted-foreground"}`}>/mes</span>
                    </>
                  )}
                </div>
                {plan.price > 0 && (
                  <p className={`mt-0.5 text-[11px] ${plan.highlighted ? "text-white/50" : "text-muted-foreground/60"}`}>
                    o {CLP.format(plan.priceAnual)}/mes anual
                  </p>
                )}
                <p className={`mt-2 text-xs ${plan.highlighted ? "text-white/70" : "text-muted-foreground"}`}>
                  {plan.description}
                </p>
              </div>

              <ul className="mb-6 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li key={f.text} className="flex items-start gap-2">
                    <Check
                      className={`mt-0.5 size-3.5 shrink-0 ${
                        plan.highlighted
                          ? f.highlight ? "text-white" : "text-white/50"
                          : f.highlight ? "text-primary" : "text-muted-foreground/50"
                      }`}
                    />
                    <span
                      className={`text-xs leading-snug ${
                        plan.highlighted
                          ? f.highlight ? "font-medium text-white" : "text-white/70"
                          : f.highlight ? "font-medium text-primary" : "text-muted-foreground"
                      }`}
                    >
                      {f.text}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`flex items-center justify-center gap-1.5 rounded-xl py-2.5 text-sm font-semibold transition-colors ${
                  plan.highlighted
                    ? "bg-white text-primary hover:bg-white/90"
                    : "bg-primary text-white hover:bg-primary/90"
                }`}
              >
                {plan.cta}
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          ))}
        </div>

        {/* Feature comparison note */}
        <div className="mt-8 rounded-xl border border-primary/10 bg-primary/4 p-5 text-center">
          <p className="text-sm text-primary/80">
            Todos los planes incluyen SSL, backups automáticos y cumplimiento con la normativa de datos chilena.
            Puedes cancelar en cualquier momento.
          </p>
        </div>

        {/* FAQs */}
        <div className="mt-16">
          <h2 className="mb-8 text-center text-2xl font-semibold text-primary">Preguntas frecuentes</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {FAQS.map(({ q, a }) => (
              <div key={q} className="rounded-xl border border-border bg-white p-5">
                <p className="text-sm font-semibold text-primary">{q}</p>
                <p className="mt-1.5 text-sm text-muted-foreground">{a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 rounded-2xl bg-primary p-8 text-center text-white">
          <h2 className="text-2xl font-semibold">¿Listo para trabajar menos en trámites?</h2>
          <p className="mt-2 text-white/70">Únete a los arquitectos que ya usan PermisoHub</p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-white/90"
          >
            Comenzar gratis — sin tarjeta
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </main>
    </div>
  )
}
