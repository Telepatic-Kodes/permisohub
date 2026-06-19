import { createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

/**
 * Server-side Supabase client.
 *
 * Use this in Server Components, Route Handlers and Server Actions.
 * It wires Supabase's auth cookie handling into Next.js `cookies()`.
 *
 * Note: in Next.js 15, `cookies()` is async, so this factory is async too.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            )
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if there is middleware refreshing
            // user sessions (see middleware.ts).
          }
        },
      },
    },
  )
}
