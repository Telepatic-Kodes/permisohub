import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock,
  FileSearch,
  FileText,
  MessageCircle,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Datos estáticos de la landing
// ---------------------------------------------------------------------------

const STATS = [
  { value: "124 días", label: "promedio para aprobar un permiso hoy" },
  { value: "US$2B", label: "pérdidas anuales por permisología" },
  { value: "81 municipios", label: "con irregularidades confirmadas" },
];

const FEATURES = [
  {
    icon: Bot,
    title: "Chat OGUC con IA",
    description:
      "Consultas normativas resueltas al instante. Artículos citados, ejemplos concretos.",
  },
  {
    icon: FileText,
    title: "Respuesta a observaciones",
    description:
      "Sube el PDF de la DOM. Obtén respuestas técnicas formales en 30 segundos.",
  },
  {
    icon: CheckCircle2,
    title: "Verificador pre-ingreso",
    description:
      "Detecta errores antes de tramitar. Reduce el ciclo de observaciones.",
  },
  {
    icon: Clock,
    title: "Contador Ley 21.718",
    description:
      "Días hábiles automáticos. Nunca pierdas un plazo legal.",
  },
  {
    icon: BarChart3,
    title: "Inteligencia de municipios",
    description: "Tiempos reales por DOM. Planifica antes de ingresar.",
  },
  {
    icon: MessageCircle,
    title: "WhatsApp automático",
    description:
      "Clientes informados en cada hito. Sin esfuerzo manual.",
  },
];

const PROBLEMA = [
  {
    step: "01",
    title: "Preparar documentos sin guía",
    description:
      "Cada expediente se arma a mano, sin saber con certeza qué pide cada DOM.",
  },
  {
    step: "02",
    title: "Esperar 124 días sin visibilidad",
    description:
      "El trámite avanza en una caja negra: ni el arquitecto ni el cliente saben en qué etapa está.",
  },
  {
    step: "03",
    title: "Responder observaciones manualmente",
    description:
      "Cada ronda de observaciones se redacta desde cero, alargando el ciclo semana tras semana.",
  },
];

interface Plan {
  nombre: string;
  precioMensual: number;
  precioAnual: number;
  destacado?: boolean;
  features: string[];
  cta: string;
}

const PLANES: Plan[] = [
  {
    nombre: "Starter",
    precioMensual: 29990,
    precioAnual: 24990,
    features: [
      "5 proyectos activos",
      "Chat OGUC (20 consultas/mes)",
      "Extractor PDF observaciones (3/mes)",
      "Contador Ley 21.718",
      "Soporte por email",
    ],
    cta: "Empezar con Starter",
  },
  {
    nombre: "Pro",
    precioMensual: 79990,
    precioAnual: 66490,
    destacado: true,
    features: [
      "Todo lo de Starter +",
      "Proyectos ilimitados",
      "IA ilimitada (chat + PDF + verificador)",
      "Inteligencia de municipios completa",
      "WhatsApp automático a clientes",
      "Portal cliente",
    ],
    cta: "Empezar con Pro",
  },
  {
    nombre: "Estudio",
    precioMensual: 149990,
    precioAnual: 124490,
    features: [
      "Todo lo de Pro +",
      "5 usuarios por workspace",
      "Analytics avanzado",
      "Acceso API",
      "Soporte prioritario",
    ],
    cta: "Empezar con Estudio",
  },
];

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

// ---------------------------------------------------------------------------

export default async function MarketingPage({
  searchParams,
}: {
  searchParams: Promise<{ billing?: string }>;
}) {
  const { billing } = await searchParams;
  const isAnnual = billing === "annual";

  return (
    <div className="min-h-screen bg-[#F9F7F3] text-[#1A3328]">
      {/* ------------------------------------------------------------------ */}
      {/* Nav                                                                */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-50 border-b border-[#1A3328]/10 bg-[#F9F7F3]/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xl font-semibold tracking-tight text-[#1A3328]"
          >
            PermisoHub
            <span className="size-2 rounded-full bg-[#2D6A4F]" />
          </Link>

          <div className="hidden items-center gap-8 text-sm font-medium text-[#1A3328]/70 md:flex">
            <a href="#producto" className="transition-colors hover:text-[#1A3328]">
              Producto
            </a>
            <a href="#precios" className="transition-colors hover:text-[#1A3328]">
              Precios
            </a>
            <a href="#contacto" className="transition-colors hover:text-[#1A3328]">
              Contacto
            </a>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="rounded-lg border border-[#1A3328]/20 px-4 py-2 text-sm font-medium text-[#1A3328] transition-colors hover:bg-[#1A3328]/5"
            >
              Iniciar sesión
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-[#1A3328] px-4 py-2 text-sm font-medium text-[#F9F7F3] transition-colors hover:bg-[#2D6A4F]"
            >
              Comenzar gratis
            </Link>
          </div>
        </nav>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center md:pt-28">
        <span className="inline-flex items-center gap-2 rounded-full border border-[#1A3328]/15 bg-white px-4 py-1.5 text-xs font-medium text-[#2D6A4F]">
          <span className="size-1.5 rounded-full bg-[#E9C46A]" />
          IA entrenada en OGUC y Ley 21.718
        </span>

        <h1 className="mx-auto mt-6 max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight text-[#1A3328] md:text-7xl">
          El copiloto IA del{" "}
          <span className="text-[#2D6A4F]">arquitecto chileno</span>
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-[#1A3328]/70 md:text-xl">
          Gestión inteligente de permisos DOM. IA entrenada en OGUC, Ley 21.718
          y la realidad de cada municipio.
        </p>

        <div className="mt-9 flex items-center justify-center">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-[#1A3328] px-7 py-3.5 text-base font-medium text-[#F9F7F3] shadow-sm transition-colors hover:bg-[#2D6A4F]"
          >
            Comenzar gratis
            <ArrowRight className="size-4" />
          </Link>
        </div>

        {/* Stats */}
        <div className="mx-auto mt-16 grid max-w-4xl grid-cols-1 gap-px overflow-hidden rounded-2xl bg-[#1A3328] sm:grid-cols-3">
          {STATS.map((stat) => (
            <div key={stat.label} className="bg-[#1A3328] px-6 py-8 text-center">
              <p className="text-4xl font-semibold tracking-tight text-[#E9C46A]">
                {stat.value}
              </p>
              <p className="mt-2 text-sm text-[#F9F7F3]/70">{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Problema                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="mx-auto max-w-3xl text-center text-3xl font-semibold tracking-tight text-[#1A3328] md:text-4xl">
          El proceso actual es manual, lento y opaco.
        </h2>

        <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-3">
          {PROBLEMA.map((item) => (
            <div
              key={item.step}
              className="rounded-2xl border border-[#1A3328]/10 bg-white p-7"
            >
              <span className="text-sm font-semibold text-[#E9C46A]">
                {item.step}
              </span>
              <h3 className="mt-3 text-lg font-semibold text-[#1A3328]">
                {item.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-[#1A3328]/65">
                {item.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Features                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section id="producto" className="scroll-mt-20 bg-white py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-[#1A3328] md:text-4xl">
              Todo lo que necesitas para tramitar con confianza
            </h2>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-[#1A3328]/10 bg-[#F9F7F3] p-7 transition-colors hover:border-[#2D6A4F]/30"
                >
                  <div className="flex size-11 items-center justify-center rounded-xl bg-[#1A3328]">
                    <Icon className="size-5 text-[#E9C46A]" />
                  </div>
                  <h3 className="mt-5 text-lg font-semibold text-[#1A3328]">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#1A3328]/65">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Pricing                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section id="precios" className="scroll-mt-20 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-[#1A3328] md:text-4xl">
              Planes para cada estudio
            </h2>
            <p className="mt-3 text-[#1A3328]/65">
              Precios en CLP. Cancela cuando quieras.
            </p>
          </div>

          {/* Toggle mensual / anual via query param */}
          <div className="mt-8 flex items-center justify-center">
            <div className="inline-flex rounded-full border border-[#1A3328]/15 bg-white p-1 text-sm font-medium">
              <Link
                href="/?billing=monthly#precios"
                scroll={false}
                className={`rounded-full px-5 py-2 transition-colors ${
                  isAnnual
                    ? "text-[#1A3328]/60 hover:text-[#1A3328]"
                    : "bg-[#1A3328] text-[#F9F7F3]"
                }`}
              >
                Mensual
              </Link>
              <Link
                href="/?billing=annual#precios"
                scroll={false}
                className={`flex items-center gap-2 rounded-full px-5 py-2 transition-colors ${
                  isAnnual
                    ? "bg-[#1A3328] text-[#F9F7F3]"
                    : "text-[#1A3328]/60 hover:text-[#1A3328]"
                }`}
              >
                Anual
                <span className="rounded-full bg-[#E9C46A] px-2 py-0.5 text-xs font-semibold text-[#1A3328]">
                  -17%
                </span>
              </Link>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-3">
            {PLANES.map((plan) => {
              const precio = isAnnual ? plan.precioAnual : plan.precioMensual;
              return (
                <div
                  key={plan.nombre}
                  className={`relative flex flex-col rounded-2xl border p-8 ${
                    plan.destacado
                      ? "border-[#2D6A4F] bg-[#1A3328] text-[#F9F7F3] shadow-xl lg:scale-[1.03]"
                      : "border-[#1A3328]/10 bg-white text-[#1A3328]"
                  }`}
                >
                  {plan.destacado && (
                    <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[#E9C46A] px-3 py-1 text-xs font-semibold text-[#1A3328]">
                      ⭐ Recomendado
                    </span>
                  )}

                  <h3
                    className={`text-lg font-semibold ${
                      plan.destacado ? "text-[#F9F7F3]" : "text-[#1A3328]"
                    }`}
                  >
                    {plan.nombre}
                  </h3>

                  <div className="mt-4 flex items-baseline gap-1">
                    <span className="text-4xl font-semibold tracking-tight">
                      {CLP.format(precio)}
                    </span>
                    <span
                      className={
                        plan.destacado
                          ? "text-sm text-[#F9F7F3]/60"
                          : "text-sm text-[#1A3328]/55"
                      }
                    >
                      /mes
                    </span>
                  </div>
                  {isAnnual && (
                    <p
                      className={`mt-1 text-xs ${
                        plan.destacado ? "text-[#E9C46A]" : "text-[#2D6A4F]"
                      }`}
                    >
                      Facturado anualmente · 17% de descuento
                    </p>
                  )}

                  <ul className="mt-7 flex-1 space-y-3 text-sm">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-2.5">
                        <CheckCircle2
                          className={`mt-0.5 size-4 shrink-0 ${
                            plan.destacado ? "text-[#E9C46A]" : "text-[#2D6A4F]"
                          }`}
                        />
                        <span
                          className={
                            plan.destacado
                              ? "text-[#F9F7F3]/85"
                              : "text-[#1A3328]/75"
                          }
                        >
                          {feature}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <Link
                    href="/login"
                    className={`mt-8 inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-medium transition-colors ${
                      plan.destacado
                        ? "bg-[#E9C46A] text-[#1A3328] hover:bg-[#E9C46A]/90"
                        : "bg-[#1A3328] text-[#F9F7F3] hover:bg-[#2D6A4F]"
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Footer                                                             */}
      {/* ------------------------------------------------------------------ */}
      <footer
        id="contacto"
        className="scroll-mt-20 border-t border-[#1A3328]/10 bg-[#1A3328] text-[#F9F7F3]"
      >
        <div className="mx-auto max-w-6xl px-6 py-14">
          <div className="flex flex-col justify-between gap-10 md:flex-row">
            <div className="max-w-sm">
              <div className="flex items-center gap-1.5 text-xl font-semibold">
                PermisoHub
                <span className="size-2 rounded-full bg-[#E9C46A]" />
              </div>
              <p className="mt-3 text-sm text-[#F9F7F3]/65">
                El copiloto IA del arquitecto chileno. Permisos DOM más rápidos,
                claros y predecibles.
              </p>
            </div>

            <div className="flex gap-16">
              <div>
                <h4 className="text-sm font-semibold text-[#F9F7F3]">
                  Navegación
                </h4>
                <ul className="mt-4 space-y-2.5 text-sm text-[#F9F7F3]/65">
                  <li>
                    <a
                      href="#producto"
                      className="transition-colors hover:text-[#E9C46A]"
                    >
                      Producto
                    </a>
                  </li>
                  <li>
                    <a
                      href="#precios"
                      className="transition-colors hover:text-[#E9C46A]"
                    >
                      Precios
                    </a>
                  </li>
                  <li>
                    <a
                      href="#contacto"
                      className="transition-colors hover:text-[#E9C46A]"
                    >
                      Contacto
                    </a>
                  </li>
                </ul>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-[#F9F7F3]">
                  Contacto
                </h4>
                <ul className="mt-4 space-y-2.5 text-sm text-[#F9F7F3]/65">
                  <li>
                    <a
                      href="mailto:contacto@permisohub.cl"
                      className="transition-colors hover:text-[#E9C46A]"
                    >
                      contacto@permisohub.cl
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div className="mt-12 border-t border-[#F9F7F3]/10 pt-6 text-sm text-[#F9F7F3]/50">
            Desarrollado para arquitectos chilenos · Santiago, 2026
          </div>
        </div>
      </footer>
    </div>
  );
}
