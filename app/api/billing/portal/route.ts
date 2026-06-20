import { createClient } from "@/lib/supabase/server"
import { getStripe, isStripeAvailable } from "@/lib/stripe"

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

  let returnUrl: string | undefined
  try {
    const body = (await request.json()) as { returnUrl?: string }
    returnUrl = body.returnUrl
  } catch {
    returnUrl = undefined
  }

  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"

  const stripe = getStripe()
  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl ?? `${origin}/configuracion/billing`,
  })

  return Response.json({ url: portalSession.url })
}
