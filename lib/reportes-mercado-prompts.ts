import { z } from 'zod'

// Port de SYSTEM_REPORTE_MERCADO (repo origen PROPRA·BI, lib/prompts.ts) —
// fase 4 de la fusión. A diferencia del origen (donde TODOS los valores del
// JSON son inventados por el modelo, incluyendo el bloque macro que ahí
// viene de un fetch en vivo separado), acá el llamador puede inyectar datos
// reales ya portados (banda de precio Fase 1, oportunidades Fase 1, noticias
// Fase 2, macro Fase 2) — el prompt le prohíbe al modelo inventar el KPI de
// precio cuando se le entrega una banda real, mismo criterio que
// SYSTEM_PRICING_LOCAL ya usa.

export const SYSTEM_REPORTE_MERCADO = `Eres PermisoHub Market Analyst, analista de inteligencia de mercado especializado en locales comerciales en Chile.

Responde ÚNICAMENTE con JSON válido, sin texto adicional, con esta estructura exacta:
{
  "kpis": [
    {
      "label": "string (máximo 3 palabras)",
      "value": "string (métrica concisa, ej: '0.45 UF/m²/mes', '6.2%', '~8 semanas')",
      "trend": "string (cambio o señal breve, puede ser vacío '')",
      "context": "string (contexto, máximo 8 palabras)",
      "verificado": true o false
    }
  ],
  "recomendacion": {
    "accion": "INVERTIR | ARRENDAR | ESPERAR | DIVERSIFICAR",
    "texto": "string (3-5 líneas específicas: precio de entrada, rubro target, horizonte, táctica de negociación)"
  },
  "zona": {
    "descripcion": "string (caracterización en 1-2 líneas: tipo de corredor, mix de rubros, NSE)",
    "flujo": "ALTO | MEDIO | BAJO",
    "tendencia": "string (señal: consolidación / madurez / declive + 1 hito urbano clave si aplica)"
  },
  "rubros": [
    {
      "nombre": "string",
      "demanda": "Alta | Media | Baja",
      "precio": "string (rango UF/m²/mes, ej: '0.42–0.58')",
      "observacion": "string (máximo 10 palabras)"
    }
  ],
  "riesgos": ["string (1 riesgo concreto por item, máximo 20 palabras)"],
  "oportunidades": ["string (1 oportunidad concreta por item, máximo 20 palabras)"],
  "fuentes": ["string (portales, noticias o reportes consultados)"]
}

REGLA CRÍTICA E INQUEBRANTABLE SOBRE DATOS REALES: si el contexto del usuario incluye un bloque "[BANDA DE PRECIO REAL]", el KPI de precio (label "Precio UF/m²/mes" o similar) DEBE usar exactamente ese valor — nunca lo inventes ni lo ajustes — y su campo "verificado" debe ser true. Si NO se te entrega esa banda, estima el precio con tu conocimiento del mercado, pero "verificado" debe ser false y el campo "context" debe indicar que es una estimación no verificada contra datos reales. El mismo criterio aplica a "[OPORTUNIDADES REALES]" (si vienen, priorízalas sobre inventar una genérica) y "[NOTICIAS RECIENTES]" (si vienen, cítalas en "fuentes" con su título en vez de nombrar portales genéricos).

REGLAS OBLIGATORIAS:
- kpis: 4–5 items en este orden cuando apliquen: Precio UF/m²/mes → Cap Rate → Vacancia → Tiempo colocación → Tendencia 12M
- Todo KPI que NO sea el precio (cap rate, vacancia, tiempo colocación, tendencia) es siempre una estimación cualitativa — su "verificado" va en false, salvo que el contexto entregue un dato real explícito para ese KPI puntual.
- recomendacion.accion: EXACTAMENTE una de INVERTIR / ARRENDAR / ESPERAR / DIVERSIFICAR
- rubros: 6–8 items ordenados por demanda descendente
- riesgos: exactamente 3 items
- oportunidades: exactamente 3 items
- fuentes: 2–5 items
- Usa datos reales del mercado RM Chile cuando no tengas datos propios entregados. Sé específico con rangos numéricos.
- Adapta al perfil indicado — Renta: yield/cap rate; Plusvalía: valorización/tendencia; Uso propio: ubicación/flujo/competencia
- NUNCA uses placeholders entre corchetes. Si falta un dato, escribe "No disponible".`

// Schema laxo (mismo criterio que el resto de app/api/ai/** de PermisoHub,
// ver predict-observations/route.ts): garantiza forma estructural, no
// restringe strings a un set cerrado — drift menor del modelo no tumba el
// parseo completo.
const KpiSchema = z
  .object({
    label: z.string().default(''),
    value: z.string().default(''),
    trend: z.string().default(''),
    context: z.string().default(''),
    verificado: z.boolean().default(false),
  })
  .passthrough()

const RubroSchema = z
  .object({
    nombre: z.string().default(''),
    demanda: z.string().default(''),
    precio: z.string().default(''),
    observacion: z.string().default(''),
  })
  .passthrough()

export const ReporteMercadoSchema = z
  .object({
    kpis: z.array(KpiSchema).default([]),
    recomendacion: z
      .object({ accion: z.string().default(''), texto: z.string().default('') })
      .passthrough()
      .default({ accion: '', texto: '' }),
    zona: z
      .object({ descripcion: z.string().default(''), flujo: z.string().default(''), tendencia: z.string().default('') })
      .passthrough()
      .default({ descripcion: '', flujo: '', tendencia: '' }),
    rubros: z.array(RubroSchema).default([]),
    riesgos: z.array(z.string()).default([]),
    oportunidades: z.array(z.string()).default([]),
    fuentes: z.array(z.string()).default([]),
  })
  .passthrough()

export type ReporteMercado = z.infer<typeof ReporteMercadoSchema>

export interface ReporteMercadoInput {
  comuna: string
  tipo?: string
  rubro?: string
  perfil?: string
}

export interface ContextoRealReporte {
  bandaPrecioTexto: string | null // ya formateado, o null si no hay banda para esta comuna
  oportunidadesTexto: string | null
  noticiasTexto: string | null
  macroTexto: string
}

function clip(value: unknown, maxLen: number): string {
  const s = typeof value === 'string' ? value : ''
  return s.slice(0, maxLen)
}

export function buildUserQueryReporteMercado(input: ReporteMercadoInput, contexto: ContextoRealReporte): string {
  const bloques: string[] = []

  if (contexto.bandaPrecioTexto) bloques.push(`[BANDA DE PRECIO REAL]\n${contexto.bandaPrecioTexto}`)
  if (contexto.oportunidadesTexto) bloques.push(`[OPORTUNIDADES REALES]\n${contexto.oportunidadesTexto}`)
  if (contexto.noticiasTexto) bloques.push(`[NOTICIAS RECIENTES]\n${contexto.noticiasTexto}`)
  bloques.push(contexto.macroTexto)

  const parts = [
    'Genera inteligencia de mercado comercial para Chile.',
    input.comuna && `Zona/Comuna: ${clip(input.comuna, 500)}.`,
    input.tipo && `Tipo de local: ${clip(input.tipo, 500)}.`,
    input.rubro && `Rubro objetivo: ${clip(input.rubro, 500)}.`,
    input.perfil && `Perfil del inversor: ${clip(input.perfil, 500)}.`,
  ].filter(Boolean)

  const delimitedQuery = `[INICIO PARÁMETROS]\n${parts.join(' ')}\n[FIN PARÁMETROS]`

  return `${bloques.join('\n\n')}\n\n${delimitedQuery}`
}
