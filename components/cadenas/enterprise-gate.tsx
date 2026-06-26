"use client"

import { Building2, CheckCircle2, FileText, MapPin, Store, TrendingUp, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"

const FEATURES = [
  "Jerarquía Cadena → Centro Comercial → Local",
  "Dashboard de cobertura de permisos por centro",
  "Portal de seguimiento por locatario (link único)",
  "Importación CSV de locales (bulk)",
  "Envío masivo de invitaciones a tenants",
  "Reportes ejecutivos PDF por cadena",
  "Hasta 20 usuarios en el workspace",
]

export function EnterpriseGate() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] px-4 py-16">
      <div className="max-w-2xl w-full">
        {/* Badge */}
        <div className="flex justify-center mb-6">
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-4 py-1.5 text-sm font-semibold text-primary">
            <Zap className="size-3.5" /> Plan Enterprise
          </span>
        </div>

        {/* Heading */}
        <h1 className="text-3xl font-bold text-center text-foreground mb-3">
          Módulo Cadenas Comerciales
        </h1>
        <p className="text-center text-muted-foreground mb-10 max-w-lg mx-auto">
          Gestión integral para administradoras de centros comerciales con decenas de locales y múltiples municipios.
        </p>

        {/* Preview cards */}
        <div className="grid grid-cols-3 gap-3 mb-10 opacity-60 pointer-events-none select-none">
          <div className="rounded-xl border bg-card p-4">
            <Building2 className="size-5 text-muted-foreground mb-2" />
            <div className="text-2xl font-bold">3</div>
            <div className="text-xs text-muted-foreground">Centros comerciales</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <Store className="size-5 text-muted-foreground mb-2" />
            <div className="text-2xl font-bold">247</div>
            <div className="text-xs text-muted-foreground">Locales gestionados</div>
          </div>
          <div className="rounded-xl border bg-card p-4">
            <TrendingUp className="size-5 text-muted-foreground mb-2" />
            <div className="text-2xl font-bold">68%</div>
            <div className="text-xs text-muted-foreground">Cobertura permisos</div>
          </div>
        </div>

        {/* Feature list + pricing */}
        <div className="rounded-2xl border bg-card p-8">
          <div className="flex items-start justify-between gap-8">
            <div className="flex-1">
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-4">
                Incluye
              </p>
              <ul className="space-y-2.5">
                {FEATURES.map(f => (
                  <li key={f} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="size-4 text-primary shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-right shrink-0">
              <div className="text-3xl font-bold text-foreground">$349.990</div>
              <div className="text-sm text-muted-foreground">CLP / mes</div>
              <div className="text-xs text-muted-foreground mt-1">o $290.400/mes anual</div>
            </div>
          </div>

          <div className="flex gap-3 mt-8">
            <Button size="lg" className="flex-1" onClick={() => { window.location.href = 'mailto:ventas@permisohub.cl?subject=Interés Plan Enterprise - Módulo Cadenas' }}>
              Contactar ventas
            </Button>
            <Button variant="outline" size="lg" onClick={() => { window.location.href = '/cadenas-comerciales?demo=1' }}>
              <FileText className="size-4" /> Ver demo
            </Button>
          </div>
        </div>

        {/* Social proof */}
        <div className="flex items-center justify-center gap-6 mt-8 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <MapPin className="size-3.5" />
            Parque Arauco · Mall Plaza · CBRE
          </div>
          <div>·</div>
          <div>Implementación en 48h</div>
        </div>
      </div>
    </div>
  )
}
