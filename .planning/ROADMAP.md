# Roadmap: PermisoHub

## Milestones

- ✅ **v1.4 Zonificación** — Phases 10-12 (shipped 2026-07-30) — [full detail](milestones/1.4-ROADMAP.md)
- ✅ **v1.5 Fusión PROPRA·BI** — ad-hoc, sin fases GSD (shipped 2026-08-01) — ver `.planning/MILESTONES.md`
- ✅ **v1.6 Reportes Profesionales de Oportunidades** — Phases 13-15 (shipped 2026-08-02) — [full detail](milestones/v1.6-ROADMAP.md)
- 🚧 **v1.7 Cabida Comercial** — Phases 16-19 (in progress)

<details>
<summary>✅ v1.4 Zonificación (Phases 10-12) — SHIPPED 2026-07-30</summary>

- [x] Phase 10: Motor de Zonificación (5/5 plans) — completed 2026-07-30
- [x] Phase 11: Vista de Zonificación en el Proyecto (8/8 plans) — completed 2026-07-30
- [x] Phase 12: Integración con Motores de Decisión (4/4 plans) — completed 2026-07-30

Full details archived: `.planning/milestones/1.4-ROADMAP.md`

</details>

<details>
<summary>✅ v1.6 Reportes Profesionales de Oportunidades (Phases 13-15) — SHIPPED 2026-08-02</summary>

- [x] Phase 13: Refactor de Scoring + Dashboard de Detalle (7/7 plans) — completed 2026-08-02
- [x] Phase 14: Comparación Lado a Lado (3/3 plans) — completed 2026-08-02
- [x] Phase 15: Informe Exportable (3/3 plans) — completed 2026-08-02

Full details archived: `.planning/milestones/v1.6-ROADMAP.md`

</details>

### 🚧 v1.7 Cabida Comercial (In Progress)

**Milestone Goal:** Determinar si hay demanda real ("cabida") para un nuevo supermercado, minimarket, strip center o power center en una oportunidad, cruzando demografía/consumo público chileno y competencia existente dentro de un área de influencia (isócrona) — nunca con veredictos binarios ni datos fabricados.

#### Phases

- [ ] **Phase 16: Ubicación e Isócrona (Motor Desacoplado)** - Resuelve punto geolocalizado + área de influencia con degradación explícita; arquitectura de motor puro día 1
- [ ] **Phase 17: Demografía y Consumo** - Población censal + capacidad de gasto estimada dentro del área de influencia, con fuente/vintage citados
- [ ] **Phase 18: Competencia por Formato** - Conteo y roster de competidores por formato (supermercado/minimarket/strip/power center) con confianza degradada ante cobertura incompleta
- [ ] **Phase 19: Veredicto, Metodología, Mapa y Tab** - Síntesis de 3 estados + confianza + metodología + mapa Leaflet, integrados como 5ª pestaña de la ficha de oportunidad

#### Phase Details

#### Phase 16: Ubicación e Isócrona (Motor Desacoplado)
**Goal**: Toda oportunidad tiene un punto geolocalizado y un área de influencia calculados por un motor desacoplado `(lat,lng,formato) → resultado`, con precisión y método de cálculo siempre explícitos — nunca presentados como más exactos de lo que son.
**Depends on**: Nothing (primera fase del milestone)
**Requirements**: UBIC-01, UBIC-02, UBIC-03, UBIC-04, UBIC-05, CABI-01
**Success Criteria** (what must be TRUE):
  1. Al abrir el tab "Cabida Comercial" de una oportunidad, el sistema muestra su ubicación resuelta (lat/lng) junto con la precisión real obtenida (ej. "dirección aproximada" vs. "centroide de comuna") — nunca presentada como ubicación exacta si no lo es
  2. El área de influencia se muestra como isócrona real (caminata/auto) cuando el servicio de ruteo responde correctamente, o como radio equivalente con el método señalado explícitamente (`red_vial` vs. `círculo_equivalente`) cuando el cálculo de isócrona falla — nunca de forma silenciosa
  3. El usuario puede forzar un recálculo explícito con un botón "Actualizar", sin refresco silencioso en background — mismo patrón que zonificación
  4. El análisis de cabida comercial es invocable como función pura `(lat, lng, formato) → resultado`, sin requerir `oportunidadId`, verificable de forma independiente (unit test o llamada directa)
**Plans**: 5 plans
Plans:
- [ ] 16-01-PLAN.md — Cuenta ORS + verificación en vivo del payload + lib/isocrona-server.ts (Zod desde payload real) + test de orden de ejes
- [ ] 16-02-PLAN.md — geocodeComunaCentroide() + lib/cabida-comercial.ts (tipos client-safe)
- [ ] 16-03-PLAN.md — Migración cabida_comercial_cache (tabla angosta) + aplicación en vivo
- [ ] 16-04-PLAN.md — lib/cabida-comercial-server.ts: resolvers + obtenerIsocrona (cache-through, degradación explícita) + obtenerAnalisisCabidaComercial (CABI-01)
- [ ] 16-05-PLAN.md — Ruta /api/cabida-comercial/analisis + 5ª pestaña "Cabida Comercial" + checkpoint humano en vivo

#### Phase 17: Demografía y Consumo
**Goal**: Dentro del área de influencia resuelta en la Fase 16, el usuario ve población y capacidad de gasto estimadas, cada cifra con su fuente y vintage visibles, sin mezclar escalas geográficas distintas sin declararlo.
**Depends on**: Phase 16 (requiere ubicación + área de influencia resuelta)
**Requirements**: DEMO-01, DEMO-02, DEMO-03
**Success Criteria** (what must be TRUE):
  1. El tab muestra población estimada dentro del área de influencia, calculada por intersección geoespacial con manzanas del Censo 2017, con disclaimer de antigüedad del dato
  2. El tab muestra capacidad de gasto estimada por categoría de consumo (ingreso/pobreza comunal vía CASEN + share de categoría vía EPF), etiquetada explícitamente como "estimado agregado a nivel macro-zona, no medido en el área específica"
  3. Cada cifra demográfica/de consumo muestra su fuente y año/vintage de forma visible, sin mezclar vintages censales (2017 vs. 2024) sin declararlo
**Plans**: TBD

#### Phase 18: Competencia por Formato
**Goal**: Dentro del área de influencia, el usuario ve cuántos y cuáles competidores existen por formato objetivo, con nombre de cadena real cuando es identificable, y con el nivel de confianza degradado explícitamente cuando la cobertura de la fuente es conocida como incompleta.
**Depends on**: Phase 16 (requiere área de influencia resuelta; independiente de Phase 17)
**Requirements**: COMPE-01, COMPE-02, COMPE-03, COMPE-04, COMPE-05, COMPE-06
**Success Criteria** (what must be TRUE):
  1. El usuario puede seleccionar uno de los 4 formatos objetivo (supermercado, minimarket, strip center, power center) para el análisis
  2. El tab muestra el conteo de competidores existentes por formato dentro del área de influencia, con nombre/tag y distancia — usando tags OSM estándar para supermercado/minimarket y la lista curada a mano para strip/power center
  3. El usuario puede ver el nombre real de cadena de cada competidor detectado (ej. "Líder Express"), cruzando OSM con la nómina SII geocodificada on-demand por comuna
  4. Un conteo de 0 competidores nunca se muestra como "confirmado: no hay competencia" cuando la cobertura de la fuente es conocida como incompleta (ej. roster SII sin Unimarc) — el nivel de confianza se degrada explícitamente en ese caso
**Plans**: TBD

#### Phase 19: Veredicto, Metodología, Mapa y Tab
**Goal**: El usuario ve, en una 5ª pestaña de la ficha de oportunidad cargada bajo demanda, un veredicto honesto de 3 estados por formato con su confianza, la metodología/fuentes usadas, y un mapa visual del área de influencia con los competidores — cerrando el ciclo de síntesis de las Fases 17 y 18.
**Depends on**: Phase 17, Phase 18 (síntesis de demografía + competencia; requiere ambas)
**Requirements**: VERE-01, VERE-02, VERE-03, VERE-04, MAPA-01, CABI-02
**Success Criteria** (what must be TRUE):
  1. El tab presenta un veredicto de 3 estados por formato (ej. "evidencia de espacio" / "mercado parece cubierto" / "evidencia insuficiente para concluir") siempre junto a su nivel de confianza — nunca uno sin el otro, nunca binario
  2. El tab incluye una sección de metodología/fuentes citando fecha del censo, fecha de scraping de competidores, radio/isócrona usado, y qué no se pudo verificar
  3. El gap score se presenta explícitamente como proxy de densidad de oferta vs. demanda estimada — nunca como índice de fuga de ventas (leakage/surplus) real
  4. El tab muestra un mapa Leaflet con el polígono del área de influencia (isócrona o radio) y pines de los competidores detectados
  5. El tab "Cabida Comercial" aparece como 5ª pestaña en la ficha de detalle de oportunidad, junto a posicionamiento/historial/comparables/resumen, con carga bajo demanda (no eager) siguiendo el patrón de `ResumenTab`
**Plans**: TBD

#### Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 16. Ubicación e Isócrona (Motor Desacoplado) | 0/TBD | Not started | - |
| 17. Demografía y Consumo | 0/TBD | Not started | - |
| 18. Competencia por Formato | 0/TBD | Not started | - |
| 19. Veredicto, Metodología, Mapa y Tab | 0/TBD | Not started | - |

---

**Note (2026-07-30):** This is the first time `/gsd:complete-milestone` has run for this project. Milestones v1.1 ("Cumplir la Promesa"), v1.2 ("Dashboard Clarity"), and v1.3 ("Army of Skills") were already shipped previously but were never separately archived — their full phase details remain below, un-collapsed, exactly as they were before this milestone close. Deliberately left them in place rather than retroactively archiving them (out of scope for closing v1.4; do this properly in a future `/gsd:cleanup` pass if desired, extracting each into its own `.planning/milestones/v{X.Y}-ROADMAP.md`).

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
