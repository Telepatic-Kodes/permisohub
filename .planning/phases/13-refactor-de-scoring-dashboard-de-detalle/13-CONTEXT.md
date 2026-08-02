# Phase 13: Refactor de Scoring + Dashboard de Detalle - Context

**Gathered:** 2026-08-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Ficha de detalle de una oportunidad individual en `/mercado-inmobiliario/oportunidades/[id]`, con posicionamiento vs. cohorte, historial de precio, señales explicadas, comparables sugeridos y resumen ejecutivo IA. Incluye el refactor de `evaluarOportunidad()` como fuente única de verdad para scoring (prerequisito técnico, no en discusión). Comparación lado a lado (Phase 14) e informe exportable (Phase 15) están fuera de este alcance.

</domain>

<decisions>
## Implementation Decisions

### Jerarquía y densidad de la ficha
- Orden de secciones: Header (precio/comuna/tipo/operación) → Posicionamiento vs. cohorte → Resumen ejecutivo IA → Historial de precio + señales → Comparables sugeridos. El dato duro va antes que la narrativa.
- Layout: tabs por sección (Resumen | Posicionamiento | Historial | Comparables), no scroll único ni acordeón.
- `muestra_n` (hoy no se muestra en ningún lugar del UI) se declara explícitamente en la ficha. Cuando la muestra es chica (por debajo de `MIN_COHORT_SIZE=15`) y cae a fallback ciudad, se comunica con un **banner de advertencia prominente** arriba de la sección de posicionamiento — no una nota discreta.
- Acceso desde la lista: se agrega un **nuevo link "Ver ficha completa"** en cada card que abre `/oportunidades/[id]`. El link externo al aviso original en la card se mantiene igual, sin reemplazarlo.

### Comparables sugeridos (DETA-05)
- Criterio: mismo comuna + tipo de propiedad + operación (match exacto en los tres), ordenados por cercanía de precio UF/m² al de la oportunidad actual.
- Cantidad máxima: Claude's Discretion — ajustar según cuántos suelen calificar realmente por cohorte.
- Cuando hay 0 o 1 comparable real disponible: la sección **siempre aparece** y muestra un mensaje explícito (ej. "No hay suficientes comparables en esta comuna/tipo todavía") — nunca se oculta la sección ni se rellena con datos fuera de criterio. Consistente con la disciplina de "nunca fabricar datos" del proyecto.
- Cada comparable es una mini-card clickeable que enlaza a su propia ficha `/oportunidades/[id]` (crea un loop de navegación entre fichas), mostrando precio + UF/m² + comuna + badge de reason code.

### Rentabilidad implícita de zona (DETA-07)
- Solo existe cuando hay cobertura real de ambas bandas (arriendo y venta) para la misma comuna×tipo.
- Cuando falta cobertura: la sección **siempre aparece** con un mensaje explicando explícitamente qué dato falta (ej. "sin datos de venta suficientes en esta comuna×tipo") — mismo criterio que comparables, nunca se oculta silenciosamente.
- Es el dato más fácil de malinterpretar de la ficha (parece cap rate real del activo, es un estimado de zona). Se etiqueta con un **badge visible "Estimado de zona"** de color distintivo pegado al número — no un tooltip sutil.
- Se muestra el **desglose completo del cálculo** (banda de arriendo UF/m² y banda de venta UF/m² usadas), no solo el porcentaje final — prioriza transparencia/verificabilidad sobre densidad visual.
- Aparece en **toda ficha de esa comuna×tipo**, tanto venta como arriendo — es un dato de zona, no del activo específico, así que no se restringe solo a fichas de venta.

### Resumen ejecutivo IA (DETA-06)
- Bajo demanda con botón (mismo patrón que Tasación/Due Diligence hoy vía `InformeEjecutivo` + streaming SSE) — no se auto-genera al cargar la página.
- El resto de la ficha (posicionamiento, historial, comparables — todos datos reales sin IA) se renderiza de inmediato sin esperar al resumen; si el resumen falla o tarda, esa sección específica muestra error/vacío sin bloquear nada más.

### Claude's Discretion
- Cantidad máxima de comparables sugeridos a mostrar (3, 5, u otro número).
- Estrategia de cache del resumen ejecutivo IA entre visitas a la misma ficha (dado que ahora es bajo demanda, el peso de esta decisión bajó vs. si hubiera sido automático).
- Extensión/tono del resumen ejecutivo IA (breve tipo "so what" vs. formato extenso multi-párrafo como Tasación/DD hoy).

</decisions>

<specifics>
## Specific Ideas

- El resto de la ficha nunca debe esperar a la IA para renderizar — los datos reales (posicionamiento, historial, comparables) son la base confiable de la ficha, la IA es un complemento opcional bajo demanda.
- La disciplina de "nunca fabricar/ocultar la ausencia de datos" (ya establecida en el resto de PermisoHub — ver `AUDIT-FIDELIDAD-DATOS-2026-07-30.md`) se aplica dos veces en esta fase: comparables sin datos y rentabilidad de zona sin cobertura ambas muestran mensaje explícito, nunca se ocultan silenciosamente ni se aproximan con datos fuera de criterio.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope. (Comparación lado a lado y informe exportable ya están planificados como Phase 14 y Phase 15 respectivamente, fuera de esta discusión.)

</deferred>

---

*Phase: 13-refactor-de-scoring-dashboard-de-detalle*
*Context gathered: 2026-08-02*
