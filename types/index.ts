export type EstadoExpediente =
  | 'borrador'
  | 'ingresado'
  | 'en_revision'
  | 'con_observaciones'
  | 'aprobado'
  | 'rechazado'

export type TipoPermiso =
  | 'permiso_edificacion'
  | 'revision_normativa'
  | 'supervision_apertura'
  | 'patente_comercial'
  | 'recepcion_final'
  | 'otro'

export interface Cliente {
  id: string
  nombre: string
  rut?: string
  contacto_nombre?: string
  email?: string
  telefono?: string
  notas?: string
  created_at: string
}

export interface Municipio {
  id: string
  nombre: string
  region: string
  dom_telefono?: string
  dom_email?: string
  dom_horario?: string
  plataforma_digital?: string
  url_dom?: string
  plazo_tipico_dias?: number
  requisitos: RequisitoDOM[]
  notas_internas?: string
}

export interface RequisitoDOM {
  nombre: string
  descripcion?: string
  obligatorio: boolean
  notas?: string
}

export interface Proyecto {
  id: string
  cliente_id: string
  nombre: string
  direccion: string
  municipio: string
  tipo: TipoPermiso
  estado: EstadoExpediente
  fecha_inicio: string
  fecha_estimada?: string
  notas?: string
  numero_expediente?: string
  etapa_actual?: string
  created_at: string
  cliente?: Cliente
  documentos?: Documento[]
  etapas?: Etapa[]
  comunicaciones?: Comunicacion[]
}

export interface Etapa {
  id: string
  proyecto_id: string
  nombre: string
  estado: 'pendiente' | 'en_curso' | 'completada' | 'bloqueada'
  fecha_inicio?: string
  fecha_fin?: string
  notas?: string
  orden: number
}

export interface Documento {
  id: string
  proyecto_id: string
  nombre: string
  tipo: string
  url: string
  tamaño?: number
  created_at: string
}

export interface Comunicacion {
  id: string
  proyecto_id: string
  fecha: string
  tipo: 'email' | 'llamada' | 'visita' | 'notificacion' | 'otro'
  asunto: string
  descripcion?: string
  contacto?: string
  created_at: string
}

export const ETAPAS_PERMISO = [
  'Pre-revisión normativa',
  'Preparación expediente',
  'Ingreso DOM',
  'Revisión DOM',
  'Respuesta observaciones',
  'Aprobación',
  'Recepción final',
]

export const ESTADO_CONFIG: Record<EstadoExpediente, { label: string; color: string }> = {
  borrador:          { label: 'Borrador',           color: 'bg-gray-100 text-gray-700' },
  ingresado:         { label: 'Ingresado',           color: 'bg-blue-100 text-blue-700' },
  en_revision:       { label: 'En revisión',         color: 'bg-yellow-100 text-yellow-700' },
  con_observaciones: { label: 'Con observaciones',   color: 'bg-orange-100 text-orange-700' },
  aprobado:          { label: 'Aprobado',            color: 'bg-green-100 text-green-700' },
  rechazado:         { label: 'Rechazado',           color: 'bg-red-100 text-red-700' },
}

export const TIPO_PERMISO_LABELS: Record<TipoPermiso, string> = {
  permiso_edificacion:  'Permiso de Edificación',
  revision_normativa:   'Revisión Normativa',
  supervision_apertura: 'Supervisión de Apertura',
  patente_comercial:    'Patente Comercial',
  recepcion_final:      'Recepción Final',
  otro:                 'Otro',
}

export type EtapaCRM =
  | 'nuevo_contacto'
  | 'contactado'
  | 'reunion_agendada'
  | 'propuesta_enviada'
  | 'negociando'
  | 'ganado'
  | 'descartado'

export type FuenteCRM = 'linkedin' | 'referido' | 'evento' | 'web' | 'otro'

export type TipoActividad = 'email' | 'llamada' | 'reunion' | 'whatsapp' | 'linkedin' | 'nota'

export interface Prospecto {
  id: string
  empresa: string
  contacto_nombre: string
  cargo?: string
  email?: string
  telefono?: string
  linkedin_url?: string
  fuente: FuenteCRM
  etapa: EtapaCRM
  valor_estimado?: number
  municipios_interes?: string[]
  notas?: string
  proximo_contacto?: string
  created_at: string
  actividades?: ActividadCRM[]
}

export interface ActividadCRM {
  id: string
  prospecto_id: string
  tipo: TipoActividad
  descripcion: string
  fecha: string
  resultado?: string
}

export const ETAPA_CRM_CONFIG: Record<EtapaCRM, { label: string; color: string; bg: string; dot: string }> = {
  nuevo_contacto:    { label: 'Nuevo contacto',    color: 'text-gray-700',   bg: 'bg-gray-100',   dot: 'bg-gray-400' },
  contactado:        { label: 'Contactado',         color: 'text-blue-700',   bg: 'bg-blue-100',   dot: 'bg-blue-500' },
  reunion_agendada:  { label: 'Reunión agendada',   color: 'text-violet-700', bg: 'bg-violet-100', dot: 'bg-violet-500' },
  propuesta_enviada: { label: 'Propuesta enviada',  color: 'text-amber-700',  bg: 'bg-amber-100',  dot: 'bg-amber-500' },
  negociando:        { label: 'Negociando',         color: 'text-orange-700', bg: 'bg-orange-100', dot: 'bg-orange-500' },
  ganado:            { label: 'Ganado ✓',           color: 'text-green-700',  bg: 'bg-green-100',  dot: 'bg-green-500' },
  descartado:        { label: 'Descartado',         color: 'text-red-700',    bg: 'bg-red-100',    dot: 'bg-red-400' },
}

export const FUENTE_LABELS: Record<FuenteCRM, string> = {
  linkedin: 'LinkedIn',
  referido: 'Referido',
  evento:   'Evento',
  web:      'Web',
  otro:     'Otro',
}

export const TIPO_ACTIVIDAD_LABELS: Record<TipoActividad, string> = {
  email:    'Email',
  llamada:  'Llamada',
  reunion:  'Reunión',
  whatsapp: 'WhatsApp',
  linkedin: 'LinkedIn DM',
  nota:     'Nota interna',
}
