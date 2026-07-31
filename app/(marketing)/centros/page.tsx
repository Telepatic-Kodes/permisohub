import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileStack,
  Landmark,
  LayoutGrid,
  MapPin,
  Scale,
  TrendingUp,
  X,
} from "lucide-react";

// ---------------------------------------------------------------------------
// PermisoHub para Centros Comerciales — landing B2B enterprise.
//
// Toda cifra citada en esta página tiene fuente verificada (ver FUENTES al
// final y notas [n]). Regla de la casa: cero estadísticas inventadas — misma
// disciplina que la auditoría de fidelidad de datos 2026-07-30.
// ---------------------------------------------------------------------------

export const metadata: Metadata = {
  title: "PermisoHub para Centros Comerciales — Permisos DOM a escala de portfolio",
  description:
    "Habilitaciones, patentes y permisos DOM de cada local de tu cartera, en cada comuna, en una sola plataforma. Riesgo de portfolio, forecast de costos y alertas Ley 21.718 para operadores de malls, power centers y strip centers.",
  openGraph: {
    title: "PermisoHub para Centros Comerciales",
    description:
      "El estado de cada habilitación, en cada centro, en cada comuna. Menos días de vacancia por permisos.",
    type: "website",
    locale: "es_CL",
  },
};

// ---------------------------------------------------------------------------
// Datos de la lámina hero — plano esquemático de un piso de mall.
// Estados: alDia (verde) · tramite (ámbar) · observado (rojo) · vacante (gris)
// ---------------------------------------------------------------------------

type EstadoLocal = "alDia" | "tramite" | "observado" | "vacante";

const LOCALES_PLANO: {
  id: string;
  estado: EstadoLocal;
  detalle: string;
  span: string;
}[] = [
  { id: "L-01", estado: "alDia", detalle: "Patente al día", span: "col-span-2" },
  { id: "L-02", estado: "tramite", detalle: "Obra menor · día 12/30", span: "col-span-1" },
  { id: "L-03", estado: "alDia", detalle: "Recepción final ok", span: "col-span-1" },
  { id: "L-04", estado: "observado", detalle: "Acta DOM · 3 obs.", span: "col-span-2" },
  { id: "L-05", estado: "alDia", detalle: "Patente al día", span: "col-span-1" },
  { id: "L-06", estado: "vacante", detalle: "Fit-out por iniciar", span: "col-span-1" },
  { id: "L-07", estado: "tramite", detalle: "Patente en trámite", span: "col-span-1" },
  { id: "L-08", estado: "alDia", detalle: "Patente al día", span: "col-span-1" },
  { id: "L-09", estado: "alDia", detalle: "Patente al día", span: "col-span-2" },
  { id: "L-10", estado: "tramite", detalle: "Cambio de destino", span: "col-span-1" },
  { id: "L-11", estado: "alDia", detalle: "Patente al día", span: "col-span-1" },
  { id: "L-12", estado: "alDia", detalle: "Patente al día", span: "col-span-1" },
];

const ESTADO_STYLES: Record<EstadoLocal, { dot: string; box: string; label: string }> = {
  alDia: {
    dot: "bg-[#2D6A4F]",
    box: "border-[#2D6A4F]/40 bg-[#2D6A4F]/[0.07]",
    label: "text-[#2D6A4F]",
  },
  tramite: {
    dot: "bg-amber-500 animate-pulse",
    box: "border-amber-500/50 bg-amber-500/[0.08]",
    label: "text-amber-700",
  },
  observado: {
    dot: "bg-red-600 animate-pulse",
    box: "border-red-600/50 bg-red-600/[0.06]",
    label: "text-red-700",
  },
  vacante: {
    dot: "bg-[#1A3328]/30",
    box: "border-dashed border-[#1A3328]/25 bg-transparent",
    label: "text-[#1A3328]/50",
  },
};

// ---------------------------------------------------------------------------
// Cifras verificadas — cada una con su nota al pie [n]
// ---------------------------------------------------------------------------

const CIFRAS = [
  {
    valor: "815 días",
    label: "promedio de tramitación de permisos municipales en la RM (2023) — la DOM explica el 73,7% del plazo",
    nota: 1,
  },
  {
    valor: "3 años",
    label: "declaró Walmart Chile que demora abrir una tienda, apuntando a la permisología",
    nota: 2,
  },
  {
    valor: "277",
    label: "activos comerciales agrupa la Cámara de Centros Comerciales: malls, power centers, strip centers y outlets",
    nota: 3,
  },
  {
    valor: "13+",
    label: "comunas distintas — con 13+ DOM distintas — opera el mayor administrador de malls del país",
    nota: 4,
  },
];

// ---------------------------------------------------------------------------
// El ciclo que se repite en cada rotación de local
// ---------------------------------------------------------------------------

const CICLO_ROTACION = [
  { paso: "01", titulo: "Sale el locatario", detalle: "El local queda oscuro. Cada semana cerrado es renta y % de venta que no entra." },
  { paso: "02", titulo: "Entra la marca nueva", detalle: "Su arquitecto debe cumplir dos normas a la vez: el manual de habilitación de tu centro y la OGUC de esa comuna." },
  { paso: "03", titulo: "Expediente completo, otra vez", detalle: "Obra menor ante la DOM, patente comercial, a veces cambio de destino y recepción. Con los criterios propios de esa DOM." },
  { paso: "04", titulo: "Multiplicado por tu cartera", detalle: "Ahora repítelo en cada local que rota, en cada centro, en cada comuna donde operas. Hoy eso vive en planillas y en la cabeza de tu equipo técnico." },
];

// ---------------------------------------------------------------------------
// Features — SOLO capacidades reales del producto (módulo Cadenas Comerciales)
// ---------------------------------------------------------------------------

const FEATURES = [
  {
    icon: LayoutGrid,
    title: "Tu cartera completa: cadena → centro → local",
    description:
      "Cada centro con sus locales, cada local con su expediente vivo: permisos, patente, recepción, observaciones y documentos. El estado real de tu portfolio en una vista.",
  },
  {
    icon: AlertTriangle,
    title: "Análisis de riesgo de portfolio",
    description:
      "Qué locales tienen patente vencida, recepción pendiente u observaciones DOM sin responder — priorizados por riesgo de multa o clausura, antes de que fiscalicen.",
  },
  {
    icon: TrendingUp,
    title: "Forecast de costos de tramitación",
    description:
      "Proyección de derechos municipales y costos de habilitación de la cartera, calculada con la tabla del Art. 130 LGUC por tipo de obra — no estimaciones al voleo.",
  },
  {
    icon: BarChart3,
    title: "Benchmark entre centros",
    description:
      "Compara tus centros entre sí: tiempos de habilitación, observaciones frecuentes por DOM, locales en riesgo. Detecta qué comuna te está frenando la apertura.",
  },
  {
    icon: ClipboardList,
    title: "Onboarding de habilitación por local",
    description:
      "Flujo guiado para cada fit-out: checklist de documentos por municipio, seguimiento del expediente y del arquitecto del locatario, historial completo por local.",
  },
  {
    icon: CalendarClock,
    title: "Alertas y plazos Ley 21.718",
    description:
      "Countdown de días hábiles por expediente, alerta de vencimiento de patentes y de silencio administrativo. Tu equipo se entera antes, no después.",
  },
  {
    icon: MapPin,
    title: "Zonificación PRC por dirección",
    description:
      "Zona, usos permitidos y prohibidos de cada local, con cita a la fuente y verificación de compatibilidad del giro — clave en cambios de destino y marcas nuevas.",
  },
  {
    icon: Landmark,
    title: "Inteligencia por municipio",
    description:
      "Criterios, plazos estimados y observaciones frecuentes de cada DOM donde operas. La memoria institucional de tu equipo técnico, en una plataforma y no en una persona.",
  },
];

// ---------------------------------------------------------------------------
// Brecha competitiva — del research de mercado (jul 2026)
// ---------------------------------------------------------------------------

const COMPETENCIA = [
  {
    solucion: "PermisoHub Centros",
    permisos: true,
    portfolio: true,
    municipal: true,
    fitout: true,
    destacado: true,
  },
  { solucion: "Suites de property mgmt. (Yardi, MRI, SAP RE)", permisos: false, portfolio: true, municipal: false, fitout: false },
  { solucion: "Revi (CChC + CENIA) — sirve a la DOM", permisos: true, portfolio: false, municipal: true, fitout: false },
  { solucion: "Planillas + estudios externos", permisos: true, portfolio: false, municipal: false, fitout: true },
];

const PASOS = [
  {
    n: "1",
    titulo: "Carga tu cartera",
    detalle: "Centros, locales y su estado actual de permisos y patentes. Importamos contigo el punto de partida en el onboarding.",
  },
  {
    n: "2",
    titulo: "Cada local, un expediente vivo",
    detalle: "Cada rotación, obra menor o renovación de patente se gestiona con checklist por comuna, plazos legales y documentos en un solo lugar.",
  },
  {
    n: "3",
    titulo: "Tu equipo ve todo, siempre",
    detalle: "Gerencia ve el riesgo del portfolio y los días a apertura. Arquitectura ve cada expediente y sus observaciones. Nadie persigue el estado por mail.",
  },
];

const FUENTES = [
  {
    n: 1,
    texto:
      "Observatorio de Plazos ADI + TocToc (927 expedientes, 2019–2023), vía Diario Financiero / Cushman & Wakefield Chile, 2024. Mide permisos de edificación de proyectos inmobiliarios en la RM — se cita como evidencia del problema estructural de plazos DOM, no como plazo típico de una habilitación de local.",
  },
  {
    n: 2,
    texto:
      "Diario Financiero: “Walmart apunta a rol de la autoridad en demora para abrir nuevos locales en Chile” — declaración pública sobre apertura de tiendas nuevas.",
  },
  {
    n: 3,
    texto: "Cámara Chilena de Centros Comerciales, camaracentroscomerciales.cl (miembros: 53 malls, 76 power centers, 70 strip centers, 68 stand-alone, 10 outlets).",
  },
  {
    n: 4,
    texto:
      "Mallplaza: 17 centros y presencia en Las Condes, La Reina, Huechuraba, Estación Central, La Florida, Puente Alto, Cerrillos, San Bernardo y regiones (Diario Financiero, 2026).",
  },
];

// ---------------------------------------------------------------------------

const MAILTO_DEMO =
  "mailto:contacto@permisohub.cl?subject=Demo%20PermisoHub%20para%20Centros%20Comerciales&body=Hola%2C%20administro%20una%20cartera%20de%20centros%20comerciales%20y%20quiero%20agendar%20una%20demo.%0A%0ACadena%2Foperador%3A%20%0AN%C2%B0%20de%20centros%3A%20%0AComunas%20donde%20operan%3A%20";

function Check({ ok }: { ok: boolean }) {
  return ok ? (
    <CheckCircle2 className="mx-auto size-4 text-[#2D6A4F]" aria-label="Sí" />
  ) : (
    <X className="mx-auto size-4 text-[#1A3328]/25" aria-label="No" />
  );
}

export default function CentrosComercialesPage() {
  return (
    <div className="min-h-screen bg-[#F9F7F3] text-[#1A3328]">
      {/* Animaciones de entrada (CSS-only, server component) */}
      <style>{`
        @keyframes ph-rise {
          from { opacity: 0; transform: translateY(14px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .ph-rise { animation: ph-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both; }
        @media (prefers-reduced-motion: reduce) {
          .ph-rise { animation: none; }
          .animate-pulse { animation: none; }
        }
      `}</style>

      {/* Header — mismo lenguaje que la landing principal */}
      <header className="sticky top-0 z-50 border-b border-[#1A3328]/10 bg-[#F9F7F3]/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link
            href="/"
            className="flex items-center gap-1.5 text-xl font-semibold tracking-tight text-[#1A3328]"
          >
            PermisoHub
            <span className="size-2 rounded-full bg-[#2D6A4F]" />
            <span className="ml-2 hidden rounded-md border border-[#1A3328]/15 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.15em] text-[#1A3328]/60 sm:inline">
              Centros comerciales
            </span>
          </Link>

          <div className="hidden items-center gap-8 text-sm font-medium text-[#1A3328]/70 md:flex">
            <a href="#problema" className="transition-colors hover:text-[#1A3328]">
              El problema
            </a>
            <a href="#plataforma" className="transition-colors hover:text-[#1A3328]">
              Plataforma
            </a>
            <a href="#comparacion" className="transition-colors hover:text-[#1A3328]">
              Alternativas
            </a>
          </div>

          <a
            href={MAILTO_DEMO}
            className="rounded-lg bg-[#1A3328] px-4 py-2 text-sm font-medium text-[#F9F7F3] transition-colors hover:bg-[#2D6A4F]"
          >
            Agendar demo
          </a>
        </nav>
      </header>

      {/* ================= HERO ================= */}
      <section className="relative overflow-hidden">
        {/* Grilla de lámina técnica de fondo */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.35]"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(26,51,40,0.06) 1px, transparent 1px), linear-gradient(to bottom, rgba(26,51,40,0.06) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-6 pb-20 pt-16 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pt-24">
          {/* Copy */}
          <div className="ph-rise flex flex-col justify-center">
            <p className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-[#2D6A4F]/30 bg-[#2D6A4F]/[0.08] px-3 py-1 font-mono text-[11px] font-medium uppercase tracking-[0.18em] text-[#2D6A4F]">
              <Building2 className="size-3.5" />
              Para operadores de malls, power y strip centers
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-4xl font-semibold leading-[1.08] tracking-tight sm:text-5xl lg:text-[3.4rem]">
              Un local cerrado
              <br />
              no genera renta.
              <br />
              <span className="text-[#2D6A4F]">Los permisos no tienen por qué frenarlo.</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#1A3328]/75">
              Cada rotación de local es un expediente completo ante una DOM distinta:
              obra menor, patente, a veces cambio de destino. PermisoHub le da a tu
              equipo técnico el estado de <strong>cada habilitación, en cada centro,
              en cada comuna</strong> — con plazos legales, riesgo de multa y costos
              proyectados en una sola plataforma.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href={MAILTO_DEMO}
                className="group inline-flex items-center gap-2 rounded-lg bg-[#1A3328] px-6 py-3 text-base font-medium text-[#F9F7F3] transition-colors hover:bg-[#2D6A4F]"
              >
                Agendar una demo
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </a>
              <Link
                href="/"
                className="text-sm font-medium text-[#1A3328]/60 underline-offset-4 transition-colors hover:text-[#1A3328] hover:underline"
              >
                ¿Eres arquitecto independiente? →
              </Link>
            </div>
            <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.15em] text-[#1A3328]/45">
              Ley 21.718 · OGUC vigente · 346 comunas · zonificación PRC citada a fuente
            </p>
          </div>

          {/* Lámina: plano del piso con estados de permisos */}
          <div className="ph-rise" style={{ animationDelay: "0.15s" }}>
            <div className="rounded-xl border border-[#1A3328]/15 bg-white/70 p-4 shadow-[0_20px_60px_-24px_rgba(26,51,40,0.35)] backdrop-blur-sm">
              {/* Plano */}
              <div className="grid grid-cols-4 gap-1.5">
                {LOCALES_PLANO.slice(0, 6).map((l) => (
                  <PlanoLocal key={l.id} local={l} />
                ))}
              </div>
              {/* Pasillo central */}
              <div className="my-1.5 flex items-center gap-2 rounded-sm border border-[#1A3328]/10 bg-[#1A3328]/[0.03] px-3 py-2">
                <span className="h-px flex-1 border-t border-dashed border-[#1A3328]/25" />
                <span className="font-mono text-[9px] uppercase tracking-[0.3em] text-[#1A3328]/40">
                  Pasillo central
                </span>
                <span className="h-px flex-1 border-t border-dashed border-[#1A3328]/25" />
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {LOCALES_PLANO.slice(6).map((l) => (
                  <PlanoLocal key={l.id} local={l} />
                ))}
              </div>

              {/* Rótulo de lámina */}
              <div className="mt-4 grid grid-cols-[1fr_auto] items-stretch overflow-hidden rounded-md border border-[#1A3328]/20">
                <div className="border-r border-[#1A3328]/20 px-3 py-2">
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#1A3328]/45">
                    Lámina
                  </p>
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.08em]">
                    Portfolio · Nivel 1 · Estado de permisos
                  </p>
                </div>
                <div className="grid grid-cols-3 divide-x divide-[#1A3328]/20 text-center">
                  <div className="px-3 py-2">
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#1A3328]/45">Locales</p>
                    <p className="font-mono text-[11px] font-semibold">12</p>
                  </div>
                  <div className="px-3 py-2">
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#1A3328]/45">En trámite</p>
                    <p className="font-mono text-[11px] font-semibold text-amber-700">3</p>
                  </div>
                  <div className="px-3 py-2">
                    <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#1A3328]/45">En riesgo</p>
                    <p className="font-mono text-[11px] font-semibold text-red-700">1</p>
                  </div>
                </div>
              </div>

              {/* Leyenda */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1">
                <Leyenda color="bg-[#2D6A4F]" texto="Al día" />
                <Leyenda color="bg-amber-500" texto="En trámite" />
                <Leyenda color="bg-red-600" texto="Observado / en riesgo" />
                <Leyenda color="bg-[#1A3328]/30" texto="Vacante" />
              </div>
            </div>
            <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[0.18em] text-[#1A3328]/40">
              Vista ilustrativa del módulo de cartera
            </p>
          </div>
        </div>
      </section>

      {/* ================= CIFRAS ================= */}
      <section className="border-y border-[#1A3328]/10 bg-[#1A3328] text-[#F9F7F3]">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-12 sm:grid-cols-2 lg:grid-cols-4">
          {CIFRAS.map((c) => (
            <div key={c.nota}>
              <p className="font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight">
                {c.valor}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[#F9F7F3]/70">
                {c.label}
                <sup className="ml-0.5 font-mono text-[10px] text-[#F9F7F3]/50">
                  <a href="#fuentes" className="hover:text-[#F9F7F3]">[{c.nota}]</a>
                </sup>
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= EL PROBLEMA ================= */}
      <section id="problema" className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-2xl">
          <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-[#2D6A4F]">
            El ciclo que se repite
          </p>
          <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
            Cada rotación de local es, en la práctica, un proyecto DOM nuevo
          </h2>
          <p className="mt-4 text-lg leading-relaxed text-[#1A3328]/70">
            Y tu equipo lo coordina entre el arquitecto del locatario, el manual de
            habilitación de tu centro y el criterio particular de cada DOM. Sin una
            herramienta hecha para eso.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {CICLO_ROTACION.map((p) => (
            <div
              key={p.paso}
              className="relative rounded-xl border border-[#1A3328]/12 bg-white/60 p-6"
            >
              <p className="font-mono text-3xl font-semibold text-[#1A3328]/15">{p.paso}</p>
              <h3 className="mt-3 text-base font-semibold">{p.titulo}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[#1A3328]/65">{p.detalle}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ================= PLATAFORMA ================= */}
      <section id="plataforma" className="border-t border-[#1A3328]/10 bg-white/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-[#2D6A4F]">
              La plataforma
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
              El módulo de cartera comercial de PermisoHub
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-[#1A3328]/70">
              Construido sobre el mismo motor que usan los arquitectos que tramitan ante
              la DOM todos los días: normativa citada, plazos de la Ley 21.718 y la
              inteligencia municipal de cada comuna donde operas.
            </p>
          </div>

          <div className="mt-12 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.title}>
                <div className="flex size-10 items-center justify-center rounded-lg border border-[#2D6A4F]/25 bg-[#2D6A4F]/[0.08]">
                  <f.icon className="size-5 text-[#2D6A4F]" />
                </div>
                <h3 className="mt-4 text-[15px] font-semibold leading-snug">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-[#1A3328]/65">
                  {f.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CÓMO FUNCIONA ================= */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-[#2D6A4F]">
              Cómo funciona
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight">
              De planillas dispersas a un expediente vivo por local
            </h2>
            <a
              href={MAILTO_DEMO}
              className="group mt-8 inline-flex items-center gap-2 rounded-lg border border-[#1A3328]/20 px-5 py-2.5 text-sm font-medium transition-colors hover:bg-[#1A3328] hover:text-[#F9F7F3]"
            >
              Ver la plataforma con tu cartera
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
          </div>
          <ol className="space-y-6">
            {PASOS.map((p) => (
              <li key={p.n} className="flex gap-5 rounded-xl border border-[#1A3328]/12 bg-white/60 p-6">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#1A3328] font-mono text-sm font-semibold text-[#F9F7F3]">
                  {p.n}
                </span>
                <div>
                  <h3 className="text-base font-semibold">{p.titulo}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-[#1A3328]/65">{p.detalle}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ================= COMPARACIÓN ================= */}
      <section id="comparacion" className="border-t border-[#1A3328]/10 bg-white/50">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="max-w-2xl">
            <p className="font-mono text-xs font-medium uppercase tracking-[0.2em] text-[#2D6A4F]">
              Las alternativas de hoy
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
              Nadie cubre la permisología del lado del operador
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-[#1A3328]/70">
              Las suites de property management administran el arriendo, no la DOM.
              Revi acelera a los municipios, no a tu equipo. Y las planillas no escalan
              a decenas de comunas.
            </p>
          </div>

          <div className="mt-10 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[#1A3328]/15 text-left">
                  <th className="py-3 pr-4 font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#1A3328]/50">
                    Solución
                  </th>
                  <th className="px-3 py-3 text-center font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#1A3328]/50">
                    Permisos DOM
                  </th>
                  <th className="px-3 py-3 text-center font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#1A3328]/50">
                    Escala portfolio
                  </th>
                  <th className="px-3 py-3 text-center font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#1A3328]/50">
                    Intel. municipal
                  </th>
                  <th className="px-3 py-3 text-center font-mono text-[11px] font-medium uppercase tracking-[0.15em] text-[#1A3328]/50">
                    Ciclo fit-out
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPETENCIA.map((c) => (
                  <tr
                    key={c.solucion}
                    className={
                      c.destacado
                        ? "border-b border-[#1A3328]/10 bg-[#2D6A4F]/[0.07] font-medium"
                        : "border-b border-[#1A3328]/10"
                    }
                  >
                    <td className="py-3.5 pr-4">{c.solucion}</td>
                    <td className="px-3 py-3.5"><Check ok={c.permisos} /></td>
                    <td className="px-3 py-3.5"><Check ok={c.portfolio} /></td>
                    <td className="px-3 py-3.5"><Check ok={c.municipal} /></td>
                    <td className="px-3 py-3.5"><Check ok={c.fitout} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-4 font-mono text-[11px] leading-relaxed text-[#1A3328]/45">
            Basado en investigación de mercado propia (jul 2026): capacidades documentadas
            públicamente de cada alternativa en Chile.
          </p>
        </div>
      </section>

      {/* ================= CTA FINAL ================= */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="relative overflow-hidden rounded-2xl bg-[#1A3328] px-8 py-16 text-center text-[#F9F7F3] sm:px-16">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-20"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(249,247,243,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(249,247,243,0.12) 1px, transparent 1px)",
              backgroundSize: "32px 32px",
            }}
          />
          <div className="relative">
            <Bell className="mx-auto size-8 text-[#F9F7F3]/60" />
            <h2 className="mx-auto mt-5 max-w-2xl font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">
              Tu próximo local puede abrir a tiempo
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-lg leading-relaxed text-[#F9F7F3]/70">
              Agenda una demo con tu cartera real: cargamos contigo un centro y te
              mostramos el estado de sus permisos, patentes y riesgos en la primera sesión.
            </p>
            <a
              href={MAILTO_DEMO}
              className="group mt-8 inline-flex items-center gap-2 rounded-lg bg-[#F9F7F3] px-7 py-3.5 text-base font-semibold text-[#1A3328] transition-colors hover:bg-white"
            >
              Agendar demo enterprise
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
            </a>
            <p className="mt-5 font-mono text-[11px] uppercase tracking-[0.18em] text-[#F9F7F3]/45">
              contacto@permisohub.cl
            </p>
          </div>
        </div>
      </section>

      {/* ================= FUENTES ================= */}
      <section id="fuentes" className="border-t border-[#1A3328]/10">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <p className="flex items-center gap-2 font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-[#1A3328]/50">
            <FileStack className="size-3.5" />
            Fuentes de las cifras citadas
          </p>
          <ol className="mt-4 space-y-2">
            {FUENTES.map((f) => (
              <li key={f.n} className="flex gap-2 text-xs leading-relaxed text-[#1A3328]/55">
                <span className="font-mono text-[#1A3328]/40">[{f.n}]</span>
                <span>{f.texto}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-[#1A3328]/45">
            <Scale className="mt-0.5 size-3.5 shrink-0" />
            La información normativa de la plataforma es de carácter informativo y no
            reemplaza los certificados ni pronunciamientos oficiales de cada DOM.
          </p>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="border-t border-[#1A3328]/10 bg-white/40">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-[#1A3328]/55 sm:flex-row">
          <Link href="/" className="flex items-center gap-1.5 font-semibold text-[#1A3328]">
            PermisoHub
            <span className="size-1.5 rounded-full bg-[#2D6A4F]" />
          </Link>
          <div className="flex items-center gap-6">
            <Link href="/" className="transition-colors hover:text-[#1A3328]">
              Para arquitectos
            </Link>
            <Link href="/terminos-y-condiciones" className="transition-colors hover:text-[#1A3328]">
              Términos
            </Link>
            <Link href="/politica-de-privacidad" className="transition-colors hover:text-[#1A3328]">
              Privacidad
            </Link>
            <a href="mailto:contacto@permisohub.cl" className="transition-colors hover:text-[#1A3328]">
              Contacto
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PlanoLocal({
  local,
}: {
  local: { id: string; estado: EstadoLocal; detalle: string; span: string };
}) {
  const s = ESTADO_STYLES[local.estado];
  return (
    <div
      className={`${local.span} rounded-sm border px-2 py-2.5 transition-transform hover:-translate-y-0.5 ${s.box}`}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-[10px] font-semibold tracking-wide">{local.id}</span>
        <span className={`size-1.5 shrink-0 rounded-full ${s.dot}`} />
      </div>
      <p className={`mt-1 truncate font-mono text-[9px] leading-tight ${s.label}`}>
        {local.detalle}
      </p>
    </div>
  );
}

function Leyenda({ color, texto }: { color: string; texto: string }) {
  return (
    <span className="flex items-center gap-1.5 font-mono text-[10px] text-[#1A3328]/55">
      <span className={`size-1.5 rounded-full ${color}`} />
      {texto}
    </span>
  );
}
