import { createClient } from "@/lib/supabase/server"
import { getStripe, isStripeAvailable } from "@/lib/stripe"

// Checkout sessions are created on demand and must never be cached.
export const dynamic = "force-dynamic"

/**
 * Create a Stripe Checkout Session for a subscription.
 *
 * Body: { priceId: string, successUrl?: string, cancelUrl?: string }
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

  let body: { priceId?: string; successUrl?: string; cancelUrl?: string }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const { priceId, successUrl, cancelUrl } = body
  if (!priceId) {
    return Response.json({ error: "priceId requerido" }, { status: 400 })
  }

  const origin =
    request.headers.get("origin") ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    "http://localhost:3000"

  const stripe = getStripe()

  // Resolve or create the Stripe customer for this user.
  const { data: existing } = await supabase
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .single<{ stripe_customer_id: string | null }>()

  let customerId = existing?.stripe_customer_id ?? null

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    })
    customerId = customer.id

    // Persist the customer id so the webhook can match events to the user.
    await supabase.from("subscriptions").upsert(
      {
        user_id: user.id,
        stripe_customer_id: customerId,
      },
      { onConflict: "user_id" },
    )
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url:
      successUrl ?? `${origin}/configuracion/billing?checkout=success`,
    cancel_url: cancelUrl ?? `${origin}/configuracion/billing?checkout=cancel`,
    client_reference_id: user.id,
    subscription_data: {
      metadata: { user_id: user.id },
    },
  })

  return Response.json({ url: session.url })
}
