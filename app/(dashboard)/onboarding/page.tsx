"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowRight,
  Bot,
  Check,
  Clock,
  FileText,
  Loader2,
} from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

// ---------------------------------------------------------------------------
// Opciones de los selects
// ---------------------------------------------------------------------------

const ESPECIALIDADES = [
  "Arquitecto independiente",
  "Oficina de arquitectura",
  "Constructora",
  "Otro",
] as const

const MUNICIPIOS = [
  "Las Condes",
  "Providencia",
  "Santiago",
  "Vitacura",
  "Ñuñoa",
  "La Florida",
  "Maipú",
  "Otro",
] as const

const TOTAL_STEPS = 3

// ---------------------------------------------------------------------------
// Tour features (paso 3)
// ---------------------------------------------------------------------------

interface FeatureCard {
  icon: typeof Bot
  title: string
  description: string
  href: string
}

const FEATURES: FeatureCard[] = [
  {
    icon: Bot,
    title: "Chat OGUC",
    description: "Pregunta cualquier duda normativa",
    href: "/herramientas/oguc-chat",
  },
  {
    icon: FileText,
    title: "Responder observaciones",
    description: "Sube el PDF de la DOM",
    href: "/proyectos",
  },
  {
    icon: Clock,
    title: "Plazos Ley 21.718",
    description: "Controla los días hábiles de tus expedientes",
    href: "/proyectos",
  },
]

// ---------------------------------------------------------------------------

export default function OnboardingPage() {
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)

  // Paso 1 — perfil
  const [nombre, setNombre] = useState("")
  const [especialidad, setEspecialidad] = useState("")

  // Paso 2 — primer proyecto
  const [proyectoNombre, setProyectoNombre] = useState("")
  const [proyectoCliente, setProyectoCliente] = useState("")
  const [proyectoMunicipio, setProyectoMunicipio] = useState("")

  // -------------------------------------------------------------------------
  // Acciones
  // -------------------------------------------------------------------------

  function handleContinuarPaso1() {
    setStep(2)
  }

  async function handleCrearProyecto() {
    setLoading(true)
    try {
      // La API /api/proyectos puede no existir todavía. Intentamos el POST y,
      // si falla por cualquier motivo, avanzamos igual con estado local.
      await fetch("/api/proyectos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: proyectoNombre,
          cliente: proyectoCliente,
          municipio: proyectoMunicipio,
        }),
      }).catch(() => {
        // Silencioso: la API puede no existir en el MVP.
      })
    } finally {
      setLoading(false)
      setStep(3)
    }
  }

  function handleSaltarProyecto() {
    setStep(3)
  }

  async function handleCompletar() {
    setLoading(true)

    // 1. Intentar marcar onboarding como completado en Supabase.
    //    Se hace de forma defensiva: la tabla/columna puede no existir.
    try {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        await supabase
          .from("profiles")
          .upsert(
            {
              id: user.id,
              nombre,
              especialidad,
              onboarding_completed: true,
              onboarding_step: TOTAL_STEPS,
            },
            { onConflict: "id" },
          )
          // No hacemos nada con el error: puede que la columna no exista.
          .then(() => undefined)
      }
    } catch {
      // Silencioso — seguimos con el flujo aunque Supabase falle.
    }

    // 2. Persistir en localStorage para el setup checklist.
    try {
      window.localStorage.setItem("permisohub_onboarding_done", "true")
    } catch {
      // Silencioso — algunos navegadores bloquean localStorage.
    }

    // 3. Redirigir al dashboard.
    setLoading(false)
    router.push("/dashboard")
  }

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="w-full max-w-[480px]">
        {/* Indicador de progreso */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((n) => (
            <div key={n} className="flex items-center gap-2">
              <div
                className={cn(
                  "flex size-8 items-center justify-center rounded-full border text-sm font-medium transition-colors",
                  n < step &&
                    "border-[#1A3328] bg-[#1A3328] text-[#F9F7F3]",
                  n === step &&
                    "border-[#1A3328] bg-[#1A3328] text-[#F9F7F3]",
                  n > step &&
                    "border-border bg-white text-muted-foreground",
                )}
              >
                {n < step ? <Check className="size-4" /> : n}
              </div>
              {n < TOTAL_STEPS && (
                <div
                  className={cn(
                    "h-px w-8 transition-colors",
                    n < step ? "bg-[#1A3328]" : "bg-border",
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-white p-8 shadow-sm">
          {/* ----------------------------------------------------------------- */}
          {/* Paso 1 — Bienvenida */}
          {/* ----------------------------------------------------------------- */}
          {step === 1 && (
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#1A3328]">
                Bienvenida a PermisoHub{nombre ? `, ${nombre}` : ""}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Configura tu perfil para comenzar
              </p>

              <div className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="nombre">Nombre completo</Label>
                  <Input
                    id="nombre"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Estefanía Rojas"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="especialidad">Especialidad</Label>
                  <Select
                    value={especialidad}
                    onValueChange={(v) => setEspecialidad(v as string)}
                  >
                    <SelectTrigger id="especialidad">
                      <SelectValue placeholder="Seleccionar especialidad" />
                    </SelectTrigger>
                    <SelectContent>
                      {ESPECIALIDADES.map((e) => (
                        <SelectItem key={e} value={e}>
                          {e}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                className="mt-6 w-full"
                size="lg"
                onClick={handleContinuarPaso1}
                disabled={!nombre.trim() || !especialidad}
              >
                Continuar
                <ArrowRight />
              </Button>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* Paso 2 — Primer proyecto */}
          {/* ----------------------------------------------------------------- */}
          {step === 2 && (
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#1A3328]">
                Crea tu primer proyecto
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Un proyecto = un expediente de permiso DOM
              </p>

              <div className="mt-6 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="proyecto-nombre">Nombre del proyecto</Label>
                  <Input
                    id="proyecto-nombre"
                    value={proyectoNombre}
                    onChange={(e) => setProyectoNombre(e.target.value)}
                    placeholder="Local comercial Las Condes"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="proyecto-cliente">Cliente</Label>
                  <Input
                    id="proyecto-cliente"
                    value={proyectoCliente}
                    onChange={(e) => setProyectoCliente(e.target.value)}
                    placeholder="Nombre del cliente"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="proyecto-municipio">Municipio</Label>
                  <Select
                    value={proyectoMunicipio}
                    onValueChange={(v) => setProyectoMunicipio(v as string)}
                  >
                    <SelectTrigger id="proyecto-municipio">
                      <SelectValue placeholder="Seleccionar municipio" />
                    </SelectTrigger>
                    <SelectContent>
                      {MUNICIPIOS.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="mt-6 space-y-2">
                <Button
                  className="w-full"
                  size="lg"
                  onClick={handleCrearProyecto}
                  disabled={loading || !proyectoNombre.trim()}
                >
                  {loading ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <>
                      Crear proyecto
                      <ArrowRight />
                    </>
                  )}
                </Button>
                <Button
                  className="w-full"
                  size="lg"
                  variant="ghost"
                  onClick={handleSaltarProyecto}
                  disabled={loading}
                >
                  Saltar por ahora
                </Button>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------- */}
          {/* Paso 3 — Tour features */}
          {/* ----------------------------------------------------------------- */}
          {step === 3 && (
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-[#1A3328]">
                Todo listo
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Aquí tienes las 3 cosas más importantes de PermisoHub:
              </p>

              <div className="mt-6 space-y-3">
                {FEATURES.map((feature) => {
                  const Icon = feature.icon
                  return (
                    <Link
                      key={feature.title}
                      href={feature.href}
                      className="flex items-start gap-3 rounded-xl border border-border bg-[#F9F7F3] p-4 transition-colors hover:border-[#1A3328]/30"
                    >
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#1A3328]/10">
                        <Icon className="size-5 text-[#1A3328]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-[#1A3328]">
                          {feature.title}
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {feature.description}
                        </p>
                      </div>
                    </Link>
                  )
                })}
              </div>

              <Button
                className="mt-6 w-full"
                size="lg"
                onClick={handleCompletar}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <>
                    Ir al dashboard
                    <ArrowRight />
                  </>
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
