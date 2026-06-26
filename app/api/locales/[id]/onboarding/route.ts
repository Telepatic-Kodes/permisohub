import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MOCK_LOCALES, MOCK_CENTROS } from '@/lib/mock-data'

export const dynamic = 'force-dynamic'

type EstadoItem = 'pendiente' | 'en_tramite' | 'completado' | 'no_aplica'

type ItemOnboarding = {
  id: string
  nombre: string
  descripcion: string
  plazo_dias: number
  requerido: boolean
  estado: EstadoItem
  orden: number
  categoria: 'permisos' | 'certificados' | 'sanitario' | 'comercial'
}

function buildChecklist(uso: string, _municipio: string): ItemOnboarding[] {
  const items: ItemOnboarding[] = [
    {
      id: 'patente_comercial',
      nombre: 'Patente comercial',
      descripcion: 'Autorización municipal para ejercer actividades comerciales en el local.',
      plazo_dias: 30,
      requerido: true,
      estado: 'pendiente',
      orden: 1,
      categoria: 'comercial',
    },
    {
      id: 'cert_electricidad',
      nombre: 'Certificado electricidad',
      descripcion: 'Certificado SEC de instalaciones eléctricas interiores.',
      plazo_dias: 15,
      requerido: true,
      estado: 'pendiente',
      orden: 2,
      categoria: 'certificados',
    },
    {
      id: 'cert_agua_potable',
      nombre: 'Certificado agua potable',
      descripcion: 'Certificado de instalaciones sanitarias de agua potable.',
      plazo_dias: 15,
      requerido: true,
      estado: 'pendiente',
      orden: 3,
      categoria: 'certificados',
    },
  ]

  if (uso === 'food' || uso === 'servicio') {
    items.push(
      {
        id: 'resolucion_sanitaria',
        nombre: 'Resolución sanitaria SEREMI Salud',
        descripcion: 'Autorización sanitaria del Ministerio de Salud para manipulación de alimentos.',
        plazo_dias: 45,
        requerido: true,
        estado: 'pendiente',
        orden: 4,
        categoria: 'sanitario',
      },
      {
        id: 'cert_bomberos',
        nombre: 'Certificado de bomberos',
        descripcion: 'Inspección y certificación de condiciones de seguridad ante incendio.',
        plazo_dias: 20,
        requerido: true,
        estado: 'pendiente',
        orden: 5,
        categoria: 'sanitario',
      }
    )
  }

  if (uso === 'food' || uso === 'entretenimiento' || uso === 'retail') {
    items.push(
      {
        id: 'permiso_edificacion',
        nombre: 'Permiso de edificación (habilitación)',
        descripcion: 'Permiso municipal DOM para habilitación o modificación del espacio físico.',
        plazo_dias: 60,
        requerido: true,
        estado: 'pendiente',
        orden: 6,
        categoria: 'permisos',
      },
      {
        id: 'recepcion_final',
        nombre: 'Recepción final de obras',
        descripcion: 'Certificación municipal de término de obras de habilitación.',
        plazo_dias: 90,
        requerido: true,
        estado: 'pendiente',
        orden: 7,
        categoria: 'permisos',
      }
    )
  }

  items.push(
    {
      id: 'cert_gas',
      nombre: 'Certificado gas',
      descripcion: 'Certificado SEC de instalaciones de gas (aplica si hay instalación de gas).',
      plazo_dias: 10,
      requerido: false,
      estado: 'pendiente',
      orden: 8,
      categoria: 'certificados',
    },
    {
      id: 'inscripcion_sii',
      nombre: 'Inscripción actividad económica SII',
      descripcion: 'Inicio de actividades ante el Servicio de Impuestos Internos.',
      plazo_dias: 5,
      requerido: true,
      estado: 'pendiente',
      orden: 9,
      categoria: 'comercial',
    }
  )

  return items
}

function charCodeSum(str: string): number {
  let sum = 0
  for (let i = 0; i < str.length; i++) {
    sum += str.charCodeAt(i)
  }
  return sum
}

const ESTADOS_ORDEN: EstadoItem[] = ['pendiente', 'en_tramite', 'completado', 'no_aplica']

function applyMockEstados(localId: string, items: ItemOnboarding[]): ItemOnboarding[] {
  return items.map((item) => ({
    ...item,
    estado: ESTADOS_ORDEN[charCodeSum(localId + item.id) % 4],
  }))
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('dev-no-auth')

    const { data, error } = await supabase
      .from('locales')
      .select('*, centro:centros_comerciales(id, nombre, municipio)')
      .eq('id', id)
      .single()

    if (error) throw error

    const centroArr = data.centro as Array<{ id: string; nombre: string; municipio: string }>
    const centro = centroArr?.[0]
    const municipio: string = centro?.municipio ?? ''
    const uso: string = (data.uso as string) ?? 'otro'
    const localNombre: string = (data.nombre_negocio as string) ?? data.numero

    const checklist = buildChecklist(uso, municipio)

    const { data: estados, error: estadosError } = await supabase
      .from('onboarding_estados')
      .select('item_id, estado')
      .eq('local_id', id)

    if (!estadosError && estados && estados.length > 0) {
      const estadosMap = new Map<string, EstadoItem>(
        (estados as Array<{ item_id: string; estado: EstadoItem }>).map((e) => [e.item_id, e.estado])
      )
      for (const item of checklist) {
        const est = estadosMap.get(item.id)
        if (est) item.estado = est
      }
    }

    const completados = checklist.filter((i) => i.estado === 'completado').length
    const progreso = Math.round((completados / checklist.length) * 100)

    return NextResponse.json({ ok: true, checklist, local_nombre: localNombre, municipio, progreso })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      const local = MOCK_LOCALES.find((l) => l.id === id)
      if (!local) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

      const centro = MOCK_CENTROS.find((cc) => cc.id === local.centro_id)
      const municipio = centro?.municipio ?? ''
      const uso: string = local.uso ?? 'otro'
      const localNombre = local.nombre_negocio ?? local.numero

      const checklist = applyMockEstados(id, buildChecklist(uso, municipio))
      const completados = checklist.filter((i) => i.estado === 'completado').length
      const progreso = Math.round((completados / checklist.length) * 100)

      return NextResponse.json({ ok: true, checklist, local_nombre: localNombre, municipio, progreso })
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 })
  }
}

type PostBody = {
  itemId: string
  estado: EstadoItem
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params
  const body = (await req.json()) as PostBody

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('dev-no-auth')

    const { error } = await supabase.from('onboarding_estados').upsert(
      { local_id: id, item_id: body.itemId, estado: body.estado },
      { onConflict: 'local_id,item_id' }
    )

    if (error) throw error

    const local = MOCK_LOCALES.find((l) => l.id === id)
    const centro = MOCK_CENTROS.find((cc) => cc.id === local?.centro_id)
    const uso: string = local?.uso ?? 'otro'
    const municipio = centro?.municipio ?? ''
    const baseItem = buildChecklist(uso, municipio).find((i) => i.id === body.itemId)
    const itemActualizado: ItemOnboarding | undefined = baseItem
      ? { ...baseItem, estado: body.estado }
      : undefined

    return NextResponse.json({ ok: true, item: itemActualizado })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      const local = MOCK_LOCALES.find((l) => l.id === id)
      const centro = MOCK_CENTROS.find((cc) => cc.id === local?.centro_id)
      const uso: string = local?.uso ?? 'otro'
      const municipio = centro?.municipio ?? ''
      const baseItem = buildChecklist(uso, municipio).find((i) => i.id === body.itemId)
      const itemActualizado: ItemOnboarding | undefined = baseItem
        ? { ...baseItem, estado: body.estado }
        : undefined

      return NextResponse.json({ ok: true, item: itemActualizado })
    }
    return NextResponse.json({ error: 'Error al actualizar item' }, { status: 500 })
  }
}
