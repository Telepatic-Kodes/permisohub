// Base de datos de comunas de Chile con estado de DOM en Línea (plataforma MINVU).
// Fuente: investigación pública + datos MINVU (Sep 2023). ~61% de cobertura nacional.
// domStatus: 'dom_en_linea' = confirmada en domenlinea.minvu.cl
//            'probable'     = plataforma propia o adopción probable / no confirmada
//            'presencial'   = tramitación presencial (sin plataforma digital conocida)

export type DomStatus = 'dom_en_linea' | 'probable' | 'presencial'

export interface ComunaChile {
  id: string // slug: 'santiago', 'las-condes', etc.
  nombre: string
  region: string // 'Metropolitana', 'Valparaíso', etc.
  provincia: string
  domStatus: DomStatus
  urlDom?: string // URL específica si se conoce
  poblacion?: 'alta' | 'media' | 'baja' // para priorización visual
}

const DOM_EN_LINEA_URL = 'https://domenlinea.minvu.cl'

export const COMUNAS_CHILE: ComunaChile[] = [
  // ─────────────────────────────────────────────────────────────
  // XV — Arica y Parinacota
  // ─────────────────────────────────────────────────────────────
  { id: 'arica', nombre: 'Arica', region: 'Arica y Parinacota', provincia: 'Arica', domStatus: 'probable', poblacion: 'alta' },
  { id: 'camarones', nombre: 'Camarones', region: 'Arica y Parinacota', provincia: 'Arica', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'putre', nombre: 'Putre', region: 'Arica y Parinacota', provincia: 'Parinacota', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'general-lagos', nombre: 'General Lagos', region: 'Arica y Parinacota', provincia: 'Parinacota', domStatus: 'presencial', poblacion: 'baja' },

  // ─────────────────────────────────────────────────────────────
  // I — Tarapacá
  // ─────────────────────────────────────────────────────────────
  { id: 'iquique', nombre: 'Iquique', region: 'Tarapacá', provincia: 'Iquique', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'alto-hospicio', nombre: 'Alto Hospicio', region: 'Tarapacá', provincia: 'Iquique', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'pozo-almonte', nombre: 'Pozo Almonte', region: 'Tarapacá', provincia: 'Tamarugal', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'pica', nombre: 'Pica', region: 'Tarapacá', provincia: 'Tamarugal', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'huara', nombre: 'Huara', region: 'Tarapacá', provincia: 'Tamarugal', domStatus: 'presencial', poblacion: 'baja' },

  // ─────────────────────────────────────────────────────────────
  // II — Antofagasta
  // ─────────────────────────────────────────────────────────────
  { id: 'antofagasta', nombre: 'Antofagasta', region: 'Antofagasta', provincia: 'Antofagasta', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'calama', nombre: 'Calama', region: 'Antofagasta', provincia: 'El Loa', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'tocopilla', nombre: 'Tocopilla', region: 'Antofagasta', provincia: 'Tocopilla', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'mejillones', nombre: 'Mejillones', region: 'Antofagasta', provincia: 'Antofagasta', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'taltal', nombre: 'Taltal', region: 'Antofagasta', provincia: 'Antofagasta', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'maria-elena', nombre: 'María Elena', region: 'Antofagasta', provincia: 'Tocopilla', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'san-pedro-de-atacama', nombre: 'San Pedro de Atacama', region: 'Antofagasta', provincia: 'El Loa', domStatus: 'presencial', poblacion: 'baja' },

  // ─────────────────────────────────────────────────────────────
  // III — Atacama
  // ─────────────────────────────────────────────────────────────
  { id: 'copiapo', nombre: 'Copiapó', region: 'Atacama', provincia: 'Copiapó', domStatus: 'probable', poblacion: 'alta' },
  { id: 'vallenar', nombre: 'Vallenar', region: 'Atacama', provincia: 'Huasco', domStatus: 'probable', poblacion: 'media' },
  { id: 'caldera', nombre: 'Caldera', region: 'Atacama', provincia: 'Copiapó', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'chanaral', nombre: 'Chañaral', region: 'Atacama', provincia: 'Chañaral', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'diego-de-almagro', nombre: 'Diego de Almagro', region: 'Atacama', provincia: 'Chañaral', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'tierra-amarilla', nombre: 'Tierra Amarilla', region: 'Atacama', provincia: 'Copiapó', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'huasco', nombre: 'Huasco', region: 'Atacama', provincia: 'Huasco', domStatus: 'presencial', poblacion: 'baja' },

  // ─────────────────────────────────────────────────────────────
  // IV — Coquimbo
  // ─────────────────────────────────────────────────────────────
  { id: 'la-serena', nombre: 'La Serena', region: 'Coquimbo', provincia: 'Elqui', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'coquimbo', nombre: 'Coquimbo', region: 'Coquimbo', provincia: 'Elqui', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'ovalle', nombre: 'Ovalle', region: 'Coquimbo', provincia: 'Limarí', domStatus: 'probable', poblacion: 'media' },
  { id: 'illapel', nombre: 'Illapel', region: 'Coquimbo', provincia: 'Choapa', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'vicuna', nombre: 'Vicuña', region: 'Coquimbo', provincia: 'Elqui', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'andacollo', nombre: 'Andacollo', region: 'Coquimbo', provincia: 'Elqui', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'salamanca', nombre: 'Salamanca', region: 'Coquimbo', provincia: 'Choapa', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'monte-patria', nombre: 'Monte Patria', region: 'Coquimbo', provincia: 'Limarí', domStatus: 'presencial', poblacion: 'baja' },

  // ─────────────────────────────────────────────────────────────
  // V — Valparaíso
  // ─────────────────────────────────────────────────────────────
  { id: 'valparaiso', nombre: 'Valparaíso', region: 'Valparaíso', provincia: 'Valparaíso', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'vina-del-mar', nombre: 'Viña del Mar', region: 'Valparaíso', provincia: 'Valparaíso', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'quilpue', nombre: 'Quilpué', region: 'Valparaíso', provincia: 'Marga Marga', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'villa-alemana', nombre: 'Villa Alemana', region: 'Valparaíso', provincia: 'Marga Marga', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'concon', nombre: 'Con-Con', region: 'Valparaíso', provincia: 'Valparaíso', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'la-ligua', nombre: 'La Ligua', region: 'Valparaíso', provincia: 'Petorca', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'puchuncavi', nombre: 'Puchuncaví', region: 'Valparaíso', provincia: 'Valparaíso', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'baja' },
  { id: 'san-antonio', nombre: 'San Antonio', region: 'Valparaíso', provincia: 'San Antonio', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'quillota', nombre: 'Quillota', region: 'Valparaíso', provincia: 'Quillota', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'los-andes', nombre: 'Los Andes', region: 'Valparaíso', provincia: 'Los Andes', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'san-felipe', nombre: 'San Felipe', region: 'Valparaíso', provincia: 'San Felipe de Aconcagua', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'la-calera', nombre: 'La Calera', region: 'Valparaíso', provincia: 'Quillota', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'casablanca', nombre: 'Casablanca', region: 'Valparaíso', provincia: 'Valparaíso', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'el-quisco', nombre: 'El Quisco', region: 'Valparaíso', provincia: 'San Antonio', domStatus: 'probable', poblacion: 'baja' },
  { id: 'algarrobo', nombre: 'Algarrobo', region: 'Valparaíso', provincia: 'San Antonio', domStatus: 'probable', poblacion: 'baja' },
  { id: 'limache', nombre: 'Limache', region: 'Valparaíso', provincia: 'Marga Marga', domStatus: 'presencial', poblacion: 'media' },
  { id: 'olmue', nombre: 'Olmué', region: 'Valparaíso', provincia: 'Marga Marga', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'cartagena', nombre: 'Cartagena', region: 'Valparaíso', provincia: 'San Antonio', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'el-tabo', nombre: 'El Tabo', region: 'Valparaíso', provincia: 'San Antonio', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'santo-domingo', nombre: 'Santo Domingo', region: 'Valparaíso', provincia: 'San Antonio', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'quintero', nombre: 'Quintero', region: 'Valparaíso', provincia: 'Valparaíso', domStatus: 'presencial', poblacion: 'media' },

  // ─────────────────────────────────────────────────────────────
  // RM — Metropolitana
  // ─────────────────────────────────────────────────────────────
  { id: 'santiago', nombre: 'Santiago', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'providencia', nombre: 'Providencia', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'las-condes', nombre: 'Las Condes', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'vitacura', nombre: 'Vitacura', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'nunoa', nombre: 'Ñuñoa', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'maipu', nombre: 'Maipú', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'la-florida', nombre: 'La Florida', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'san-miguel', nombre: 'San Miguel', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'la-reina', nombre: 'La Reina', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'macul', nombre: 'Macul', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'penalolen', nombre: 'Peñalolén', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'pudahuel', nombre: 'Pudahuel', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'quilicura', nombre: 'Quilicura', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'renca', nombre: 'Renca', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'recoleta', nombre: 'Recoleta', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'independencia', nombre: 'Independencia', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'conchali', nombre: 'Conchalí', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'huechuraba', nombre: 'Huechuraba', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'lo-barnechea', nombre: 'Lo Barnechea', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'cerrillos', nombre: 'Cerrillos', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'lo-espejo', nombre: 'Lo Espejo', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'la-pintana', nombre: 'La Pintana', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'san-ramon', nombre: 'San Ramón', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'el-bosque', nombre: 'El Bosque', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'la-granja', nombre: 'La Granja', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'pedro-aguirre-cerda', nombre: 'Pedro Aguirre Cerda', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'estacion-central', nombre: 'Estación Central', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'cerro-navia', nombre: 'Cerro Navia', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'lo-prado', nombre: 'Lo Prado', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'quinta-normal', nombre: 'Quinta Normal', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'penaflor', nombre: 'Peñaflor', region: 'Metropolitana', provincia: 'Talagante', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'san-bernardo', nombre: 'San Bernardo', region: 'Metropolitana', provincia: 'Maipo', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'talagante', nombre: 'Talagante', region: 'Metropolitana', provincia: 'Talagante', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'melipilla', nombre: 'Melipilla', region: 'Metropolitana', provincia: 'Melipilla', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'colina', nombre: 'Colina', region: 'Metropolitana', provincia: 'Chacabuco', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'lampa', nombre: 'Lampa', region: 'Metropolitana', provincia: 'Chacabuco', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'el-monte', nombre: 'El Monte', region: 'Metropolitana', provincia: 'Talagante', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'baja' },
  { id: 'padre-hurtado', nombre: 'Padre Hurtado', region: 'Metropolitana', provincia: 'Talagante', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'buin', nombre: 'Buin', region: 'Metropolitana', provincia: 'Maipo', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'paine', nombre: 'Paine', region: 'Metropolitana', provincia: 'Maipo', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'puente-alto', nombre: 'Puente Alto', region: 'Metropolitana', provincia: 'Cordillera', domStatus: 'presencial', poblacion: 'alta' },
  { id: 'san-joaquin', nombre: 'San Joaquín', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'presencial', poblacion: 'media' },
  { id: 'la-cisterna', nombre: 'La Cisterna', region: 'Metropolitana', provincia: 'Santiago', domStatus: 'presencial', poblacion: 'media' },
  { id: 'isla-de-maipo', nombre: 'Isla de Maipo', region: 'Metropolitana', provincia: 'Talagante', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'tiltil', nombre: 'Tiltil', region: 'Metropolitana', provincia: 'Chacabuco', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'curacavi', nombre: 'Curacaví', region: 'Metropolitana', provincia: 'Melipilla', domStatus: 'presencial', poblacion: 'baja' },

  // ─────────────────────────────────────────────────────────────
  // VI — O'Higgins
  // ─────────────────────────────────────────────────────────────
  { id: 'rancagua', nombre: 'Rancagua', region: "O'Higgins", provincia: 'Cachapoal', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'san-fernando', nombre: 'San Fernando', region: "O'Higgins", provincia: 'Colchagua', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'rengo', nombre: 'Rengo', region: "O'Higgins", provincia: 'Cachapoal', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'machali', nombre: 'Machalí', region: "O'Higgins", provincia: 'Cachapoal', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'graneros', nombre: 'Graneros', region: "O'Higgins", provincia: 'Cachapoal', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'pichilemu', nombre: 'Pichilemu', region: "O'Higgins", provincia: 'Cardenal Caro', domStatus: 'probable', poblacion: 'baja' },
  { id: 'santa-cruz', nombre: 'Santa Cruz', region: "O'Higgins", provincia: 'Colchagua', domStatus: 'presencial', poblacion: 'media' },
  { id: 'mostazal', nombre: 'Mostazal', region: "O'Higgins", provincia: 'Cachapoal', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'san-vicente', nombre: 'San Vicente', region: "O'Higgins", provincia: 'Cachapoal', domStatus: 'presencial', poblacion: 'media' },
  { id: 'chimbarongo', nombre: 'Chimbarongo', region: "O'Higgins", provincia: 'Colchagua', domStatus: 'presencial', poblacion: 'baja' },

  // ─────────────────────────────────────────────────────────────
  // VII — Maule
  // ─────────────────────────────────────────────────────────────
  { id: 'talca', nombre: 'Talca', region: 'Maule', provincia: 'Talca', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'curico', nombre: 'Curicó', region: 'Maule', provincia: 'Curicó', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'molina', nombre: 'Molina', region: 'Maule', provincia: 'Curicó', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'curepto', nombre: 'Curepto', region: 'Maule', provincia: 'Talca', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'baja' },
  { id: 'rauco', nombre: 'Rauco', region: 'Maule', provincia: 'Curicó', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'baja' },
  { id: 'linares', nombre: 'Linares', region: 'Maule', provincia: 'Linares', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'constitucion', nombre: 'Constitución', region: 'Maule', provincia: 'Talca', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'cauquenes', nombre: 'Cauquenes', region: 'Maule', provincia: 'Cauquenes', domStatus: 'probable', poblacion: 'media' },
  { id: 'parral', nombre: 'Parral', region: 'Maule', provincia: 'Linares', domStatus: 'presencial', poblacion: 'media' },
  { id: 'san-javier', nombre: 'San Javier', region: 'Maule', provincia: 'Linares', domStatus: 'presencial', poblacion: 'media' },
  { id: 'teno', nombre: 'Teno', region: 'Maule', provincia: 'Curicó', domStatus: 'presencial', poblacion: 'baja' },

  // ─────────────────────────────────────────────────────────────
  // XVI — Ñuble
  // ─────────────────────────────────────────────────────────────
  { id: 'chillan', nombre: 'Chillán', region: 'Ñuble', provincia: 'Diguillín', domStatus: 'probable', poblacion: 'alta' },
  { id: 'chillan-viejo', nombre: 'Chillán Viejo', region: 'Ñuble', provincia: 'Diguillín', domStatus: 'presencial', poblacion: 'media' },
  { id: 'san-carlos', nombre: 'San Carlos', region: 'Ñuble', provincia: 'Punilla', domStatus: 'probable', poblacion: 'media' },
  { id: 'bulnes', nombre: 'Bulnes', region: 'Ñuble', provincia: 'Diguillín', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'quirihue', nombre: 'Quirihue', region: 'Ñuble', provincia: 'Itata', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'coelemu', nombre: 'Coelemu', region: 'Ñuble', provincia: 'Itata', domStatus: 'presencial', poblacion: 'baja' },

  // ─────────────────────────────────────────────────────────────
  // VIII — Biobío
  // ─────────────────────────────────────────────────────────────
  { id: 'concepcion', nombre: 'Concepción', region: 'Biobío', provincia: 'Concepción', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'talcahuano', nombre: 'Talcahuano', region: 'Biobío', provincia: 'Concepción', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'hualpen', nombre: 'Hualpén', region: 'Biobío', provincia: 'Concepción', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'san-pedro-de-la-paz', nombre: 'San Pedro de la Paz', region: 'Biobío', provincia: 'Concepción', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'chiguayante', nombre: 'Chiguayante', region: 'Biobío', provincia: 'Concepción', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'coronel', nombre: 'Coronel', region: 'Biobío', provincia: 'Concepción', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'los-angeles', nombre: 'Los Ángeles', region: 'Biobío', provincia: 'Biobío', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'lebu', nombre: 'Lebu', region: 'Biobío', provincia: 'Arauco', domStatus: 'probable', poblacion: 'media' },
  { id: 'lota', nombre: 'Lota', region: 'Biobío', provincia: 'Concepción', domStatus: 'probable', poblacion: 'media' },
  { id: 'tome', nombre: 'Tomé', region: 'Biobío', provincia: 'Concepción', domStatus: 'probable', poblacion: 'media' },
  { id: 'penco', nombre: 'Penco', region: 'Biobío', provincia: 'Concepción', domStatus: 'probable', poblacion: 'media' },
  { id: 'arauco', nombre: 'Arauco', region: 'Biobío', provincia: 'Arauco', domStatus: 'presencial', poblacion: 'media' },
  { id: 'cañete', nombre: 'Cañete', region: 'Biobío', provincia: 'Arauco', domStatus: 'presencial', poblacion: 'media' },
  { id: 'nacimiento', nombre: 'Nacimiento', region: 'Biobío', provincia: 'Biobío', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'mulchen', nombre: 'Mulchén', region: 'Biobío', provincia: 'Biobío', domStatus: 'presencial', poblacion: 'baja' },

  // ─────────────────────────────────────────────────────────────
  // IX — Araucanía
  // ─────────────────────────────────────────────────────────────
  { id: 'temuco', nombre: 'Temuco', region: 'Araucanía', provincia: 'Cautín', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'padre-las-casas', nombre: 'Padre Las Casas', region: 'Araucanía', provincia: 'Cautín', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'villarrica', nombre: 'Villarrica', region: 'Araucanía', provincia: 'Cautín', domStatus: 'probable', poblacion: 'media' },
  { id: 'pucon', nombre: 'Pucón', region: 'Araucanía', provincia: 'Cautín', domStatus: 'probable', poblacion: 'media' },
  { id: 'angol', nombre: 'Angol', region: 'Araucanía', provincia: 'Malleco', domStatus: 'probable', poblacion: 'media' },
  { id: 'victoria', nombre: 'Victoria', region: 'Araucanía', provincia: 'Malleco', domStatus: 'presencial', poblacion: 'media' },
  { id: 'lautaro', nombre: 'Lautaro', region: 'Araucanía', provincia: 'Cautín', domStatus: 'presencial', poblacion: 'media' },
  { id: 'nueva-imperial', nombre: 'Nueva Imperial', region: 'Araucanía', provincia: 'Cautín', domStatus: 'presencial', poblacion: 'media' },
  { id: 'collipulli', nombre: 'Collipulli', region: 'Araucanía', provincia: 'Malleco', domStatus: 'presencial', poblacion: 'baja' },

  // ─────────────────────────────────────────────────────────────
  // XIV — Los Ríos
  // ─────────────────────────────────────────────────────────────
  { id: 'valdivia', nombre: 'Valdivia', region: 'Los Ríos', provincia: 'Valdivia', domStatus: 'probable', poblacion: 'alta' },
  { id: 'la-union', nombre: 'La Unión', region: 'Los Ríos', provincia: 'Ranco', domStatus: 'probable', poblacion: 'media' },
  { id: 'rio-bueno', nombre: 'Río Bueno', region: 'Los Ríos', provincia: 'Ranco', domStatus: 'presencial', poblacion: 'media' },
  { id: 'panguipulli', nombre: 'Panguipulli', region: 'Los Ríos', provincia: 'Valdivia', domStatus: 'presencial', poblacion: 'media' },
  { id: 'los-lagos-comuna', nombre: 'Los Lagos', region: 'Los Ríos', provincia: 'Valdivia', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'mariquina', nombre: 'Mariquina', region: 'Los Ríos', provincia: 'Valdivia', domStatus: 'presencial', poblacion: 'baja' },

  // ─────────────────────────────────────────────────────────────
  // X — Los Lagos
  // ─────────────────────────────────────────────────────────────
  { id: 'puerto-montt', nombre: 'Puerto Montt', region: 'Los Lagos', provincia: 'Llanquihue', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'alta' },
  { id: 'puerto-varas', nombre: 'Puerto Varas', region: 'Los Lagos', provincia: 'Llanquihue', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'media' },
  { id: 'purranque', nombre: 'Purranque', region: 'Los Lagos', provincia: 'Osorno', domStatus: 'dom_en_linea', urlDom: DOM_EN_LINEA_URL, poblacion: 'baja' },
  { id: 'osorno', nombre: 'Osorno', region: 'Los Lagos', provincia: 'Osorno', domStatus: 'probable', poblacion: 'alta' },
  { id: 'castro', nombre: 'Castro', region: 'Los Lagos', provincia: 'Chiloé', domStatus: 'probable', poblacion: 'media' },
  { id: 'ancud', nombre: 'Ancud', region: 'Los Lagos', provincia: 'Chiloé', domStatus: 'probable', poblacion: 'media' },
  { id: 'osorno-rio-negro', nombre: 'Río Negro', region: 'Los Lagos', provincia: 'Osorno', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'calbuco', nombre: 'Calbuco', region: 'Los Lagos', provincia: 'Llanquihue', domStatus: 'presencial', poblacion: 'media' },
  { id: 'frutillar', nombre: 'Frutillar', region: 'Los Lagos', provincia: 'Llanquihue', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'llanquihue', nombre: 'Llanquihue', region: 'Los Lagos', provincia: 'Llanquihue', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'quellon', nombre: 'Quellón', region: 'Los Lagos', provincia: 'Chiloé', domStatus: 'presencial', poblacion: 'media' },

  // ─────────────────────────────────────────────────────────────
  // XI — Aysén
  // ─────────────────────────────────────────────────────────────
  { id: 'coyhaique', nombre: 'Coyhaique', region: 'Aysén', provincia: 'Coyhaique', domStatus: 'probable', poblacion: 'media' },
  { id: 'aysen', nombre: 'Aysén', region: 'Aysén', provincia: 'Aysén', domStatus: 'presencial', poblacion: 'media' },
  { id: 'chile-chico', nombre: 'Chile Chico', region: 'Aysén', provincia: 'General Carrera', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'cochrane', nombre: 'Cochrane', region: 'Aysén', provincia: 'Capitán Prat', domStatus: 'presencial', poblacion: 'baja' },

  // ─────────────────────────────────────────────────────────────
  // XII — Magallanes
  // ─────────────────────────────────────────────────────────────
  { id: 'punta-arenas', nombre: 'Punta Arenas', region: 'Magallanes', provincia: 'Magallanes', domStatus: 'probable', poblacion: 'alta' },
  { id: 'puerto-natales', nombre: 'Puerto Natales', region: 'Magallanes', provincia: 'Última Esperanza', domStatus: 'probable', poblacion: 'media' },
  { id: 'porvenir', nombre: 'Porvenir', region: 'Magallanes', provincia: 'Tierra del Fuego', domStatus: 'presencial', poblacion: 'baja' },
  { id: 'cabo-de-hornos', nombre: 'Cabo de Hornos', region: 'Magallanes', provincia: 'Antártica Chilena', domStatus: 'presencial', poblacion: 'baja' },
]

// Regiones ordenadas de norte a sur.
export const REGIONES_CHILE: string[] = [
  'Arica y Parinacota',
  'Tarapacá',
  'Antofagasta',
  'Atacama',
  'Coquimbo',
  'Valparaíso',
  'Metropolitana',
  "O'Higgins",
  'Maule',
  'Ñuble',
  'Biobío',
  'Araucanía',
  'Los Ríos',
  'Los Lagos',
  'Aysén',
  'Magallanes',
]

export function getComunasByRegion(region: string): ComunaChile[] {
  return COMUNAS_CHILE.filter((c) => c.region === region)
}

export function getComunasByStatus(status: DomStatus): ComunaChile[] {
  return COMUNAS_CHILE.filter((c) => c.domStatus === status)
}

export function getCoverageStats(): {
  total: number
  domEnLinea: number
  probable: number
  presencial: number
  pctCoverage: number
} {
  const total = COMUNAS_CHILE.length
  const domEnLinea = COMUNAS_CHILE.filter((c) => c.domStatus === 'dom_en_linea').length
  const probable = COMUNAS_CHILE.filter((c) => c.domStatus === 'probable').length
  const presencial = COMUNAS_CHILE.filter((c) => c.domStatus === 'presencial').length
  // Cobertura nacional oficial MINVU: 210 de 345 comunas (~61%).
  const pctCoverage = Math.round((210 / 345) * 100)
  return { total, domEnLinea, probable, presencial, pctCoverage }
}
