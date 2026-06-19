"use client"

import { useState, type FormEvent } from "react"
import Link from "next/link"

const BRAND_GREEN = "#1A3328"

export default function ClienteLoginPage() {
  const [email, setEmail] = useState("")
  const [sent, setSent] = useState(false)

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!email) return
    // Demo: simulate sending a magic link. No real auth in the client portal.
    setSent(true)
  }

  return (
    <div className="flex min-h-[70vh] w-full items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1
            className="text-3xl font-semibold tracking-tight"
            style={{ color: BRAND_GREEN }}
          >
            PermisoHub
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Ingresa tu email para ver el estado de tus permisos
          </p>
        </div>

        <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm sm:p-8">
          {sent ? (
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
                Revisa tu correo — te enviamos el link de acceso
              </h2>
              <p className="text-sm text-neutral-500">
                Enviamos un enlace a{" "}
                <span className="font-medium text-neutral-700">{email}</span>.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSent(false)
                  setEmail("")
                }}
                className="mt-2 text-sm font-medium text-neutral-500 underline-offset-2 hover:underline"
              >
                Usar otro correo
              </button>
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
                <input
                  id="email"
                  type="email"
                  name="email"
                  autoComplete="email"
                  required
                  placeholder="tu@empresa.cl"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 outline-none transition-colors focus:border-[#1A3328] focus:ring-1 focus:ring-[#1A3328]"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
                style={{ backgroundColor: BRAND_GREEN }}
              >
                Ver mis permisos
              </button>
            </form>
          )}
        </div>

        <div className="mt-6 text-center">
          <Link
            href="/portal"
            className="text-sm font-medium text-neutral-400 underline-offset-2 hover:text-[#1A3328] hover:underline"
          >
            Ver demo →
          </Link>
        </div>

        <p className="mt-6 text-center text-xs text-neutral-400">
          ¿Necesitas ayuda? Escríbenos a{" "}
          <a
            href="mailto:hola@permisohub.cl"
            className="font-medium text-neutral-500 hover:text-[#1A3328]"
          >
            hola@permisohub.cl
          </a>
        </p>
      </div>
    </div>
  )
}
