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

### Active (v1.1 — Cumplir la Promesa)

- [ ] BILL-01→07: Stripe billing con 3 tiers (Starter $29.990 / Pro $79.990 / Estudio $149.990 CLP)
- [ ] GATE-01→06: Feature gating por tier (límites de proyectos, AI chats, PDF extractions)
- [ ] LAND-01→04: Landing page pública con pricing y SEO
- [ ] ONBD-01→03: Onboarding wizard 3 pasos post-signup
- [ ] PWA-01→03: App instalable en móvil

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

## Current Milestone: v1.2 Dashboard Clarity

**Goal:** Rediseñar el dashboard a Timeline View — información organizada por urgencia/tiempo, flujo único sin paneles separados.

**Target features:**
- Timeline View: ACCIÓN REQUERIDA / PRÓXIMOS 30D / EN PROCESO / COMPLETADO
- 3 hero stats prominentes (Urgentes, Activos, Días prom.)
- Quick actions como pills horizontales
- Status bar minimalista al fondo con conteos por estado

---
*Last updated: 2026-06-21 — Milestone v1.2 started*
