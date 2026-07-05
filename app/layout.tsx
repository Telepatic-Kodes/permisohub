import type { Metadata, Viewport } from "next";
import { Fraunces, DM_Sans, Space_Grotesk, JetBrains_Mono } from "next/font/google";
import Script from "next/script";
import { Toaster } from "@/components/ui/sonner";
import { PwaInstallPrompt } from "@/components/pwa-install-prompt";
import { Providers } from "@/components/providers";
import "./globals.css";

// Fraunces — voz editorial/emocional (marketing).
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  weight: "variable",
  display: "swap",
});

// DM Sans — prosa y UI (cuerpo).
const dmSans = DM_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

// Space Grotesk — voz TÉCNICA del instrumento: rótulos, cabeceras de
// expediente, títulos de lámina. Grotesca de carácter, disciplina de tipo
// técnico con ritmo legible.
const spaceGrotesk = Space_Grotesk({
  variable: "--font-technical",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

// JetBrains Mono — DATO técnico: cotas, superficies, coeficientes, m², %,
// plazos, números de artículo/DDU/expediente. Cada dígito en su caja → los
// cuadros de superficie se leen alineados como en un plano.
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PermisoHub",
  description: "Gestión de permisos municipales — EP Gestión Arquitectónica",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "PermisoHub",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#1A3328",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${fraunces.variable} ${dmSans.variable} ${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full">
        <Providers>
          {children}
        </Providers>
        <Toaster />
        <PwaInstallPrompt />
        <Script id="register-sw" strategy="afterInteractive">{`
          if ('serviceWorker' in navigator) {
            window.addEventListener('load', function() {
              navigator.serviceWorker.register('/sw.js')
            })
          }
        `}</Script>
      </body>
    </html>
  );
}
