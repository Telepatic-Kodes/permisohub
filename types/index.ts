export type EstadoExpediente =
  | 'borrador'
  | 'ingresado'
  | 'en_revision'
  | 'con_observaciones'
  | 'aprobado'
  | 'rechazado'

export type TipoPermiso =
  // Permisos mayores
  | 'permiso_edificacion'         // Obra nueva o ampliación que requiere permiso completo
  | 'anteproyecto'               // Aprobación previa de anteproyecto (art. 1.1.2 OGUC)
  | 'ampliacion'                 // Ampliación de edificación existente
  | 'cambio_destino'             // Cambio de uso de un inmueble ya existente
  // Obras menores (Ley 21.718 / Art. 5.1.2 OGUC)
  | 'obra_menor_sin_permiso'     // Obra menor exenta — solo Declaración Jurada (Art. 5.1.2)
  | 'obra_menor_con_permiso'     // Obra menor que igual requiere permiso simplificado (Art. 5.1.4)
  // Subdivisiones y loteos
  | 'subdivision'                // Subdivisión o fusión de predios (Art. 3.1.2 OGUC)
  | 'loteo'                      // Loteo o urbanización
  // Recepciones y certificaciones
  | 'recepcion_final'            // Recepción final de obra (requiere certificados especialidades)
  | 'recepcion_parcial'          // Recepción parcial por etapas
  // Otros trámites
  | 'revision_normativa'
  | 'supervision_apertura'
  | 'patente_comercial'
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

// Vigencia de un permiso otorgado (campo computado, no persistido)
export type VigenciaPermiso = 'vigente' | 'por_vencer' | 'vencido' | 'sin_fecha'

// Estado del proceso de desarchivo ante la DOM
export type EstadoDesarchivo = 'solicitado' | 'pagado' | 'en_proceso' | 'completado' | 'rechazado'

export interface SolicitudDesarchivo {
  fecha_solicitud: string
  estado: EstadoDesarchivo
  numero_solicitud?: string       // número que da el municipio al recibir la solicitud
  costo_uf?: number               // derechos de desarchivo en UF
  fecha_pago?: string
  fecha_estimada_entrega?: string
  observaciones?: string
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
  // Campos de permiso otorgado
  numero_permiso?: string             // número asignado por el municipio al otorgar
  fecha_otorgamiento?: string         // fecha en que DOM aprobó/otorgó el permiso
  fecha_vencimiento_permiso?: string  // fecha de vencimiento del permiso
  // Campos de desarchivo
  esta_archivado?: boolean
  fecha_archivado?: string
  solicitud_desarchivo?: SolicitudDesarchivo
  // Campos de patente comercial
  numero_patente?: string             // número de patente asignado por el municipio
  giro_sii?: string                   // giro comercial SII
  año_ejercicio?: number              // año fiscal de la patente (2025, 2026…)
  valor_derechos?: number             // derechos municipales en CLP
  fecha_pago_derechos?: string        // fecha de pago de los derechos
  patente_anterior_id?: string        // FK al proyecto del año anterior
  // Campos SII del predio (enriquecimiento catastral)
  rol_sii?: string                    // rol del predio ej. "1234-056"
  avaluo_fiscal_clp?: number          // avalúo fiscal en CLP (fuente: SII)
  superficie_terreno_m2?: number      // superficie del terreno en m²
  superficie_construida_m2?: number   // superficie construida en m²
  destino_sii?: string                // destino SII: CASA HABITACION, COMERCIO…
  lat?: number                        // latitud del predio (para mapa)
  lng?: number                        // longitud del predio (para mapa)
  // Campos enterprise (cadena comercial)
  local_id?: string
  centro_id?: string
  cadena_id?: string
  cliente?: Cliente
  local?: Local
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
  // Permisos mayores
  permiso_edificacion:      'Permiso de Edificación',
  anteproyecto:             'Anteproyecto (Art. 1.1.2)',
  ampliacion:               'Ampliación',
  cambio_destino:           'Cambio de Destino',
  // Obras menores
  obra_menor_sin_permiso:   'Obra Menor sin Permiso (Art. 5.1.2)',
  obra_menor_con_permiso:   'Obra Menor con Permiso (Art. 5.1.4)',
  // Subdivisiones
  subdivision:              'Subdivisión / Fusión',
  loteo:                    'Loteo / Urbanización',
  // Recepciones
  recepcion_final:          'Recepción Final',
  recepcion_parcial:        'Recepción Parcial por Etapas',
  // Otros
  revision_normativa:       'Revisión Normativa',
  supervision_apertura:     'Supervisión de Apertura',
  patente_comercial:        'Patente Comercial',
  otro:                     'Otro',
}

export const TIPO_PERMISO_DESCRIPCION: Partial<Record<TipoPermiso, string>> = {
  permiso_edificacion:    'Obras nuevas o ampliaciones ≥ 150 m² o ≥ 3 pisos. Requiere expediente completo con todas las especialidades.',
  anteproyecto:           'Aprobación previa de diseño. Congela normativa por 180 días hábiles.',
  ampliacion:             'Aumento de superficie construida en edificación existente.',
  cambio_destino:         'Modificación del uso del inmueble (ej: bodega → oficina).',
  obra_menor_sin_permiso: 'Obras de mantención o reparación que no alteran estructura ni superficie. Solo requiere Declaración Jurada ante DOM.',
  obra_menor_con_permiso: 'Obras menores que requieren visación DOM pero con proceso simplificado.',
  subdivision:            'División o fusión de uno o más predios. Requiere CBR y Catastro.',
  loteo:                  'Habilitación de terrenos con apertura de calles u obras de urbanización.',
  recepcion_final:        'Certificación de término de obra. Requiere certificados de electricidad (SEC), gas (GASCO/SEC), sanitario (empresa sanitaria), ascensores, etc.',
  recepcion_parcial:      'Recepción de una etapa de obra mientras continúa la construcción.',
}

// ============================================================================
// Workspace / Enterprise
// ============================================================================

export type RolWorkspace = 'admin' | 'arquitecto' | 'viewer'

export type TipoWorkspace = 'estudio' | 'inmobiliaria' | 'independiente' | 'cadena_comercial'

export interface Workspace {
  id: string
  nombre: string
  tipo: TipoWorkspace
  plan: string
  owner_id: string
  created_at: string
}

export interface WorkspaceMember {
  id: string
  workspace_id: string
  user_id: string
  role: RolWorkspace
  nombre?: string
  email?: string
  avatar?: string
  joined_at: string
}

export interface WorkspaceInvite {
  id: string
  workspace_id: string
  email: string
  role: RolWorkspace
  invited_by?: string
  token: string
  expires_at: string
  accepted_at?: string
  created_at: string
}

export const ROL_LABELS: Record<RolWorkspace, string> = {
  admin:       'Administrador',
  arquitecto:  'Arquitecto',
  viewer:      'Sólo lectura',
}

export const ROL_DESCRIPCION: Record<RolWorkspace, string> = {
  admin:       'Gestiona el workspace, equipo, proyectos y configuración.',
  arquitecto:  'Crea y edita proyectos. No puede gestionar el equipo.',
  viewer:      'Ve el avance de proyectos sin poder editar. Ideal para mandantes y locatarios.',
}

export const TIPO_WORKSPACE_LABELS: Record<TipoWorkspace, string> = {
  estudio:          'Estudio de Arquitectura',
  inmobiliaria:     'Administradora / Inmobiliaria',
  independiente:    'Arquitecto Independiente',
  cadena_comercial: 'Cadena Comercial / Centro Comercial',
}

// ============================================================================
// Cadenas de Centros Comerciales — vertical enterprise
// ============================================================================

export type UsoLocal = 'retail' | 'food' | 'servicio' | 'entretenimiento' | 'otro'

export interface Cadena {
  id: string
  workspace_id: string
  nombre: string
  rut?: string
  contacto_nombre?: string
  email?: string
  logo_url?: string
  municipios?: string[]
  centros?: CentroComercial[]
  created_at: string
}

export interface CentroComercial {
  id: string
  cadena_id: string
  nombre: string
  direccion?: string
  municipio: string
  region?: string
  area_m2?: number
  num_locales?: number
  gerente_nombre?: string
  gerente_email?: string
  locales?: Local[]
  cadena?: Cadena
  created_at: string
}

export interface Local {
  id: string
  centro_id: string
  numero: string
  nombre_negocio?: string
  tenant_email?: string
  tenant_nombre?: string
  area_m2?: number
  uso?: UsoLocal
  proyectos?: Proyecto[]
  centro?: CentroComercial
  created_at: string
}

export const USO_LOCAL_LABELS: Record<UsoLocal, string> = {
  retail:         'Retail',
  food:           'Gastronomía',
  servicio:       'Servicio',
  entretenimiento:'Entretenimiento',
  otro:           'Otro',
}

// ============================================================================
// CRM
// ============================================================================

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
