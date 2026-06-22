import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Supabase magic-link / OAuth callback.
 *
 * Supabase redirects the user here after they click the email link.
 * We exchange the `code` for a session, then redirect:
 *   - New users (no profile) → /onboarding
 *   - Returning users        → /dashboard (or the original `next` param)
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next") ?? "/dashboard"

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    )
  }

  // Check if the user has completed onboarding (profile exists and has nombre)
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("nombre")
      .eq("id", user.id)
      .single<{ nombre: string | null }>()

    if (!profile?.nombre) {
      return NextResponse.redirect(`${origin}/onboarding`)
    }
  }

  return NextResponse.redirect(`${origin}${next}`)
}
