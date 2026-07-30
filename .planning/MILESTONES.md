# Milestones

## v1.0 — MVP (Shipped June 2026)

**Shipped:** 2026-06-20
**Phases:** 1–7 (conceptual, pre-GSD)

### What shipped:
- Gestión de proyectos y expedientes
- CRM de prospectos y clientes
- Portal cliente con seguimiento
- Wizard de ingreso DOM en Línea
- Chat OGUC con IA (Claude Sonnet 4.6, streaming SSE)
- Verificador de cumplimiento OGUC pre-ingreso
- Extractor de observaciones PDF (base64 → Claude)
- Generador de respuesta a observaciones
- Generador de comunicaciones formales
- Contador días hábiles Ley 21.718
- Calculadora de derechos municipales
- Inteligencia de municipios (estadísticas DOM)
- WhatsApp automático (Twilio)
- Cron jobs automatizados
- Pitch deck 14 slides + Modelo de negocio HTML (página /documentos)

**Last phase number:** 7

---

## v1.1 — Cumplir la Promesa (Shipped)

**Started:** 2026-06-20
**Phases:** 1–5

### Goal:
Hacer el negocio real: Stripe billing, feature gating por tier, landing page pública, onboarding flow y PWA.

### What shipped:
- Stripe billing con 3 tiers (Starter/Pro/Estudio) + facturación anual
- Feature gating por tier (proyectos, AI chats, PDF extractions) con reset mensual
- Landing page pública con pricing y toggle mensual/anual
- Onboarding wizard 3 pasos post-signup
- PWA instalable (manifest, prompt, modo standalone)

**Last phase number:** 5

---

## v1.2 — Dashboard Clarity (Shipped)

**Shipped:** 2026-06-21
**Phases:** 6

### Goal:
Rediseñar el dashboard para que la urgencia sea obvia de un vistazo.

### What shipped:
- Timeline View con 4 secciones de urgencia
- 3 hero stats (Urgentes, Activos, Días prom.)
- Estado visual como único indicador (sin badges redundantes)
- Quick actions como pills horizontales

**Last phase number:** 6

---

## v1.3 — Army of Skills (Shipped)

**Shipped:** 2026-06-26
**Phases:** 7–9

### Goal:
Crear el ejército de skills de IA específicas para cada módulo — copiloto embebido (drawer) + automatizaciones de fondo.

### What shipped:
- Copiloto IA drawer (4 skills) en Permisos, Desarchivo y Patentes
- Verificación DOM diaria automática (write-back idempotente, sin click del arquitecto)
- WhatsApp automático al cliente cuando cambia el estado DOM
- Enriquecimiento SII automático al crear patente comercial
- Resumen semanal por email con tip de IA

**Last phase number:** 9

## v1.4 — Zonificación (Shipped: 2026-07-30)

**Phases:** 10–12 (3 phases, 17 plans, 33 tasks)

### Goal:
Determinar automáticamente la zona PRC y usos permitidos/prohibidos de un proyecto a partir de su dirección (ArcGIS MINVU/OCUC), mostrarla con confirmación visual en mapa, verificar compatibilidad de uso, y citarla como señal aditiva en vía de tramitación, due diligence y copiloto IA — sin depender de servicios de pago como zonificación.cl.

### What shipped:
- Motor de zonificación: geocoding (Nominatim) + consulta espacial ArcGIS + caché compartida por coordenadas + persistencia automática con estado explícito (`encontrado`/`sin_cobertura`/`error`), sin UI (Fase 10)
- Vista de zonificación en el proyecto: código+nombre+sector, mapa con polígono real (Leaflet+OSM), usos permitidos/prohibidos verbatim con cita a fuente oficial, disclaimer CIP siempre visible, botón "Actualizar" explícito, fallback manual comuna/zona, verificador de compatibilidad de uso con IA de 3 estados (Fase 11)
- Integración aditiva en los motores existentes: alerta citada de incompatibilidad en vía de tramitación (sin alterar el motor determinista `recomendarVia()`), nuevo tipo de cita `'PRC'` en due diligence, contexto de usos de zona inyectado en los prompts de diagnóstico OGUC y checklist del copiloto (Fase 12)
- Cobertura inicial: Las Condes, Providencia, Vitacura, Ñuñoa
- Bugs de producción preexistentes encontrados y corregidos en el camino: migración SII nunca aplicada en producción (enriquecimiento silenciosamente roto desde julio), código de zona nunca persistido

**Last phase number:** 12

---

