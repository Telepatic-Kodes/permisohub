import { createClient } from "@/lib/supabase/server"
import { getStripe, isStripeAvailable } from "@/lib/stripe"
import { PortalBodySchema } from "@/lib/schemas"
import { checkRateLimit } from "@/lib/rate-limit"

// Portal sessions are created on demand and must never be cached.
export const dynamic = "force-dynamic"

/**
 * Create a Stripe Customer Portal session so the user can manage their
 * subscription (update payment method, cancel, view invoices).
 *
 * Body: { returnUrl?: string }
 * Returns: { url: string }
 */
export async function POST(request: Request) {
  if (!isStripeAvailable()) {
    return Response.json(
      { error: "Stripe no está configurado" },
      { status: 503 },
    )
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "No autenticado" }, { status: 401 })
  }

  const rateLimit = await checkRateLimit(`billing:${user.id}`)
  if (rateLimit) return rateLimit

  const { data: sub } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single<{ stripe_customer_id: string | null }>()

  const customerId = sub?.stripe_customer_id
  if (!customerId) {
    return Response.json(
      { error: "No hay un cliente de Stripe asociado" },
      { status: 400 },
    )
  }

  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"

  let returnUrl: string | undefined
  try {
    const raw = await request.json()
    const parsed = PortalBodySchema.safeParse(raw)
    if (parsed.success && parsed.data.returnUrl) {
      // Only allow return URLs within the same origin
      try {
        const parsedUrl = new URL(parsed.data.returnUrl)
        if (parsedUrl.origin === origin) returnUrl = parsed.data.returnUrl
      } catch { /* invalid URL — use default */ }
    }
  } catch {
    returnUrl = undefined
  }

  const stripe = getStripe()
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl ?? `${origin}/configuracion/billing`,
  })

  return Response.json({ url: portalSession.url })
}
