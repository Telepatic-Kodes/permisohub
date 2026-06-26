import { createClient } from "@supabase/supabase-js"

/**
 * Server-only Supabase admin client.
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY to bypass RLS. NEVER use in client
 * components or browser-accessible routes. Safe for crons, webhooks,
 * and background jobs where there is no user session.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error(
      "Missing Supabase service credentials: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set"
    )
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
