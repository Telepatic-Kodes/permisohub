import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Refreshes the Supabase auth session on every request and enforces
 * route protection. All routes are protected except `/login` and the
 * auth callback. Unauthenticated visitors are redirected to `/login`.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: Do not run code between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to
  // debug issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Routes that are reachable without an authenticated session.
  const isPublicRoute =
    pathname.startsWith("/login") || pathname.startsWith("/auth")

  if (!user && !isPublicRoute && process.env.NODE_ENV === 'production') {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Send already-authenticated users away from the login page.
  if (user && pathname.startsWith("/login")) {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  // IMPORTANT: You must return the supabaseResponse object as is to keep
  // the refreshed auth cookies in sync between the browser and server.
  return supabaseResponse
}
