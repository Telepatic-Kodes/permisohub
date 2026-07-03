import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

export interface AlertaItem {
  id: string
  cadena_id: string
  cadena_nombre: string
  centro_id: string
  centro_nombre: string
  local_id: string
  local_numero: string
  negocio: string
  tenant_email?: string
  categoria: 'vencido' | 'proximo_30' | 'proximo_60' | 'proximo_90' | 'sin_permiso'
  fecha_estimada?: string
  dias_restantes?: number
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return Response.json({ error: 'No autenticado' }, { status: 401 })
    }

    const rateLimit = await checkRateLimit(`general:${user.id}`)
    if (rateLimit) return rateLimit

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Fetch all locales with their proyectos, joining through centros → cadenas
    const { data: locales, error: localesError } = await supabase
      .from('locales')
      .select(
        `
        id,
        numero,
        nombre_negocio,
        tenant_email,
        centro_id,
        centros (
          id,
          nombre,
          cadena_id,
          cadenas (
            id,
            nombre
          )
        ),
        proyectos (
          id,
          estado,
          fecha_estimada,
          local_id
        )
      `
      )

    if (localesError) throw localesError

    const alertas: AlertaItem[] = []

    for (const local of locales ?? []) {
      const centro = Array.isArray(local.centros) ? local.centros[0] : local.centros
      const cadena = centro
        ? Array.isArray(centro.cadenas)
          ? centro.cadenas[0]
          : centro.cadenas
        : null

      if (!centro || !cadena) continue

      // Find proyectos linked to this local
      const linkedProyectos = (local.proyectos ?? []).filter(
        (p: { local_id: string | null }) => p.local_id === local.id
      )

      if (linkedProyectos.length === 0) {
        alertas.push({
          id: `sin-permiso-${local.id}`,
          cadena_id: cadena.id,
          cadena_nombre: cadena.nombre,
          centro_id: centro.id,
          centro_nombre: centro.nombre,
          local_id: local.id,
          local_numero: local.numero,
          negocio: local.nombre_negocio ?? local.numero,
          tenant_email: local.tenant_email ?? undefined,
          categoria: 'sin_permiso',
        })
        continue
      }

      for (const proyecto of linkedProyectos) {
        if (!proyecto.fecha_estimada) continue

        const fechaEstimada = new Date(proyecto.fecha_estimada)
        fechaEstimada.setHours(0, 0, 0, 0)
        const diffMs = fechaEstimada.getTime() - today.getTime()
        const diasRestantes = Math.round(diffMs / 86400000)

        let categoria: AlertaItem['categoria'] | null = null

        if (proyecto.estado === 'aprobado' && diasRestantes < 0) {
          categoria = 'vencido'
        } else if (
          ['aprobado', 'en_revision'].includes(proyecto.estado) &&
          diasRestantes >= 1 &&
          diasRestantes <= 30
        ) {
          categoria = 'proximo_30'
        } else if (
          ['aprobado', 'en_revision'].includes(proyecto.estado) &&
          diasRestantes >= 31 &&
          diasRestantes <= 60
        ) {
          categoria = 'proximo_60'
        } else if (
          ['aprobado', 'en_revision'].includes(proyecto.estado) &&
          diasRestantes >= 61 &&
          diasRestantes <= 90
        ) {
          categoria = 'proximo_90'
        }

        if (categoria) {
          alertas.push({
            id: `alerta-${proyecto.id}`,
            cadena_id: cadena.id,
            cadena_nombre: cadena.nombre,
            centro_id: centro.id,
            centro_nombre: centro.nombre,
            local_id: local.id,
            local_numero: local.numero,
            negocio: local.nombre_negocio ?? local.numero,
            tenant_email: local.tenant_email ?? undefined,
            categoria,
            fecha_estimada: proyecto.fecha_estimada,
            dias_restantes: diasRestantes,
          })
        }
      }
    }

    // Sort: vencido first, then proximo_30, proximo_60, proximo_90, sin_permiso
    const orden: Record<AlertaItem['categoria'], number> = {
      vencido: 0,
      proximo_30: 1,
      proximo_60: 2,
      proximo_90: 3,
      sin_permiso: 4,
    }
    alertas.sort((a, b) => orden[a.categoria] - orden[b.categoria])

    return Response.json({ alertas })
  } catch {
    return Response.json({ error: 'Error al obtener alertas' }, { status: 500 })
  }
}
