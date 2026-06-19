import { cn } from "@/lib/utils";
import { ESTADO_CONFIG, type EstadoExpediente } from "@/types";

interface EstadoBadgeProps {
  estado: EstadoExpediente;
  className?: string;
}

export function EstadoBadge({ estado, className }: EstadoBadgeProps) {
  const config = ESTADO_CONFIG[estado];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        config.color,
        className
      )}
    >
      {config.label}
    </span>
  );
}
