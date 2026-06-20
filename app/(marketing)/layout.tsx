import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "PermisoHub — El copiloto IA del arquitecto chileno",
  description:
    "Gestión inteligente de permisos de edificación municipales. IA entrenada en OGUC y Ley 21.718. Acelera tus trámites DOM de 124 a menos de 60 días.",
  openGraph: {
    title: "PermisoHub — El copiloto IA del arquitecto chileno",
    description:
      "Gestión inteligente de permisos de edificación municipales. IA entrenada en OGUC y Ley 21.718.",
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
