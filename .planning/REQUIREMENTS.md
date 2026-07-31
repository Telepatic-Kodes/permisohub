# Requirements: PermisoHub

**Defined:** 2026-06-20
**Core Value:** El copiloto IA del arquitecto chileno

## v1.4 Requirements — Zonificación

### ZONE — Zonificación por Dirección (Núcleo)

- [x] **ZONE-01**: Al abrir un proyecto con dirección, el arquitecto ve automáticamente la zona PRC (código + nombre) determinada por geocoding + consulta espacial contra el layer ArcGIS de MINVU/OCUC
- [x] **ZONE-02**: El resultado incluye un mapa que confirma visualmente que el punto geocodificado cae dentro del polígono de la zona retornada
- [x] **ZONE-03**: El resultado muestra los usos permitidos y usos prohibidos de la zona en texto verbatim, con cita a la fuente oficial (link al decreto cuando esté disponible, tratamiento no-verificado cuando no — distinto del flag `verificado` de normativa-retrieval.ts)
- [x] **ZONE-04**: El resultado de zonificación queda persistido en el proyecto, con una acción explícita "Actualizar" — sin refresco silencioso en background
- [x] **ZONE-05**: Si el geocoding falla o la comuna no tiene cobertura, el arquitecto puede seleccionar manualmente comuna y zona desde un listado en vez de ver un error sin salida
- [x] **ZONE-06**: Toda pantalla de zonificación muestra el disclaimer "Informativo, no reemplaza el Certificado de Informaciones Previas (CIP) oficial"

### COMPAT — Compatibilidad de Uso

- [x] **COMPAT-01**: El arquitecto puede indicar el uso pretendido del proyecto y el sistema responde con uno de tres estados — Permitido / No permitido / No especificado (requiere revisión) — nunca un veredicto binario

### INTEG — Integración con Motores Existentes

- [x] **INTEG-01**: `via-tramitacion.ts` muestra una alerta citada cuando el uso declarado no calza con los usos permitidos de la zona, sin modificar el árbol de decisión determinista (`recomendarVia()` no se altera)
- [x] **INTEG-02**: `due-diligence.ts` puede citar la zona como fuente de hallazgo (nuevo tipo `'PRC'` en `RefNormativa`) cuando detecta incoherencia entre el destino declarado y los usos permitidos
- [x] **INTEG-03**: Los skills del copiloto IA (diagnóstico OGUC, checklist) reciben el texto de usos permitidos/prohibidos como contexto adicional al generar sus respuestas

### Future Requirements (v1.4.x / v2+)

- Dashboard de zonificación a nivel portafolio (todos los proyectos activos)
- Exportar PDF/anexo del hallazgo de zonificación para el expediente
- Indicador de vigencia/antigüedad del PRC ("vigente desde...") — pendiente confirmar si el layer expone fecha de decreto
- Coeficientes urbanísticos numéricos (FOS, constructibilidad, altura, rasante, distanciamiento) — requiere fuente de datos distinta, paga o verificada

### Out of Scope (v1.4)

- Coeficientes urbanísticos numéricos — sin fuente pública citable a la fidelidad requerida; ver Future Requirements
- Capas de riesgo (inundación, remoción en masa, tsunami) — fuente de datos no confirmada, no stubear UI
- Explorador GIS completo / modo de navegación libre — diluye el foco del producto (velocidad de tramitación DOM), duplica la superficie de zonificación.cl
- Repositorio legal nacional de ordenanzas — redundante con `normativa-retrieval.ts` existente
- Métricas o paywall por consulta interna — el valor estratégico de este milestone es no cobrar por consulta (a diferencia de zonificación.cl); se agrupa sin medir dentro del plan existente

### Traceability

| REQ-ID | Phase | Status |
|--------|-------|--------|
| ZONE-01 | 11 | Complete |
| ZONE-02 | 11 | Complete |
| ZONE-03 | 11 | Complete |
| ZONE-04 | 11 | Complete |
| ZONE-05 | 11 | Complete |
| ZONE-06 | 11 | Complete |
| COMPAT-01 | 11 | Complete |
| INTEG-01 | 12 | Complete |
| INTEG-02 | 12 | Complete |
| INTEG-03 | 12 | Complete |

**Coverage:**
- v1.4 requirements: 10 total
- Mapped to phases: 10/10 ✓
- Unmapped: 0
- Note: Phase 10 (Motor de Zonificación) has no directly-mapped requirement — it's enabling infrastructure (geocoding, coverage registry, ArcGIS adapter, cache, persistence) that Phase 11's user-facing requirements depend on.

---

## v1.3 Requirements — Army of Skills

### FOUND — Foundation (Preconditions)

- [x] **FOUND-01**: Los crons `daily-check` y `weekly-summary` usan `createServiceClient()` con `SUPABASE_SERVICE_ROLE_KEY` (no cliente anon) — corrige bug de 0 filas silenciosas en contexto sin cookies
- [x] **FOUND-02**: Tabla `document_checklist_items` existe en Supabase con columnas: `id`, `proyecto_id`, `item_key`, `label`, `articulo_oguc`, `estado` (pendiente | ok), `source` (ai | manual)
- [x] **FOUND-03**: Componente `Sheet` de shadcn/ui instalado y disponible para el drawer del copiloto

### SKILL — Copiloto IA Drawer

- [x] **SKILL-01**: Usuario puede abrir panel "Copiloto IA" (Sheet lateral derecho) desde cualquier proyecto en Permisos, Desarchivo o Patentes — muestra task cards sugeridas, no un input en blanco
- [x] **SKILL-02**: Copiloto ejecuta Diagnóstico OGUC con los datos reales del proyecto interpolados en las fórmulas normativas (no artículos genéricos)
- [x] **SKILL-03**: Copiloto predice observaciones probables de la DOM con: categoría, señal de frecuencia, trigger específico en este proyecto, y acción preventiva por ítem
- [x] **SKILL-04**: Copiloto genera Checklist de Documentos requeridos, persistido a DB con `item_key` y artículo normativo, con estado pendiente/ok modificable manualmente
- [x] **SKILL-05**: Copiloto calcula Estimación de Tiempo (días hábiles) y Derechos (CLP y UF) basado en datos del proyecto e inteligencia municipal

### AUTO — Automatizaciones de Fondo

- [x] **AUTO-01**: El cron diario actualiza `estado` y `etapa` en DB cuando el scraper DOM detecta un cambio, usando write idempotente (`.neq()`) para tolerar double-invoke de Vercel
- [x] **AUTO-02**: Al cambiar el `estado` DOM del proyecto en DB, el cliente recibe WhatsApp automático con el nuevo estado
- [x] **AUTO-03**: Al crear una patente comercial, `after()` dispara enriquecimiento SII automáticamente para pre-llenar `giro_sii` y `rol_avaluo` sin bloquear la respuesta del formulario
- [x] **AUTO-04**: Cada lunes 08:00 America/Santiago, el arquitecto recibe email de resumen semanal con estados de proyectos desde DB más una sección de tip/insight escrita por IA

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

| REQ-ID | Phase | Status |
|--------|-------|--------|
| FOUND-01 | 7 | Complete |
| FOUND-02 | 7 | Complete |
| FOUND-03 | 7 | Complete |
| SKILL-01 | 8 | Complete |
| SKILL-02 | 8 | Complete |
| SKILL-03 | 8 | Complete |
| SKILL-04 | 8 | Complete |
| SKILL-05 | 8 | Complete |
| AUTO-01 | 9 | Complete |
| AUTO-02 | 9 | Complete |
| AUTO-03 | 9 | Complete |
| AUTO-04 | 9 | Complete |

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

- [x] **BILL-01**: Usuario puede suscribirse al plan Starter ($29.990 CLP/mes) via Stripe Checkout
- [x] **BILL-02**: Usuario puede suscribirse al plan Pro ($79.990 CLP/mes) via Stripe Checkout
- [x] **BILL-03**: Usuario puede suscribirse al plan Estudio ($149.990 CLP/mes) via Stripe Checkout
- [x] **BILL-04**: Usuario puede elegir facturación anual con 17% de descuento en cualquier plan
- [x] **BILL-05**: Usuario puede gestionar/cancelar su suscripción via Stripe Customer Portal
- [x] **BILL-06**: Webhook de Stripe actualiza el estado de suscripción en Supabase en tiempo real
- [x] **BILL-07**: Usuario ve su plan activo, fecha de renovación y monto en `/configuracion/billing`

### GATE — Feature Gating

- [x] **GATE-01**: Proyectos del plan Starter limitados a 5; plan Pro ilimitados
- [x] **GATE-02**: AI chats limitados a 20/mes en Starter, 100 en Pro, ilimitados en Estudio
- [x] **GATE-03**: PDF extractions limitadas a 5/mes en Starter, 30 en Pro, ilimitadas en Estudio
- [x] **GATE-04**: Al alcanzar límite, el usuario ve un upgrade prompt con CTA a Stripe Checkout
- [x] **GATE-05**: El uso mensual se resetea automáticamente el día 1 de cada mes
- [x] **GATE-06**: Plan Free (sin suscripción) tiene límites menores que Starter

### LAND — Landing Page

- [x] **LAND-01**: Página pública en `/` con hero, 6 features, 3 pricing tiers y footer — sin sidebar
- [x] **LAND-02**: Toggle mensual/anual en la sección de pricing
- [x] **LAND-03**: CTA "Suscribirse" en pricing conecta a Stripe Checkout
- [x] **LAND-04**: `/dashboard` redirige a /login si el usuario no está autenticado (landing en `/` es pública)

### ONBD — Onboarding

- [x] **ONBD-01**: Usuario nuevo ve wizard de 3 pasos al primer login: Bienvenida → Primer proyecto → Tour
- [x] **ONBD-02**: Wizard redirige al dashboard con checklist visible al completarse
- [x] **ONBD-03**: Usuario que ya completó onboarding no ve el wizard al volver

### PWA — Progressive Web App

- [x] **PWA-01**: Manifest.json completo con iconos 192x512
- [x] **PWA-02**: Prompt de instalación en mobile Chrome
- [x] **PWA-03**: App abre en modo standalone cuando está instalada (sin chrome del browser)

---
*Requirements defined: 2026-06-20*
*Last updated: 2026-07-30 — v1.4 Zonificación roadmap created (Phases 10-12), traceability mapped 10/10*
