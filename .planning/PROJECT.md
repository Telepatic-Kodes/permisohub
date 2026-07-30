# PermisoHub

## What This Is

PermisoHub es una plataforma SaaS B2B para arquitectos chilenos que gestiona permisos de edificación municipales de principio a fin. Combina gestión de expedientes, CRM, portal cliente, automatizaciones y un copiloto de IA entrenado en la normativa chilena (OGUC, LGUC, Ley 21.718).

## Core Value

El copiloto IA del arquitecto chileno — reduce el tiempo de tramitación DOM de 124 días promedio a menos de 60, automatizando documentación, respuestas a observaciones y seguimiento.

## Tech Stack

- **Frontend**: Next.js 16.2.9 (Turbopack), TypeScript estricto, Tailwind CSS, shadcn/ui
- **Backend**: Next.js API Routes, Supabase (PostgreSQL + Auth + RLS)
- **IA**: Anthropic Claude Sonnet 4.6 (chat, extracción PDF, verificación, comunicaciones)
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

### Active (v1.4 — Zonificación)

- [ ] Zonificación automática por dirección dentro del proyecto (zona PRC + usos permitidos/prohibidos vía ArcGIS FeatureServer de MINVU/OCUC)
- [ ] Verificación de compatibilidad: uso pretendido del proyecto vs. usos permitidos/prohibidos de la zona
- [ ] Citación a fuente oficial (decreto/Diario Oficial) por resultado de zona, siguiendo el patrón de normativa-retrieval.ts
- [ ] Cobertura inicial: Las Condes, Providencia, Vitacura, Ñuñoa — ampliable por comuna según disponibilidad de capa MINVU/OCUC
- [ ] Manejo explícito de comunas sin cobertura (mensaje claro, no fallo silencioso)

### Out of Scope (v1.4)

- Coeficientes urbanísticos numéricos (FOS, coef. constructibilidad, altura máxima, rasante, distanciamiento) — ningún layer público de MINVU/OCUC los expone; requeriría parsear Ordenanza Local por comuna, esfuerzo de otro milestone
- Cobertura nacional completa (345 comunas) — se amplía oportunistamente, no es meta de v1.4
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

## Previous Milestone: v1.3 Army of Skills (Complete ✅)

**Shipped:** 2026-06-26 — Copiloto IA drawer (Permisos/Desarchivo/Patentes), verificación DOM diaria automática, enriquecimiento SII automático, resumen semanal con tip de IA.

---

## Current Milestone: v1.4 Zonificación

**Goal:** Determinar la zona PRC y usos permitidos/prohibidos de un proyecto automáticamente a partir de su dirección, citando la fuente oficial — cerrando una brecha frente a servicios de pago como zonificación.cl usando datos públicos de MINVU/OCUC.

**Target features:**
- Zonificación automática por dirección dentro del proyecto (alimenta due-diligence.ts y via-tramitacion.ts)
- Verificación de compatibilidad entre uso pretendido y usos permitidos/prohibidos de la zona
- Citación a fuente oficial (decreto/Diario Oficial) por resultado
- Cobertura inicial: Las Condes, Providencia, Vitacura, Ñuñoa

---
*Last updated: 2026-07-30 — Milestone v1.4 started*
