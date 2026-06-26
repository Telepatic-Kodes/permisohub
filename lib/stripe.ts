import Stripe from "stripe"

let _stripe: Stripe | null = null

/**
 * Lazily instantiate the Stripe SDK client.
 *
 * We intentionally do NOT pin `apiVersion`: the installed SDK (v22) only
 * accepts its own pinned `LatestApiVersion` as a literal, so passing an older
 * string would break the build. Omitting it lets the SDK use the version that
 * matches its bundled types.
 */
export function getStripe(): Stripe {
  if (!_stripe) {
    if (!process.env.STRIPE_SECRET_KEY) {
      throw new Error("STRIPE_SECRET_KEY not set")
    }
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
  }
  return _stripe
}

export function isStripeAvailable(): boolean {
  return !!process.env.STRIPE_SECRET_KEY
}

export type PlanId = "free" | "starter" | "pro" | "estudio" | "enterprise"

export type BillingInterval = "monthly" | "annual"

/**
 * Maps a Stripe price id (taken from env vars) to the internal plan id.
 *
 * The map is built at module load from the `STRIPE_PRICE_*` env vars so the
 * webhook can resolve `price_id → plan_id` without hardcoding price ids.
 */
export const PLAN_PRICES: Record<string, PlanId> = (() => {
  const entries: Array<[string | undefined, PlanId]> = [
    [process.env.STRIPE_PRICE_STARTER_MONTHLY, "starter"],
    [process.env.STRIPE_PRICE_STARTER_ANNUAL, "starter"],
    [process.env.STRIPE_PRICE_PRO_MONTHLY, "pro"],
    [process.env.STRIPE_PRICE_PRO_ANNUAL, "pro"],
    [process.env.STRIPE_PRICE_ESTUDIO_MONTHLY, "estudio"],
    [process.env.STRIPE_PRICE_ESTUDIO_ANNUAL, "estudio"],
    [process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY, "enterprise"],
    [process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL, "enterprise"],
  ]
  const map: Record<string, PlanId> = {}
  for (const [priceId, plan] of entries) {
    if (priceId) map[priceId] = plan
  }
  return map
})()

/**
 * Maps a Stripe price id to its billing interval.
 */
export const PLAN_INTERVALS: Record<string, BillingInterval> = (() => {
  const entries: Array<[string | undefined, BillingInterval]> = [
    [process.env.STRIPE_PRICE_STARTER_MONTHLY, "monthly"],
    [process.env.STRIPE_PRICE_STARTER_ANNUAL, "annual"],
    [process.env.STRIPE_PRICE_PRO_MONTHLY, "monthly"],
    [process.env.STRIPE_PRICE_PRO_ANNUAL, "annual"],
    [process.env.STRIPE_PRICE_ESTUDIO_MONTHLY, "monthly"],
    [process.env.STRIPE_PRICE_ESTUDIO_ANNUAL, "annual"],
    [process.env.STRIPE_PRICE_ENTERPRISE_MONTHLY, "monthly"],
    [process.env.STRIPE_PRICE_ENTERPRISE_ANNUAL, "annual"],
  ]
  const map: Record<string, BillingInterval> = {}
  for (const [priceId, interval] of entries) {
    if (priceId) map[priceId] = interval
  }
  return map
})()

export const PLAN_NAMES: Record<PlanId, string> = {
  free: "Gratis",
  starter: "Starter",
  pro: "Pro",
  estudio: "Estudio",
  enterprise: "Enterprise",
}

export const PLAN_AMOUNTS: Record<PlanId, { monthly: number; annual: number }> =
  {
    free: { monthly: 0, annual: 0 },
    starter: { monthly: 29990, annual: 24900 },
    pro: { monthly: 79990, annual: 66300 },
    estudio: { monthly: 149990, annual: 124400 },
    enterprise: { monthly: 349990, annual: 290400 },
  }

/**
 * Resolve the configured Stripe price id for a plan + interval, reading the
 * matching `STRIPE_PRICE_*` env var. Returns `null` when not configured.
 */
export function getPriceId(
  plan: PlanId,
  interval: BillingInterval,
): string | null {
  if (plan === "free") return null
  const key = `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}`
  return process.env[key] ?? null
}
