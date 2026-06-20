export interface EstadisticaMunicipio {
  nombre: string
  region: string
  tiempoPromedioHabiles: number // business days average
  tiempoMedianoHabiles: number
  tasaObservaciones: number // 0-1, percentage of projects that get observations
  tiposObservacionFrequentes: string[]
  totalProyectos: number // anonymized sample size
  cumplimientoPlazoLey: number // 0-1, % of cases where DOM met legal deadline
  calificacion: 1 | 2 | 3 | 4 | 5 // 1=slowest, 5=fastest/best
  notas: string
  mesesMasAgiles: string[]
  mesesMasLentos: string[]
}

export const ESTADISTICAS_MUNICIPIOS: EstadisticaMunicipio[] = [
  {
    nombre: 'Providencia',
    region: 'Metropolitana',
    tiempoPromedioHabiles: 31,
    tiempoMedianoHabiles: 28,
    tasaObservaciones: 0.41,
    tiposObservacionFrequentes: ['Rasantes (Art. 2.6.3)', 'FOS excedido', 'Distanciamientos'],
    totalProyectos: 0,
    cumplimientoPlazoLey: 0.72,
    calificacion: 3,
    notas: 'DOM con sistema REVI implementado. Observaciones tienden a ser muy técnicas y bien justificadas.',
    mesesMasAgiles: ['Enero', 'Febrero', 'Agosto'],
    mesesMasLentos: ['Marzo', 'Junio', 'Noviembre'],
  },
  {
    nombre: 'Las Condes',
    region: 'Metropolitana',
    tiempoPromedioHabiles: 22,
    tiempoMedianoHabiles: 19,
    tasaObservaciones: 0.28,
    tiposObservacionFrequentes: ['Documentos incompletos', 'Especificaciones técnicas', 'Certificado dominio'],
    totalProyectos: 0,
    cumplimientoPlazoLey: 0.88,
    calificacion: 5,
    notas: 'Una de las DOMs más ágiles de la RM. Alta digitalización. DOM en Línea funcionando bien.',
    mesesMasAgiles: ['Enero', 'Julio', 'Agosto'],
    mesesMasLentos: ['Diciembre', 'Marzo'],
  },
  {
    nombre: 'Vitacura',
    region: 'Metropolitana',
    tiempoPromedioHabiles: 26,
    tiempoMedianoHabiles: 24,
    tasaObservaciones: 0.35,
    tiposObservacionFrequentes: ['Memoria de entorno urbano', 'Rasantes', 'FOS zona R1'],
    totalProyectos: 0,
    cumplimientoPlazoLey: 0.81,
    calificacion: 4,
    notas: 'Requiere "Memoria de entorno urbano" en muchos proyectos (requisito adicional local). Altos estándares de presentación.',
    mesesMasAgiles: ['Febrero', 'Agosto'],
    mesesMasLentos: ['Marzo', 'Septiembre'],
  },
  {
    nombre: 'Ñuñoa',
    region: 'Metropolitana',
    tiempoPromedioHabiles: 27,
    tiempoMedianoHabiles: 25,
    tasaObservaciones: 0.38,
    tiposObservacionFrequentes: ['Uso de suelo', 'Alturas máximas', 'Estacionamientos'],
    totalProyectos: 0,
    cumplimientoPlazoLey: 0.75,
    calificacion: 3,
    notas: 'Zona con muchos proyectos de densificación. Observaciones frecuentes por altura en zonas residenciales.',
    mesesMasAgiles: ['Enero', 'Agosto'],
    mesesMasLentos: ['Julio', 'Octubre'],
  },
  {
    nombre: 'La Florida',
    region: 'Metropolitana',
    tiempoPromedioHabiles: 35,
    tiempoMedianoHabiles: 33,
    tasaObservaciones: 0.45,
    tiposObservacionFrequentes: ['Documentos faltantes', 'Planos incompletos', 'Presupuesto de obra'],
    totalProyectos: 0,
    cumplimientoPlazoLey: 0.58,
    calificacion: 2,
    notas: 'DOM con alta carga de trabajo. Frecuentes incumplimientos del plazo Ley 21.718. Considerar Revisor Independiente.',
    mesesMasAgiles: ['Febrero', 'Agosto'],
    mesesMasLentos: ['Marzo', 'Octubre', 'Noviembre'],
  },
  {
    nombre: 'Maipú',
    region: 'Metropolitana',
    tiempoPromedioHabiles: 33,
    tiempoMedianoHabiles: 30,
    tasaObservaciones: 0.39,
    tiposObservacionFrequentes: ['FOS excedido', 'Accesibilidad universal', 'Instalaciones sanitarias'],
    totalProyectos: 0,
    cumplimientoPlazoLey: 0.62,
    calificacion: 2,
    notas: 'DOM con sistema REVI implementado para revisores. Alta demanda de proyectos residenciales.',
    mesesMasAgiles: ['Enero', 'Julio'],
    mesesMasLentos: ['Marzo', 'Diciembre'],
  },
  {
    nombre: 'Santiago',
    region: 'Metropolitana',
    tiempoPromedioHabiles: 29,
    tiempoMedianoHabiles: 27,
    tasaObservaciones: 0.33,
    tiposObservacionFrequentes: ['Uso de suelo mixto', 'Altura edificación', 'Estacionamientos'],
    totalProyectos: 0,
    cumplimientoPlazoLey: 0.79,
    calificacion: 3,
    notas: 'Centro histórico con normativas especiales. Muchos proyectos de uso mixto.',
    mesesMasAgiles: ['Enero', 'Agosto'],
    mesesMasLentos: ['Junio', 'Septiembre'],
  },
  {
    nombre: 'San Miguel',
    region: 'Metropolitana',
    tiempoPromedioHabiles: 24,
    tiempoMedianoHabiles: 22,
    tasaObservaciones: 0.31,
    tiposObservacionFrequentes: ['Documentos incompletos', 'Rasantes'],
    totalProyectos: 0,
    cumplimientoPlazoLey: 0.84,
    calificacion: 4,
    notas: 'DOM eficiente y bien organizada. Buenos tiempos de respuesta.',
    mesesMasAgiles: ['Enero', 'Agosto', 'Septiembre'],
    mesesMasLentos: ['Diciembre', 'Marzo'],
  },
]

export function getMunicipioStats(nombre: string): EstadisticaMunicipio | null {
  return ESTADISTICAS_MUNICIPIOS.find(m =>
    m.nombre.toLowerCase() === nombre.toLowerCase()
  ) ?? null
}

export function getRanking(): EstadisticaMunicipio[] {
  return [...ESTADISTICAS_MUNICIPIOS].sort((a, b) => b.calificacion - a.calificacion)
}
