export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  const { proyectoId } = await request.json() as { proyectoId: string }

  if (!proyectoId) {
    return Response.json({ error: 'proyectoId requerido' }, { status: 400 })
  }

  const token = crypto.randomUUID()
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:7891'

  return Response.json({
    ok: true,
    token,
    url: `${baseUrl}/portal/${proyectoId}?t=${token}`,
  })
}
