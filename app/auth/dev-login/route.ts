export const dynamic = "force-dynamic"

import { NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { createServiceClient } from "@/lib/supabase/service"

// ---------------------------------------------------------------------------
// Auto-login de desarrollo (SIN magic link ni contraseña).
//
// Establece una sesión real para el usuario dev usando el service role, de modo
// que RLS y `auth.getUser()` sigan funcionando en toda la app. El middleware
// redirige aquí cuando BYPASS_AUTH=true. NUNCA se activa en producción.
// ---------------------------------------------------------------------------

const DEV_EMAIL = process.env.DEV_USER_EMAIL ?? "tomas@aiaiai.cl"

function bypassEnabled(): boolean {
  return (
    process.env.BYPASS_AUTH === "true" && process.env.NODE_ENV !== "production"
  )
}

export async function GET(request: Request) {
  if (!bypassEnabled()) {
    return NextResponse.json({ error: "No disponible" }, { status: 404 })
  }

  const url = new URL(request.url)
  const next = url.searchParams.get("next") || "/dashboard"

  // 1) Generar un OTP para el usuario dev (no se envía correo; usamos el token).
  const admin = createServiceClient()
  const { data, error } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: DEV_EMAIL,
  })
  if (error || !data?.properties?.email_otp) {
    return NextResponse.json(
      { error: error?.message ?? "No se pudo generar el enlace de acceso" },
      { status: 500 },
    )
  }

  // 2) Verificar el OTP con el cliente SSR → establece las cookies de sesión.
  const supabase = await createClient()
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "email",
    email: DEV_EMAIL,
    token: data.properties.email_otp,
  })
  if (verifyError) {
    return NextResponse.json({ error: verifyError.message }, { status: 500 })
  }

  return NextResponse.redirect(new URL(next, url.origin))
}
