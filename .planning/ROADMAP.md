# Roadmap: Milestone v1.4 — Zonificación

**Started:** 2026-07-30
**Phases:** 3 (numbered 10-12, continues from v1.3)

## Phases

- [x] **Phase 10: Motor de Zonificación** — Geocoding, registro de cobertura por comuna y persistencia automática del resultado de zona (sin UI todavía) (completed 2026-07-30)
- [ ] **Phase 11: Vista de Zonificación en el Proyecto** — Zona, mapa, usos citados, compatibilidad de uso y fallback manual, visibles para el arquitecto
- [ ] **Phase 12: Integración con Motores de Decisión** — via-tramitacion.ts, due-diligence.ts y el copiloto IA incorporan la zona como señal aditiva citada

## Phase Details

### Phase 10: Motor de Zonificación

**Goal:** El sistema puede determinar automáticamente, para una dirección dentro de las comunas cubiertas (Las Condes, Providencia, Vitacura, Ñuñoa), la zona PRC y sus usos permitidos/prohibidos — geocodificando, consultando el FeatureServer ArcGIS de MINVU/OCUC, cacheando el resultado y persistiéndolo en el proyecto — distinguiendo explícitamente "encontrado" / "sin cobertura" / "error", sin exponer aún interfaz al arquitecto.

**Depends on:** Nothing (first phase of milestone)

**Requirements:** Ninguno directamente — infraestructura habilitante. Los requirements ZONE-01→06 y COMPAT-01 se completan de cara al arquitecto en la Phase 11, que depende de este motor.

**Success Criteria** (what must be TRUE):
1. Dado un proyecto con dirección en una comuna cubierta, el sistema geocodifica correctamente y el lat/lng resultante corresponde a la comuna real del proyecto (verificable contra un set de direcciones conocidas)
2. Al consultar el endpoint de zonificación para esa dirección, el sistema retorna código de zona PRC, nombre y usos permitidos/prohibidos en texto verbatim, validado con Zod contra el shape real de ArcGIS
3. El resultado queda cacheado en una tabla compartida por coordenadas redondeadas — una segunda consulta al mismo punto no repite la llamada a ArcGIS
4. Al crear o actualizar un proyecto con dirección, el resultado de zonificación se persiste automáticamente en el proyecto con un estado explícito (`encontrado` / `sin_cobertura` / `error`), nunca colapsado a un booleano
5. Para una comuna fuera de las 4 iniciales, el sistema retorna explícitamente `sin_cobertura` en vez de un resultado vacío indistinguible de "sin restricciones"

**Plans:** 5/5 plans complete

Plans:
- [ ] 10-01-PLAN.md — Migración: zonificacion_cache + proyectos.zona_* + CHECK de estado (wave 1, checkpoint)
- [ ] 10-02-PLAN.md — lib/zonificacion-comunas.ts: registro ArcGIS por comuna (wave 1, paralelo)
- [ ] 10-03-PLAN.md — lib/geocoding.ts: geocoder Nominatim (wave 1, paralelo)
- [ ] 10-04-PLAN.md — lib/zonificacion.ts + app/api/zonificacion/lookup/route.ts: orquestación end-to-end (wave 2)
- [ ] 10-05-PLAN.md — lib/zonificacion-server.ts + wiring en after() de POST/PATCH proyectos (wave 3)

---

### Phase 11: Vista de Zonificación en el Proyecto

**Goal:** El arquitecto ve la zona PRC de su proyecto con confirmación visual en mapa, lee los usos permitidos/prohibidos citados a fuente oficial, verifica si su uso pretendido es compatible, controla explícitamente cuándo actualizar el resultado, y tiene una salida manual cuando el geocoding falla o la comuna no tiene cobertura — con el disclaimer del CIP siempre visible.

**Depends on:** Phase 10 (motor de lookup y persistencia)

**Requirements:** ZONE-01, ZONE-02, ZONE-03, ZONE-04, ZONE-05, ZONE-06, COMPAT-01

**Success Criteria** (what must be TRUE):
1. Al abrir un proyecto con dirección en una comuna cubierta, el arquitecto ve automáticamente la zona PRC (código + nombre) sin ejecutar ninguna acción manual
2. El arquitecto ve un mapa que confirma visualmente que el punto geocodificado cae dentro del polígono de la zona retornada
3. El arquitecto ve los usos permitidos y prohibidos en texto verbatim, con cita a la fuente oficial (link al decreto cuando existe, tratamiento "no verificado" cuando no) y el disclaimer "Informativo, no reemplaza el Certificado de Informaciones Previas (CIP) oficial" visible en toda pantalla de zonificación
4. El arquitecto puede indicar el uso pretendido del proyecto y recibe una respuesta de tres estados — Permitido / No permitido / No especificado (requiere revisión) — nunca un veredicto binario
5. El arquitecto puede forzar una actualización del resultado con una acción explícita "Actualizar" (sin refresco silencioso en background), y si el geocoding falla o la comuna no tiene cobertura, puede seleccionar manualmente comuna y zona desde un listado en vez de ver un error sin salida

**Plans:** TBD

Plans:
- [ ] 11-01: TBD (planning pendiente)

---

### Phase 12: Integración con Motores de Decisión

**Goal:** Los motores existentes — vía de tramitación, due diligence y copiloto IA — incorporan la zonificación como señal adicional citada, de forma estrictamente aditiva: `recomendarVia()` no cambia su lógica determinista, y todo proyecto sin dato de zonificación disponible sigue funcionando exactamente igual que hoy.

**Depends on:** Phase 11 (la compatibilidad de uso debe estar visualmente verificada antes de confiar en ella como señal de integración)

**Requirements:** INTEG-01, INTEG-02, INTEG-03

**Success Criteria** (what must be TRUE):
1. Cuando el uso declarado del proyecto no calza con los usos permitidos de la zona, `via-tramitacion.ts` muestra una alerta citada en la pantalla de vía de tramitación, sin que `recomendarVia()` altere su árbol de decisión ni sus resultados
2. `due-diligence.ts` puede citar la zona como fuente de un hallazgo (nuevo tipo `'PRC'` en `RefNormativa`) cuando detecta incoherencia entre el destino declarado y los usos permitidos
3. Los skills del copiloto IA (diagnóstico OGUC, checklist) reciben el texto de usos permitidos/prohibidos de la zona como contexto adicional al generar sus respuestas, cuando el proyecto tiene un resultado de zonificación disponible
4. Un proyecto sin dirección geocodificable, sin cobertura, o sin zonificación consultada aún funciona exactamente igual que antes de este milestone en vía de tramitación, due diligence y copiloto (comportamiento estrictamente aditivo, sin regresiones)

**Plans:** TBD

Plans:
- [ ] 12-01: TBD (planning pendiente)

## Progress

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 10. Motor de Zonificación | 0/5 | Complete    | 2026-07-30 |
| 11. Vista de Zonificación en el Proyecto | 0/TBD | Not started | - |
| 12. Integración con Motores de Decisión | 0/TBD | Not started | - |

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
