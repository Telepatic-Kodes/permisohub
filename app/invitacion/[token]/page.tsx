"use client"

import { use, useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2, Loader2, Users } from "lucide-react"

import { createClient } from "@/lib/supabase/client"

// ---------------------------------------------------------------------------
// Aceptar una invitación al equipo.
//
// Es una ruta pública (el invitado todavía no tiene sesión) y el canje ocurre
// en el servidor: aquí solo se muestra el estado. Si no hay sesión, se manda a
// iniciarla y se vuelve a este mismo enlace.
// ---------------------------------------------------------------------------

type Estado = "verificando" | "sin-sesion" | "aceptando" | "listo" | "error"

export default function AceptarInvitacionPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = use(params)
  const router = useRouter()
  const [estado, setEstado] = useState<Estado>("verificando")
  const [mensaje, setMensaje] = useState<string>("")
  const [workspace, setWorkspace] = useState<string | null>(null)

  const aceptar = useCallback(async () => {
    setEstado("aceptando")
    try {
      const res = await fetch("/api/workspace/invites/aceptar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      })
      const json = (await res.json()) as { ok?: boolean; error?: string; workspace?: string | null }
      if (!res.ok || !json.ok) {
        setMensaje(json.error ?? "No se pudo aceptar la invitación")
        setEstado("error")
        return
      }
      setWorkspace(json.workspace ?? null)
      setEstado("listo")
      setTimeout(() => router.push("/proyectos"), 1800)
    } catch {
      setMensaje("No se pudo conectar con el servidor")
      setEstado("error")
    }
  }, [token, router])

  useEffect(() => {
    let cancelado = false
    createClient()
      .auth.getUser()
      .then(({ data }) => {
        if (cancelado) return
        if (!data.user) {
          setEstado("sin-sesion")
          return
        }
        void aceptar()
      })
      .catch(() => {
        if (!cancelado) setEstado("sin-sesion")
      })
    return () => {
      cancelado = true
    }
  }, [aceptar])

  return (
    <main
      className="flex min-h-screen w-full items-center justify-center px-4 py-12"
      style={{ backgroundColor: "#F9F7F3" }}
    >
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight" style={{ color: "#1A3328" }}>
            PermisoHub
          </h1>
          <p className="mt-1.5 text-sm text-neutral-500">Invitación a un equipo</p>
        </div>

        <div className="rounded-[3px] border border-[#1A3328]/20 bg-white p-6 text-center">
          {(estado === "verificando" || estado === "aceptando") && (
            <>
              <Loader2 className="mx-auto size-7 animate-spin text-[#2D6A4F]" />
              <p className="mt-4 text-sm font-medium">
                {estado === "verificando" ? "Verificando tu sesión…" : "Sumándote al equipo…"}
              </p>
            </>
          )}

          {estado === "sin-sesion" && (
            <>
              <Users className="mx-auto size-7 text-[#2D6A4F]" strokeWidth={1.5} />
              <p className="mt-4 text-sm font-medium">Te invitaron a un equipo en PermisoHub</p>
              <p className="mt-2 text-[13px] leading-5 text-neutral-500">
                Inicia sesión con el correo al que llegó la invitación. Al volver, se aceptará
                automáticamente.
              </p>
              <Link
                href={`/login?next=${encodeURIComponent(`/invitacion/${token}`)}`}
                className="mt-5 inline-flex items-center justify-center rounded-[3px] bg-[#2D6A4F] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1A3328]"
              >
                Iniciar sesión
              </Link>
            </>
          )}

          {estado === "listo" && (
            <>
              <CheckCircle2 className="mx-auto size-7" style={{ color: "var(--state-ok, #2D6A4F)" }} />
              <p className="mt-4 text-sm font-medium">
                Listo{workspace ? `, ya eres parte de ${workspace}` : ", ya eres parte del equipo"}
              </p>
              <p className="mt-2 text-[13px] text-neutral-500">Abriendo los proyectos…</p>
            </>
          )}

          {estado === "error" && (
            <>
              <p className="text-sm font-medium" style={{ color: "#B23B2E" }}>
                No se pudo aceptar la invitación
              </p>
              <p className="mt-2 text-[13px] leading-5 text-neutral-600">{mensaje}</p>
              <Link
                href="/proyectos"
                className="mt-5 inline-block text-[13px] font-medium underline hover:no-underline"
              >
                Ir a la aplicación
              </Link>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
