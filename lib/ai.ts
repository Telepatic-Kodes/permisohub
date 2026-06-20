import Anthropic from '@anthropic-ai/sdk'

let _client: Anthropic | null = null

export function getAI(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  return _client
}

export const AI_MODEL = 'claude-sonnet-4-6'

export function isAIAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY
}
