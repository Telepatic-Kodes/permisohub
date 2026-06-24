import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PermisoHub — El OS del arquitecto chileno",
  description:
    "Gestión completa de permisos DOM: proyectos, clientes, observaciones, plazos Ley 21.718 y 9 herramientas IA. El software que los arquitectos chilenos necesitaban.",
  openGraph: {
    title: "PermisoHub — El OS del arquitecto chileno",
    description:
      "Proyectos, clientes, IA y permisos DOM en un solo lugar. Ley 21.718, OGUC y 345 municipios cubiertos.",
    type: "website",
    locale: "es_CL",
  },
};

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
