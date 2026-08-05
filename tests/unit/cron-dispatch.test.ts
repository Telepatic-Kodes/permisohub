import { describe, it, expect } from 'vitest'
import { tareasDebidasHoy, TAREAS_CRON } from '@/lib/cron-dispatch'

// Fechas UTC de referencia — usar siempre horas UTC explícitas (Z) para no
// depender del timezone de la máquina que corre el test.
const MIERCOLES = new Date('2026-08-05T12:00:00Z') // día "normal", sin extras
const LUNES = new Date('2026-08-03T12:00:00Z')
const MARTES = new Date('2026-08-04T12:00:00Z')
const DIA_2_DEL_MES_VIERNES = new Date('2026-01-02T12:00:00Z') // 2 ene 2026 fue viernes

describe('tareasDebidasHoy', () => {
  it('un miércoles normal solo corren las 7 tareas diarias', () => {
    const tareas = tareasDebidasHoy(MIERCOLES)
    const paths = tareas.map((t) => t.path).sort()
    expect(paths).toEqual(
      [
        '/api/cron/daily-check',
        '/api/cron/noticias-macro',
        '/api/cron/salud-fuentes',
        '/api/scraper/mercado-locales',
        '/api/scraper/mercado-locales-tipos-adicionales',
        '/api/scraper/mercado-locales-doomos',
        '/api/scraper/mercado-locales-doomos-tipos-adicionales',
      ].sort()
    )
  })

  it('salud-fuentes se dispara PRIMERA, antes de cualquier scraper', () => {
    // No es cosmético: si corriera después de las 5 tareas de terrenos de un
    // martes, mediría la contención que produce este mismo cron sobre
    // Overpass y la reportaría como degradación de la fuente.
    expect(TAREAS_CRON[0].path).toBe('/api/cron/salud-fuentes')
    expect(TAREAS_CRON[0].staggerMs).toBeGreaterThan(0)
  })

  it('un lunes suman weekly-summary e instrumentos-ipt a las diarias', () => {
    const tareas = tareasDebidasHoy(LUNES)
    const paths = tareas.map((t) => t.path)
    expect(paths).toContain('/api/cron/weekly-summary')
    expect(paths).toContain('/api/scraper/instrumentos-ipt')
    expect(paths).toHaveLength(9)
  })

  it('un martes corren las 5 fuentes de terrenos además de las diarias, nunca weekly-summary', () => {
    const tareas = tareasDebidasHoy(MARTES)
    const paths = tareas.map((t) => t.path)
    expect(paths).toContain('/api/cron/terrenos-portalinmobiliario')
    expect(paths).toContain('/api/cron/terrenos-yapo')
    expect(paths).toContain('/api/cron/terrenos-doomos')
    expect(paths).toContain('/api/cron/terrenos-chilepropiedades')
    expect(paths).toContain('/api/cron/terrenos-portalterreno')
    expect(paths).not.toContain('/api/cron/weekly-summary')
    expect(paths).toHaveLength(12)
  })

  it('el día 2 del mes suma sii-nomina-sucursales, sin importar el día de la semana', () => {
    const tareas = tareasDebidasHoy(DIA_2_DEL_MES_VIERNES)
    const paths = tareas.map((t) => t.path)
    expect(paths).toContain('/api/scraper/sii-nomina-sucursales')
  })

  it('las 5 tareas de terrenos tienen stagger > 0 (nunca se disparan simultáneas)', () => {
    const terrenos = TAREAS_CRON.filter((t) => t.path.includes('terrenos-'))
    expect(terrenos).toHaveLength(5)
    // Las primeras 4 necesitan pausa antes de la siguiente; la última puede
    // ser 0 porque no hay una después en el grupo de terrenos.
    const conStagger = terrenos.filter((t) => t.staggerMs > 0)
    expect(conStagger.length).toBeGreaterThanOrEqual(4)
  })

  it('cada tarea define un path único (nunca dos entradas apuntan a la misma ruta)', () => {
    const paths = TAREAS_CRON.map((t) => t.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('hay exactamente 15 tareas registradas (12 de vercel.json + 2 de mercado-locales-doomos 04-08 + salud-fuentes 05-08)', () => {
    expect(TAREAS_CRON).toHaveLength(15)
  })
})
