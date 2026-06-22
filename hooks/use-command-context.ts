"use client"

export interface CommandContext {
  proyectoId: string
  proyectoNombre: string
  municipio: string
}

declare global {
  interface Window {
    __ph_command_context?: CommandContext
  }
}

export function setCommandContext(ctx: CommandContext): void {
  if (typeof window !== 'undefined') {
    window.__ph_command_context = ctx
  }
}

export function clearCommandContext(): void {
  if (typeof window !== 'undefined') {
    delete window.__ph_command_context
  }
}

export function getCommandContext(): CommandContext | null {
  if (typeof window !== 'undefined') {
    return window.__ph_command_context ?? null
  }
  return null
}
