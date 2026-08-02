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

## v1.5 — Fusión PROPRA·BI (Shipped: 2026-08-01)

**Commits:** `7d84126`..`c6f567e` (17 commits, 2026-07-31 → 2026-08-01, directo a `main` sin feature branch)

### Goal:
Absorber PROPRA·BI (suite de inteligencia de mercado inmobiliario, hasta entonces un proyecto standalone) dentro de PermisoHub como un segundo módulo de primer nivel, y separar con claridad la identidad de "Permisos" vs. "Mercado Inmobiliario" en la UI — sin fragmentar la app en dos productos.

### What shipped:
- **Fusión del app enterprise** (`7d84126`): `permisohub-enterprise` (antes standalone) plegado dentro de esta misma app — una sola app, tres vistas (cliente/admin/enterprise). El repo standalone queda archivado (`ARCHIVADO.md`).
- **Checklist dinámico** (`9ffd266`): checklist de requisitos DOM con fuente real (9 formularios MINVU transcritos a mano), reemplazando 2 sistemas hardcodeados previos (`expediente-score.tsx`, checklist con requisitos inventados por comuna).
- **Módulo Terrenos** (`622b7c3`): descubrimiento y evaluación de terrenos — 5 scrapers (Portalinmobiliario/Yapo/Doomos/Chilepropiedades/PortalTerreno) + enriquecimiento (zonificación ArcGIS, señales OSM, SII). Construido completo pero **sin ingesta programada** (huérfano de cron) — ver `.planning/data-sources.yaml`, corregido parcialmente en Torre de Control.
- **PROPRA·BI, 8 fases** (`4e37cc8`..`a92a926`): tasación con avalúo fiscal SII, pricing y oportunidades de locales comerciales, noticias de mercado + indicadores macro (UF/IPC/TPM/Dólar), calculadora de inversión, due diligence de propiedad, reportes de mercado, cobertura ampliada a 36 comunas y tipos de propiedad adicionales (oficina/bodega/industrial).
- **Instrumentos IPT** (`a05039f`, `d6b7d43`): estado legal real de instrumentos de planificación territorial vía Portal IPT (MINVU) — badge de cobertura en el listado de municipios.
- **Copiloto conversacional** (`f77b482`): primer patrón de function/tool-calling del codebase (OpenAI `tools`/`tool_calls`), anclado en las funciones ya verificadas de Mercado Inmobiliario en vez de generar respuestas libres.
- **Rediseño UX/IA** (`3abea2c`, `e6cc0d2`, `c6f567e`): separación explícita de "Permisos" vs. "Mercado Inmobiliario" como módulos con switcher, sidebar contextual, badge de módulo auto-inferido, hub `/dashboard` compartido con panel real de ambos módulos; corrección de un bug de contraste en modo oscuro de alcance transversal (`bg-white` hardcodeado en ~35 archivos, no invertía con el tema).

### Deuda conocida (heredada a Torre de Control, ver `.planning/data-sources.yaml`):
2 implementaciones duplicadas del scraper SII, 4 puntos de entrada distintos para el dato de UF, 3 listas de comunas deliberadamente no sincronizadas, un pipeline RAG completo construido pero nunca cableado al runtime, 5 scrapers de terrenos sin ingesta programada.

**Last phase number:** N/A (este milestone no siguió la disciplina de fases GSD — trabajo ejecutado en sesiones ad-hoc, ver Key Decisions en PROJECT.md).

---


## v1.6 Reportes Profesionales de Oportunidades (Shipped: 2026-08-02)

**Phases completed:** Phases 13-15 (3 phases, 13 plans)

**Key accomplishments:**
- Ficha de detalle por oportunidad individual (`/oportunidades/[id]`) — posicionamiento vs. cohorte, historial de precio, señales explicadas, comparables sugeridos, resumen ejecutivo IA bajo demanda
- `evaluarOportunidad()` extraído como fuente única de verdad para scoring (TDD, 9 casos) — previene que list y detail diverjan en qué cuenta como "oportunidad"
- Comparación lado a lado (2-5 oportunidades) con tabla comparativa y prevención estructural real (server-side, no solo checkbox) de mezclar tipo/operación
- Informe exportable/imprimible — individual y de comparación — vía `@media print`, con fecha de generación Y de última verificación por dato (nunca snapshot sin fecha)
- Disciplina de "nunca fabricar/ocultar datos" aplicada consistentemente en las 3 fases (comparables sin datos, rentabilidad de zona sin cobertura, informes)

Full detail archived: `.planning/milestones/v1.6-ROADMAP.md`, `.planning/milestones/v1.6-REQUIREMENTS.md`

---

