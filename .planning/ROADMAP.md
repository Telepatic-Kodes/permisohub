# Roadmap: Milestone v1.3 — Army of Skills

**Started:** 2026-06-25
**Phases:** 3 (numbered 7-9, continues from v1.2)

## Phases

- [ ] **Phase 7: Foundation** — Precondiciones críticas: service client, tabla DB y Sheet instalado
- [ ] **Phase 8: Copiloto Core** — Drawer IA embebido con 4 análisis de expediente
- [ ] **Phase 9: Automatizaciones** — Procesos de fondo que corren sin intervención del arquitecto

## Phase Details

### Phase 7: Foundation

**Goal:** Las tres precondiciones están resueltas para que el copiloto y las automatizaciones funcionen correctamente en producción.

**Depends on:** Nothing (first phase of milestone)

**Requirements:** FOUND-01, FOUND-02, FOUND-03

**Success Criteria** (what must be TRUE):
1. Los crons `daily-check` y `weekly-summary` leen filas reales de tablas RLS-protected en producción (no 0 filas silenciosas)
2. La tabla `document_checklist_items` existe en Supabase y acepta INSERT con los campos definidos
3. El componente `Sheet` de shadcn/ui está disponible para importar desde `@/components/ui/sheet`

**Plans:** 3 plans

Plans:
- [ ] 07-01-PLAN.md — FOUND-01: create lib/supabase/service.ts + patch both cron files
- [ ] 07-02-PLAN.md — FOUND-02: add document_checklist_items table to schema.sql + apply migration
- [ ] 07-03-PLAN.md — FOUND-03: install Sheet component via shadcn CLI

---

### Phase 8: Copiloto Core

**Goal:** El arquitecto puede abrir un panel lateral desde cualquier proyecto y obtener 4 análisis IA específicos al expediente sin ingresar datos adicionales.

**Depends on:** Phase 7 (Sheet component for drawer, `document_checklist_items` table for SKILL-04)

**Requirements:** SKILL-01, SKILL-02, SKILL-03, SKILL-04, SKILL-05

**Success Criteria** (what must be TRUE):
1. Desde un proyecto de Permisos, Desarchivo o Patentes, el arquitecto abre el panel "Copiloto IA" con un click y ve task cards sugeridas (no input en blanco)
2. La pestaña Diagnóstico OGUC muestra fórmulas normativas con los valores reales del proyecto interpolados y cita el artículo OGUC aplicable
3. La pestaña Predicción de Observaciones lista observaciones probables cada una con categoría, señal de frecuencia, trigger específico en este expediente y acción preventiva
4. La pestaña Checklist genera ítems con `item_key` y artículo normativo, persiste a DB y el estado pendiente/ok es modificable manualmente desde el drawer
5. La pestaña Estimación muestra un rango de días hábiles y el monto de derechos en CLP y UF basado en datos del proyecto e inteligencia municipal

**Plans:** 3 plans

Plans:
- [ ] 08-01-PLAN.md — POST /api/ai/copiloto (4 concurrent AI skills) + PATCH checklist toggle endpoint
- [ ] 08-02-PLAN.md — CopilotoDrawer + CopilotoTrigger + 4 tab components
- [ ] 08-03-PLAN.md — Wire CopilotoTrigger + CopilotoDrawer into permisos, patentes, proyectos/[id] pages

---

### Phase 9: Automatizaciones

**Goal:** Tres procesos corren de fondo sin intervención del arquitecto: actualización DOM diaria, notificación WhatsApp al cliente, enriquecimiento SII en patentes y resumen semanal por email.

**Depends on:** Phase 7 (service client fix unblocks AUTO-01, AUTO-02, AUTO-04; `after()` pattern for AUTO-03 is independent but DB must be ready)

**Requirements:** AUTO-01, AUTO-02, AUTO-03, AUTO-04

**Success Criteria** (what must be TRUE):
1. Cuando el scraper DOM detecta un cambio de estado, el campo `estado` y `etapa` del proyecto se actualiza en DB de forma idempotente (doble invocación de Vercel no genera duplicados)
2. Cuando el estado DOM de un proyecto cambia en DB, el cliente del proyecto recibe un WhatsApp con el nuevo estado sin acción del arquitecto
3. Al crear una patente comercial, el formulario responde inmediatamente y `giro_sii` y `rol_avaluo` se pre-llenan en DB segundos después via enriquecimiento SII asíncrono
4. Cada lunes a las 08:00 America/Santiago el arquitecto recibe un email con el estado de todos sus proyectos activos más un tip/insight generado por IA

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 7. Foundation | 0/3 | Not started | - |
| 8. Copiloto Core | 0/3 | Not started | - |
| 9. Automatizaciones | 0/? | Not started | - |

---

# Roadmap: Milestone v1.2 — Dashboard Clarity

**Started:** 2026-06-21
**Phases:** 1 (numbered 6, continues from v1.1)

| # | Phase | Goal | Requirements | Status |
|---|-------|------|--------------|--------|
| 6 | Dashboard Timeline View | Flujo único organizado por urgencia/tiempo | DASH-01→06 | ✅ Complete |

---

# Roadmap: Milestone v1.1 — Cumplir la Promesa

**Started:** 2026-06-20
**Phases:** 5 (numbered 1-5 for v1.1)

| # | Phase | Goal | Requirements | Status |
|---|-------|------|--------------|--------|
| 1 | Stripe Billing | Cobrar dinero real | BILL-01→07 | ✅ Complete |
| 2 | Feature Gating | Tier limits enforced | GATE-01→06 | ✅ Complete |
| 3 | Landing Page | Página pública de conversión | LAND-01→04 | ✅ Complete |
| 4 | Onboarding Flow | Activación de nuevos usuarios | ONBD-01→03 | ✅ Complete |
| 5 | PWA | App instalable en móvil | PWA-01→03 | ✅ Complete |

---

## Phase 1: Stripe Billing

**Goal:** Cobrar dinero real — integrar Stripe con CLP pricing y sincronizar estado de suscripción via webhook.

**Requirements:** BILL-01, BILL-02, BILL-03, BILL-04, BILL-05, BILL-06, BILL-07

**Deliverables:**
- `lib/stripe.ts` — cliente Stripe singleton
- `lib/subscription.ts` — helpers getUserSubscription, getPlanFromPriceId
- `app/api/billing/checkout/route.ts` — crea Stripe Checkout Session
- `app/api/billing/portal/route.ts` — crea Stripe Customer Portal session
- `app/api/billing/webhook/route.ts` — maneja eventos de Stripe
- `app/(dashboard)/configuracion/billing/page.tsx` — UI de billing
- SQL: tabla `subscriptions` en Supabase

**Success criteria:**
1. Usuario no autenticado no puede acceder a /configuracion/billing
2. Usuario autenticado ve su plan actual (free por defecto)
3. Click en "Suscribirse Pro" abre Stripe Checkout con precio en CLP
4. Webhook recibe evento → actualiza DB → usuario ve plan activo
5. Botón "Gestionar suscripción" abre Stripe Customer Portal

---

## Phase 2: Feature Gating

**Goal:** Tier limits enforced — el plan del usuario determina qué puede hacer en la app.

**Requirements:** GATE-01, GATE-02, GATE-03, GATE-04, GATE-05, GATE-06

**Depends on:** Phase 1 (tabla subscriptions + lib/subscription.ts)

**Deliverables:**
- `lib/plan-limits.ts` — constantes de límites por plan
- `lib/usage.ts` — tracking de uso mensual
- `components/ui/upgrade-prompt.tsx` — modal de upgrade
- Modificación `app/api/ai/chat/route.ts` — check ai_chats limit
- Modificación `app/api/ai/extract-observations/route.ts` — check pdf_extractions limit
- Modificación `app/(dashboard)/proyectos/page.tsx` — check projects limit
- SQL: tabla `usage_events` en Supabase

**Success criteria:**
1. Usuario Starter con 5 proyectos ve botón "Nuevo proyecto" deshabilitado
2. Usuario Starter que alcanza 20 chats/mes recibe 402 con mensaje de upgrade
3. Upgrade prompt muestra el plan Pro con CTA a Stripe Checkout
4. Usuario Pro no tiene restricciones de uso

---

## Phase 3: Landing Page

**Goal:** Página pública de conversión con SEO y pricing conectado a Stripe.

**Requirements:** LAND-01, LAND-02, LAND-03, LAND-04

**Deliverables:**
- `app/(marketing)/page.tsx` — landing page pública en `/`
- `app/(marketing)/layout.tsx` — layout sin sidebar (público)
- Mover dashboard home: `app/(dashboard)/page.tsx` → `app/(dashboard)/dashboard/page.tsx`
- Modificación `lib/supabase/middleware.ts` — agregar `/` a rutas públicas
- Modificación `components/dashboard/sidebar.tsx` — cambiar Dashboard link a `/dashboard`

**Secciones:**
1. Nav — logo + "Iniciar sesión" + "Comenzar gratis"
2. Hero — tagline + stats (124 días, US$2B, 81 municipios)
3. Features — 6 cards
4. Pricing — 3 tiers con toggle mensual/anual + CTA Stripe
5. Footer

**Success criteria:**
1. `localhost:7891` sin sesión → muestra landing (no redirige a /login)
2. `localhost:7891/dashboard` sin sesión → redirige a /login
3. Click en "Suscribirse Pro" en landing → Stripe Checkout
4. Meta tags correctos en <head>

---

## Phase 4: Onboarding Flow

**Goal:** Activación — usuarios nuevos crean su primer proyecto sin fricción.

**Requirements:** ONBD-01, ONBD-02, ONBD-03

**Deliverables:**
- `app/(dashboard)/onboarding/page.tsx` — wizard 3 pasos
- `components/dashboard/setup-checklist.tsx` — widget en dashboard
- Modificación `app/(dashboard)/layout.tsx` — redirect a /onboarding si no completado
- SQL: columnas `onboarding_completed`, `onboarding_step` en tabla `profiles`

**Success criteria:**
1. Usuario nuevo (sin proyectos, sin onboarding_completed) → redirect a /onboarding
2. Wizard tiene 3 pasos visuales: Bienvenida → Primer proyecto → Tour
3. Al completar → redirige al dashboard con checklist visible
4. Usuario que ya completó onboarding no ve el wizard al volver

---

## Phase 5: PWA

**Goal:** App instalable en iOS y Android desde el browser.

**Requirements:** PWA-01, PWA-02, PWA-03

**Deliverables:**
- `public/manifest.json`
- `public/icons/icon-192.png`, `public/icons/icon-512.png`
- `public/sw.js`
- `components/pwa-install-prompt.tsx`
- Modificación `app/layout.tsx` — agregar manifest link + theme-color + SW registration

**Success criteria:**
1. Chrome DevTools → Application → Manifest → todos los campos completos
2. Mobile Chrome → muestra prompt "Agregar a pantalla de inicio"
3. Instalada como PWA → abre sin chrome (display: standalone)
4. Lighthouse PWA score ≥ 90

---
*Roadmap created: 2026-06-20*
*v1.3 section added: 2026-06-25*
