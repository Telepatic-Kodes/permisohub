# Requirements: PermisoHub

**Defined:** 2026-06-20
**Core Value:** El copiloto IA del arquitecto chileno

## v1.3 Requirements — Army of Skills

### FOUND — Foundation (Preconditions)

- [ ] **FOUND-01**: Los crons `daily-check` y `weekly-summary` usan `createServiceClient()` con `SUPABASE_SERVICE_ROLE_KEY` (no cliente anon) — corrige bug de 0 filas silenciosas en contexto sin cookies
- [ ] **FOUND-02**: Tabla `document_checklist_items` existe en Supabase con columnas: `id`, `proyecto_id`, `item_key`, `label`, `articulo_oguc`, `estado` (pendiente | ok), `source` (ai | manual)
- [ ] **FOUND-03**: Componente `Sheet` de shadcn/ui instalado y disponible para el drawer del copiloto

### SKILL — Copiloto IA Drawer

- [ ] **SKILL-01**: Usuario puede abrir panel "Copiloto IA" (Sheet lateral derecho) desde cualquier proyecto en Permisos, Desarchivo o Patentes — muestra task cards sugeridas, no un input en blanco
- [ ] **SKILL-02**: Copiloto ejecuta Diagnóstico OGUC con los datos reales del proyecto interpolados en las fórmulas normativas (no artículos genéricos)
- [ ] **SKILL-03**: Copiloto predice observaciones probables de la DOM con: categoría, señal de frecuencia, trigger específico en este proyecto, y acción preventiva por ítem
- [ ] **SKILL-04**: Copiloto genera Checklist de Documentos requeridos, persistido a DB con `item_key` y artículo normativo, con estado pendiente/ok modificable manualmente
- [ ] **SKILL-05**: Copiloto calcula Estimación de Tiempo (días hábiles) y Derechos (CLP y UF) basado en datos del proyecto e inteligencia municipal

### AUTO — Automatizaciones de Fondo

- [ ] **AUTO-01**: El cron diario actualiza `estado` y `etapa` en DB cuando el scraper DOM detecta un cambio, usando write idempotente (`.neq()`) para tolerar double-invoke de Vercel
- [ ] **AUTO-02**: Al cambiar el `estado` DOM del proyecto en DB, el cliente recibe WhatsApp automático con el nuevo estado
- [ ] **AUTO-03**: Al crear una patente comercial, `after()` dispara enriquecimiento SII automáticamente para pre-llenar `giro_sii` y `rol_avaluo` sin bloquear la respuesta del formulario
- [ ] **AUTO-04**: Cada lunes 08:00 America/Santiago, el arquitecto recibe email de resumen semanal con estados de proyectos desde DB más una sección de tip/insight escrita por IA

### Future Requirements

- Análisis OGUC con corpus curado y citaciones a documentos oficiales (Q4 2026)
- Copiloto conversacional en el drawer con follow-up questions (Q4 2026)
- DOM auto-update para todos los 346 municipios vía MINVU API (pendiente publicación API oficial)
- Copiloto accesible vía `/herramientas/copiloto` como página standalone

### Out of Scope (v1.3)

- Migración de OpenAI GPT-4o a Claude Sonnet 4.6 — riesgo de migración mid-milestone; mantener OpenAI para este milestone
- Copiloto con streaming SSE — análisis es JSON estructurado; streaming solo para el chat OGUC existente
- WhatsApp hacia el arquitecto (no el cliente) — fuera de scope del mvp de notificaciones

### Traceability

| REQ-ID | Phase |
|--------|-------|
| FOUND-01 | 7 |
| FOUND-02 | 7 |
| FOUND-03 | 7 |
| SKILL-01 | 8 |
| SKILL-02 | 8 |
| SKILL-03 | 8 |
| SKILL-04 | 8 |
| SKILL-05 | 8 |
| AUTO-01 | 9 |
| AUTO-02 | 9 |
| AUTO-03 | 9 |
| AUTO-04 | 9 |

---

## v1.2 Requirements — Dashboard Clarity

### DASH — Dashboard Redesign

- [x] **DASH-01**: Sección "Acción requerida" muestra proyectos con obs. + alertas juntos, ordenados por urgencia
- [x] **DASH-02**: Tres métricas hero (Urgentes, Activos, Días prom.) son los únicos KPIs prominentes
- [x] **DASH-03**: Cuatro secciones temporales organizan todos los proyectos sin superposición
- [x] **DASH-04**: Cada proyecto aparece exactamente una vez en el timeline
- [x] **DASH-05**: El estado visual (color/icono de fila) es el ÚNICO indicador — sin badges redundantes
- [x] **DASH-06**: Quick actions accesibles como pills horizontales desde el header del contenido

---

## v1.1 Requirements — Cumplir la Promesa

### BILL — Billing & Subscription

- [ ] **BILL-01**: Usuario puede suscribirse al plan Starter ($29.990 CLP/mes) via Stripe Checkout
- [ ] **BILL-02**: Usuario puede suscribirse al plan Pro ($79.990 CLP/mes) via Stripe Checkout
- [ ] **BILL-03**: Usuario puede suscribirse al plan Estudio ($149.990 CLP/mes) via Stripe Checkout
- [ ] **BILL-04**: Usuario puede elegir facturación anual con 17% de descuento en cualquier plan
- [ ] **BILL-05**: Usuario puede gestionar/cancelar su suscripción via Stripe Customer Portal
- [ ] **BILL-06**: Webhook de Stripe actualiza el estado de suscripción en Supabase en tiempo real
- [ ] **BILL-07**: Usuario ve su plan activo, fecha de renovación y monto en `/configuracion/billing`

### GATE — Feature Gating

- [ ] **GATE-01**: Proyectos del plan Starter limitados a 5; plan Pro ilimitados
- [ ] **GATE-02**: AI chats limitados a 20/mes en Starter, 100 en Pro, ilimitados en Estudio
- [ ] **GATE-03**: PDF extractions limitadas a 5/mes en Starter, 30 en Pro, ilimitadas en Estudio
- [ ] **GATE-04**: Al alcanzar límite, el usuario ve un upgrade prompt con CTA a Stripe Checkout
- [ ] **GATE-05**: El uso mensual se resetea automáticamente el día 1 de cada mes
- [ ] **GATE-06**: Plan Free (sin suscripción) tiene límites menores que Starter

### LAND — Landing Page

- [ ] **LAND-01**: Página pública en `/` con hero, 6 features, 3 pricing tiers y footer — sin sidebar
- [ ] **LAND-02**: Toggle mensual/anual en la sección de pricing
- [ ] **LAND-03**: CTA "Suscribirse" en pricing conecta a Stripe Checkout
- [ ] **LAND-04**: `/dashboard` redirige a /login si el usuario no está autenticado (landing en `/` es pública)

### ONBD — Onboarding

- [ ] **ONBD-01**: Usuario nuevo ve wizard de 3 pasos al primer login: Bienvenida → Primer proyecto → Tour
- [ ] **ONBD-02**: Wizard redirige al dashboard con checklist visible al completarse
- [ ] **ONBD-03**: Usuario que ya completó onboarding no ve el wizard al volver

### PWA — Progressive Web App

- [ ] **PWA-01**: Manifest.json completo con iconos 192x512
- [ ] **PWA-02**: Prompt de instalación en mobile Chrome
- [ ] **PWA-03**: App abre en modo standalone cuando está instalada (sin chrome del browser)
