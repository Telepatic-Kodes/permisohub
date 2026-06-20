import { createClient as createServiceClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import {
  getStripe,
  isStripeAvailable,
  PLAN_INTERVALS,
  PLAN_PRICES,
  type BillingInterval,
  type PlanId,
} from "@/lib/stripe"

// Webhooks must read the raw body to verify Stripe's signature, so this route
// must never be cached or statically optimized.
export const dynamic = "force-dynamic"

/**
 * Admin Supabase client (service role).
 *
 * The webhook has no user session, so it uses the service role key to write to
 * the `subscriptions` table. Falls back to the anon key only if the service
 * role key is absent (RLS policy `Service role manages subscriptions` allows
 * the service role to bypass row-level checks).
 */
function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) {
    throw new Error("Supabase admin credentials not set")
  }
  return createServiceClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

function planFromSubscription(subscription: Stripe.Subscription): {
  plan: PlanId
  interval: BillingInterval
} {
  const item = subscription.items.data[0]
  const priceId = item?.price.id ?? ""
  return {
    plan: PLAN_PRICES[priceId] ?? "free",
    interval: PLAN_INTERVALS[priceId] ?? "monthly",
  }
}

function periodEndIso(subscription: Stripe.Subscription): string | null {
  // In recent Stripe API versions `current_period_end` lives on the
  // subscription item rather than the subscription object itself.
  const seconds = subscription.items.data[0]?.current_period_end
  if (typeof seconds !== "number") return null
  return new Date(seconds * 1000).toISOString()
}

async function upsertFromSubscription(
  subscription: Stripe.Subscription,
  statusOverride?: string,
) {
  const supabase = getAdminClient()
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id
  const userId = subscription.metadata?.user_id ?? null
  const { plan, interval } = planFromSubscription(subscription)

  const row: Record<string, unknown> = {
    stripe_customer_id: customerId,
    stripe_subscription_id: subscription.id,
    plan,
    billing_interval: interval,
    status: statusOverride ?? subscription.status,
    current_period_end: periodEndIso(subscription),
    updated_at: new Date().toISOString(),
  }

  // Prefer matching by user_id (carried in metadata); otherwise match by the
  // Stripe customer id that the checkout route stored earlier.
  if (userId) {
    row.user_id = userId
    await supabase.from("subscriptions").upsert(row, { onConflict: "user_id" })
  } else {
    await supabase
      .from("subscriptions")
      .update(row)
      .eq("stripe_customer_id", customerId)
  }
}

export async function POST(request: Request) {
  if (!isStripeAvailable()) {
    return Response.json(
      { error: "Stripe no está configurado" },
      { status: 503 },
    )
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET
  if (!webhookSecret) {
    return Response.json(
      { error: "STRIPE_WEBHOOK_SECRET not set" },
      { status: 503 },
    )
  }

  const body = await request.text()
  const signature = request.headers.get("stripe-signature") ?? ""

  let event: Stripe.Event
  try {
    event = getStripe().webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    const message = err instanceof Error ? err.message : "invalid signature"
    return Response.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 },
    )
  }

  try {
    switch (event.type) {
      case "customer.subscription.updated":
      case "customer.subscription.created": {
        const subscription = event.data.object as Stripe.Subscription
        await upsertFromSubscription(subscription)
        break
      }
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription
        await upsertFromSubscription(subscription, "canceled")
        break
      }
      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice
        const subscriptionId = invoiceSubscriptionId(invoice)
        if (subscriptionId) {
          const subscription =
            await getStripe().subscriptions.retrieve(subscriptionId)
          await upsertFromSubscription(subscription, "active")
        }
        break
      }
      default:
        // Unhandled event types are acknowledged but ignored.
        break
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error"
    return Response.json(
      { error: `Webhook handler failed: ${message}` },
      { status: 500 },
    )
  }

  return Response.json({ received: true })
}

/**
 * Extract the subscription id from an invoice across Stripe API versions.
 * The field has moved between the invoice root and its parent over time.
 */
function invoiceSubscriptionId(invoice: Stripe.Invoice): string | null {
  const candidate = (invoice as { subscription?: string | { id: string } })
    .subscription
  if (typeof candidate === "string") return candidate
  if (candidate && typeof candidate === "object") return candidate.id

  const parent = (
    invoice as {
      parent?: { subscription_details?: { subscription?: string } | null }
    }
  ).parent
  const fromParent = parent?.subscription_details?.subscription
  return typeof fromParent === "string" ? fromParent : null
}
