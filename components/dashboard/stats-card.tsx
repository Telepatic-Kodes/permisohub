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
  { bg: string; text: string }
> = {
  green: { bg: "bg-green-100", text: "text-green-700" },
  blue: { bg: "bg-blue-100", text: "text-blue-700" },
  orange: { bg: "bg-orange-100", text: "text-orange-700" },
  red: { bg: "bg-red-100", text: "text-red-700" },
};

export function StatsCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  color = "green",
}: StatsCardProps) {
  const colors = COLOR_STYLES[color];
  const TrendIcon = trend && trend.value < 0 ? TrendingDown : TrendingUp;

  return (
    <div className="rounded-xl border border-border bg-white p-5">
      <div className="flex items-start justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-full",
            colors.bg
          )}
        >
          <Icon className={cn("size-5", colors.text)} />
        </div>
      </div>

      <p className="mt-3 text-3xl font-semibold tracking-tight text-[#1A3328]">
        {value}
      </p>

      {subtitle && (
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      )}

      {trend && (
        <div className="mt-2 flex items-center gap-1 text-xs">
          <TrendIcon
            className={cn(
              "size-3.5",
              trend.value < 0 ? "text-red-600" : "text-green-600"
            )}
          />
          <span
            className={cn(
              "font-medium",
              trend.value < 0 ? "text-red-600" : "text-green-600"
            )}
          >
            {trend.value > 0 ? "+" : ""}
            {trend.value}%
          </span>
          <span className="text-muted-foreground">{trend.label}</span>
        </div>
      )}
    </div>
  );
}
