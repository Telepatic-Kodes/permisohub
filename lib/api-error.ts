export function apiError(message: string, status: number, internalError?: unknown): Response {
  if (internalError !== undefined) {
    const detail = internalError instanceof Error ? internalError.message : String(internalError)
    console.error(`[API ${status}] ${message}:`, detail)
  }
  return Response.json({ error: message }, { status })
}
