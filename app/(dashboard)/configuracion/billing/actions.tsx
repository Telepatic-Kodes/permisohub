"use client"

import { useState } from "react"

interface SubscribeButtonProps {
  priceId: string
  label: string
  highlighted?: boolean
  disabled?: boolean
}

async function postJson(
  endpoint: string,
  payload: Record<string, unknown>,
): Promise<string | null> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? "No se pudo completar la operación")
  }
  const data = (await res.json()) as { url?: string }
  return data.url ?? null
}

export function SubscribeButton({
  priceId,
  label,
  highlighted = false,
  disabled = false,
}: SubscribeButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const url = await postJson("/api/billing/checkout", {
        priceId,
        successUrl: `${window.location.origin}/configuracion/billing?checkout=success`,
        cancelUrl: `${window.location.origin}/configuracion/billing?checkout=cancel`,
      })
      if (url) window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado")
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        className={
          highlighted
            ? "w-full rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-[#1A3328] transition-colors hover:bg-white/90 disabled:opacity-60"
            : "w-full rounded-lg bg-[#1A3328] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1A3328]/90 disabled:opacity-60"
        }
      >
        {loading ? "Redirigiendo…" : label}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}

export function ManageSubscriptionButton() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleClick() {
    setLoading(true)
    setError(null)
    try {
      const url = await postJson("/api/billing/portal", {
        returnUrl: `${window.location.origin}/configuracion/billing`,
      })
      if (url) window.location.href = url
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error inesperado")
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="rounded-lg border border-[#1A3328] bg-white px-4 py-2.5 text-sm font-semibold text-[#1A3328] transition-colors hover:bg-[#F0EBE1] disabled:opacity-60"
      >
        {loading ? "Redirigiendo…" : "Gestionar suscripción"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
