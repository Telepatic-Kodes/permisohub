import type { PlanId } from "./stripe"

export interface PlanLimits {
  projects: number // max proyectos activos (Infinity = sin límite)
  aiChatsPerMonth: number // mensajes chat OGUC por mes
  pdfExtractionsPerMonth: number // extracciones PDF por mes
  whatsapp: boolean
  clientPortal: boolean
  municipalIntelligence: boolean
  cadenaModule: boolean // módulo cadenas comerciales
  seats: number // usuarios por workspace
}

export const PLAN_LIMITS: Record<PlanId, PlanLimits> = {
  free: {
    projects: 3,
    aiChatsPerMonth: 5,
    pdfExtractionsPerMonth: 1,
    whatsapp: false,
    clientPortal: false,
    municipalIntelligence: false,
    cadenaModule: false,
    seats: 1,
  },
  starter: {
    projects: 5,
    aiChatsPerMonth: 20,
    pdfExtractionsPerMonth: 3,
    whatsapp: false,
    clientPortal: false,
    municipalIntelligence: false,
    cadenaModule: false,
    seats: 1,
  },
  pro: {
    projects: Infinity,
    aiChatsPerMonth: Infinity,
    pdfExtractionsPerMonth: Infinity,
    whatsapp: true,
    clientPortal: true,
    municipalIntelligence: true,
    cadenaModule: false,
    seats: 1,
  },
  estudio: {
    projects: Infinity,
    aiChatsPerMonth: Infinity,
    pdfExtractionsPerMonth: Infinity,
    whatsapp: true,
    clientPortal: true,
    municipalIntelligence: true,
    cadenaModule: false,
    seats: 5,
  },
  enterprise: {
    projects: Infinity,
    aiChatsPerMonth: Infinity,
    pdfExtractionsPerMonth: Infinity,
    whatsapp: true,
    clientPortal: true,
    municipalIntelligence: true,
    cadenaModule: true,
    seats: 20,
  },
}

export function getLimits(plan: PlanId): PlanLimits {
  return PLAN_LIMITS[plan]
}

export function isWithinLimit(current: number, limit: number): boolean {
  if (limit === Infinity) return true
  return current < limit
}
