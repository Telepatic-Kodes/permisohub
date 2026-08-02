# Roadmap: PermisoHub

## Milestones

- ✅ **v1.4 Zonificación** — Phases 10-12 (shipped 2026-07-30) — [full detail](milestones/1.4-ROADMAP.md)
- ✅ **v1.5 Fusión PROPRA·BI** — ad-hoc, sin fases GSD (shipped 2026-08-01) — ver `.planning/MILESTONES.md`
- 🚧 **v1.6 Reportes Profesionales de Oportunidades** — Phases 13-15 (in progress)

<details>
<summary>✅ v1.4 Zonificación (Phases 10-12) — SHIPPED 2026-07-30</summary>

- [x] Phase 10: Motor de Zonificación (5/5 plans) — completed 2026-07-30
- [x] Phase 11: Vista de Zonificación en el Proyecto (8/8 plans) — completed 2026-07-30
- [x] Phase 12: Integración con Motores de Decisión (4/4 plans) — completed 2026-07-30

Full details archived: `.planning/milestones/1.4-ROADMAP.md`

</details>

---

**Note (2026-07-30):** This is the first time `/gsd:complete-milestone` has run for this project. Milestones v1.1 ("Cumplir la Promesa"), v1.2 ("Dashboard Clarity"), and v1.3 ("Army of Skills") were already shipped previously but were never separately archived — their full phase details remain below, un-collapsed, exactly as they were before this milestone close. Deliberately left them in place rather than retroactively archiving them (out of scope for closing v1.4; do this properly in a future `/gsd:cleanup` pass if desired, extracting each into its own `.planning/milestones/v{X.Y}-ROADMAP.md`).

---

# Roadmap: Milestone v1.6 — Reportes Profesionales de Oportunidades

**Started:** 2026-08-02
**Phases:** 3 (numbered 13-15, continues from v1.4 — v1.5 and the ad-hoc sessions since did not use GSD phase numbering, see `.planning/MILESTONES.md` and PROJECT.md Key Decisions)

**Goal:** Elevar `/mercado-inmobiliario/oportunidades` (hoy lista plana + histograma) a un producto de reporting profesional — dashboard de detalle por oportunidad, comparación lado a lado, e informe exportable — informado por investigación real de cómo reportan CBRE/JLL/Colliers y CoStar/LoopNet/Crexi. Alcance confirmado con la founder: solo Oportunidades, Reportes de Mercado queda fuera (ver Backlog en PROJECT.md).

## Phases

- [x] **Phase 13: Refactor de Scoring + Dashboard de Detalle** — Ficha de detalle por oportunidad en su propia ruta, con posicionamiento vs. cohorte, historial de precio, señales y resumen ejecutivo IA (completed 2026-08-02)
- [x] **Phase 14: Comparación Lado a Lado** — Selección de 2-5 oportunidades del mismo tipo/operación, comparadas en tabla vía estado-en-URL (completed 2026-08-02)
- [ ] **Phase 15: Informe Exportable** — Vista imprimible/exportable de una oportunidad o comparación, con portada, metodología y personalización

## Phase Details

### Phase 13: Refactor de Scoring + Dashboard de Detalle

**Goal:** El arquitecto/inversionista puede abrir la ficha de una oportunidad individual y ver, en una sola pantalla, todo lo que hoy solo existe repartido entre la card de la lista y el histograma — posicionamiento real vs. mercado, historial, señales explicadas, comparables sugeridos y un resumen ejecutivo narrado por IA.

**Depends on:** Nothing (first phase of milestone)

**Requirements:** DETA-01, DETA-02, DETA-03, DETA-04, DETA-05, DETA-06, DETA-07

**Success Criteria** (what must be TRUE):
1. Usuario puede abrir la ficha de detalle de una oportunidad individual en su propia ruta (`/mercado-inmobiliario/oportunidades/[id]`), no solo la card de la lista
2. La ficha muestra el posicionamiento de precio vs. la banda de mercado real de su cohorte (P25/mediana/P75), con la muestra (`muestra_n`) declarada explícitamente
3. La ficha muestra el historial de precio del listing, hace cuántos días está publicado, y explica en detalle los reason codes junto con las señales cruzadas (expansión de cadenas, tendencia constructiva) ya usadas en la lista
4. La ficha sugiere automáticamente otras oportunidades comparables de la misma comuna/tipo
5. La ficha incluye un resumen ejecutivo narrado por IA (patrón `InformeEjecutivo`) y, solo cuando hay cobertura real de datos para calcularla, una rentabilidad implícita de zona etiquetada explícitamente como estimado

**Plans:** 7/7 plans complete

Plans:
- [ ] 13-01-PLAN.md — Extraer evaluarOportunidad() (TDD, prerequisito de scoring)
- [ ] 13-02-PLAN.md — Utilidades compartidas: formato-fecha, streamConContexto, prompts del resumen
- [ ] 13-03-PLAN.md — Capa de datos: obtenerOportunidadPorId, obtenerComparablesOportunidad, obtenerHistorialPrecioListing
- [ ] 13-04-PLAN.md — Resumen ejecutivo IA: ruta SSE + ResumenTab
- [ ] 13-05-PLAN.md — Tab Posicionamiento + Rentabilidad implícita de zona
- [ ] 13-06-PLAN.md — Tab Historial + Tab Comparables
- [ ] 13-07-PLAN.md — Ensamblado final: [id]/page.tsx + wiring de la lista + checkpoint humano

---

### Phase 14: Comparación Lado a Lado

**Goal:** El arquitecto/inversionista puede poner 2 a 5 oportunidades comparables una al lado de la otra y ver de inmediato cuál conviene más por atributo, sin poder mezclar por error tipos de propiedad u operaciones distintas.

**Depends on:** Phase 13 (reusa `evaluarOportunidad()`, `obtenerOportunidadPorId()` y los widgets ya resueltos por listing)

**Requirements:** COMPA-01, COMPA-02, COMPA-03, COMPA-04

**Success Criteria** (what must be TRUE):
1. Usuario puede seleccionar entre 2 y 5 oportunidades del mismo tipo de propiedad y misma operación para comparar
2. La comparación se muestra en tabla (columnas=propiedades, filas=atributos), con el mejor valor resaltado por fila
3. El sistema previene estructuralmente (checkbox/selección deshabilitada, no solo una advertencia) seleccionar oportunidades de tipo/operación distintos en la misma comparación
4. La selección de comparación persiste en la URL (`?ids=`) — compartible y recargable

**Plans:** 3/3 plans complete

Plans:
- [ ] 14-01-PLAN.md — Capa de datos: obtenerOportunidadesPorIds() batched + construirOportunidadDetalle() extraído
- [ ] 14-02-PLAN.md — SelectorComparacion (checkbox + tope 5 + botón flotante) wireado en la lista
- [ ] 14-03-PLAN.md — TablaComparacion + /oportunidades/comparar con validación server-side de homogeneidad (defensa real de COMPA-03) + checkpoint humano end-to-end

---

### Phase 15: Informe Exportable

**Goal:** El arquitecto/inversionista puede generar una vista exportable/imprimible — de una oportunidad individual o de una comparación — para compartir externamente con cliente o inversionista, con la misma disciplina de fuentes y fechas que ya rige el resto del proyecto.

**Depends on:** Phase 13 (informe de oportunidad individual) y Phase 14 (informe de comparación)

**Requirements:** INFO-01, INFO-02, INFO-03, INFO-04

**Success Criteria** (what must be TRUE):
1. Usuario puede exportar/imprimir un informe de una oportunidad individual con portada, cuerpo y sección de metodología/fuentes
2. Usuario puede exportar/imprimir un informe de una comparación de oportunidades con la misma disciplina de fuentes
3. El informe muestra fecha de generación Y fecha de última verificación por dato (nunca un snapshot sin fecha)
4. Usuario puede personalizar el informe con un campo "preparado por / para" en la portada

**Plans:** TBD

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 13. Refactor de Scoring + Dashboard de Detalle | 0/7 | Complete    | 2026-08-02 |
| 14. Comparación Lado a Lado | 0/3 | Complete    | 2026-08-02 |
| 15. Informe Exportable | 0/TBD | Not started | - |

---

# Roadmap: Milestone v1.3 — Army of Skills

**Started:** 2026-06-25
**Phases:** 3 (numbered 7-9, continues from v1.2)

## Phases

- [ ] **Phase 7: Foundation** — Precondiciones críticas: service client, tabla DB y Sheet instalado
- [ ] **Phase 8: Copiloto Core** — Drawer IA embebido con 4 análisis de expediente
- [x] **Phase 9: Automatizaciones** — Procesos de fondo que corren sin intervención del arquitecto (completed 2026-06-26)

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

**Plans:** 3/3 plans complete

Plans:
- [ ] 09-01-PLAN.md — AUTO-01+02: idempotency + etapa_actual + decouple DOM scraper from WA guard
- [ ] 09-02-PLAN.md — AUTO-03: after() SII enrichment on patente_comercial creation
- [ ] 09-03-PLAN.md — AUTO-04: AI tip generation in weekly-summary + schedule fix

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 7. Foundation | 0/3 | Not started | - |
| 8. Copiloto Core | 0/3 | Not started | - |
| 9. Automatizaciones | 0/3 | Complete    | 2026-06-26 |

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
*v1.4 section added: 2026-07-30*
