import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bot,
  CheckCircle2,
  Clock,
  FileSearch,
  FileText,
  FolderDown,
  MessageCircle,
  Scale,
  Search,
  Sparkles,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Datos estáticos de la landing
// ---------------------------------------------------------------------------

const STATS = [
  { value: "124 días", label: "promedio para aprobar un permiso en 2024 (vs 45 días en 2009)" },
  { value: "US$2B", label: "en pérdidas anuales por demoras de tramitación en Chile" },
  { value: "7.000+", label: "estudios de arquitectura chilenos sin herramienta dedicada" },
];

const COMPETENCIA = [
  { solucion: "PermisoHub", para_arq: true, ia: true, nacional: true, saas: true, auto: true, destacado: true },
  { solucion: "REVI (CChC+Google)", para_arq: false, ia: true, nacional: false, saas: false, auto: false },
  { solucion: "DOM en Línea (MINVU)", para_arq: false, ia: false, nacional: true, saas: false, auto: false },
  { solucion: "Consultoría tradicional", para_arq: true, ia: false, nacional: false, saas: false, auto: false },
];

const OPORTUNIDAD = [
  {
    icon: Scale,
    titulo: "Ley 21.718 vigente",
    descripcion: "Desde enero 2025 fija 30 días hábiles máximo para la DOM. Nueva urgencia de cumplimiento para todos los arquitectos del país.",
  },
  {
    icon: TrendingUp,
    titulo: "REVI cubre solo el 3.5%",
    descripcion: "La IA municipal existe en 12 de 346 municipios — y ayuda a la DOM, no al arquitecto. Hay una ventana de 2–3 años antes de que el mercado madure.",
  },
  {
    icon: FileSearch,
    titulo: "CBR Digital 2026",
    descripcion: "La digitalización del Conservador de Bienes Raíces acelera todo el flujo documental del sector. El timing es ahora.",
  },
  {
    icon: Zap,
    titulo: "Mercado en crisis",
    descripcion: "El dolor de la permisología es agudo y creciente. Crisis = adopción acelerada de soluciones que funcionan.",
  },
];

const TRACTION = [
  { value: "Jun 2026", label: "MVP lanzado y operativo en producción" },
  { value: "25+", label: "módulos construidos y funcionales" },
  { value: "100%", label: "bootstrapped — fundadora-arquitecta" },
  { value: "US$2B", label: "en dolor de mercado sin solución dedicada" },
];

const FEATURES = [
  {
    icon: Bot,
    title: "9 herramientas con IA",
    description:
      "Chat OGUC, predictor de observaciones, memoria descriptiva, declaración jurada, checklist y más. Todo conectado con los datos de tu proyecto.",
  },
  {
    icon: FileText,
    title: "Respuesta a observaciones DOM",
    description:
      "Registra cada observación, genera respuesta técnica con IA y haz seguimiento del estado hasta que quede respondida.",
  },
  {
    icon: CheckCircle2,
    title: "Score de expediente en tiempo real",
    description:
      "Sube documentos, marca completitud y ve el porcentaje de avance por municipio. Un click para exportar el ZIP con naming DOM.",
  },
  {
    icon: Clock,
    title: "Toolkit Ley 21.718",
    description:
      "Countdown de días hábiles por proyecto, alerta de silencio administrativo y generador de reclamo DOM cuando el plazo legal se vence.",
  },
  {
    icon: BarChart3,
    title: "Inteligencia por municipio",
    description:
      "PRC, seccionales, zonas típicas y observaciones frecuentes de cada DOM. Datos reales de Las Condes, Providencia, Vitacura y más.",
  },
  {
    icon: TrendingUp,
    title: "CRM de prospectos integrado",
    description:
      "Pipeline visual de oportunidades. Marca un prospecto como ganado y se crea el proyecto automáticamente con los datos prellenados.",
  },
  {
    icon: MessageCircle,
    title: "Portal del mandante sin login",
    description:
      "Genera un link único con un click. El cliente ve el estado del permiso en tiempo real, sin crear cuenta ni instalar nada.",
  },
  {
    icon: FolderDown,
    title: "Exportación y comunicaciones",
    description:
      "Exporta el expediente completo en ZIP con naming DOM, registra comunicaciones con la municipalidad y genera cartas formales con IA.",
  },
  {
    icon: Search,
    title: "Búsqueda global (⌘K)",
    description:
      "Accede a cualquier proyecto, cliente o herramienta desde el teclado. La paleta de comandos aprende del contexto de la página.",
  },
];

const PROBLEMA = [
  {
    step: "01",
    title: "Expediente armado de memoria",
    description:
      "Sin guía, cada arquitecto reconstruye desde cero qué exige cada DOM para cada tipo de proyecto. 8–20 hrs perdidas, y el checklist cambia sin aviso.",
  },
  {
    step: "02",
    title: "449 días en promedio sin visibilidad",
    description:
      "El trámite avanza en una caja negra. El mandante llama dos veces por semana. La Ley 21.718 fija 30 días hábiles, pero nadie lo hace cumplir.",
  },
  {
    step: "03",
    title: "Observaciones respondidas desde cero",
    description:
      "Cada ronda de la DOM se redacta manualmente. Sin historial de qué se dijo, cuándo y cómo respondió la DOM, el ciclo se repite sin aprender.",
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
      "Chat OGUC · 20 consultas/mes",
      "Herramientas IA (predictor, checklist, timeline)",
      "Gestión de observaciones y comunicaciones",
      "Toolkit Ley 21.718 con alertas",
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
      "IA ilimitada (9 herramientas sin límite)",
      "Inteligencia DOM por municipio",
      "Portal del mandante con link único",
      "Export ZIP expediente con naming DOM",
      "WhatsApp automático a clientes",
      "CRM de prospectos con pipeline",
    ],
    cta: "Empezar con Pro",
  },
  {
    nombre: "Estudio",
    precioMensual: 149990,
    precioAnual: 124490,
    features: [
      "Todo lo de Pro +",
      "Hasta 5 usuarios en el workspace",
      "Invitaciones con acceso personalizado",
      "Analytics y reportes avanzados",
      "Acceso API",
      "Soporte prioritario SLA 4h",
    ],
    cta: "Empezar con Estudio",
  },
  {
    nombre: "Enterprise",
    precioMensual: 349990,
    precioAnual: 290400,
    features: [
      "Todo lo de Estudio +",
      "Módulo Cadenas Comerciales",
      "Jerarquía Cadena → Centro → Local",
      "Portal por locatario con token único",
      "Importación CSV de locales (bulk)",
      "Dashboard de cobertura de permisos",
      "Hasta 20 usuarios en el workspace",
      "Reportes ejecutivos PDF por cadena",
      "Soporte dedicado SLA 2h",
    ],
    cta: "Contactar ventas",
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
          <span className="size-1.5 rounded-full bg-[#E9C46A] animate-pulse" />
          MVP en producción · Ley 21.718 · OGUC · 346 municipios
        </span>

        <h1 className="mx-auto mt-6 max-w-4xl text-5xl font-semibold leading-[1.05] tracking-tight text-[#1A3328] md:text-7xl">
          El copiloto{" "}
          <span className="italic text-[#2D6A4F]">IA</span>{" "}
          del arquitecto chileno
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg text-[#1A3328]/70 md:text-xl">
          Prepara, predice, responde y acelera. La capa inteligente entre el
          arquitecto y la burocracia DOM — de principio a fin.
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
              Todo el ciclo DOM en una sola plataforma
            </h2>
            <p className="mt-3 text-[#1A3328]/65">
              Desde el primer prospecto hasta la recepción definitiva — con IA en cada paso.
            </p>
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
      {/* Competencia                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-[#1A3328] md:text-4xl">
            Somos el único enfocado en el arquitecto
          </h2>
          <p className="mt-3 text-[#1A3328]/65">
            REVI ayuda a la DOM a revisar. PermisoHub ayuda al arquitecto a triunfar.
          </p>
        </div>

        <div className="mt-12 overflow-x-auto rounded-2xl border border-[#1A3328]/10 bg-white">
          <table className="w-full min-w-[600px] text-sm">
            <thead>
              <tr className="border-b border-[#1A3328]/8">
                <th className="px-6 py-4 text-left font-semibold text-[#1A3328]">Solución</th>
                <th className="px-4 py-4 text-center font-medium text-[#1A3328]/70">Para arquitectos</th>
                <th className="px-4 py-4 text-center font-medium text-[#1A3328]/70">IA integrada</th>
                <th className="px-4 py-4 text-center font-medium text-[#1A3328]/70">Cobertura nacional</th>
                <th className="px-4 py-4 text-center font-medium text-[#1A3328]/70">Modelo SaaS</th>
                <th className="px-4 py-4 text-center font-medium text-[#1A3328]/70">Automatización</th>
              </tr>
            </thead>
            <tbody>
              {COMPETENCIA.map((row) => (
                <tr
                  key={row.solucion}
                  className={`border-b border-[#1A3328]/8 last:border-0 ${
                    row.destacado ? "bg-[#1A3328]" : ""
                  }`}
                >
                  <td className={`px-6 py-4 font-semibold ${row.destacado ? "text-[#E9C46A]" : "text-[#1A3328]"}`}>
                    {row.solucion}
                  </td>
                  {[row.para_arq, row.ia, row.nacional, row.saas, row.auto].map((val, i) => (
                    <td key={i} className="px-4 py-4 text-center">
                      {val ? (
                        <CheckCircle2 className={`mx-auto size-5 ${row.destacado ? "text-[#E9C46A]" : "text-[#2D6A4F]"}`} />
                      ) : (
                        <X className="mx-auto size-5 text-[#1A3328]/25" />
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-center text-xs text-[#1A3328]/50">
          REVI cubre solo 12 de 346 municipios (3.5%) y sirve a los funcionarios — no al arquitecto.
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Oportunidad                                                        */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-[#1A3328] py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-[#E9C46A]/30 bg-[#E9C46A]/10 px-4 py-1.5 text-xs font-medium text-[#E9C46A]">
              <Sparkles className="size-3.5" />
              Timing perfecto
            </span>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-[#F9F7F3] md:text-4xl">
              Una ventana de 2–3 años
            </h2>
            <p className="mt-3 text-[#F9F7F3]/60">
              Cuatro fuerzas convergentes que crean una oportunidad única ahora.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2">
            {OPORTUNIDAD.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.titulo} className="rounded-2xl border border-[#F9F7F3]/10 bg-[#F9F7F3]/5 p-7">
                  <div className="flex size-10 items-center justify-center rounded-xl bg-[#E9C46A]/15">
                    <Icon className="size-5 text-[#E9C46A]" />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-[#F9F7F3]">{item.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#F9F7F3]/60">{item.descripcion}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Tracción                                                           */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-[#1A3328] md:text-4xl">
            MVP en producción, listo para escalar
          </h2>
          <p className="mt-3 text-[#1A3328]/65">
            Construido por una arquitecta que vivió el problema desde adentro.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-4xl grid-cols-2 gap-px overflow-hidden rounded-2xl bg-[#1A3328]/10 md:grid-cols-4">
          {TRACTION.map((item) => (
            <div key={item.label} className="bg-[#F9F7F3] px-6 py-8 text-center">
              <p className="text-3xl font-semibold tracking-tight text-[#1A3328]">{item.value}</p>
              <p className="mt-2 text-xs leading-relaxed text-[#1A3328]/60">{item.label}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 flex justify-center">
          <div className="max-w-2xl rounded-2xl border border-[#2D6A4F]/20 bg-white p-8 text-center">
            <p className="text-base leading-relaxed text-[#1A3328]/80">
              "Arquitecta con experiencia directa en tramitación DOM. Construí PermisoHub desde el dolor propio:
              conozco cada cuello de botella del proceso porque lo viví."
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <div className="flex size-9 items-center justify-center rounded-full bg-[#1A3328] text-sm font-semibold text-[#E9C46A]">
                EP
              </div>
              <div className="text-left">
                <p className="text-sm font-semibold text-[#1A3328]">Estefanía Parada</p>
                <p className="text-xs text-[#1A3328]/55">Fundadora · Arquitecta</p>
              </div>
            </div>
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

          <div className="mt-12 grid grid-cols-1 gap-6 lg:grid-cols-2 xl:grid-cols-4">
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
                El OS del arquitecto chileno. Proyectos, clientes, IA y
                permisos DOM en un solo lugar.
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
                  <li>
                    <Link
                      href="/docs"
                      className="transition-colors hover:text-[#E9C46A]"
                    >
                      Cómo funciona
                    </Link>
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
