# PermisoHub

## What This Is

PermisoHub es una plataforma SaaS B2B para arquitectos chilenos que gestiona permisos de edificación municipales de principio a fin. Combina gestión de expedientes, CRM, portal cliente, automatizaciones y un copiloto de IA entrenado en la normativa chilena (OGUC, LGUC, Ley 21.718).

## Core Value

El copiloto IA del arquitecto chileno — reduce el tiempo de tramitación DOM de 124 días promedio a menos de 60, automatizando documentación, respuestas a observaciones y seguimiento.

## Tech Stack

- **Frontend**: Next.js 16.2.9 (Turbopack/Webpack), TypeScript estricto, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Supabase (PostgreSQL + Auth + RLS), Supabase MCP para migraciones/queries en sesiones de agente
- **IA**: OpenAI GPT-4o vía `lib/ai.ts` (chat, extracción PDF, verificación, comunicaciones, clasificación de compatibilidad de uso PRC) — `@anthropic-ai/sdk` instalado pero dormante, no migrar a mitad de milestone
- **Mapas**: Leaflet + OpenStreetMap raster tiles (v1.4, componente presentacional para confirmación visual de polígono de zona)
- **Datos geoespaciales**: ArcGIS FeatureServer (MINVU/OCUC), Nominatim (geocoding, sin API key)
- **Automatización**: Twilio (WhatsApp), Resend (email), Vercel Cron Jobs
- **Hosting**: Vercel (edge functions, auto-scaling)
- **Billing**: Stripe (v1.1+)

## Requirements

### Validated (v1.0 — MVP shipped Jun 2026)

- ✓ Gestión de proyectos y expedientes — v1.0
- ✓ CRM de prospectos y clientes — v1.0
- ✓ Portal cliente con seguimiento — v1.0
- ✓ Wizard de ingreso DOM en Línea — v1.0
- ✓ Chat OGUC con IA streaming — v1.0
- ✓ Extractor PDF observaciones → respuestas automáticas — v1.0
- ✓ Verificador cumplimiento OGUC pre-ingreso — v1.0
- ✓ Generador de comunicaciones formales — v1.0
- ✓ Contador días hábiles Ley 21.718 — v1.0
- ✓ Calculadora derechos municipales — v1.0
- ✓ Inteligencia de municipios — v1.0
- ✓ WhatsApp automático (Twilio) — v1.0
- ✓ Cron jobs automatizados — v1.0
- ✓ Pitch deck + Modelo de negocio (/documentos) — v1.0

- ✓ BILL-01→07: Stripe billing con 3 tiers (Starter $29.990 / Pro $79.990 / Estudio $149.990 CLP) — v1.1
- ✓ GATE-01→06: Feature gating por tier (límites de proyectos, AI chats, PDF extractions) — v1.1
- ✓ LAND-01→04: Landing page pública con pricing y SEO — v1.1
- ✓ ONBD-01→03: Onboarding wizard 3 pasos post-signup — v1.1
- ✓ PWA-01→03: App instalable en móvil — v1.1
- ✓ Dashboard Timeline View (4 secciones de urgencia, hero stats) — v1.2
- ✓ Copiloto IA drawer en Permisos, Desarchivo y Patentes — v1.3
- ✓ Verificación DOM diaria automática (write-back sin click del arquitecto) — v1.3
- ✓ Enriquecimiento SII automático al crear patente comercial — v1.3
- ✓ Resumen semanal por email con tip de IA — v1.3

- ✓ Zonificación automática por dirección (zona PRC + código/nombre + usos permitidos/prohibidos vía ArcGIS FeatureServer MINVU/OCUC, geocoding Nominatim, caché compartida por coordenadas) — v1.4
- ✓ Mapa con confirmación visual de polígono de zona (Leaflet + OSM) — v1.4
- ✓ Verificación de compatibilidad de uso (uso pretendido vs. usos permitidos/prohibidos, clasificación IA de 3 estados — Permitido/No permitido/No especificado, nunca binario) — v1.4
- ✓ Citación a fuente oficial (link a decreto cuando existe) + disclaimer CIP siempre visible — v1.4
- ✓ Fallback manual de comuna/zona cuando falla el geocoding o no hay cobertura — v1.4
- ✓ Acción explícita "Actualizar" (sin refresco silencioso) — v1.4
- ✓ Cobertura inicial: Las Condes, Providencia, Vitacura, Ñuñoa — v1.4
- ✓ Integración aditiva de la zona en vía de tramitación (alerta citada), due diligence (cita PRC), y copiloto IA (contexto en diagnóstico OGUC + checklist) — sin alterar la lógica determinista de `recomendarVia()` — v1.4

### Active (próximo milestone — sin definir todavía)

Ninguno todavía — correr `/gsd:new-milestone` para definir el próximo ciclo de requirements. Candidatos surgidos durante v1.4 (no comprometidos, solo semillas para la próxima sesión de discovery):

- [ ] Dashboard de zonificación a nivel portafolio (todos los proyectos activos)
- [ ] Exportar PDF/anexo del hallazgo de zonificación para el expediente
- [ ] Indicador de vigencia/antigüedad del PRC ("vigente desde...") — pendiente confirmar si el layer expone fecha de decreto
- [ ] Ampliar cobertura de comunas ArcGIS más allá de las 4 iniciales
- [ ] Coeficientes urbanísticos numéricos (FOS, constructibilidad, altura, rasante, distanciamiento) — requiere fuente de datos distinta, paga o verificada
- [ ] Reparar el mojibake residual de doble-corrupción en un subconjunto de nombres de zona de Las Condes (hallado en el checkpoint de 11-08, cosmético, no bloqueante)
- [ ] Corregir la etiqueta de cita "Fuente: capa oficial {municipio}" para usar la comuna realmente seleccionada en el fallback manual, no `proyecto.municipio` (hallado en 11-08)

### Out of Scope (v1.4 — resuelto, para referencia histórica)

- Coeficientes urbanísticos numéricos (FOS, coef. constructibilidad, altura máxima, rasante, distanciamiento) — ningún layer público de MINVU/OCUC los expone; requeriría parsear Ordenanza Local por comuna, esfuerzo de otro milestone
- Cobertura nacional completa (345 comunas) — se amplía oportunistamente, no fue meta de v1.4
- Alianza o integración de datos con zonificación.cl — decisión explícita de no depender de terceros pudiendo usar la fuente pública (MINVU/OCUC) directamente

### Out of Scope (v1.1)

- DOM en Línea API integration — gobierno aún no la publica (Q4 2026+)
- Marketplace de revisores independientes — Q4 2026
- Analytics para constructoras — Q1 2027
- API pública — Q2 2027
- Expansión LATAM — 2028+

## Context

- **Mercado**: ~8.000 arquitectos activos en Chile, 7.741 permisos/año, 124 días promedio, US$2B pérdidas anuales
- **Competencia principal**: REVI (CChC+Google) solo cubre 12/346 municipios (3.5%) y sirve a la DOM, no al arquitecto
- **Marco legal**: Ley 21.718 (ene 2025) — 30 días hábiles máximo DOM. Ley Marco Autorizaciones Sectoriales (sept 2025)
- **GTM**: Colegio de Arquitectos + AOA, SEO normativa chilena, referidos $50K CLP
- **Post-v1.4**: Supabase MCP configurado a nivel `user` en `~/.claude.json` — reusable en futuras sesiones de agente sin reconfigurar (project-ref `nojejnebedjpbdlynrqs`). Dev-auth bypass (`BYPASS_AUTH=true` + `/auth/dev-login`) confirmado funcional para testing con sesión real sin password — usar en vez de reportar "sin browser/sesión disponible" como bloqueo en futuros checkpoints.
- **Deuda técnica conocida (no bloqueante)**: mojibake residual de doble-corrupción en un subconjunto de nombres de zona ArcGIS de Las Condes; etiqueta de cita del fallback manual usa `proyecto.municipio` en vez de la comuna seleccionada; checklist del copiloto se genera una sola vez y no se regenera si la zonificación llega después.

## Constraints

- **TypeScript**: `any` prohibido — strict mode siempre
- **Auth**: Supabase Auth con RLS — multi-tenant por diseño
- **Secrets**: Nunca hardcodeados — variables de entorno siempre
- **Turbopack bug**: Path `/Estefanía/` tiene caracteres acentuados — evitar dashes en nombres de carpetas de rutas
- **Stripe**: Keys en `.env.local` + Vercel (usuario las configura manualmente)

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js App Router (no Pages) | Moderna, edge-compatible, RSC para performance | ✓ Good |
| Supabase (no custom auth) | Auth + DB + RLS en un servicio | ✓ Good |
| Claude Sonnet 4.6 (no 3.5) | Mejor comprensión de documentos técnicos PDF | ✓ Good |
| Turbopack dev (no webpack) | Builds más rápidos, aceptar bug con path acentuado | ⚠️ Bug workaround: evitar dashes en rutas |
| Middleware dev bypass | Dev local sin Supabase auth — prod siempre enforced | ✓ Good |
| Route: `/calculadora` no `/calculadora-derechos` | Turbopack unicode bug workaround | ✓ Good |
| Dashboard en `/dashboard` (v1.1) | Landing page pública en `/` | — Pending |
| Zona PRC como cita `'PRC'` local en `due-diligence.ts` (no extender `FuenteNormativa`) | `getArticuloById`/`getContextoNormativo`/`flagUnverifiedCita` no pueden resolver una fuente GIS en vivo per-parcela — extender el tipo curado obligaría a esas funciones a manejar una fuente que estructuralmente no pueden resolver | ✓ Good |
| Señal de compatibilidad de uso (IA, no determinista) mantenida estrictamente fuera de `recomendarVia()` | El motor de vía de tramitación es puro y tiene tests de determinismo (`toEqual` en llamadas repetidas) — mezclar una señal de IA ahí habría roto esa garantía | ✓ Good |
| Guard compuesto `zona_status==='encontrado' && zona_usos_disponibles===true` en toda la superficie de zonificación (nunca solo `zona_status`) | Ñuñoa tiene `encontrado` pero usos estructuralmente vacíos — tratar solo `zona_status` como suficiente citaría/compararía contra texto vacío | ✓ Good |
| Verificación de checkpoints humanos con browser real (Playwright) + `mcp__supabase__execute_sql` para armar escenarios de prueba, en vez de solo tsc/eslint | Cada fase de v1.4 tuvo al menos un checkpoint bloqueante; verificar en vivo encontró bugs reales que tsc/eslint no habrían atrapado (migración SII nunca aplicada, mapa no se refrescaba tras Actualizar, mojibake residual, etiqueta de comuna incorrecta) | ✓ Good |

## Previous Milestones

- **v1.3 Army of Skills** (shipped 2026-06-26) — Copiloto IA drawer (Permisos/Desarchivo/Patentes), verificación DOM diaria automática, enriquecimiento SII automático, resumen semanal con tip de IA.
- **v1.4 Zonificación** (shipped 2026-07-30) — Zonificación automática por dirección (ArcGIS MINVU/OCUC), mapa con confirmación visual, compatibilidad de uso IA de 3 estados, fallback manual, integración aditiva en vía de tramitación/due diligence/copiloto. Full detail: `.planning/milestones/1.4-ROADMAP.md`.

---

## Current Milestone

Ninguno definido todavía. Correr `/gsd:new-milestone` para iniciar el próximo ciclo (questioning → research → requirements → roadmap). Ver "Active" arriba para candidatos surgidos durante v1.4.

---
*Last updated: 2026-07-30 — después del milestone v1.4*
