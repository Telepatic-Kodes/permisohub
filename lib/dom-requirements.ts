export type CategoriaDocumento =
  | 'planos'
  | 'memorias'
  | 'certificados'
  | 'formularios'
  | 'legales'

export interface DocumentoRequerido {
  id: string
  nombre: string
  descripcion: string
  categoria: CategoriaDocumento
  obligatorio: boolean
  formatoAceptado: string[]   // ['pdf', 'dwg', 'jpg']
  nomenclaturaDom: string     // exact filename prefix expected by DOM en Línea
  ejemplo?: string
}

export interface RequisitosMunicipio {
  municipio: string
  urlDomEnLinea: string
  tienePortalPropio: boolean
  notaEspecial?: string
  documentosExtra?: DocumentoRequerido[]
}

// Base documents required for ALL permit types by OGUC
const BASE_DOCS: DocumentoRequerido[] = [
  {
    id: 'solicitud',
    nombre: 'Solicitud de permiso',
    descripcion: 'Formulario de solicitud firmado por propietario y arquitecto',
    categoria: 'formularios',
    obligatorio: true,
    formatoAceptado: ['pdf'],
    nomenclaturaDom: 'SOL_PERMISO',
  },
  {
    id: 'plano_ubicacion',
    nombre: 'Plano de ubicación y emplazamiento',
    descripcion: 'Escala 1:500 o 1:1000 con coordenadas UTM',
    categoria: 'planos',
    obligatorio: true,
    formatoAceptado: ['pdf', 'dwg'],
    nomenclaturaDom: 'PLANO_UBICACION',
  },
  {
    id: 'plano_arquitectura',
    nombre: 'Plantas, elevaciones y cortes',
    descripcion: 'Planos de arquitectura completos a escala',
    categoria: 'planos',
    obligatorio: true,
    formatoAceptado: ['pdf', 'dwg'],
    nomenclaturaDom: 'PLANO_ARQ',
  },
  {
    id: 'memoria_calculo',
    nombre: 'Memoria de cálculo estructural',
    descripcion: 'Firmada por ingeniero calculista con su timbre',
    categoria: 'memorias',
    obligatorio: true,
    formatoAceptado: ['pdf'],
    nomenclaturaDom: 'MEM_CALCULO',
  },
  {
    id: 'especificaciones',
    nombre: 'Especificaciones técnicas',
    descripcion: 'EETT de arquitectura y especialidades',
    categoria: 'memorias',
    obligatorio: true,
    formatoAceptado: ['pdf'],
    nomenclaturaDom: 'EETT',
  },
  {
    id: 'cert_dominio',
    nombre: 'Certificado de dominio vigente',
    descripcion: 'Del Conservador de Bienes Raíces, no mayor a 30 días',
    categoria: 'certificados',
    obligatorio: true,
    formatoAceptado: ['pdf'],
    nomenclaturaDom: 'CERT_DOMINIO',
  },
  {
    id: 'cert_hipotecas',
    nombre: 'Certificado de hipotecas y gravámenes',
    descripcion: 'Del CBR, no mayor a 30 días',
    categoria: 'certificados',
    obligatorio: true,
    formatoAceptado: ['pdf'],
    nomenclaturaDom: 'CERT_HIPOTECAS',
  },
  {
    id: 'cip',
    nombre: 'Certificado de informaciones previas (CIP)',
    descripcion: 'Emitido por la DOM del municipio',
    categoria: 'certificados',
    obligatorio: true,
    formatoAceptado: ['pdf'],
    nomenclaturaDom: 'CIP',
  },
  {
    id: 'plano_instalaciones',
    nombre: 'Planos de instalaciones',
    descripcion: 'Agua potable, alcantarillado, eléctrico y gas',
    categoria: 'planos',
    obligatorio: false,
    formatoAceptado: ['pdf', 'dwg'],
    nomenclaturaDom: 'PLANO_INST',
  },
]

// Additional docs by permit type
const DOCS_POR_TIPO: Record<string, DocumentoRequerido[]> = {
  permiso_edificacion: [
    ...BASE_DOCS,
    {
      id: 'presupuesto',
      nombre: 'Presupuesto de obra',
      descripcion: 'Valor estimado de la construcción para cálculo de derechos',
      categoria: 'formularios',
      obligatorio: true,
      formatoAceptado: ['pdf', 'xlsx'],
      nomenclaturaDom: 'PRESUPUESTO',
    },
    {
      id: 'plano_topografico',
      nombre: 'Plano topográfico',
      descripcion: 'Solo si el terreno tiene pendiente >5%',
      categoria: 'planos',
      obligatorio: false,
      formatoAceptado: ['pdf', 'dwg'],
      nomenclaturaDom: 'PLANO_TOPO',
    },
  ],
  recepcion_final: [
    {
      id: 'solicitud_recepcion',
      nombre: 'Solicitud de recepción final',
      descripcion: 'Formulario de solicitud de recepción',
      categoria: 'formularios',
      obligatorio: true,
      formatoAceptado: ['pdf'],
      nomenclaturaDom: 'SOL_RECEPCION',
    },
    {
      id: 'permiso_original',
      nombre: 'Permiso de edificación original',
      descripcion: 'Copia del permiso otorgado',
      categoria: 'legales',
      obligatorio: true,
      formatoAceptado: ['pdf'],
      nomenclaturaDom: 'PERMISO_ORIGINAL',
    },
    {
      id: 'cert_instalaciones',
      nombre: 'Certificados de instalaciones',
      descripcion: 'ESSAL/SEC/SMAPA según corresponda',
      categoria: 'certificados',
      obligatorio: true,
      formatoAceptado: ['pdf'],
      nomenclaturaDom: 'CERT_INST',
    },
    {
      id: 'libro_obras',
      nombre: 'Libro de obras (bitácora)',
      descripcion: 'Firmado por inspector técnico de obra si aplica',
      categoria: 'legales',
      obligatorio: false,
      formatoAceptado: ['pdf'],
      nomenclaturaDom: 'LIBRO_OBRAS',
    },
  ],
  regularizacion: [
    ...BASE_DOCS,
    {
      id: 'declaracion_jurada',
      nombre: 'Declaración jurada propietario',
      descripcion: 'Notarial — declara que la obra es anterior a la fecha de corte',
      categoria: 'legales',
      obligatorio: true,
      formatoAceptado: ['pdf'],
      nomenclaturaDom: 'DECL_JURADA',
    },
    {
      id: 'plano_levantamiento',
      nombre: 'Plano de levantamiento arquitectónico',
      descripcion: 'Levantamiento de la obra existente',
      categoria: 'planos',
      obligatorio: true,
      formatoAceptado: ['pdf', 'dwg'],
      nomenclaturaDom: 'PLANO_LEVANT',
    },
  ],
  anteproyecto: [
    {
      id: 'solicitud_ante',
      nombre: 'Solicitud de anteproyecto',
      descripcion: 'Formulario de solicitud',
      categoria: 'formularios',
      obligatorio: true,
      formatoAceptado: ['pdf'],
      nomenclaturaDom: 'SOL_ANTE',
    },
    {
      id: 'plano_emplazamiento',
      nombre: 'Plano de emplazamiento',
      descripcion: 'Esquema con superficies y rasantes',
      categoria: 'planos',
      obligatorio: true,
      formatoAceptado: ['pdf'],
      nomenclaturaDom: 'PLANO_EMPL',
    },
    {
      id: 'cip',
      nombre: 'Certificado de informaciones previas',
      descripcion: 'CIP vigente del municipio',
      categoria: 'certificados',
      obligatorio: true,
      formatoAceptado: ['pdf'],
      nomenclaturaDom: 'CIP',
    },
  ],
}

// Municipality-specific info
const MUNICIPIOS_DOM: Record<string, RequisitosMunicipio> = {
  'Santiago': {
    municipio: 'Santiago',
    urlDomEnLinea: 'https://domenlinea.minvu.cl',
    tienePortalPropio: false,
    notaEspecial: 'Usa DOM en Línea MINVU. Requiere FEA del arquitecto.',
  },
  'Las Condes': {
    municipio: 'Las Condes',
    urlDomEnLinea: 'https://domenlinea.minvu.cl',
    tienePortalPropio: false,
    notaEspecial: 'Estrictos en plazos. Derechos municipales más altos.',
  },
  'Providencia': {
    municipio: 'Providencia',
    urlDomEnLinea: 'https://domenlinea.minvu.cl',
    tienePortalPropio: false,
  },
  'Vitacura': {
    municipio: 'Vitacura',
    urlDomEnLinea: 'https://domenlinea.minvu.cl',
    tienePortalPropio: false,
    notaEspecial: 'Requiere memoria arquitectónica adicional con antecedentes del entorno.',
    documentosExtra: [
      {
        id: 'memoria_entorno',
        nombre: 'Memoria de entorno urbano',
        descripcion: 'Específico de Vitacura: análisis del entorno inmediato',
        categoria: 'memorias',
        obligatorio: true,
        formatoAceptado: ['pdf'],
        nomenclaturaDom: 'MEM_ENTORNO',
      },
    ],
  },
  'Ñuñoa': {
    municipio: 'Ñuñoa',
    urlDomEnLinea: 'https://domenlinea.minvu.cl',
    tienePortalPropio: false,
  },
  'La Florida': {
    municipio: 'La Florida',
    urlDomEnLinea: 'https://domenlinea.minvu.cl',
    tienePortalPropio: false,
  },
  'Maipú': {
    municipio: 'Maipú',
    urlDomEnLinea: 'https://domenlinea.minvu.cl',
    tienePortalPropio: false,
    notaEspecial: 'Portal DOM en Línea. Plazos de respuesta promedio 45 días.',
  },
  'Pudahuel': {
    municipio: 'Pudahuel',
    urlDomEnLinea: 'https://domenlinea.minvu.cl',
    tienePortalPropio: false,
  },
  'Recoleta': {
    municipio: 'Recoleta',
    urlDomEnLinea: 'https://domenlinea.minvu.cl',
    tienePortalPropio: false,
  },
  'La Reina': {
    municipio: 'La Reina',
    urlDomEnLinea: 'https://domenlinea.minvu.cl',
    tienePortalPropio: false,
  },
}

export function getDocumentosRequeridos(
  tipoPermiso: string,
  municipio: string
): DocumentoRequerido[] {
  const base = DOCS_POR_TIPO[tipoPermiso] ?? DOCS_POR_TIPO['permiso_edificacion']
  const extra = MUNICIPIOS_DOM[municipio]?.documentosExtra ?? []
  // Dedupe by id
  const seen = new Set(base.map((d) => d.id))
  return [...base, ...extra.filter((d) => !seen.has(d.id))]
}

export function getMunicipioInfo(municipio: string): RequisitosMunicipio {
  return MUNICIPIOS_DOM[municipio] ?? {
    municipio,
    urlDomEnLinea: 'https://domenlinea.minvu.cl',
    tienePortalPropio: false,
  }
}

export function getNombreArchivoDom(
  docId: string,
  expedienteNumero: string,
  tipoPermiso: string
): string {
  const doc = Object.values(DOCS_POR_TIPO)
    .flat()
    .find((d) => d.id === docId)
  const prefix = doc?.nomenclaturaDom ?? docId.toUpperCase()
  const exp = expedienteNumero.replace(/[^a-zA-Z0-9]/g, '_')
  const tipo = tipoPermiso.toUpperCase().slice(0, 3)
  return `${prefix}_${tipo}_${exp}`
}

export const CATEGORIAS_LABEL: Record<CategoriaDocumento, string> = {
  planos: 'Planos',
  memorias: 'Memorias y especificaciones',
  certificados: 'Certificados',
  formularios: 'Formularios',
  legales: 'Documentos legales',
}
