import { Check } from "lucide-react"
import { createClient } from "@/lib/supabase/server"
import {
  getPriceId,
  isStripeAvailable,
  PLAN_AMOUNTS,
  PLAN_NAMES,
  type PlanId,
} from "@/lib/stripe"
import { getUserSubscription, type Subscription } from "@/lib/subscription"
import { PageHeader } from "@/components/dashboard/page-header"
import { Badge } from "@/components/ui/badge"
import {
  ManageSubscriptionButton,
  SubscribeButton,
} from "./actions"

export const dynamic = "force-dynamic"

interface PlanCard {
  id: PlanId
  features: string[]
  highlighted?: boolean
}

const PLAN_CARDS: PlanCard[] = [
  {
    id: "starter",
    features: [
      "Hasta 10 proyectos activos",
      "Checklist normativo OGUC",
      "Calculadora de derechos municipales",
      "Soporte por email",
    ],
  },
  {
    id: "pro",
    highlighted: true,
    features: [
      "Proyectos ilimitados",
      "Chat OGUC con IA",
      "Verificador de cumplimiento",
      "Inteligencia DOM por municipio",
      "Alertas WhatsApp",
      "Soporte prioritario",
    ],
  },
  {
    id: "estudio",
    features: [
      "Todo lo de Pro",
      "Multiusuario (equipo)",
      "Reportes y analítica avanzada",
      "Integraciones a medida",
      "Gerente de cuenta dedicado",
    ],
  },
]

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
})

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso))
}

function planBadgeClass(plan: PlanId): string {
  switch (plan) {
    case "pro":
      return "bg-primary text-white"
    case "estudio":
      return "bg-primary/80 text-white"
    case "starter":
      return "bg-primary/15 text-primary"
    default:
      return "bg-primary/10 text-primary/70"
  }
}

function StripeNotConfigured() {
  const envVars = [
    "STRIPE_SECRET_KEY=sk_live_...",
    "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...",
    "STRIPE_WEBHOOK_SECRET=whsec_...",
    "STRIPE_PRICE_STARTER_MONTHLY=price_...",
    "STRIPE_PRICE_STARTER_ANNUAL=price_...",
    "STRIPE_PRICE_PRO_MONTHLY=price_...",
    "STRIPE_PRICE_PRO_ANNUAL=price_...",
    "STRIPE_PRICE_ESTUDIO_MONTHLY=price_...",
    "STRIPE_PRICE_ESTUDIO_ANNUAL=price_...",
  ]
  return (
    <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
      <h2 className="text-sm font-semibold text-amber-900">
        Stripe no está configurado
      </h2>
      <p className="mt-1 text-sm text-amber-800">
        Define las siguientes variables de entorno para habilitar la
        facturación:
      </p>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-amber-900/90 p-4 text-xs leading-relaxed text-amber-50">
        {envVars.join("\n")}
      </pre>
    </div>
  )
}

function CurrentPlanSummary({
  subscription,
}: {
  subscription: Subscription | null
}) {
  const plan: PlanId = subscription?.plan ?? "free"
  const isActive = subscription?.status === "active"
  const interval = subscription?.billingInterval ?? "monthly"
  const amount = PLAN_AMOUNTS[plan][interval]

  return (
    <div className="rounded-xl border border-border bg-white p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-primary/50">
            Plan actual
          </p>
          <div className="mt-1.5 flex items-center gap-2.5">
            <span className="text-2xl font-semibold text-primary">
              {PLAN_NAMES[plan]}
            </span>
            <Badge className={planBadgeClass(plan)}>
              {isActive ? "Activo" : (subscription?.status ?? "Sin suscripción")}
            </Badge>
          </div>
        </div>
        {subscription && subscription.stripeCustomerId && (
          <ManageSubscriptionButton />
        )}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 border-t border-border pt-5 sm:grid-cols-2">
        <div>
          <p className="text-xs text-primary/50">Monto</p>
          <p className="mt-0.5 text-sm font-medium text-primary">
            {plan === "free"
              ? "Gratis"
              : `${CLP.format(amount)} / ${interval === "annual" ? "mes (anual)" : "mes"}`}
          </p>
        </div>
        <div>
          <p className="text-xs text-primary/50">Próxima renovación</p>
          <p className="mt-0.5 text-sm font-medium text-primary">
            {formatDate(subscription?.currentPeriodEnd ?? null)}
          </p>
        </div>
      </div>
    </div>
  )
}

function PlanCardView({
  card,
  currentPlan,
}: {
  card: PlanCard
  currentPlan: PlanId
}) {
  const amounts = PLAN_AMOUNTS[card.id]
  const monthlyPriceId = getPriceId(card.id, "monthly")
  const isCurrent = currentPlan === card.id

  const containerClass = card.highlighted
    ? "rounded-xl border-2 border-primary bg-primary p-6 text-white shadow-md"
    : "rounded-xl border border-border bg-white p-6"

  const featureTextClass = card.highlighted
    ? "text-white/90"
    : "text-primary/80"

  return (
    <div className={containerClass}>
      <div className="flex items-center justify-between">
        <h3
          className={
            card.highlighted
              ? "text-lg font-semibold text-white"
              : "text-lg font-semibold text-primary"
          }
        >
          {PLAN_NAMES[card.id]}
        </h3>
        {card.highlighted && (
          <span className="rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white">
            Recomendado
          </span>
        )}
      </div>

      <div className="mt-4">
        <p
          className={
            card.highlighted
              ? "text-3xl font-bold text-white"
              : "text-3xl font-bold text-primary"
          }
        >
          {CLP.format(amounts.monthly)}
          <span
            className={
              card.highlighted
                ? "text-sm font-normal text-white/70"
                : "text-sm font-normal text-primary/60"
            }
          >
            {" "}
            / mes
          </span>
        </p>
        <p
          className={
            card.highlighted
              ? "mt-1 text-xs text-white/70"
              : "mt-1 text-xs text-primary/60"
          }
        >
          o {CLP.format(amounts.annual)} / mes facturado anual
        </p>
      </div>

      <ul className="mt-5 space-y-2.5">
        {card.features.map((feature) => (
          <li
            key={feature}
            className={`flex items-start gap-2 text-sm ${featureTextClass}`}
          >
            <Check
              className={
                card.highlighted
                  ? "mt-0.5 size-4 shrink-0 text-white"
                  : "mt-0.5 size-4 shrink-0 text-primary"
              }
            />
            <span>{feature}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {isCurrent ? (
          <p
            className={
              card.highlighted
                ? "rounded-lg bg-white/15 px-4 py-2.5 text-center text-sm font-medium text-white"
                : "rounded-lg bg-primary/5 px-4 py-2.5 text-center text-sm font-medium text-primary"
            }
          >
            Tu plan actual
          </p>
        ) : monthlyPriceId ? (
          <SubscribeButton
            priceId={monthlyPriceId}
            label="Suscribirse"
            highlighted={card.highlighted}
          />
        ) : (
          <p
            className={
              card.highlighted
                ? "text-center text-xs text-white/70"
                : "text-center text-xs text-primary/50"
            }
          >
            Precio no configurado
          </p>
        )}
      </div>
    </div>
  )
}

export default async function BillingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const subscription = user ? await getUserSubscription(user.id) : null
  const currentPlan: PlanId =
    subscription && subscription.status === "active" ? subscription.plan : "free"

  return (
    <div className="flex min-h-screen flex-col">
      <PageHeader
        emoji="💳"
        title="Facturación"
        breadcrumbs={[
          { label: "Configuración", href: "/configuracion" },
          { label: "Facturación" },
        ]}
      />
      <div className="flex-1 overflow-auto p-8">
        <div className="mx-auto max-w-5xl">
      {!isStripeAvailable() ? (
        <div className="space-y-8">
          <StripeNotConfigured />
          <CurrentPlanSummary subscription={subscription} />
        </div>
      ) : (
        <div className="space-y-8">
          <CurrentPlanSummary subscription={subscription} />

          <section>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-primary/50">
              Planes disponibles
            </h2>
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {PLAN_CARDS.map((card) => (
                <PlanCardView
                  key={card.id}
                  card={card}
                  currentPlan={currentPlan}
                />
              ))}
            </div>
          </section>
        </div>
      )}
        </div>
      </div>
    </div>
  )
}
