import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  trend?: { value: number; label: string };
  color?: "green" | "blue" | "orange" | "red";
}

const COLOR_STYLES: Record<
  NonNullable<StatsCardProps["color"]>,
  { accent: string; iconBg: string; iconText: string; border: string }
> = {
  green:  {
    accent:   "bg-[oklch(0.28_0.055_158)]",
    iconBg:   "bg-primary/8",
    iconText: "text-primary",
    border:   "border-primary/15",
  },
  blue:   {
    accent:   "bg-sky-500",
    iconBg:   "bg-sky-50",
    iconText: "text-sky-600",
    border:   "border-sky-200/60",
  },
  orange: {
    accent:   "bg-amber-500",
    iconBg:   "bg-amber-50",
    iconText: "text-amber-600",
    border:   "border-amber-200/60",
  },
  red:    {
    accent:   "bg-red-500",
    iconBg:   "bg-red-50",
    iconText: "text-destructive",
    border:   "border-red-200/60",
  },
};

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "green",
}: StatsCardProps) {
  const s = COLOR_STYLES[color];
  const TrendIcon = trend && trend.value < 0 ? TrendingDown : TrendingUp;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border bg-white pl-5 pr-5 py-5",
        s.border
      )}
      style={{ boxShadow: "var(--shadow-card)" }}
    >
      {/* Left accent bar */}
      <div className={cn("absolute inset-y-0 left-0 w-[3px]", s.accent)} />

      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground/70">
            {title}
          </p>
          <p className="heading-display mt-2 text-[2.25rem] leading-none text-primary tabular-nums">
            {value}
          </p>
          {subtitle && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">{subtitle}</p>
          )}
          {trend && (
            <div className="mt-2 flex items-center gap-1 text-[11px]">
              <TrendIcon
                className={cn(
                  "size-3",
                  trend.value < 0 ? "text-red-500" : "text-primary"
                )}
              />
              <span className={cn("font-semibold", trend.value < 0 ? "text-red-500" : "text-primary")}>
                {trend.value > 0 ? "+" : ""}
                {trend.value}%
              </span>
              <span className="text-muted-foreground">{trend.label}</span>
            </div>
          )}
        </div>

        <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", s.iconBg)}>
          <Icon className={cn("size-4.5", s.iconText)} />
        </div>
      </div>
    </div>
  );
}
