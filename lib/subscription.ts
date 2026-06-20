import { createClient } from "@/lib/supabase/server"
import type { BillingInterval, PlanId } from "./stripe"

export interface Subscription {
  id: string
  userId: string
  plan: PlanId
  billingInterval: BillingInterval
  status: string
  stripeCustomerId: string | null
  stripeSubscriptionId: string | null
  currentPeriodEnd: string | null
}

interface SubscriptionRow {
  id: string
  user_id: string
  plan: string
  billing_interval: string | null
  status: string
  stripe_customer_id: string | null
  stripe_subscription_id: string | null
  current_period_end: string | null
}

export async function getUserSubscription(
  userId: string,
): Promise<Subscription | null> {
  const supabase = await createClient()
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single<SubscriptionRow>()

  if (!data) return null

  return {
    id: data.id,
    userId: data.user_id,
    plan: data.plan as PlanId,
    billingInterval: (data.billing_interval ?? "monthly") as BillingInterval,
    status: data.status,
    stripeCustomerId: data.stripe_customer_id,
    stripeSubscriptionId: data.stripe_subscription_id,
    currentPeriodEnd: data.current_period_end,
  }
}

export async function getUserPlan(userId: string): Promise<PlanId> {
  const sub = await getUserSubscription(userId)
  if (!sub || sub.status !== "active") return "free"
  return sub.plan
}
