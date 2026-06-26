# Features Research — v1.3 Army of Skills

**Domain:** AI copilot for B2B SaaS (Chilean architectural permitting)
**Researched:** 2026-06-25
**Overall confidence:** MEDIUM-HIGH (UX patterns HIGH via Intercom/industry analysis; Chilean DOM specifics MEDIUM from public sources)

---

## Copiloto Drawer UX

### Table Stakes (users expect these — missing = broken product)

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Slide-in from right, doesn't replace main content | Standard B2B drawer pattern (Intercom, Zendesk, Linear) | Low | shadcn `Sheet` component, 420px wide |
| Context injection on open | Copilot must know which project/expediente is currently open — without user re-typing it | Low | Pass `proyecto_id`, type, estado, municipio at open time |
| Keyboard shortcut to toggle | `⌘K` or `⌘/` is standard SaaS expectation; reduces friction for power users | Low | Map to global keydown listener |
| Persistent conversation within session | Follow-up questions referencing earlier answers ("and for article 2.1.15?") | Low | Keep thread in component state during session |
| Source citations with hover preview | Professionals need to verify before acting — citing OGUC article numbers is non-negotiable | Medium | Return `{answer, sources: [{article, excerpt}]}` |
| Loading/streaming state | AI takes 2-5s; no spinner-and-wait — stream tokens progressively | Low | SSE or Vercel AI SDK `useChat` |
| Close and reopen without losing context | Drawer closed ≠ conversation reset | Low | Lift state to parent module, not inside Sheet |
| Mobile-accessible (at minimum not broken) | Architects use phones on-site | Low | Full-screen Sheet on mobile breakpoint |

### Differentiators (valued but not expected — these win the comparison)

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| Module-aware suggested prompts | On opening in Permisos: shows "Diagnosticar OGUC", "Predecir observaciones", "Ver checklist". On Patentes: "Enriquecer con SII", "Calcular derechos". Reduces cold-start blank-page friction | Medium | Hardcoded prompt cards per module, disappear after first message |
| Switch between 4 analysis types without leaving drawer | Tabs or buttons inside drawer: Diagnóstico / Observaciones / Checklist / Estimación | Medium | Each tab triggers a different system prompt + returns structured data |
| "Exportar a expediente" action | One-click to attach AI output to the project record (stored in DB) | Medium | Creates `ai_analysis` row linked to `proyecto_id` |
| Inline OGUC article references with expand | Click article number → shows full article text inline without leaving drawer | High | Requires OGUC article lookup endpoint; defer to Phase 2 if needed |
| Municipality-specific phrasing | "La DOM de Providencia suele observar X con frecuencia" — not generic "may be observed" | High | Requires municipal intelligence data (already built in v1.0) |

### Anti-Features (explicitly do NOT build)

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| Full-page AI mode replacing main view | Destroys spatial context — architect needs to see the project while consulting copilot | Right drawer overlay only |
| Generic chatbot persona ("Hi! I'm your assistant...") | Professionals find it infantilizing; wastes screen space | Skip pleasantries, jump straight to domain task |
| "Ask me anything" open prompt as default state | Cold start is friction; blank box with no hints → abandonment | Show 3-4 task cards on first open |
| Auto-suggest while user types in other fields | Cursor hijacking in form fields breaks focus, feels invasive | Only activate on explicit open (button or shortcut) |
| Storing every conversation forever | GDPR/privacy exposure for professional communications; unnecessary DB bloat | Session-only conversation; persist only explicit "save to expediente" actions |
| Typing indicator animation | Adds perceived latency; streaming tokens already shows progress | Stream tokens directly, skip animated dots |

---

## AI Analysis — 4 Types

### Type 1: Diagnóstico OGUC

**Expected behavior:** Given a project's parameters (superficie, uso, zona, municipio, tipo permiso), identify which OGUC articles apply and flag where the project data suggests non-compliance risks.

**What makes it good vs. generic:**
- **Generic:** "Article 5.1.1 establishes setbacks. Your project may have setback issues."
- **Good:** "Artículo 2.6.3 OGUC exige un escalafón de rasante de 70° para zonas residenciales R2. Según tu expediente, el costado norte tiene 4.5m de altura a 2.1m del deslindes → ángulo aproximado 65° → **observación probable**. Revisa plano de rasante antes de ingresar."

The distinction is: project-specific numbers inserted into the regulatory formula, not generic alerts.

**Required inputs from existing data:**
- Superficie total (m²) — ya en expediente
- Uso (habitacional, comercial, mixto) — ya en expediente
- Zona DOM / Plan Regulador — depends on municipio intelligence (v1.0 built)
- Tipo permiso (anteproyecto, permiso, recepción) — ya en expediente
- Número de pisos, coeficiente ocupación (if available)

**Output format:**
```
{
  articulos_aplicables: [{numero, titulo, resumen_aplicacion}],
  riesgos_incumplimiento: [{articulo, descripcion_riesgo, severidad: "alto|medio|bajo", dato_proyecto_involucrado}],
  recomendaciones: [string]
}
```

**Depth rule:** Each risk must reference a specific project data field, not be generic. If the data to evaluate a specific article is missing, say "No pude evaluar art. X — falta dato Y en el expediente" rather than skipping it silently.

**Dependency on existing features:** Builds on OGUC compliance checker (v1.0) — same regulatory corpus, but now scoped to a specific project's data rather than a general query.

**Complexity:** HIGH — requires structured project data → OGUC article mapping logic in system prompt. High hallucination risk on article numbers; mitigation: restrict model to a curated article corpus, not free recall.

---

### Type 2: Predicción de Observaciones

**Expected behavior:** Predict which observations this specific municipal DOM is likely to raise on this project before submission.

**What makes it actionable vs. useless:**
The output must answer: "What specific thing should I fix or prepare before submitting?" Generic warnings ("the municipality may have concerns about setbacks") are useless. Actionable output has:

1. **Observation category** — what DOM reviewers typically flag
2. **Probability signal** — "Alta frecuencia en esta DOM" vs "Ocasional en DOMs similares"
3. **Specific trigger** — what in this expediente triggers the prediction
4. **Preventive action** — exactly what to attach or modify

**Example of actionable output:**
```
Observación probable: Plano de cálculo de derechos
Frecuencia en DOM Providencia: Alta (basado en municipio tipo RM)
Motivo en este proyecto: Superficie > 200m² requiere anexo D del formulario.
Acción: Adjuntar formulario MINVU Anexo D con cálculo de derechos firmado.
```

**Data requirements:**
- Municipio → classification (conservative, average, strict) from municipal intelligence (v1.0)
- Tipo permiso
- Superficie and uso
- Documents already attached

**Output format:**
```
{
  observaciones_predichas: [
    {
      categoria: string,
      probabilidad: "alta|media|baja",
      motivo_especifico: string,
      accion_preventiva: string,
      fuente: "patron_municipal|oguc_articulo|experiencia_general"
    }
  ]
}
```

**What NOT to include:** Generic OGUC articles that apply universally to all projects. If an observation applies to 100% of projects regardless of municipio, it belongs in the OGUC diagnostic, not here.

**Dependency on existing features:** Requires municipal intelligence data (v1.0). The richer that data, the more specific predictions. Without it, this degrades to generic — still useful, but less differentiating.

**Confidence flag requirement:** The system must surface its confidence: "Esta predicción se basa en patrones generales de DOMs metropolitanas, no en datos históricos de esta municipalidad específica." Honesty prevents professional errors.

**Complexity:** HIGH — prediction without historical training data is hypothesis-based. System prompt must be carefully scoped. Risk: overconfident predictions cause architects to miss unexpected observations.

---

### Type 3: Checklist de Documentos

**Expected behavior:** For the specific permit type of this project, generate the required document list with status (attached / missing / uncertain) based on what's already in the expediente.

**State management decision — PERSISTED to DB, not local:**

This is the most important architectural decision for this feature. Rationale:
- Architects return to the same project across days/sessions
- The checklist status is collaborative context (arquitecto jefe vs asistente)
- "Mark as pending" and "mark as complete" actions have real consequences for the workflow
- Local state is lost on browser refresh — for a professional tool, that's unacceptable

**Schema recommendation:**
```sql
document_checklist_items (
  id uuid,
  proyecto_id uuid REFERENCES proyectos(id),
  item_key text,           -- stable identifier e.g. "plano_arquitectonico"
  label text,              -- display name
  estado text,             -- 'ok' | 'pendiente' | 'no_aplica'
  updated_at timestamptz,
  updated_by uuid,
  notas text               -- architect can annotate why not-applicable
)
```

Rationale for `item_key` over pure label: allows re-generating the checklist (e.g., after AI update) without losing manual state overrides.

**Generated vs. manual items:** AI generates the base list per permit type + municipio. Architect can:
- Mark any item `no_aplica` (with optional note)
- Add custom items the AI didn't predict
- Cannot delete AI-generated items (only mark `no_aplica`)

**Output format (initial generation):**
```
{
  checklist: [
    {
      item_key: string,
      label: string,
      oguc_base: string,        // "Art. 5.4.2" or null
      requerido_municipio: boolean,
      estado_inferido: "ok|pendiente|incierto",
      inferencia_motivo: string // why AI thinks it's ok or missing
    }
  ]
}
```

**Table stakes:** Required documents must be based on specific permit type (anteproyecto vs permiso de edificación vs recepción) — not a generic "all possible documents" dump.

**Dependency on existing features:** PDF observation extractor (v1.0) can pre-populate `estado: ok` for documents mentioned in existing PDFs. This is a high-value integration — if the architect already uploaded a plano PDF, the checklist should know it.

**Complexity:** MEDIUM — list generation is straightforward; the DB persistence and manual override UX is where effort lives.

---

### Type 4: Estimación de Tiempo y Derechos

**Expected behavior:** For this project, estimate total processing time in business days and total fees in CLP and UF.

**Time estimate breakdown:**
```
Preparación expediente: X días hábiles (basado en complejidad)
Revisión DOM (Ley 21.718 máximo 30 días hábiles): 30 días base
Observaciones probables + respuesta: +N días (si predicción Tipo 2 indica observaciones)
Buffer municipio [tipo]: +N días (si DOM históricamente más lenta)
─────────────────────────────────────────────
Total estimado: X–Y días hábiles
Fecha estimada de resolución: [date]
```

**Fee estimate breakdown:** Builds directly on existing calculadora de derechos (v1.0). The new value is:
- Combining it with the project's actual superficie/uso data (no manual re-entry)
- Adding "otros costos típicos" context (certificados, copias, notaría) that the bare calculator doesn't show

**Output format:**
```
{
  tiempo: {
    dias_habiles_total: {min: number, max: number},
    fecha_estimada: date,
    desglose: [{etapa, dias_habiles, base}]
  },
  derechos: {
    monto_clp: number,
    monto_uf: number,
    calculo_base: string,   // "Artículo X OGUC, tabla Y"
    otros_costos_tipicos: [{descripcion, monto_clp_aprox}]
  },
  advertencias: [string]    // e.g., "Estimación basada en DOM tipo metropolitana"
}
```

**Dependency on existing features:** Calculadora de derechos (v1.0) — reuse the same calculation logic, wrap it with project-populated inputs.

**Complexity:** LOW-MEDIUM — mostly data assembly + existing calculator. Main risk is the time estimate feeling fabricated; mitigate with transparent ranges and explicit methodology.

---

## Background Automations

### DOM Auto-Update (Verificación Diaria)

**Expected behavior:** A cron job checks each active project's DOM status daily and updates `proyectos.estado_dom` in Supabase without any architect action.

**Cadence:** Daily, not hourly. DOM status changes are not real-time in Chilean municipalities — DOM Digital updates business-day frequency at best. Hourly would be over-polling with no benefit.

**Architecture pattern (established SaaS):** Vercel Cron Jobs (already in stack, v1.0) → API route → for each active project, check DOM Digital or municipio portal → compare to current DB state → if changed: update DB, trigger WhatsApp notification (Twilio, v1.0).

**State machine:**
```
ingresado → en_revision → observado → subsanado → aprobado | rechazado
```
The cron only moves state forward (never backward) and only when external source confirms.

**Table stakes:**
- Idempotency: running the cron twice in same day must not double-send notifications
- Audit trail: log each check attempt (status, timestamp, source response)
- Error handling: DOM Digital is unreliable — 3-retry with exponential backoff, silent failure (no architect alarm for transient errors)

**Anti-feature:** Do not poll all projects simultaneously — stagger checks over the cron window to avoid rate-limiting by municipal portals. Batch size: ≤ 10 concurrent checks.

**Dependency:** WhatsApp automático (Twilio, v1.0) — auto-update triggers the existing notification pipeline.

**Complexity:** MEDIUM — the cron infrastructure exists; the complexity is scraping reliability across 346 diverse municipal portals. Mitigation: MVP targets only DOM Digital-enabled municipalities first (covers ~30% of volume); manual fallback for others.

---

### SII Auto-Fill on Patente Creation

**Expected behavior:** When an architect creates a new patente comercial entry, the system auto-queries SII (Chile's tax authority public search) to enrich the record with: razón social, giro, dirección, fecha inicio actividades.

**Data source:** SII public RUT query endpoint (no auth required for basic data). HIGH confidence this is publicly accessible.

**Trigger:** On `patente` record creation with a valid RUT field — not a cron, an event trigger.

**UX pattern:** Non-blocking enrichment. Form saves immediately, then a brief "Enriqueciendo datos SII..." indicator appears; fields populate within 2-3 seconds. Architect can override any auto-filled value.

**Failure handling:** If SII lookup fails (timeout, invalid RUT, RUT not found), the form stays functional — enrichment is enhancement, not a blocker.

**Anti-feature:** Do not lock the form waiting for SII response. Never block the save action on an external API.

**Complexity:** LOW — simple HTTP fetch to public endpoint, map response to Supabase fields. Main risk: SII's public API changes format without notice (MEDIUM stability risk). Mitigation: wrap in a thin adapter layer.

---

### Weekly AI Email Digest

**Cadence:** Every Monday between 08:00–09:00 Chile time (America/Santiago). Rationale: Tuesday–Thursday are highest open-rate days industry-wide, but architects start their week on Monday reviewing pending work. The planning/reviewing behavior on Monday morning overrides the generic benchmark for this use case.

**Format:** HTML email via Resend (already in stack). Single-column, mobile-optimized. Max 500 words of generated content.

**Content structure (per user):**

```
Subject: "Tu semana en PermisoHub — [N] proyectos activos, [N] en riesgo de plazo"
  → Subject must contain real numbers from the user's data, not generic text

Section 1: Estado de la semana (3-4 bullet points max)
  - Proyectos aprobados esta semana
  - Proyectos que recibieron observaciones
  - Proyectos próximos a vencer plazo (Ley 21.718)

Section 2: Acción urgente (if any — else omit this section)
  - Projects within 5 business days of deadline
  - Specific: project name, fecha límite, estado actual

Section 3: Recordatorio IA (1 item, rotational)
  - Weekly tip related to what the architect has been doing
  - Examples: "Tip: Los proyectos en DOM Providencia que incluyen memoria descriptiva detallada tienen 40% menos observaciones según nuestros datos"

CTA: "Ver en PermisoHub →" (one button, links to dashboard)
```

**Personalization rules:**
- If user has 0 active projects: do not send the email (no value, trains unsubscribe habit)
- If all projects are in `aprobado` state with no pending actions: send brief congratulatory summary only
- Subject line must include real project counts — never generic "Your weekly update"

**AI generation scope:** Section 3 tip only — the rest is templated from real data. Generating Sections 1 and 2 from AI introduces hallucination risk on professional timelines. Use AI for the narrative/tip layer, not for factual project status.

**Table stakes:**
- Unsubscribe link (legal requirement + deliverability)
- Correct timezone (America/Santiago)
- Resend handles delivery; use Vercel Cron for scheduling (already in stack)
- Plain-text fallback for email clients that block HTML

**Anti-features:**

| Anti-Feature | Why Avoid |
|--------------|-----------|
| Daily digest emails | Frequency fatigue → unsubscribe. Professionals have 121 emails/day already |
| "Your AI assistant has insights!" generic subject | Zero information scent; low open rate |
| Generating project statuses with AI | Architects cannot afford hallucinated deadlines; factual data only for statuses |
| Digest emails for inactive users | Trains unsubscribe behavior; only send when there's real content |
| HTML-only (no text fallback) | Deliverability penalty; some corporate email clients block HTML |

**Complexity:** MEDIUM — Resend + Vercel Cron infrastructure exists; complexity is per-user data assembly (query each user's active projects) and the template rendering logic. At scale, batch email generation per user needs to be parallelizable.

---

## Feature Dependencies Map

```
Type 1 (OGUC Diagnostic)
  → depends on: municipal intelligence (v1.0), OGUC compliance checker corpus (v1.0)
  → enables: Type 2 (feeds risk signals)

Type 2 (Observation Prediction)
  → depends on: municipal intelligence (v1.0), Type 1 risk signals (optional enrichment)
  → enables: Type 3 time estimate (adds "observation buffer" to timeline)

Type 3 (Document Checklist)
  → depends on: PDF extractor (v1.0, to pre-populate "ok" state), permit type from expediente
  → persists to: Supabase (document_checklist_items table — NEW)

Type 4 (Time + Fee Estimate)
  → depends on: calculadora derechos (v1.0), Type 2 output (observation probability → adds buffer)
  → inputs auto-populated from expediente (no re-entry)

DOM Auto-Update
  → depends on: existing cron infrastructure (v1.0), WhatsApp Twilio (v1.0)
  → updates: proyectos.estado_dom in Supabase

SII Auto-Fill
  → depends on: nothing in v1.0 — net new
  → triggers on: patente record creation event

Weekly Email
  → depends on: Resend (v1.0), Vercel Cron (v1.0)
  → reads from: proyectos table, plazos, estado_dom
  → AI generates: Section 3 tip only (not factual status data)
```

---

## Build Complexity Summary

| Feature | Complexity | Highest Risk | Mitigation |
|---------|------------|--------------|------------|
| Copiloto Drawer (shell) | LOW | Session state loss on close | Lift state to parent module |
| Type 1: OGUC Diagnostic | HIGH | Hallucinated article numbers | Curated article corpus in system prompt, not free recall |
| Type 2: Observation Prediction | HIGH | Overconfident predictions → architect errors | Always show confidence level + data basis |
| Type 3: Document Checklist | MEDIUM | State lost on refresh | Persist to Supabase immediately on change |
| Type 4: Time + Fee Estimate | LOW-MEDIUM | Time estimate feels fabricated | Show ranges (X–Y days), not point estimates; show formula |
| DOM Auto-Update | MEDIUM | Municipal portal scraping unreliability | Start with DOM Digital only; idempotency + retry logic |
| SII Auto-Fill | LOW | SII API format changes | Adapter layer isolating SII response parsing |
| Weekly Email | MEDIUM | Hallucinated project statuses | Template factual data; AI writes tip only |
