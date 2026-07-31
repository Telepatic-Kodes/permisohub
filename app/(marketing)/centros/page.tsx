import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Building2,
  Check,
  FileStack,
  Landmark,
  LayoutDashboard,
  MapPin,
  Scale,
  ShieldCheck,
  TrendingUp,
  X,
} from "lucide-react";

export const metadata: Metadata = {
  title: "PermisoHub para Centros Comerciales — Control de permisos por activo",
  description:
    "Control operacional de permisos DOM, patentes y habilitaciones para carteras de malls, power centers y strip centers en Chile.",
  openGraph: {
    title: "PermisoHub para Centros Comerciales",
    description:
      "Visibilidad ejecutiva y control técnico para cada habilitación de su cartera comercial.",
    type: "website",
    locale: "es_CL",
  },
};

type EstadoActivo = "operativo" | "tramite" | "riesgo" | "vacante";

const ACTIVOS = [
  {
    centro: "Centro Norte",
    comuna: "Huechuraba",
    locales: 42,
    tramite: 4,
    riesgo: 1,
    estado: "operativo" as EstadoActivo,
  },
  {
    centro: "Plaza Oriente",
    comuna: "La Reina",
    locales: 28,
    tramite: 3,
    riesgo: 0,
    estado: "operativo" as EstadoActivo,
  },
  {
    centro: "Parque Sur",
    comuna: "San Bernardo",
    locales: 36,
    tramite: 5,
    riesgo: 2,
    estado: "riesgo" as EstadoActivo,
  },
  {
    centro: "Paseo Costanera",
    comuna: "Viña del Mar",
    locales: 24,
    tramite: 2,
    riesgo: 0,
    estado: "tramite" as EstadoActivo,
  },
];

const CIFRAS = [
  {
    valor: "815 días",
    label:
      "promedio de tramitación de permisos municipales en la RM (2023); la DOM explica el 73,7% del plazo",
    nota: 1,
  },
  {
    valor: "3 años",
    label:
      "declaró Walmart Chile que demora la apertura de una tienda, apuntando a la permisología",
    nota: 2,
  },
  {
    valor: "277",
    label:
      "activos comerciales agrupa la Cámara de Centros Comerciales en Chile",
    nota: 3,
  },
  {
    valor: "13+",
    label:
      "comunas —y criterios DOM distintos— cubre el mayor administrador de malls del país",
    nota: 4,
  },
];

const RIESGOS = [
  {
    numero: "01",
    titulo: "Vacancia que se extiende",
    detalle:
      "La fecha de apertura depende de expedientes distribuidos entre locatarios, arquitectos, municipios y estudios externos.",
  },
  {
    numero: "02",
    titulo: "Riesgo regulatorio fragmentado",
    detalle:
      "Patentes, recepciones y observaciones se controlan activo por activo, sin una lectura consolidada para la gerencia.",
  },
  {
    numero: "03",
    titulo: "Conocimiento que no escala",
    detalle:
      "El criterio de cada DOM queda en correos, planillas y en la experiencia de personas clave del equipo técnico.",
  },
];

const CAPACIDADES = [
  {
    icon: LayoutDashboard,
    titulo: "Control de cartera",
    detalle:
      "Estructura operador → centro → local, con un expediente vivo para cada habilitación, patente y recepción.",
  },
  {
    icon: ShieldCheck,
    titulo: "Riesgo y cumplimiento",
    detalle:
      "Priorización de patentes vencidas, recepciones pendientes y observaciones DOM según exposición operacional.",
  },
  {
    icon: TrendingUp,
    titulo: "Forecast de costos y plazos",
    detalle:
      "Proyección de derechos municipales por tipo de obra y seguimiento de plazos legales por expediente.",
  },
  {
    icon: Landmark,
    titulo: "Inteligencia municipal",
    detalle:
      "Criterios, antecedentes y observaciones recurrentes de cada municipio donde opera la cartera.",
  },
  {
    icon: MapPin,
    titulo: "Zonificación por dirección",
    detalle:
      "Usos permitidos, restricciones y compatibilidad de giro con cita a la fuente del instrumento territorial.",
  },
  {
    icon: Building2,
    titulo: "Gobierno del fit-out",
    detalle:
      "Checklist por comuna, responsables, documentos y trazabilidad para cada cambio de locatario.",
  },
];

const FLUJO = [
  {
    numero: "01",
    titulo: "Levantamiento de cartera",
    detalle:
      "Consolidamos centros, locales, comunas y el estado documental existente. La implementación parte desde su realidad operacional.",
  },
  {
    numero: "02",
    titulo: "Estandarización del expediente",
    detalle:
      "Cada habilitación se gestiona con la misma estructura de control, adaptada al trámite y a la DOM correspondiente.",
  },
  {
    numero: "03",
    titulo: "Visibilidad por nivel de decisión",
    detalle:
      "Gerencia revisa riesgo y fechas de apertura; arquitectura controla observaciones; operaciones mantiene continuidad.",
  },
];

const COMPARACION = [
  {
    solucion: "PermisoHub Centros",
    permisos: true,
    portfolio: true,
    municipal: true,
    fitout: true,
    destacado: true,
  },
  {
    solucion: "Property management (Yardi, MRI, SAP RE)",
    permisos: false,
    portfolio: true,
    municipal: false,
    fitout: false,
  },
  {
    solucion: "Revi — plataforma para la DOM",
    permisos: true,
    portfolio: false,
    municipal: true,
    fitout: false,
  },
  {
    solucion: "Planillas + asesoría externa",
    permisos: true,
    portfolio: false,
    municipal: false,
    fitout: true,
  },
];

const FUENTES = [
  {
    n: 1,
    texto:
      "Observatorio de Plazos ADI + TocToc (927 expedientes, 2019–2023), vía Diario Financiero / Cushman & Wakefield Chile, 2024. Corresponde a permisos de edificación en la RM y se usa como evidencia del problema estructural de plazos DOM, no como plazo típico de una habilitación de local.",
  },
  {
    n: 2,
    texto:
      "Diario Financiero: “Walmart apunta a rol de la autoridad en demora para abrir nuevos locales en Chile”.",
  },
  {
    n: 3,
    texto:
      "Cámara Chilena de Centros Comerciales: 53 malls, 76 power centers, 70 strip centers, 68 stand-alone y 10 outlets.",
  },
  {
    n: 4,
    texto:
      "Mallplaza: 17 centros y presencia en 13+ comunas de Chile, según información pública revisada en 2026.",
  },
];

const MAILTO_DEMO =
  "mailto:contacto@permisohub.cl?subject=Reunión%20ejecutiva%20—%20PermisoHub%20Centros&body=Hola%2C%20quisiera%20evaluar%20PermisoHub%20para%20nuestra%20cartera%20de%20activos%20comerciales.%0A%0AOperador%3A%20%0AN%C2%B0%20de%20centros%3A%20%0AComunas%20donde%20operamos%3A%20";

const estadoStyles: Record<
  EstadoActivo,
  { label: string; dot: string; text: string }
> = {
  operativo: {
    label: "Controlado",
    dot: "bg-[#4f6b5f]",
    text: "text-[#4f6b5f]",
  },
  tramite: {
    label: "En curso",
    dot: "bg-[#b77943]",
    text: "text-[#8d552f]",
  },
  riesgo: {
    label: "Atención",
    dot: "bg-[#a64b3c]",
    text: "text-[#923f32]",
  },
  vacante: {
    label: "Vacante",
    dot: "bg-[#8b8b83]",
    text: "text-[#6b6b64]",
  },
};

function ComparisonMark({ ok }: { ok: boolean }) {
  return ok ? (
    <Check className="mx-auto size-4 text-[#315448]" aria-label="Sí" />
  ) : (
    <X className="mx-auto size-4 text-[#b7b4aa]" aria-label="No" />
  );
}

export default function CentrosComercialesPage() {
  return (
    <div className="min-h-screen bg-[#f2f0e9] font-sans text-[#202825]">
      <header className="sticky top-0 z-50 border-b border-[#202825]/15 bg-[#f2f0e9]/95 backdrop-blur-sm">
        <nav className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="font-technical text-[19px] font-semibold tracking-[-0.02em]">
              PermisoHub
            </span>
            <span className="hidden h-4 w-px bg-[#202825]/25 sm:block" />
            <span className="hidden text-[10px] font-semibold uppercase tracking-[0.18em] text-[#202825]/55 sm:block">
              Activos comerciales
            </span>
          </Link>

          <div className="hidden items-center gap-7 text-[12px] font-medium text-[#202825]/65 lg:flex">
            <a href="#desafio" className="hover:text-[#202825]">
              El desafío
            </a>
            <a href="#plataforma" className="hover:text-[#202825]">
              La plataforma
            </a>
            <a href="#implementacion" className="hover:text-[#202825]">
              Implementación
            </a>
            <a href="#comparacion" className="hover:text-[#202825]">
              Comparación
            </a>
          </div>

          <a
            href={MAILTO_DEMO}
            className="inline-flex items-center gap-2 border border-[#202825] bg-[#202825] px-4 py-2.5 text-[12px] font-semibold text-[#f6f3eb] transition-colors hover:bg-[#315448]"
          >
            Solicitar reunión
            <ArrowRight className="size-3.5" />
          </a>
        </nav>
      </header>

      <main>
        <section className="border-b border-[#202825]/15">
          <div className="mx-auto grid max-w-[1240px] lg:grid-cols-[1.04fr_0.96fr]">
            <div className="flex min-h-[610px] flex-col justify-between px-5 py-14 sm:px-8 sm:py-20 lg:border-r lg:border-[#202825]/15 lg:py-24">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[#8d552f]">
                  Permisología para real estate comercial
                </p>
                <h1 className="mt-7 max-w-3xl font-technical text-[clamp(3.25rem,6vw,5.8rem)] font-medium leading-[0.94] tracking-[-0.055em]">
                  Control operacional para cada habilitación de su cartera.
                </h1>
                <p className="mt-8 max-w-xl text-[18px] leading-8 text-[#202825]/68">
                  Una plataforma para que gerencias de arquitectura, desarrollo y
                  operaciones administren permisos DOM, patentes y fechas de apertura
                  a escala de portfolio.
                </p>
                <div className="mt-9 flex flex-wrap items-center gap-5">
                  <a
                    href={MAILTO_DEMO}
                    className="group inline-flex items-center gap-3 bg-[#315448] px-6 py-3.5 text-sm font-semibold text-white transition-colors hover:bg-[#243f36]"
                  >
                    Evaluar nuestra cartera
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </a>
                  <a
                    href="#plataforma"
                    className="border-b border-[#202825]/40 pb-1 text-sm font-medium text-[#202825]/70 hover:text-[#202825]"
                  >
                    Conocer la plataforma
                  </a>
                </div>
              </div>

              <div className="mt-16 grid max-w-xl grid-cols-3 border-t border-[#202825]/20 pt-5">
                {["Arquitectura", "Desarrollo", "Operaciones"].map((area) => (
                  <div
                    key={area}
                    className="border-l border-[#202825]/15 pl-3 first:border-l-0 first:pl-0 sm:pl-5"
                  >
                    <p className="text-[9px] uppercase tracking-[0.16em] text-[#202825]/42">
                      Información para
                    </p>
                    <p className="mt-1 text-xs font-semibold">{area}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#273c35] px-5 py-12 text-[#f4f1e8] sm:px-8 lg:px-10 lg:py-16">
              <div className="flex items-start justify-between border-b border-white/20 pb-6">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/45">
                    Resumen ejecutivo
                  </p>
                  <h2 className="mt-2 font-technical text-2xl font-medium tracking-[-0.03em]">
                    Estado de cartera
                  </h2>
                </div>
                <p className="num text-[10px] uppercase tracking-[0.12em] text-white/45">
                  Corte 30.07.26
                </p>
              </div>

              <div className="grid grid-cols-3 border-b border-white/20">
                {[
                  { label: "Activos", value: "04" },
                  { label: "Locales", value: "130" },
                  { label: "En riesgo", value: "03" },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="border-r border-white/20 py-7 pr-4 last:border-r-0 last:pl-5"
                  >
                    <p className="num text-3xl font-medium tracking-[-0.04em]">
                      {item.value}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-white/45">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-8">
                <div className="grid grid-cols-[1fr_60px_56px] border-b border-white/25 pb-3 text-[9px] font-semibold uppercase tracking-[0.14em] text-white/40 sm:grid-cols-[1fr_70px_64px]">
                  <span>Activo / comuna</span>
                  <span className="text-right">Trámites</span>
                  <span className="text-right">Riesgo</span>
                </div>
                <div>
                  {ACTIVOS.map((activo) => {
                    const state = estadoStyles[activo.estado];
                    return (
                      <div
                        key={activo.centro}
                        className="grid grid-cols-[1fr_60px_56px] items-center border-b border-white/15 py-4 sm:grid-cols-[1fr_70px_64px]"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`size-1.5 ${state.dot}`} />
                            <p className="text-sm font-medium">{activo.centro}</p>
                          </div>
                          <p className="mt-1 pl-3.5 text-[10px] uppercase tracking-[0.1em] text-white/40">
                            {activo.comuna} · {activo.locales} locales
                          </p>
                        </div>
                        <p className="num text-right text-sm text-white/75">
                          {String(activo.tramite).padStart(2, "0")}
                        </p>
                        <p
                          className={`num text-right text-sm ${
                            activo.riesgo > 0 ? "text-[#df9d83]" : "text-white/40"
                          }`}
                        >
                          {String(activo.riesgo).padStart(2, "0")}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="mt-8 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-white/20 pt-5 text-[10px] uppercase tracking-[0.1em] text-white/55 sm:grid-cols-4">
                {[
                  ["#4f6b5f", "Controlado"],
                  ["#b77943", "En curso"],
                  ["#a64b3c", "Atención"],
                  ["#8b8b83", "Vacante"],
                ].map(([color, label]) => (
                  <span key={label} className="flex items-center gap-2">
                    <span
                      className="size-1.5"
                      style={{ backgroundColor: color }}
                    />
                    {label}
                  </span>
                ))}
              </div>

              <p className="mt-9 border-l border-[#c18055] pl-4 text-xs leading-5 text-white/48">
                Visualización referencial del módulo de control de cartera. Los datos
                de cada operador permanecen segregados por organización.
              </p>
            </div>
          </div>
        </section>

        <section className="border-b border-[#202825]/15 bg-[#e5e1d7]">
          <div className="mx-auto grid max-w-[1240px] sm:grid-cols-2 lg:grid-cols-4">
            {CIFRAS.map((cifra) => (
              <div
                key={cifra.nota}
                className="border-b border-[#202825]/15 px-5 py-9 sm:px-8 lg:border-b-0 lg:border-r lg:last:border-r-0"
              >
                <p className="num text-3xl font-medium tracking-[-0.04em]">
                  {cifra.valor}
                </p>
                <p className="mt-3 text-xs leading-5 text-[#202825]/62">
                  {cifra.label}
                  <sup className="ml-1">
                    <a href="#fuentes" className="text-[#8d552f]">
                      [{cifra.nota}]
                    </a>
                  </sup>
                </p>
              </div>
            ))}
          </div>
        </section>

        <section id="desafio" className="border-b border-[#202825]/15">
          <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 lg:py-28">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8d552f]">
                  El desafío
                </p>
                <h2 className="mt-5 font-technical text-4xl font-medium leading-[1.02] tracking-[-0.045em] sm:text-5xl">
                  La permisología afecta el desempeño del activo.
                </h2>
                <p className="mt-6 max-w-md text-base leading-7 text-[#202825]/65">
                  Cada rotación reactiva un circuito entre el operador, la marca, su
                  arquitecto y una DOM distinta. Sin gobierno de datos, la gerencia
                  recibe el problema cuando la apertura ya está comprometida.
                </p>
              </div>

              <div className="border-t border-[#202825]/25">
                {RIESGOS.map((riesgo) => (
                  <article
                    key={riesgo.numero}
                    className="grid gap-5 border-b border-[#202825]/20 py-7 sm:grid-cols-[72px_0.8fr_1.2fr] sm:items-start"
                  >
                    <p className="num text-xs text-[#8d552f]">{riesgo.numero}</p>
                    <h3 className="font-technical text-lg font-semibold tracking-[-0.02em]">
                      {riesgo.titulo}
                    </h3>
                    <p className="text-sm leading-6 text-[#202825]/62">
                      {riesgo.detalle}
                    </p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="plataforma" className="bg-[#faf8f2]">
          <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 lg:py-28">
            <div className="flex flex-col justify-between gap-8 border-b border-[#202825]/25 pb-10 md:flex-row md:items-end">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8d552f]">
                  Plataforma de control
                </p>
                <h2 className="mt-5 max-w-2xl font-technical text-4xl font-medium leading-[1.03] tracking-[-0.045em] sm:text-5xl">
                  Una capa operacional entre el activo y el municipio.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-[#202825]/62">
                PermisoHub conecta la visión ejecutiva de la cartera con el detalle
                técnico de cada expediente, sin reemplazar los sistemas de property
                management existentes.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3">
              {CAPACIDADES.map((capacidad, index) => (
                <article
                  key={capacidad.titulo}
                  className={`min-h-[250px] border-b border-[#202825]/18 py-9 md:px-8 ${
                    index % 2 === 0 ? "md:border-r" : ""
                  } ${
                    index % 3 !== 2 ? "lg:border-r" : "lg:border-r-0"
                  } ${index % 2 !== 0 ? "md:border-r-0" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <capacidad.icon
                      className="size-5 text-[#315448]"
                      strokeWidth={1.5}
                    />
                    <span className="num text-[10px] text-[#202825]/35">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <h3 className="mt-10 font-technical text-xl font-semibold tracking-[-0.025em]">
                    {capacidad.titulo}
                  </h3>
                  <p className="mt-3 max-w-sm text-sm leading-6 text-[#202825]/60">
                    {capacidad.detalle}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="implementacion"
          className="border-y border-[#202825]/15 bg-[#d9d4c8]"
        >
          <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 lg:py-24">
            <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-24">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#7a492d]">
                  Implementación
                </p>
                <h2 className="mt-5 font-technical text-4xl font-medium leading-[1.03] tracking-[-0.045em]">
                  Partimos desde su cartera real.
                </h2>
                <p className="mt-5 max-w-sm text-sm leading-6 text-[#202825]/62">
                  El objetivo no es sumar otra herramienta aislada, sino establecer
                  una fuente de control compartida por los equipos que participan en
                  cada apertura.
                </p>
                <a
                  href={MAILTO_DEMO}
                  className="group mt-8 inline-flex items-center gap-3 border-b border-[#202825]/50 pb-1 text-sm font-semibold"
                >
                  Revisar alcance de implementación
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </a>
              </div>

              <ol className="border-t border-[#202825]/30">
                {FLUJO.map((paso) => (
                  <li
                    key={paso.numero}
                    className="grid gap-4 border-b border-[#202825]/25 py-7 sm:grid-cols-[64px_0.8fr_1.2fr]"
                  >
                    <span className="num text-xs text-[#7a492d]">
                      {paso.numero}
                    </span>
                    <h3 className="font-technical text-lg font-semibold tracking-[-0.02em]">
                      {paso.titulo}
                    </h3>
                    <p className="text-sm leading-6 text-[#202825]/62">
                      {paso.detalle}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        <section id="comparacion" className="bg-[#faf8f2]">
          <div className="mx-auto max-w-[1240px] px-5 py-20 sm:px-8 lg:py-28">
            <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-24">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#8d552f]">
                  Encaje en el ecosistema
                </p>
                <h2 className="mt-5 font-technical text-4xl font-medium leading-[1.03] tracking-[-0.045em]">
                  Diseñado para el lado privado de la tramitación.
                </h2>
              </div>
              <p className="max-w-lg self-end text-sm leading-6 text-[#202825]/62">
                Las suites inmobiliarias administran contratos y activos. Las
                plataformas municipales sirven a la DOM. PermisoHub organiza el
                trabajo del operador que debe abrir y mantener locales en múltiples
                comunas.
              </p>
            </div>

            <div className="mt-12 overflow-x-auto border-t border-[#202825]/30">
              <table className="w-full min-w-[760px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-[#202825]/25">
                    <th className="py-4 pr-6 text-left text-[9px] font-semibold uppercase tracking-[0.16em] text-[#202825]/45">
                      Solución
                    </th>
                    {[
                      "Permisos DOM",
                      "Escala portfolio",
                      "Inteligencia municipal",
                      "Ciclo fit-out",
                    ].map((label) => (
                      <th
                        key={label}
                        className="px-4 py-4 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-[#202825]/45"
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARACION.map((item) => (
                    <tr
                      key={item.solucion}
                      className={`border-b border-[#202825]/18 ${
                        item.destacado ? "bg-[#315448]/[0.07]" : ""
                      }`}
                    >
                      <td
                        className={`py-4 pr-6 ${
                          item.destacado ? "font-semibold text-[#315448]" : ""
                        }`}
                      >
                        {item.solucion}
                      </td>
                      <td className="px-4 py-4">
                        <ComparisonMark ok={item.permisos} />
                      </td>
                      <td className="px-4 py-4">
                        <ComparisonMark ok={item.portfolio} />
                      </td>
                      <td className="px-4 py-4">
                        <ComparisonMark ok={item.municipal} />
                      </td>
                      <td className="px-4 py-4">
                        <ComparisonMark ok={item.fitout} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-[10px] leading-4 text-[#202825]/42">
              Comparación basada en capacidades documentadas públicamente y en
              investigación de mercado propia, julio de 2026.
            </p>
          </div>
        </section>

        <section className="bg-[#273c35] text-[#f4f1e8]">
          <div className="mx-auto grid max-w-[1240px] lg:grid-cols-[1.1fr_0.9fr]">
            <div className="border-b border-white/15 px-5 py-16 sm:px-8 lg:border-b-0 lg:border-r lg:py-24">
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#d29a72]">
                Conversación ejecutiva
              </p>
              <h2 className="mt-5 max-w-2xl font-technical text-4xl font-medium leading-[1.02] tracking-[-0.045em] sm:text-5xl">
                Revise el riesgo de permisos sobre una cartera real.
              </h2>
            </div>
            <div className="flex flex-col justify-between px-5 py-16 sm:px-8 lg:px-12 lg:py-24">
              <p className="max-w-md text-base leading-7 text-white/62">
                En una primera reunión revisamos la estructura de sus activos,
                comunas y flujos de habilitación para definir un piloto con alcance
                concreto.
              </p>
              <div className="mt-10">
                <a
                  href={MAILTO_DEMO}
                  className="group inline-flex items-center gap-3 bg-[#f2f0e9] px-6 py-3.5 text-sm font-semibold text-[#202825] hover:bg-white"
                >
                  Solicitar reunión de evaluación
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </a>
                <p className="mt-5 text-[10px] uppercase tracking-[0.15em] text-white/38">
                  contacto@permisohub.cl
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="fuentes" className="border-b border-[#202825]/15">
          <div className="mx-auto max-w-[1240px] px-5 py-12 sm:px-8">
            <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
              <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#202825]/50">
                <FileStack className="size-3.5" />
                Fuentes y alcance
              </p>
              <div>
                <ol className="space-y-2.5">
                  {FUENTES.map((fuente) => (
                    <li
                      key={fuente.n}
                      className="grid grid-cols-[28px_1fr] text-[11px] leading-5 text-[#202825]/52"
                    >
                      <span className="num">[{fuente.n}]</span>
                      <span>{fuente.texto}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-5 flex items-start gap-2 border-t border-[#202825]/15 pt-5 text-[11px] leading-5 text-[#202825]/45">
                  <Scale className="mt-0.5 size-3.5 shrink-0" />
                  La información normativa de la plataforma es de carácter
                  informativo y no reemplaza certificados ni pronunciamientos
                  oficiales de cada DOM.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-6 px-5 py-8 text-xs text-[#202825]/50 sm:flex-row sm:items-center sm:px-8">
          <Link
            href="/"
            className="font-technical text-base font-semibold text-[#202825]"
          >
            PermisoHub
          </Link>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href="/">Para arquitectos</Link>
            <Link href="/terminos-y-condiciones">Términos</Link>
            <Link href="/politica-de-privacidad">Privacidad</Link>
            <a href="mailto:contacto@permisohub.cl">Contacto</a>
          </div>
          <p className="text-[10px] uppercase tracking-[0.12em]">
            Gestión de permisos municipales
          </p>
        </div>
      </footer>
    </div>
  );
}
