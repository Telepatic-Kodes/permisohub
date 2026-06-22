import {
  AlertTriangle,
  CheckCircle2,
  FileEdit,
  Search,
  Upload,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EstadoExpediente } from "@/types";

interface EstadoBadgeProps {
  estado: EstadoExpediente;
  className?: string;
}

interface BadgeConfig {
  label: string;
  bg: string;
  text: string;
  Icon: LucideIcon;
}

const BADGE_CONFIG: Record<EstadoExpediente, BadgeConfig> = {
  borrador:          { label: "Borrador",           bg: "bg-muted",        text: "text-muted-foreground", Icon: FileEdit },
  ingresado:         { label: "Ingresado",          bg: "bg-sky-50",       text: "text-sky-700",          Icon: Upload },
  en_revision:       { label: "En revisión",        bg: "bg-blue-50",      text: "text-blue-700",         Icon: Search },
  con_observaciones: { label: "Con observaciones",  bg: "bg-amber-50",     text: "text-amber-700",        Icon: AlertTriangle },
  aprobado:          { label: "Aprobado",           bg: "bg-emerald-50",   text: "text-emerald-700",      Icon: CheckCircle2 },
  rechazado:         { label: "Rechazado",          bg: "bg-red-50",       text: "text-red-700",          Icon: XCircle },
};

export function EstadoBadge({ estado, className }: EstadoBadgeProps) {
  const config = BADGE_CONFIG[estado];
  const { Icon } = config;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        config.bg,
        config.text,
        className
      )}
    >
      <Icon className="size-3.5" />
      {config.label}
    </span>
  );
}
