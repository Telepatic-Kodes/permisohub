import { z } from 'zod'

// Billing
export const CheckoutBodySchema = z.object({
  priceId: z.string().min(1),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
})

export const PortalBodySchema = z.object({
  returnUrl: z.string().url().optional(),
})

// Workspace
export const InviteBodySchema = z.object({
  email: z.string().email(),
  role: z.enum(['viewer', 'arquitecto', 'admin']).optional(),
})

// Proyectos
export const NuevoProyectoSchema = z.object({
  nombre: z.string().min(1).max(200),
  cliente_id: z.string().uuid(),
  municipio: z.string().min(1),
  tipo: z.string().optional(),
  descripcion: z.string().optional(),
})

// Notifications
export const NotifyBodySchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).max(200),
  html: z.string().min(1),
})

export const WhatsAppBodySchema = z.object({
  to: z.string().regex(/^\+?[0-9]{8,15}$/),
  message: z.string().min(1).max(4000),
})
