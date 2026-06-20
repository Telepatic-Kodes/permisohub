# Requirements: PermisoHub

**Defined:** 2026-06-20
**Core Value:** El copiloto IA del arquitecto chileno

## v1.1 Requirements — Cumplir la Promesa

### BILL — Billing & Subscription

- [ ] **BILL-01**: Usuario puede suscribirse al plan Starter ($29.990 CLP/mes) via Stripe Checkout
- [ ] **BILL-02**: Usuario puede suscribirse al plan Pro ($79.990 CLP/mes) via Stripe Checkout
- [ ] **BILL-03**: Usuario puede suscribirse al plan Estudio ($149.990 CLP/mes) via Stripe Checkout
- [ ] **BILL-04**: Usuario puede elegir facturación anual con 17% de descuento en cualquier plan
- [ ] **BILL-05**: Usuario puede gestionar/cancelar su suscripción via Stripe Customer Portal
- [ ] **BILL-06**: Webhook de Stripe actualiza el estado de suscripción en Supabase en tiempo real
- [ ] **BILL-07**: Usuario ve su plan activo, fecha de renovación y monto en `/configuracion/billing`

### GATE — Feature Gating por Plan

- [ ] **GATE-01**: Usuario Starter está limitado a 5 proyectos activos (el 6to muestra upgrade prompt)
- [ ] **GATE-02**: Usuario Starter está limitado a 20 mensajes Chat OGUC por mes
- [ ] **GATE-03**: Usuario Starter está limitado a 3 extracciones PDF por mes
- [ ] **GATE-04**: Upgrade prompt invita a subir al plan Pro con CTA directo a Stripe Checkout
- [ ] **GATE-05**: Usuario Pro tiene acceso ilimitado a todas las features de IA
- [ ] **GATE-06**: Usuario Estudio puede invitar hasta 5 usuarios a su workspace

### ONBD — Onboarding

- [ ] **ONBD-01**: Usuario nuevo ve wizard de bienvenida post-signup (3 pasos lineales)
- [ ] **ONBD-02**: Wizard guía al usuario a crear su primer proyecto con datos pre-rellenados
- [ ] **ONBD-03**: Dashboard muestra checklist de setup con progreso visual hasta completar onboarding

### PWA — Progressive Web App

- [ ] **PWA-01**: App puede instalarse en móvil iOS y Android desde Chrome/Safari
- [ ] **PWA-02**: `manifest.json` correcto con nombre, iconos (192×192, 512×512) y colores de marca (#1A3328)
- [ ] **PWA-03**: Banner de instalación aparece en primera visita desde móvil

### LAND — Landing Page

- [ ] **LAND-01**: Ruta `/` muestra landing page pública (sin auth requerida)
- [ ] **LAND-02**: Landing tiene Hero con tagline "El copiloto IA del arquitecto chileno" y CTA a registro
- [ ] **LAND-03**: Landing tiene sección pricing con los 3 tiers y botones que abren Stripe Checkout
- [ ] **LAND-04**: Landing tiene meta tags SEO (title, description, og:image, og:title)

## Future Requirements (v1.2+)

### MKTG — Marketing & Growth

- **MKTG-01**: Programa de referidos ($50.000 CLP por referido activo)
- **MKTG-02**: Blog/contenido SEO sobre normativa chilena
- **MKTG-03**: Newsletter mensual a arquitectos

### INTG — Integraciones

- **INTG-01**: API DOM en Línea (cuando gobierno la publique)
- **INTG-02**: Marketplace de revisores independientes
- **INTG-03**: API pública PermisoHub para partners

### ENT — Enterprise

- **ENT-01**: Analytics dashboard para constructoras
- **ENT-02**: Módulo de licitaciones
- **ENT-03**: Integración ERP constructoras

## Out of Scope (v1.1)

| Feature | Reason |
|---------|--------|
| DOM en Línea API | Gobierno aún no la publica — Q4 2026+ |
| Marketplace revisores | Q4 2026 — requiere legal + onboarding |
| Analytics constructoras | Q1 2027 — después de tener datos suficientes |
| API pública | Q2 2027 — después de estabilizar el modelo de datos |
| App nativa iOS/Android | Web-first; PWA es suficiente para v1 |
| Expansión LATAM | 2028+ |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| BILL-01 | Phase 1 | Pending |
| BILL-02 | Phase 1 | Pending |
| BILL-03 | Phase 1 | Pending |
| BILL-04 | Phase 1 | Pending |
| BILL-05 | Phase 1 | Pending |
| BILL-06 | Phase 1 | Pending |
| BILL-07 | Phase 1 | Pending |
| GATE-01 | Phase 2 | Pending |
| GATE-02 | Phase 2 | Pending |
| GATE-03 | Phase 2 | Pending |
| GATE-04 | Phase 2 | Pending |
| GATE-05 | Phase 2 | Pending |
| GATE-06 | Phase 2 | Pending |
| LAND-01 | Phase 3 | Pending |
| LAND-02 | Phase 3 | Pending |
| LAND-03 | Phase 3 | Pending |
| LAND-04 | Phase 3 | Pending |
| ONBD-01 | Phase 4 | Pending |
| ONBD-02 | Phase 4 | Pending |
| ONBD-03 | Phase 4 | Pending |
| PWA-01 | Phase 5 | Pending |
| PWA-02 | Phase 5 | Pending |
| PWA-03 | Phase 5 | Pending |

**Coverage:**
- v1.1 requirements: 23 total
- Mapped to phases: 23
- Unmapped: 0 ✓

---
*Requirements defined: 2026-06-20*
