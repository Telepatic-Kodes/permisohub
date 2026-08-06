import { describe, expect, it } from 'vitest'
import {
  COMUNAS_SII,
  SANTIAGO_CODIGOS,
  codigosSIIPorComuna,
  normalizarNombreComuna,
} from '@/lib/comunas-sii'
import { COMUNAS_CHILE } from '@/lib/comunas-chile'

// El test que de verdad importa es "toda comuna que la app ofrece en un <Select>
// resuelve a un código". Sin él, agregar una comuna a COMUNAS_CHILE la deja sin
// consulta al SII y no se entera nadie hasta que un usuario busca un rol.
describe('cobertura de las comunas que usa la app', () => {
  it('las 174 comunas de COMUNAS_CHILE resuelven a al menos un código', () => {
    const sinCodigo = COMUNAS_CHILE.filter((c) => codigosSIIPorComuna(c.nombre).length === 0)
    expect(sinCodigo.map((c) => c.nombre)).toEqual([])
  })

  it('resuelve los dos nombres donde la app y el SII no coinciden', () => {
    // Únicos alias del módulo. Si alguna vez sobran o faltan, el test de arriba
    // no lo distinguiría de un error de normalización: por eso van explícitos.
    expect(codigosSIIPorComuna('Mostazal')).toEqual(['6104'])
    expect(codigosSIIPorComuna('Puerto Natales')).toEqual(['12101'])
  })
})

describe('el padrón del SII', () => {
  it('trae 347 filas, con códigos y nombres únicos', () => {
    expect(COMUNAS_SII).toHaveLength(347)
    expect(new Set(COMUNAS_SII.map((c) => c.codigo)).size).toBe(347)
    expect(new Set(COMUNAS_SII.map((c) => c.nombre)).size).toBe(347)
  })

  it('usa la numeración regional pre-2007', () => {
    const enRegion = (d: string) =>
      COMUNAS_SII.filter(
        (c) => (c.codigo.length === 5 ? c.codigo.slice(0, 2) : c.codigo.slice(0, 1)) === d
      ).length
    expect(enRegion('1')).toBe(11) // Tarapacá 7 + Arica y Parinacota 4
    expect(enRegion('8')).toBe(54) // Biobío 33 + Ñuble 21
    expect(enRegion('10')).toBe(42) // Los Lagos 30 + Los Ríos 12
  })

  it('no expone Antártica, y por eso devuelve [] en vez de un código cualquiera', () => {
    expect(COMUNAS_SII.filter((c) => /ANT[AÁ]RTIC/.test(c.nombre))).toEqual([])
    expect(codigosSIIPorComuna('Antártica')).toEqual([])
  })

  it('desconoce un nombre inventado en lugar de resolverlo al más parecido', () => {
    expect(codigosSIIPorComuna('Comuna Que No Existe')).toEqual([])
    expect(codigosSIIPorComuna('')).toEqual([])
  })
})

describe('Santiago', () => {
  it('devuelve los tres códigos, no solo 13101', () => {
    // 13134 SANTIAGO OESTE y 13135 SANTIAGO SUR son subdivisiones internas del
    // SII, no comunas — pero tienen predios propios. Resolver Santiago a 13101
    // a secas deja roles sin encontrar.
    expect(codigosSIIPorComuna('Santiago')).toEqual([...SANTIAGO_CODIGOS])
  })

  it('las subdivisiones existen en el padrón con esos nombres', () => {
    const porCodigo = (codigo: string) => COMUNAS_SII.find((c) => c.codigo === codigo)?.nombre
    expect(porCodigo('13101')).toBe('SANTIAGO')
    expect(porCodigo('13134')).toBe('SANTIAGO OESTE')
    expect(porCodigo('13135')).toBe('SANTIAGO SUR')
  })
})

describe('normalizarNombreComuna', () => {
  it('colapsa tildes, mayúsculas y separadores', () => {
    expect(normalizarNombreComuna('Ñuñoa')).toBe('NUNOA')
    expect(normalizarNombreComuna('Til-Til')).toBe(normalizarNombreComuna('Tiltil'))
    expect(normalizarNombreComuna("O'Higgins")).toBe('OHIGGINS')
    expect(normalizarNombreComuna('  Las Condes ')).toBe('LASCONDES')
  })

  it('no colapsa comunas distintas con nombres parecidos', () => {
    expect(normalizarNombreComuna('San Pedro')).not.toBe(
      normalizarNombreComuna('San Pedro de la Paz')
    )
  })
})
