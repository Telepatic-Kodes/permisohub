import Link from "next/link";
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronRight,
  Clock,
  FileWarning,
  FolderOpen,
} from "lucide-react";
import { StatsCard } from "@/components/dashboard/stats-card";
import { EstadoBadge } from "@/components/dashboard/estado-badge";
import type { EstadoExpediente } from "@/types";

// ---------------------------------------------------------------------------
// Mock data — reemplazar por datos de Supabase más adelante
// ---------------------------------------------------------------------------

interface ProyectoReciente {
  id: string;
  nombre: string;
  cliente: string;
  municipio: string;
  estado: EstadoExpediente;
  fechaEstimada: string;
}

const PROYECTOS_RECIENTES: ProyectoReciente[] = [
  {
    id: "1",
    nombre: "Local comercial — Mall Plaza Egaña",
    cliente: "Falabella Retail S.A.",
    municipio: "La Reina",
    estado: "con_observaciones",
    fechaEstimada: "28 jun 2026",
  },
  {
    id: "2",
    nombre: "Ampliación tienda — Av. Apoquindo",
    cliente: "Cencosud S.A.",
    municipio: "Las Condes",
    estado: "en_revision",
    fechaEstimada: "10 jul 2026",
  },
  {
    id: "3",
    nombre: "Habilitación cafetería — Costanera Center",
    cliente: "Starbucks Chile",
    municipio: "Providencia",
    estado: "ingresado",
    fechaEstimada: "22 jul 2026",
  },
  {
    id: "4",
    nombre: "Remodelación sucursal — Plaza Vespucio",
    cliente: "Banco de Chile",
    municipio: "La Florida",
    estado: "aprobado",
    fechaEstimada: "15 jun 2026",
  },
  {
    id: "5",
    nombre: "Nuevo local — Paseo Estación",
    cliente: "Tottus",
    municipio: "Estación Central",
    estado: "borrador",
    fechaEstimada: "5 ago 2026",
  },
];

type AlertaTipo = "urgente" | "proxima" | "info";

interface Alerta {
  id: string;
  tipo: AlertaTipo;
  titulo: string;
  detalle: string;
  proyectoId: string;
}

const ALERTAS: Alerta[] = [
  {
    id: "a1",
    tipo: "urgente",
    titulo: "Observaciones DOM por responder",
    detalle: "Mall Plaza Egaña — plazo vence en 3 días",
    proyectoId: "1",
  },
  {
    id: "a2",
    tipo: "proxima",
    titulo: "Próxima fecha estimada",
    detalle: "Av. Apoquindo — revisión DOM el 10 jul",
    proyectoId: "2",
  },
  {
    id: "a3",
    tipo: "info",
    titulo: "Expediente listo para ingreso",
    detalle: "Paseo Estación — documentación completa",
    proyectoId: "5",
  },
];

const ALERTA_STYLES: Record<
  AlertaTipo,
  { icon: typeof AlertCircle; bg: string; text: string }
> = {
  urgente: { icon: AlertCircle, bg: "bg-red-100", text: "text-red-700" },
  proxima: { icon: Calendar, bg: "bg-orange-100", text: "text-orange-700" },
  info: { icon: FileWarning, bg: "bg-blue-100", text: "text-blue-700" },
};

// ---------------------------------------------------------------------------

function saludoFecha() {
  return new Intl.DateTimeFormat("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Santiago",
  }).format(new Date());
}

export default function DashboardPage() {
  const fecha = saludoFecha();

  return (
    <div className="p-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-[#1A3328]">
          Buenos días, Estefanía
        </h1>
        <p className="mt-1 text-sm capitalize text-muted-foreground">{fecha}</p>
      </header>

      {/* Stats */}
      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatsCard
          title="Proyectos activos"
          value={12}
          subtitle="En tramitación"
          icon={FolderOpen}
          color="blue"
        />
        <StatsCard
          title="Con observaciones"
          value={3}
          subtitle="Requieren acción"
          icon={AlertCircle}
          color="orange"
        />
        <StatsCard
          title="Aprobados este mes"
          value={5}
          subtitle="Junio 2026"
          icon={CheckCircle}
          color="green"
          trend={{ value: 25, label: "vs. mes anterior" }}
        />
        <StatsCard
          title="Días promedio tramitación"
          value={42}
          subtitle="Últimos 90 días"
          icon={Clock}
          color="green"
        />
      </section>

      {/* Two columns */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Proyectos recientes — 60% */}
        <section className="lg:col-span-3">
          <div className="overflow-hidden rounded-xl border border-border bg-white">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-[#1A3328]">
                Proyectos recientes
              </h2>
              <Link
                href="/proyectos"
                className="text-sm font-medium text-[#1A3328]/70 transition-colors hover:text-[#1A3328]"
              >
                Ver todos
              </Link>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3">Proyecto</th>
                    <th className="px-5 py-3">Cliente</th>
                    <th className="px-5 py-3">Municipio</th>
                    <th className="px-5 py-3">Estado</th>
                    <th className="px-5 py-3">Fecha estimada</th>
                  </tr>
                </thead>
                <tbody>
                  {PROYECTOS_RECIENTES.map((proyecto) => (
                    <tr
                      key={proyecto.id}
                      className="group border-b border-border last:border-0 transition-colors hover:bg-[#F9F7F3]"
                    >
                      <td className="px-5 py-3.5">
                        <Link
                          href={`/proyectos/${proyecto.id}`}
                          className="block font-medium text-[#1A3328]"
                        >
                          {proyecto.nombre}
                        </Link>
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {proyecto.cliente}
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {proyecto.municipio}
                      </td>
                      <td className="px-5 py-3.5">
                        <EstadoBadge estado={proyecto.estado} />
                      </td>
                      <td className="px-5 py-3.5 text-muted-foreground">
                        {proyecto.fechaEstimada}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Alertas — 40% */}
        <section className="lg:col-span-2">
          <div className="rounded-xl border border-border bg-white">
            <div className="border-b border-border px-5 py-4">
              <h2 className="text-base font-semibold text-[#1A3328]">Alertas</h2>
            </div>

            <ul className="divide-y divide-border">
              {ALERTAS.map((alerta) => {
                const style = ALERTA_STYLES[alerta.tipo];
                const Icon = style.icon;
                return (
                  <li key={alerta.id}>
                    <Link
                      href={`/proyectos/${alerta.proyectoId}`}
                      className="flex items-start gap-3 px-5 py-4 transition-colors hover:bg-[#F9F7F3]"
                    >
                      <div
                        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${style.bg}`}
                      >
                        <Icon className={`size-4.5 ${style.text}`} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-[#1A3328]">
                          {alerta.titulo}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {alerta.detalle}
                        </p>
                      </div>
                      <ChevronRight className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
