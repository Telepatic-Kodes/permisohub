"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart2,
  Building2,
  Calculator,
  CreditCard,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  MapPin,
  MessageCircle,
  MessageSquare,
  Settings,
  ShieldCheck,
  TrendingUp,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface NavGroup {
  label: string | null;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { href: "/proyectos", label: "Proyectos", icon: FolderOpen },
      { href: "/prospectos", label: "CRM", icon: TrendingUp },
      { href: "/clientes", label: "Clientes", icon: Building2 },
      { href: "/municipios", label: "Municipios", icon: MapPin },
    ],
  },
  {
    label: "IA Normativa",
    items: [
      { href: "/herramientas/oguc-chat", label: "Chat OGUC", icon: MessageSquare },
      { href: "/herramientas/compliance-check", label: "Verificador OGUC", icon: ShieldCheck },
      { href: "/herramientas/checklist", label: "Checklist Normativo", icon: Wrench },
      { href: "/herramientas/municipios", label: "Inteligencia DOM", icon: BarChart2 },
      { href: "/herramientas/calculadora", label: "Calculadora derechos", icon: Calculator },
      { href: "/configuracion/whatsapp", label: "WhatsApp", icon: MessageCircle },
    ],
  },
  {
    label: "Documentos",
    items: [{ href: "/documentos", label: "Pitch & Modelo negocio", icon: FileText }],
  },
  {
    label: null,
    items: [
      { href: "/configuracion/billing", label: "Facturación", icon: CreditCard },
      { href: "/configuracion", label: "Configuración", icon: Settings },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border bg-white">
      {/* Logo */}
      <div className="px-6 py-6">
        <h1 className="text-xl font-semibold tracking-tight text-[#1A3328]">
          PermisoHub
        </h1>
        <p className="mt-0.5 text-xs text-muted-foreground">
          EP Gestión Arquitectónica
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-4 px-3 py-2">
        {NAV_GROUPS.map((group, groupIndex) => (
          <div key={group.label ?? `group-${groupIndex}`} className="space-y-1">
            {group.label && (
              <p className="px-3 pb-1 pt-1 text-xs font-semibold uppercase tracking-wider text-[#1A3328]/40">
                {group.label}
              </p>
            )}
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-[#1A3328] text-white"
                      : "text-[#1A3328]/70 hover:bg-[#F0EBE1] hover:text-[#1A3328]"
                  )}
                >
                  <Icon className="size-4.5 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* User */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-3 rounded-lg px-2 py-2">
          <Avatar size="default">
            <AvatarFallback className="bg-[#1A3328] text-xs font-medium text-white">
              EP
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-[#1A3328]">
              Estefanía Parada
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Arquitecta
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar sesión"
            className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-[#F0EBE1] hover:text-[#1A3328]"
          >
            <LogOut className="size-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
