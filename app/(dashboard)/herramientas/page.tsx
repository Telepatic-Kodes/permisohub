import Link from "next/link"
import {
  BookText,
  CalendarClock,
  ChevronRight,
  FileSearch,
  FileSignature,
  MessageSquare,
  ShieldCheck,
  Target,
  Wrench,
  type LucideIcon,
} from "lucide-react"
import { PageHeader } from "@/components/dashboard/page-header"

interface Tool {
  label: string
  description: string
  href: string
  Icon: LucideIcon
  color: string
  iconBg: string
}

const TOOLS: Tool[] = [
  {
    label: "Chat OGUC",
    description: "Consultas normativas con IA en tiempo real",
    href: "/herramientas/oguc-chat",
    Icon: MessageSquare,
    color: "text-primary",
    iconBg: "bg-primary/8",
  },
  {
    label: "Verificador OGUC",
    description: "Cumplimiento normativo antes del ingreso",
    href: "/herramientas/compliance-check",
    Icon: ShieldCheck,
    color: "text-emerald-600",
    iconBg: "bg-emerald-50",
  },
  {
    label: "Checklist Normativo",
    description: "Lista de verificación completa por expediente",
    href: "/herramientas/checklist",
    Icon: Wrench,
    color: "text-sky-600",
    iconBg: "bg-sky-50",
  },
  {
    label: "Memoria Descriptiva",
    description: "Genera memorias técnicas oficiales con IA",
    href: "/herramientas/memoria",
    Icon: BookText,
    color: "text-amber-600",
    iconBg: "bg-amber-50",
  },
  {
    label: "Predictor de Riesgo",
    description: "Anticipa observaciones DOM antes de ingresar",
    href: "/herramientas/predictor",
    Icon: Target,
    color: "text-orange-600",
    iconBg: "bg-orange-50",
  },
  {
    label: "Auditor Expediente",
    description: "Analiza PDFs y detecta inconsistencias",
    href: "/herramientas/auditor",
    Icon: FileSearch,
    color: "text-violet-600",
    iconBg: "bg-violet-50",
  },
  {
    label: "Timeline Aprobación",
    description: "Plazos legales según Ley 21.718",
    href: "/herramientas/timeline",
    Icon: CalendarClock,
    color: "text-rose-600",
    iconBg: "bg-rose-50",
  },
  {
    label: "Declaración Jurada",
    description: "Genera declaración para obras menores exentas de permiso (Art. 5.1.2 OGUC)",
    href: "/herramientas/declaracion-jurada",
    Icon: FileSignature,
    color: "text-teal-600",
    iconBg: "bg-teal-50",
  },
]

export default function HerramientasPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        title="Herramientas IA"
        subtitle="El copiloto del arquitecto chileno"
      />

      <div className="flex-1 px-6 py-8">
        <div className="mx-auto max-w-4xl">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {TOOLS.map(({ label, description, href, Icon, color, iconBg }) => (
              <Link
                key={href}
                href={href}
                className="group flex items-start gap-4 rounded-xl border border-border bg-white p-5 transition-all hover:border-primary/20 hover:shadow-sm"
              >
                <div className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
                  <Icon className={`size-5 ${color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-semibold text-primary">{label}</p>
                  <p className="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground/70">{description}</p>
                </div>
                <ChevronRight className="mt-1 size-4 shrink-0 text-muted-foreground/20 transition-colors group-hover:text-primary/40" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
