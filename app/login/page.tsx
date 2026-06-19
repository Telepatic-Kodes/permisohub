"use client"

import { useState, type FormEvent } from "react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const BRAND_GREEN = "#1A3328"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle",
  )
  const [errorMessage, setErrorMessage] = useState("")

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email || status === "loading") return

    setStatus("loading")
    setErrorMessage("")

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          typeof window !== "undefined"
            ? `${window.location.origin}/auth/callback`
            : undefined,
      },
    })

    if (error) {
      setStatus("error")
      setErrorMessage(error.message)
      return
    }

    setStatus("sent")
  }

  return (
    <main
      className="flex min-h-screen w-full items-center justify-center px-4 py-12"
      style={{ backgroundColor: "#F9F7F3" }}
    >
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <h1
            className="text-3xl font-semibold tracking-tight"
            style={{ color: BRAND_GREEN }}
          >
            PermisoHub
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Gestión de permisos municipales · EP Gestión Arquitectónica
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200/70 bg-white p-6 shadow-sm sm:p-8">
          {status === "sent" ? (
            <div className="space-y-3 text-center">
              <div
                className="mx-auto flex size-12 items-center justify-center rounded-full"
                style={{ backgroundColor: `${BRAND_GREEN}14` }}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={BRAND_GREEN}
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="size-6"
                  aria-hidden="true"
                >
                  <rect width="20" height="16" x="2" y="4" rx="2" />
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                </svg>
              </div>
              <h2 className="text-base font-medium text-neutral-900">
                Revisa tu correo para ingresar
              </h2>
              <p className="text-sm text-neutral-500">
                Enviamos un enlace mágico a{" "}
                <span className="font-medium text-neutral-700">{email}</span>.
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => {
                  setStatus("idle")
                  setEmail("")
                }}
              >
                Usar otro correo
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-sm font-medium text-neutral-700"
                >
                  Correo electrónico
                </label>
                <Input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  placeholder="tu@correo.cl"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              {status === "error" && errorMessage ? (
                <p className="text-sm text-red-600">{errorMessage}</p>
              ) : null}

              <Button
                type="submit"
                size="lg"
                className="w-full"
                disabled={status === "loading"}
                style={{ backgroundColor: BRAND_GREEN }}
              >
                {status === "loading" ? "Enviando…" : "Enviar magic link"}
              </Button>

              <p className="text-center text-xs text-neutral-400">
                Te enviaremos un enlace seguro para ingresar sin contraseña.
              </p>
            </form>
          )}
        </div>
      </div>
    </main>
  )
}
