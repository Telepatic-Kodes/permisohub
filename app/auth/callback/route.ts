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
  // Validate next: must be an internal path (starts with / but not //)
  const rawNext = searchParams.get("next") ?? "/dashboard"
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/dashboard"

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=no_code`)
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.exchangeCodeForSession(code)

  if (error) {
    // Use generic error code — never expose raw Supabase error messages in URLs
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
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
