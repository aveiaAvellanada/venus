import {
  avisosCargaInicial, claveDeFila, erroresCargaInicial, filasParaCargar, paresNuevos, resumenCargaInicial, tallasYaCargadas,
} from './cargaInicial'
import { filaVacia, rangoCompleto, type FilaFactura } from './compras'

const FOTO = 'https://x.supabase.co/storage/v1/object/public/productos/catalogo/52452601-rojo.webp?v=1'

const diana = (o: Partial<FilaFactura> = {}): FilaFactura => ({
  ...filaVacia('a'),
  referencia: '52452601', descripcion: 'Diana Gold', marca: 'Manisol', categoria: 'Chanclas', color: 'Rojo',
  cantidades: { '35': '4', '36': '4', '37': '10', '38': '10', '39': '4' },
  rangos: [rangoCompleto({ minimo: '30.000' })],
  ...o,
})

describe('carga inicial: lo que se guarda', () => {
  it('una fila por talla nueva, con su stock, precio y foto; sin máximo si no se escribió', () => {
    const filas = filasParaCargar([diana({ foto: FOTO })])
    expect(filas).toHaveLength(5)
    expect(filas[2]).toEqual({
      fila: '52452601 Rojo, talla 37', categoria: 'Chanclas', descripcion: 'Diana Gold', marca: 'Manisol',
      referencia: '52452601', color: 'Rojo', talla: '37', precio_minimo: 30000, precio_maximo: undefined, stock: 10, foto_url: FOTO,
    })
    expect(filas.reduce((s, f) => s + f.stock, 0)).toBe(32)
  })

  it('cada rango de tallas lleva su precio', () => {
    const fila = diana({ rangos: [rangoCompleto({ hasta: '36', minimo: '28000', maximo: '32000' }), rangoCompleto({ desde: '37', minimo: '30000' })] })
    const precios = filasParaCargar([fila]).map((f) => [f.talla, f.precio_minimo, f.precio_maximo])
    expect(precios).toEqual([['35', 28000, 32000], ['36', 28000, 32000], ['37', 30000, undefined], ['38', 30000, undefined], ['39', 30000, undefined]])
  })

  it('las tallas que ya existen no se cargan otra vez; con foto nueva van con su precio y stock 0', () => {
    const existentes = { '38': { id: 'e38', precio_minimo: 31000, precio_maximo: null, stock: 6 } }
    const sinFoto = diana({ existentes })
    expect(filasParaCargar([sinFoto]).map((f) => f.talla)).toEqual(['35', '36', '37', '39'])
    expect(paresNuevos(sinFoto)).toBe(22)
    expect(tallasYaCargadas(sinFoto)).toEqual(['38'])

    const soloFoto = diana({ existentes, cantidades: {}, foto: FOTO })
    expect(filasParaCargar([soloFoto])).toEqual([
      expect.objectContaining({ talla: '38', precio_minimo: 31000, precio_maximo: undefined, stock: 0, foto_url: FOTO }),
    ])
  })

  it('dos colores se guardan como "Rojo y blanco"', () => {
    expect(filasParaCargar([diana({ color: 'rojo/blanco' })])[0].color).toBe('Rojo y blanco')
    expect(claveDeFila(diana({ color: 'rojo/blanco' }))).toBe(claveDeFila(diana({ referencia: ' 52452601 ', color: 'Rojo y blanco' })))
  })

  it('el resumen cuenta referencias, tallas nuevas, pares y fotos', () => {
    expect(resumenCargaInicial([diana({ foto: FOTO }), diana({ id: 'b', color: 'Negro', cantidades: { '40': '3' } }), filaVacia('c')]))
      .toEqual({ referencias: 2, tallasNuevas: 6, pares: 35, fotos: 1 })
  })
})

describe('carga inicial: errores y avisos', () => {
  it('una fila completa no tiene errores (no pide costo)', () => {
    expect(erroresCargaInicial([diana(), filaVacia('vacia')])).toEqual([])
  })

  it('sin nada que guardar', () => {
    expect(erroresCargaInicial([filaVacia('a')])).toEqual(['Escribe la cantidad de al menos una talla nueva.'])
  })

  it('pide descripción, categoría y precio mínimo; el máximo no puede ser menor', () => {
    expect(erroresCargaInicial([diana({ descripcion: '', categoria: '', rangos: [rangoCompleto()] })])).toEqual([
      'Falta la descripción de 52452601 Rojo.',
      'Falta la categoría de 52452601 Rojo.',
      'Falta el precio mínimo de 52452601 Rojo (tallas 20–45).',
    ])
    expect(erroresCargaInicial([diana({ rangos: [rangoCompleto({ minimo: '40000', maximo: '30000' })] })]))
      .toEqual(['En 52452601 Rojo (tallas 20–45) el precio mínimo pasa del máximo.'])
  })

  it('la misma referencia y color dos veces es un error', () => {
    expect(erroresCargaInicial([diana(), diana({ id: 'b', color: 'ROJO', cantidades: { '40': '1' } })]))
      .toContain('52452601 ROJO está dos veces: deja una sola fila por referencia y color.')
  })

  it('una foto subida con otro nombre hay que volver a ponerla', () => {
    expect(erroresCargaInicial([diana({ color: 'Negro', foto: FOTO })]))
      .toContain('La foto de 52452601 Negro quedó con el nombre de antes: vuelve a ponerla.')
  })

  it('avisa las tallas ya cargadas y las referencias sin foto', () => {
    const existentes = { '37': { id: 'e', precio_minimo: 1, precio_maximo: null }, '38': { id: 'f', precio_minimo: 1, precio_maximo: null } }
    expect(avisosCargaInicial([diana({ existentes })])).toEqual([
      'En 52452601 Rojo, las tallas 37 y 38 ya estaban cargadas: su stock no cambia aquí (para corregirlo usa Conteo físico).',
      '1 referencia sin foto: la puedes poner después.',
    ])
  })
})
