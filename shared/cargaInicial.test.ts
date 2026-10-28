import {
  avisosCargaInicial, claveDeFila, erroresCargaInicial, filasParaCargar, paresNuevos, paresSumados, resumenCargaInicial,
  tallasConPrecioNuevo,
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

  it('en una talla que ya existe los pares escritos se suman; con foto nueva van todas, con su precio', () => {
    const existentes = { '38': { id: 'e38', precio_minimo: 30000, precio_maximo: null, stock: 6 } }
    const conSuma = diana({ existentes })
    expect(paresNuevos(conSuma)).toBe(22)
    expect(paresSumados(conSuma)).toBe(10)
    const filas = filasParaCargar([conSuma])
    expect(filas.map((f) => f.talla)).toEqual(['35', '36', '37', '39', '38'])
    expect(filas[4]).toEqual(expect.objectContaining({ talla: '38', stock: 0, sumar: 10, precio_minimo: 30000 }))
    expect(filas[0]).not.toHaveProperty('sumar')

    const soloFoto = diana({ existentes, cantidades: {}, foto: FOTO })
    expect(filasParaCargar([soloFoto])).toEqual([
      expect.objectContaining({ talla: '38', precio_minimo: 30000, precio_maximo: undefined, stock: 0, foto_url: FOTO }),
    ])
    expect(filasParaCargar([soloFoto])[0]).not.toHaveProperty('sumar')
  })

  it('cambiar el precio de lo que ya existe lo guarda (los provisionales de $1)', () => {
    const existentes = {
      '35': { id: 'e35', precio_minimo: 1, precio_maximo: null, stock: 4 },
      '36': { id: 'e36', precio_minimo: 1, precio_maximo: null, stock: 4 },
    }
    // Reconocida: los rangos traen el precio que tiene (sin cambios no hay nada que guardar).
    const igual = diana({ existentes, cantidades: {}, rangos: [rangoCompleto({ minimo: '1' })] })
    expect(tallasConPrecioNuevo(igual)).toEqual([])
    expect(filasParaCargar([igual])).toEqual([])
    const nuevo = diana({ existentes, cantidades: {}, rangos: [rangoCompleto({ minimo: '45.000', maximo: '55.000' })] })
    expect(tallasConPrecioNuevo(nuevo)).toEqual(['35', '36'])
    expect(filasParaCargar([nuevo])).toEqual([
      expect.objectContaining({ talla: '35', precio_minimo: 45000, precio_maximo: 55000, stock: 0 }),
      expect.objectContaining({ talla: '36', precio_minimo: 45000, precio_maximo: 55000, stock: 0 }),
    ])
    expect(erroresCargaInicial([nuevo])).toEqual([])
    // Borrar el precio no lo deja vacío: es un error.
    expect(erroresCargaInicial([diana({ existentes, cantidades: {}, rangos: [rangoCompleto()] })]))
      .toEqual(['Falta el precio mínimo de 52452601 Rojo (tallas 20–45).'])
  })

  it('dos colores se guardan como "Rojo y blanco"', () => {
    expect(filasParaCargar([diana({ color: 'rojo/blanco' })])[0].color).toBe('Rojo y blanco')
    expect(claveDeFila(diana({ color: 'rojo/blanco' }))).toBe(claveDeFila(diana({ referencia: ' 52452601 ', color: 'Rojo y blanco' })))
  })

  it('el resumen cuenta referencias, tallas nuevas, pares (también los sumados), precios y fotos', () => {
    expect(resumenCargaInicial([diana({ foto: FOTO }), diana({ id: 'b', color: 'Negro', cantidades: { '40': '3' } }), filaVacia('c')]))
      .toEqual({ referencias: 2, tallasNuevas: 6, pares: 35, paresSumados: 0, preciosCambiados: 0, fotos: 1 })
    const existentes = { '40': { id: 'e40', precio_minimo: 1, precio_maximo: null, stock: 2 } }
    expect(resumenCargaInicial([diana({ id: 'b', color: 'Negro', existentes, cantidades: { '40': '3' } })]))
      .toEqual({ referencias: 1, tallasNuevas: 0, pares: 3, paresSumados: 3, preciosCambiados: 1, fotos: 0 })
  })
})

describe('carga inicial: errores y avisos', () => {
  it('una fila completa no tiene errores (no pide costo)', () => {
    expect(erroresCargaInicial([diana({ foto: FOTO }), filaVacia('vacia')])).toEqual([])
  })

  it('un zapato nuevo no se crea sin foto; la talla nueva de un color que ya tiene foto, sí', () => {
    expect(erroresCargaInicial([diana()])).toEqual(['Falta la foto de 52452601 Rojo: es obligatoria para crear un zapato.'])
    const conFotoEnInventario = { '34': { id: 'e', precio_minimo: 1, precio_maximo: null, foto_url: FOTO } }
    expect(erroresCargaInicial([diana({ existentes: conFotoEnInventario })])).toEqual([])
  })

  it('sin nada que guardar', () => {
    expect(erroresCargaInicial([filaVacia('a')])).toEqual(['No hay nada que guardar: escribe pares, cambia un precio o pon una foto.'])
  })

  it('pide descripción, categoría y precio mínimo; el máximo no puede ser menor', () => {
    expect(erroresCargaInicial([diana({ descripcion: '', categoria: '', rangos: [rangoCompleto()], foto: FOTO })])).toEqual([
      'Falta la descripción de 52452601 Rojo.',
      'Falta la categoría de 52452601 Rojo.',
      'Falta el precio mínimo de 52452601 Rojo (tallas 20–45).',
    ])
    expect(erroresCargaInicial([diana({ rangos: [rangoCompleto({ minimo: '40000', maximo: '30000' })], foto: FOTO })]))
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

  it('avisa lo que cambia en lo ya cargado: pares que se suman y precios', () => {
    const existentes = { '37': { id: 'e', precio_minimo: 1, precio_maximo: null }, '38': { id: 'f', precio_minimo: 1, precio_maximo: null } }
    expect(avisosCargaInicial([diana({ existentes })])).toEqual([
      'En 52452601 Rojo se suman 20 pares a las tallas 37 y 38, que ya estaban cargadas.',
      'En 52452601 Rojo cambia el precio de las tallas 37 y 38.',
    ])
  })
})
