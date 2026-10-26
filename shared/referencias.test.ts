import { CATEGORIAS } from './excel'
import {
  describirReferencia, descripcionesConocidas, indiceModelos, modeloDeDescripcion, PREFIJO_CATEGORIA, referenciaPorDescripcion,
} from './referencias'

const m = (referencia: string, descripcion: string, marca: string) => ({ referencia, descripcion, marca, categoria: 'Tennis' })

describe('referencia automática', () => {
  it('cada categoría tiene su prefijo de 3 letras, distinto (los mismos de la base)', () => {
    const prefijos = CATEGORIAS.map((c) => PREFIJO_CATEGORIA[c.valor])
    expect(prefijos.every((p) => /^[A-Z]{3}$/.test(p))).toBe(true)
    expect(new Set(prefijos).size).toBe(CATEGORIAS.length)
  })

  it('se lee el código automático; el de un proveedor no', () => {
    expect(describirReferencia('TEN-NIKE-012')).toBe('Tennis · NIKE · n.º 12')
    expect(describirReferencia('FUT-SM-001')).toBe('Fútbol · sin marca · n.º 1')
    expect(describirReferencia('BMA-VERL-1203')).toBe('Botas material · VERL · n.º 1203')
    expect(describirReferencia('VR-77')).toBeNull()
    expect(describirReferencia('XYZ-NIKE-001')).toBeNull()
    expect(describirReferencia(null)).toBeNull()
  })
})

describe('reconocer un zapato por su descripción', () => {
  const indice = indiceModelos([
    m('TEN-NIKE-001', 'Tennis Zeus', 'Nike'),
    m('TEN-NIKE-001', 'Tennis Zeus', 'Nike'), // otro color del mismo: no se repite
    m('TEN-ADID-001', 'tennis  zeus', 'Adidas'),
    m('CLA-VERL-001', 'Clásico cuero', 'Verlon'),
    m('', 'Sin referencia', ''), // antes de la migración: no es un modelo
  ])

  it('sin importar mayúsculas, tildes ni espacios', () => {
    expect(modeloDeDescripcion(indice, ' clasico CUERO ', '')?.referencia).toBe('CLA-VERL-001')
  })

  it('con varias marcas para la misma descripción, decide la marca; sin ella no se adivina', () => {
    expect(modeloDeDescripcion(indice, 'Tennis Zeus', '')).toBeNull()
    expect(modeloDeDescripcion(indice, 'Tennis Zeus', 'adidas')?.referencia).toBe('TEN-ADID-001')
    expect(modeloDeDescripcion(indice, 'Tennis Zeus', 'Puma')).toBeNull()
    // Con la marca escrita, otra marca es otro zapato aunque sea el único con esa descripción.
    expect(modeloDeDescripcion(indice, 'Clásico cuero', 'Bosi')).toBeNull()
  })

  it('la referencia de la fila: la del zapato reconocido; si no hay, suelta la de otro y conserva una apartada', () => {
    expect(referenciaPorDescripcion(indice, { referencia: '', descripcion: 'Clásico cuero', marca: '' })).toBe('CLA-VERL-001')
    expect(referenciaPorDescripcion(indice, { referencia: 'CLA-VERL-001', descripcion: 'Clásico charol', marca: '' })).toBe('')
    expect(referenciaPorDescripcion(indice, { referencia: 'CHA-RIDE-004', descripcion: 'Chancla', marca: 'Rider' })).toBe('CHA-RIDE-004')
  })

  it('sugiere cada descripción una vez', () => {
    expect(descripcionesConocidas(indice)).toEqual(['Clásico cuero', 'Tennis Zeus'])
  })
})
