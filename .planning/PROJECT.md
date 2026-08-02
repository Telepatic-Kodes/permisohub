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

### Requirements (Torre de Control — shipped 2026-08-01, mergeado a main)

**Torre de Control** — gobernanza de datos y decisiones (ver `.planning/data-sources.yaml`), motivada porque el milestone v1.5 (fusión PROPRA·BI) se ejecutó en sesiones ad-hoc sin actualizar `.planning/`, dejando 17 commits invisibles a este sistema hasta esta puesta al día.

- ✓ Registro de fuentes de datos (`data-sources.yaml`, 32 fuentes) + validador determinista (`scripts/check-data-sources.mjs`) + `reportError`/`reportWarning` en los 7 scrapers que solo hacían `console.warn`
- ✓ Tabla `data_source_runs` + `recordSourceRun()` + página `/admin/salud-datos` — migración `20260807_data_source_runs.sql` aplicada en Supabase (confirmado en vivo: tabla con datos reales de mercado-locales/instrumentos-ipt/terrenos/cadenas-sucursales)
- ✓ Git hook de captura automática de commits (`.githooks/post-commit`) + puesta al día de `.planning/`
- ✓ Comando `/torre-control` project-local
- ✓ `InformeEjecutivo` piloteado en Tasación y extendido a Due Diligence — decisión explícita de NO extender a Predictor/Auditor/Compliance-check/Reportes de Mercado/Memoria Descriptiva (ya tienen UI a medida equivalente o el género no aplica, ver Key Decisions)
- ✓ 3 decisiones de founder resueltas (TocToc pendiente sin bloquear, Unimarc sin más inversión, refresh legal en cadencia fija trimestral)

### Requirements (v1.5 — Fusión PROPRA·BI, shipped 2026-08-01, ver `.planning/MILESTONES.md`)

- ✓ Módulo Terrenos (descubrimiento + evaluación) — v1.5
- ✓ Mercado Inmobiliario (tasación, pricing, oportunidades, due diligence, calculadora de inversión, reportes, indicadores macro, noticias) — v1.5
- ✓ Copiloto conversacional de Mercado Inmobiliario (function/tool-calling) — v1.5
- ✓ Instrumentos IPT por comuna — v1.5
- ✓ Checklist dinámico de requisitos DOM (fuente real, 9 formularios MINVU) — v1.5
- ✓ Separación de módulos Permisos/Mercado Inmobiliario en la UI (switcher, sidebar contextual, badge) — v1.5
- ✓ Fusión de permisohub-enterprise en una sola app — v1.5

### Requirements (auditoría de código + Mi Cartera + cierre de deuda — shipped 2026-08-02, mergeado a main)

Serie de sesiones ad-hoc entre v1.5 y v1.6 (sin milestone formal propio) — capturado acá para que "Validated" refleje la realidad del código:

- ✓ Auditoría de código de Mi Cartera, resto de Mercado Inmobiliario, y Permisos/DOM — 1 falla P0 de seguridad (RLS cross-tenant, patrón encontrado 3 veces), workspace-sharing roto en 4 rutas, fabricación financiera en cuadros de cálculo/derechos municipales, honestidad de IA (fabricación en fallos de parseo, truncamiento silencioso), SSE roto, N+1, timezone UTC — ver bullets `[auditoria-*]` en `.planning/STATE.md` Accumulated Context
- ✓ Mi Cartera: alerta de reajuste de renta UF/IPC (Ley 18.101 Art. 13) + Cap Rate en el resumen de portafolio — primer uso de 2 agentes en paralelo (git worktrees) en el proyecto
- ✓ Torre de Control: cierre de 5/6 `needs-decision` del registro de fuentes (spot-check real de 23 comunas, decisión de no cablear RAG-embeddings, cierre de DOM Digital tras investigar viabilidad)

### Requirements (v1.6 — Reportes Profesionales de Oportunidades, shipped 2026-08-02)

- ✓ DETA-01→07: Dashboard de detalle por oportunidad individual (`/oportunidades/[id]`) — posicionamiento vs. cohorte con `muestra_n` explícito, historial de precio, reason codes + señales cruzadas, comparables sugeridos, resumen ejecutivo IA bajo demanda, rentabilidad implícita de zona — v1.6
- ✓ COMPA-01→04: Comparación lado a lado de 2-5 oportunidades homogéneas, tabla con mejor valor resaltado, prevención estructural real (server-side, no solo checkbox) de mezclar tipo/operación, estado persistido en URL — v1.6
- ✓ INFO-01→04: Informe exportable/imprimible (individual y de comparación) vía `@media print`, con fecha de generación Y de última verificación por dato, campo "preparado por/para" personalizable — v1.6
- ✓ `evaluarOportunidad()` extraído como fuente única de verdad para scoring (TDD) — previene divergencia entre lista y ficha de detalle
- ✓ Patrón `@media print` + `window.print()` establecido como estándar del proyecto para vistas exportables (sin jsPDF/html2canvas) — resuelve una contradicción interna del research de milestone entre sus propios documentos

### Backlog (no comprometido — semillas para futuras sesiones de discovery)

- [ ] Dashboard de zonificación a nivel portafolio (todos los proyectos activos)
- [ ] Exportar PDF/anexo del hallazgo de zonificación para el expediente
- [ ] Indicador de vigencia/antigüedad del PRC ("vigente desde...") — pendiente confirmar si el layer expone fecha de decreto
- [ ] Ampliar cobertura de comunas ArcGIS más allá de las 4 iniciales
- [ ] Coeficientes urbanísticos numéricos (FOS, constructibilidad, altura, rasante, distanciamiento) — requiere fuente de datos distinta, paga o verificada
- [ ] Reparar el mojibake residual de doble-corrupción en un subconjunto de nombres de zona de Las Condes (hallado en el checkpoint de 11-08, cosmético, no bloqueante)
- [ ] Corregir la etiqueta de cita "Fuente: capa oficial {municipio}" para usar la comuna realmente seleccionada en el fallback manual, no `proyecto.municipio` (hallado en 11-08)
- [ ] Aplicar el mismo tratamiento de reporte profesional (research-driven) a Reportes de Mercado, una vez validado en Oportunidades v1.6

### Out of Scope (v1.6 — resuelto, para referencia histórica)

- Cap rate/NOI real por activo — no calculable con datos de listing (un scrape es arriendo O venta, nunca ambos del mismo activo); solo se ofrece "rentabilidad implícita de zona", etiquetada como estimado
- Rent roll, Walk Score, score único de "mejor oportunidad" — contradice la disciplina de "nunca fabricar interpretación no fundamentada" del proyecto
- Boilerplate legal de Offering Memorandum institucional (formato EE.UU.) — no aplica al contexto chileno/PYME de arquitectos
- Reportes de Mercado (página separada) — fuera de alcance, solo Oportunidades; evaluar mismo tratamiento después (ver Backlog)
- Mapa de posicionamiento a nivel comuna — bloqueado, sin GeoJSON de comunas RM disponible
- jsPDF/html2canvas para generación de PDF sin usuario presente — ninguno de los requisitos lo pedía; `@media print` cubre el caso de uso interactivo

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
- **Post-v1.6**: `gsd-tools.cjs phase complete` tiene un bug de regex que captura la línea de Requirements equivocada cuando el bullet-summary de "Phases" en ROADMAP.md menciona una fase antes de la sección completa de otra — ocurrió en Fase 14 y 15, corregido a mano ambas veces, causa raíz no arreglada en el script. `gsd-tools.cjs milestone complete` también copió ROADMAP.md/REQUIREMENTS.md completos sin acotar al milestone (a diferencia de v1.4) — corregido a mano reconstruyendo `milestones/v1.6-*.md`. `.planning/STATE.md` sigue en formato narrativo legacy que los comandos `state advance-plan/update-progress` no pueden parsear — cada ejecutor de plan lo actualiza a mano.

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
| Absorber PROPRA·BI como módulo nativo "Mercado Inmobiliario" (no un producto separado ni un submenú del copiloto de permisos) | El founder describió la tesis "arquitectura es dibujo" como diferenciador — el mercado inmobiliario necesitaba su propia identidad de módulo con switcher, no quedar enterrado; evita scope creep del copiloto de permisos | ✓ Good |
| Copiloto de Mercado Inmobiliario usa function/tool-calling (OpenAI `tools`) en vez de generar respuestas libres o RAG | Ancla cada respuesta en las funciones ya verificadas de `mercado-locales-server.ts`/`instrumentos-ipt-server.ts` en vez de dejar que el modelo invente cifras — primer uso de este patrón en el codebase | ✓ Good |
| Bautizar la función de gobernanza de datos/decisiones "Torre de Control", no "PMO" | El producto ya usa "PMO" para `components/proyecto/pmo-panel.tsx` (panel de sugerencias por proyecto) — mismo término para ambas cosas habría generado confusión real en conversaciones de equipo | ✓ Good |
| `data-sources.yaml` vive en `.planning/` (no en la raíz del repo) y se valida con un script determinista sin LLM, no con un agente | Co-ubicado con el resto del sistema de operaciones ya existente; un diff estructural (registro vs. filesystem vs. vercel.json) no necesita juicio de un modelo — más rápido, determinista, sin costo de tokens | ✓ Good |
| Captura de decisiones vía git hook (automática) en vez de un ritual de fin de sesión | El milestone v1.5 completo (17 commits) quedó invisible a `.planning/` precisamente porque dependía de que alguien se acordara de actualizarlo bajo presión de tiempo — un hook no se puede olvidar, es un efecto secundario de commitear | ✓ Good |
| `InformeEjecutivo` (Torre de Control §6) extendido solo a Tasación y Due Diligence, NO a Predictor/Auditor/Compliance-check/Reportes de Mercado/Memoria Descriptiva | Los primeros dos son streaming de markdown libre (búsqueda web agéntica) sin estructura compartida — ahí el componente aporta. Los otros 4 ya devuelven JSON estructurado con UI a medida que ya expresa bottom-line-up-front + verificación por campo (score circular + veredicto en Auditor, riesgo global + mes óptimo en Predictor, badge "Dato verificado"/"Estimado" por KPI en Reportes) — forzar el componente genérico ahí sería un downgrade visual, no una mejora. Memoria Descriptiva es un documento formal (texto de memoria para la DOM), no un informe de decisión con veredicto — el framing "resumen ejecutivo + confianza" no aplica a su género. | ✓ Good |
| Acceso comercial a TocToc (único vendor real de precios de transacción efectiva en Chile) — diferido, no descartado | Founder (1 ago 2026, confirmado 2026-08-01): política actual es no pagar por ninguna aplicación/dato de terceros por el momento — no es específico de TocToc, aplica a cualquier fuente paga que surja en la investigación de mercado en curso | — Deferred |
| RUT operativo real de Unimarc — no seguir investigando vía agentes | Founder (1 ago 2026): cobertura parcial de SMU (Alvi + Super10, sin Unimarc) es aceptable — más tiempo de búsqueda automatizada no vale la pena; reabrir solo si aparece por otra vía. Ver `sii-nomina-sucursales-holdings-sin-tiendas` en `data-sources.yaml` | ✓ Good |
| Refresh de bases de conocimiento legal (LGUC/OGUC/DDU) en cadencia fija trimestral (`freshness_sla_days: 90`), no ad-hoc | Founder (1 ago 2026): prefiere un recordatorio automático y determinista (el validador ya existente avisa cuando vence) a decidir caso a caso cuándo revisar | ✓ Good |
| `evaluarOportunidad()` extraído como fuente única de verdad para scoring, vía TDD (v1.6) | Previene que lista y ficha de detalle diverjan en qué cuenta como "oportunidad" — el bug exacto que motivó el prerequisito técnico de la Fase 13 | ✓ Good |
| Comparables y comparación de oportunidades vía queries nuevas y directas, no reusando `obtenerOportunidadesMercadoLocales()` (v1.6) | Esa función descarta listings sin reasonCodes — un subconjunto autoseleccionado, no el universo real de comparación | ✓ Good |
| Resumen ejecutivo IA de Oportunidades vía `streamConContexto` sin herramienta de búsqueda web, no `streamConBusquedaWeb` (v1.6) | Oportunidades sí tiene datos reales de mercado — dejar que el modelo busque en la web arriesgaría inventar contexto no anclado a esos datos | ✓ Good |
| Defensa de COMPA-03 en dos capas — checkbox deshabilitado (UX) + validación server-side real en `/comparar` (v1.6) | La URL `?ids=` es alcanzable directo, sin pasar por el checkbox — la validación real tiene que vivir en el servidor | ✓ Good |
| Informe exportable vía `@media print` + `window.print()`, no jsPDF/html2canvas (v1.6) | Resuelve una contradicción interna del research de milestone entre sus propios documentos; ninguno de los requisitos pedía generación sin usuario presente | ✓ Good |
| Sin gráficos Recharts en la v1 del informe exportable (v1.6) | Comportamiento de impresión de `ResponsiveContainer` no verificado en ningún caso real del repo — se evita el riesgo completo usando `GaugeArc`/`DesviacionBar` (SVG plano) | ✓ Good |

## Previous Milestones

- **v1.3 Army of Skills** (shipped 2026-06-26) — Copiloto IA drawer (Permisos/Desarchivo/Patentes), verificación DOM diaria automática, enriquecimiento SII automático, resumen semanal con tip de IA.
- **v1.4 Zonificación** (shipped 2026-07-30) — Zonificación automática por dirección (ArcGIS MINVU/OCUC), mapa con confirmación visual, compatibilidad de uso IA de 3 estados, fallback manual, integración aditiva en vía de tramitación/due diligence/copiloto. Full detail: `.planning/milestones/1.4-ROADMAP.md`.
- **v1.5 Fusión PROPRA·BI** (shipped 2026-08-01) — Absorción completa de la suite de inteligencia de mercado inmobiliario PROPRA·BI como módulo nativo "Mercado Inmobiliario", módulo Terrenos, instrumentos IPT, checklist dinámico, fusión de permisohub-enterprise, rediseño UX/IA de separación de módulos. Full detail: `.planning/MILESTONES.md`.
- **v1.6 Reportes Profesionales de Oportunidades** (shipped 2026-08-02) — Dashboard de detalle por oportunidad (posicionamiento vs. cohorte, historial, señales, comparables, resumen ejecutivo IA), comparación lado a lado (2-5 oportunidades, prevención estructural de mezclar tipo/operación), informe exportable/imprimible vía `@media print` con disciplina de fechas de vigencia. Full detail: `.planning/milestones/v1.6-ROADMAP.md`.

---
*Last updated: 2026-08-02 — cierre del milestone v1.6 (Reportes Profesionales de Oportunidades) vía `/gsd:complete-milestone`*
