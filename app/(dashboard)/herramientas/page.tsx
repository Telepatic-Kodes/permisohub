import Link from "next/link"
import {
  BookText,
  CalendarClock,
  ClipboardList,
  Compass,
  FileSearch,
  FileSignature,
  MailCheck,
  MessageSquare,
  PencilRuler,
  ShieldCheck,
  Stamp,
  Target,
  type LucideIcon,
} from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"
import { Num } from "@/components/arch/dato"
import { COPILOTO_PERSONA } from "@/lib/copiloto-persona"

interface Tool {
  label: string
  description: string
  href: string
  Icon: LucideIcon
}

interface ToolGroup {
  categoria: string
  tools: Tool[]
}

const GROUPS: ToolGroup[] = [
  {
    categoria: "Revisión y control",
    tools: [
      {
        label: "Subsanar observaciones (acta real)",
        description: "Sube el ordinario que te llegó de la DOM: extraemos cada observación y te explicamos y redactamos la subsanación citada. Elige un proyecto.",
        href: "/proyectos",
        Icon: MailCheck,
      },
      {
        label: "Pre-revisión DOM",
        description: "Simula el acta de observaciones de la DOM antes de ingresar tu expediente",
        href: "/herramientas/pre-revision",
        Icon: Stamp,
      },
      {
        label: "Verificador Normativo",
        description: "Revisa cumplimiento OGUC antes de ingresar el expediente",
        href: "/herramientas/compliance-check",
        Icon: ShieldCheck,
      },
      {
        label: "Anticipa Observaciones",
        description: "Predice qué observaciones hará la DOM antes de que ingrese el expediente",
        href: "/herramientas/predictor",
        Icon: Target,
      },
      {
        label: "Revisor de Expediente",
        description: "Analiza tus PDFs y detecta inconsistencias con la normativa",
        href: "/herramientas/auditor",
        Icon: FileSearch,
      },
    ],
  },
  {
    categoria: "Normativa y tramitación",
    tools: [
      {
        label: "Chat OGUC",
        description: "Consultas normativas OGUC · LGUC · circulares DDU en tiempo real",
        href: "/herramientas/oguc-chat",
        Icon: MessageSquare,
      },
      {
        label: "Asesor de tramitación",
        description: "Qué vía conviene (512, obra menor, alteración) ponderando costo y tiempo",
        href: "/herramientas/asesor-tramitacion",
        Icon: Compass,
      },
      {
        label: "Plazos DOM (Ley 21.718)",
        description: "Calcula y alerta sobre los plazos legales de respuesta de la DOM",
        href: "/herramientas/timeline",
        Icon: CalendarClock,
      },
    ],
  },
  {
    categoria: "Documentos y planos",
    tools: [
      {
        label: "Anotación sobre planos",
        description: "Marca cada observación sobre la lámina, como el revisor DOM rayaba el plano",
        href: "/herramientas/anotacion-plano",
        Icon: PencilRuler,
      },
      {
        label: "Memoria Descriptiva",
        description: "Genera memorias técnicas con IA a partir de los datos del proyecto",
        href: "/herramientas/memoria",
        Icon: BookText,
      },
      {
        label: "Declaración Jurada",
        description: "Genera declaración para obras menores exentas de permiso (Art. 5.1.2 OGUC)",
        href: "/herramientas/declaracion-jurada",
        Icon: FileSignature,
      },
      {
        label: "Formularios MINVU",
        description: "Explorador oficial del Mapa de Formularios: los 5 grupos, transcripción literal",
        href: "/herramientas/formularios-minvu",
        Icon: ClipboardList,
      },
    ],
  },
]

const TOTAL_TOOLS = GROUPS.reduce((n, g) => n + g.tools.length, 0)

export default function HerramientasPage() {

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title="Herramientas IA"
        subtitle={`${COPILOTO_PERSONA.nombre} · ${COPILOTO_PERSONA.rol}`}
      />

      <div className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-4xl">
          {/* Cabecera de índice — instrumentos del estudio técnico */}
          <div className="mb-8 flex items-end justify-between gap-4 border-b border-line-med pb-4">
            <div>
              <p className="font-technical text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
                Instrumentos técnicos
              </p>
              <h2 className="font-technical mt-1.5 text-lg font-semibold leading-none text-primary">
                Índice de herramientas
              </h2>
            </div>
            <p className="shrink-0 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              <Num className="text-sm font-semibold text-primary">
                {String(TOTAL_TOOLS).padStart(2, "0")}
              </Num>{" "}
              instrumentos
            </p>
          </div>

          <div className="space-y-9">
            {GROUPS.map(({ categoria, tools }, gi) => {
              // Índice de instrumento correlativo (01..12) sin mutar en render:
              // offset = total de herramientas en los grupos anteriores.
              const offset = GROUPS.slice(0, gi).reduce((n, g) => n + g.tools.length, 0)
              return (
              <section key={categoria} className="space-y-3">
                {/* Encabezado de categoría — eyebrow técnico */}
                <div className="flex items-center gap-3">
                  <h3 className="font-technical text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    {categoria}
                  </h3>
                  <div className="h-px flex-1 bg-line-fine" />
                  <span className="num text-[10px] text-muted-foreground/60">
                    {String(tools.length).padStart(2, "0")}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {tools.map(({ label, description, href, Icon }, ti) => {
                    const codigo = String(offset + ti + 1).padStart(2, "0")
                    return (
                      <Link
                        key={href}
                        href={href}
                        className="group flex items-start gap-3.5 rounded-[4px] border border-line-fine bg-card p-4 transition-colors hover:border-[var(--blueprint)] hover:bg-[var(--blueprint)]/[0.05]"
                      >
                        <span className="num mt-0.5 shrink-0 text-[11px] tabular-nums text-muted-foreground/50 transition-colors group-hover:text-[var(--blueprint)]">
                          {codigo}
                        </span>
                        <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground/70 transition-colors group-hover:text-[var(--blueprint)]" />
                        <div className="min-w-0 flex-1">
                          <p className="font-technical text-[13px] font-semibold leading-tight text-primary">
                            {label}
                          </p>
                          <p className="mt-1 text-[11.5px] leading-relaxed text-muted-foreground/70">
                            {description}
                          </p>
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </section>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
