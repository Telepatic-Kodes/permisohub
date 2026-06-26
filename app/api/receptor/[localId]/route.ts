import { createClient } from '@/lib/supabase/server'
import { MOCK_LOCALES, MOCK_CENTROS, MOCK_CADENAS } from '@/lib/mock-data'

export const dynamic = 'force-dynamic'

type ChecklistItem = {
  id: string
  categoria: string
  item: string
  obligatorio: boolean
}

const MOCK_CHECKLIST: ChecklistItem[] = [
  // Obras
  { id: 'obras-1', categoria: 'Obras', item: 'Obra terminada según planos aprobados', obligatorio: true },
  { id: 'obras-2', categoria: 'Obras', item: 'Sin materiales en vías públicas', obligatorio: true },
  { id: 'obras-3', categoria: 'Obras', item: 'Fachada terminada', obligatorio: true },
  // Instalaciones
  { id: 'inst-1', categoria: 'Instalaciones', item: 'Instalación eléctrica completada', obligatorio: true },
  { id: 'inst-2', categoria: 'Instalaciones', item: 'Red de agua potable funcionando', obligatorio: true },
  { id: 'inst-3', categoria: 'Instalaciones', item: 'Alcantarillado conectado', obligatorio: true },
  { id: 'inst-4', categoria: 'Instalaciones', item: 'Gas certificado (si aplica)', obligatorio: false },
  // Accesibilidad
  { id: 'acc-1', categoria: 'Accesibilidad', item: 'Rampa de acceso conforme OGUC', obligatorio: true },
  { id: 'acc-2', categoria: 'Accesibilidad', item: 'Baños accesibles', obligatorio: true },
  { id: 'acc-3', categoria: 'Accesibilidad', item: 'Señalética de emergencia', obligatorio: true },
  // Incendios
  { id: 'inc-1', categoria: 'Incendios', item: 'Extintores instalados', obligatorio: true },
  { id: 'inc-2', categoria: 'Incendios', item: 'Mangueras y rociadores', obligatorio: true },
  { id: 'inc-3', categoria: 'Incendios', item: 'Alarma de incendio funcionando', obligatorio: true },
  // Documentación
  { id: 'doc-1', categoria: 'Documentación', item: 'Libro de obras disponible', obligatorio: true },
  { id: 'doc-2', categoria: 'Documentación', item: 'Planos aprobados en obra', obligatorio: true },
  { id: 'doc-3', categoria: 'Documentación', item: 'Certificados de especialidades', obligatorio: true },
]

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ localId: string }> }
) {
  const { localId } = await params

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('dev-no-auth')

    const { data: localData, error: localError } = await supabase
      .from('locales')
      .select('id, numero, nombre_negocio, uso, area_m2, centro:centros_comerciales(nombre, municipio, direccion, cadena:cadenas(nombre))')
      .eq('id', localId)
      .single()

    if (localError) throw localError

    const { data: checklistData, error: checklistError } = await supabase
      .from('checklist_items')
      .select('id, categoria, item, obligatorio')
      .order('categoria')

    if (checklistError) throw checklistError

    const { data: ultimaInspeccion } = await supabase
      .from('inspecciones')
      .select('fecha, inspector_nombre, resultado')
      .eq('local_id', localId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    // Supabase returns joins as arrays even for single relations
    type CentroArr = Array<{ nombre: string; municipio: string; direccion?: string; cadena: Array<{ nombre: string }> }>
    const centroArr = localData.centro as unknown as CentroArr
    const centroItem = centroArr?.[0]
    const cadenaItem = centroItem?.cadena?.[0]

    return Response.json({
      ok: true,
      local: {
        id: localData.id as string,
        numero: localData.numero as string,
        nombre_negocio: (localData.nombre_negocio ?? null) as string | null,
        uso: (localData.uso ?? null) as string | null,
        area_m2: (localData.area_m2 ?? null) as number | null,
      },
      centro: {
        nombre: centroItem?.nombre ?? '',
        municipio: centroItem?.municipio ?? '',
        direccion: centroItem?.direccion,
      },
      cadena: {
        nombre: cadenaItem?.nombre ?? '',
      },
      checklist: checklistData ?? MOCK_CHECKLIST,
      ultima_inspeccion: ultimaInspeccion
        ? {
            fecha: ultimaInspeccion.fecha,
            inspector: ultimaInspeccion.inspector_nombre,
            resultado: ultimaInspeccion.resultado as 'conforme' | 'no_conforme' | 'con_observaciones',
          }
        : null,
    })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      const local = MOCK_LOCALES.find(l => l.id === localId)
      if (!local) return Response.json({ error: 'Local no encontrado' }, { status: 404 })

      const centro = MOCK_CENTROS.find(cc => cc.id === local.centro_id)
      if (!centro) return Response.json({ error: 'Centro no encontrado' }, { status: 404 })

      const cadena = MOCK_CADENAS.find(c => c.id === centro.cadena_id)

      return Response.json({
        ok: true,
        local: {
          id: local.id,
          numero: local.numero,
          nombre_negocio: local.nombre_negocio ?? null,
          uso: local.uso ?? null,
          area_m2: local.area_m2 ?? null,
        },
        centro: {
          nombre: centro.nombre,
          municipio: centro.municipio,
          direccion: centro.direccion,
        },
        cadena: {
          nombre: cadena?.nombre ?? 'Cadena desconocida',
        },
        checklist: MOCK_CHECKLIST,
        ultima_inspeccion: null,
      })
    }
    return Response.json({ error: 'Error interno' }, { status: 500 })
  }
}

type PostBody = {
  items: Array<{ id: string; estado: 'conforme' | 'no_conforme' | 'no_aplica'; nota?: string }>
  inspector_nombre: string
  observaciones_generales?: string
}

function calcularResultado(
  items: Array<{ estado: 'conforme' | 'no_conforme' | 'no_aplica'; nota?: string }>
): 'conforme' | 'no_conforme' | 'con_observaciones' {
  if (items.some(i => i.estado === 'no_conforme')) return 'no_conforme'
  if (items.some(i => i.nota && i.nota.trim().length > 0)) return 'con_observaciones'
  return 'conforme'
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ localId: string }> }
) {
  const { localId } = await params
  const body = await request.json() as PostBody

  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) throw new Error('dev-no-auth')

    const resultado = calcularResultado(body.items)

    const { data, error } = await supabase
      .from('inspecciones')
      .insert({
        local_id: localId,
        inspector_nombre: body.inspector_nombre,
        observaciones_generales: body.observaciones_generales ?? null,
        resultado,
        items: body.items,
        fecha: new Date().toISOString(),
      })
      .select('id')
      .single()

    if (error) throw error

    return Response.json({ ok: true, inspeccion_id: data.id, resultado })
  } catch {
    if (process.env.NODE_ENV !== 'production') {
      const resultado = calcularResultado(body.items)
      return Response.json({
        ok: true,
        inspeccion_id: `insp-${Date.now()}`,
        resultado,
      })
    }
    return Response.json({ error: 'Error al registrar inspección' }, { status: 500 })
  }
}
