import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isPublicRoute =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/auth") ||
    pathname.startsWith("/pricing") ||
    pathname.startsWith("/docs") ||
    // Marketing y legales públicos (antes redirigían a /login en producción):
    pathname.startsWith("/centros") ||
    pathname.startsWith("/terminos-y-condiciones") ||
    pathname.startsWith("/politica-de-privacidad") ||
    // Portal del mandante — su gracia es funcionar SIN login (token en la URL):
    pathname.startsWith("/portal") ||
    // Aceptar una invitación al equipo: la página se abre sin sesión y desde
    // ahí manda a iniciarla conservando el destino.
    pathname.startsWith("/invitacion") ||
    // Las rutas API autogestionan su auth (createClient + getUser → 401 JSON,
    // o CRON_SECRET, o son deliberadamente públicas como /api/zonificacion/*).
    // Redirigirlas con 307 a /login rompía crons, el self-fetch de
    // zonificación y el portal en producción.
    pathname.startsWith("/api")

  // BYPASS_AUTH only works outside production — never allow in Vercel prod env.
  // En vez de dejar pasar sin usuario (lo que rompe RLS y hace que las API
  // devuelvan 401), auto-logueamos como el usuario dev vía /auth/dev-login.
  if (process.env.BYPASS_AUTH === 'true' && process.env.NODE_ENV !== 'production') {
    // Dejar pasar la propia ruta de dev-login y todo lo que no sea página.
    if (pathname.startsWith('/auth/dev-login')) {
      return NextResponse.next({ request })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.next({ request })
    }

    let res = NextResponse.next({ request })
    const supabase = createServerClient(supabaseUrl, supabaseKey, {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          res = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          )
        },
      },
    })

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // Sin sesión y pidiendo una PÁGINA (navegación HTML) → bounce por
    // dev-login para crear la sesión. Evitamos rebotar assets como
    // manifest.json, que se piden sin cookies y causarían un loop.
    const wantsHTML = request.headers.get('accept')?.includes('text/html')
    if (!user && wantsHTML && !pathname.startsWith('/api')) {
      const to = request.nextUrl.clone()
      to.pathname = '/auth/dev-login'
      to.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`
      return NextResponse.redirect(to)
    }

    return res
  }

  // DEMO_MODE (runtime) or NEXT_PUBLIC_DEMO_MODE (baked at build) bypass auth.
  // Igual que BYPASS_AUTH: jamás en producción.
  if (
    (process.env.DEMO_MODE === 'true' || process.env.NEXT_PUBLIC_DEMO_MODE === 'true') &&
    process.env.NODE_ENV !== 'production'
  ) {
    return NextResponse.next({ request })
  }

  // If Supabase is not configured or still has placeholder URL, open access (no auth loop).
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const supabaseReady = supabaseUrl && !supabaseUrl.includes('your-project') && supabaseKey
  if (!supabaseReady) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Authenticated users hitting public routes → dashboard
  if (user && (pathname === "/" || pathname.startsWith("/login"))) {
    const url = request.nextUrl.clone()
    url.pathname = "/dashboard"
    return NextResponse.redirect(url)
  }

  // Authenticated users on protected routes: if profile incomplete → onboarding
  // Skip the check when already on /onboarding to avoid redirect loops.
  if (user && !pathname.startsWith("/onboarding") && !isPublicRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("nombre")
      .eq("id", user.id)
      .single<{ nombre: string | null }>()

    if (!profile?.nombre) {
      const url = request.nextUrl.clone()
      url.pathname = "/onboarding"
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
