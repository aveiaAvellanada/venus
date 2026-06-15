import {
  carritoReducer, totalCarrito, pagosCuadran, montoEfectivo, calcularCambio,
  type ItemCarrito, type ProductoVendible,
} from './carrito'

const tenis: ProductoVendible = {
  tipo: 'calzado', id: 'c1', titulo: 'Tenis Nike', detalle: 'Talla 39 · Negro', precio: 120000, stock: 2,
}
const cafe: ProductoVendible = {
  tipo: 'varios', id: 'v1', titulo: 'Café', detalle: 'por libra', precio: 12000, stock: 10, unidad: 'libra',
}

const conTenis = (): ItemCarrito[] => carritoReducer([], { tipo: 'agregar', producto: tenis })

describe('carritoReducer', () => {
  test('agregar un producto nuevo lo pone con cantidad 1', () => {
    const items = conTenis()
    expect(items).toHaveLength(1)
    expect(items[0].cantidad).toBe(1)
    expect(items[0].subtotal).toBe(120000)
  })

  test('agregar el mismo producto fusiona y suma cantidad', () => {
    let items = conTenis()
    items = carritoReducer(items, { tipo: 'agregar', producto: tenis })
    expect(items).toHaveLength(1)
    expect(items[0].cantidad).toBe(2)
  })

  test('no supera el stock disponible (calzado)', () => {
    let items = conTenis()
    items = carritoReducer(items, { tipo: 'agregar', producto: tenis })
    items = carritoReducer(items, { tipo: 'agregar', producto: tenis })
    expect(items[0].cantidad).toBe(2) // stock = 2
  })

  test('calzado redondea la cantidad hacia abajo a entero', () => {
    let items = conTenis()
    items = carritoReducer(items, { tipo: 'cambiarCantidad', id: 'c1', cantidad: 1.9 })
    expect(items[0].cantidad).toBe(1)
  })

  test('varios permite cantidad decimal', () => {
    let items = carritoReducer([], { tipo: 'agregar', producto: cafe })
    items = carritoReducer(items, { tipo: 'cambiarCantidad', id: 'v1', cantidad: 0.5 })
    expect(items[0].cantidad).toBe(0.5)
    expect(items[0].subtotal).toBe(6000)
  })

  test('cambiar cantidad a 0 elimina el item', () => {
    let items = conTenis()
    items = carritoReducer(items, { tipo: 'cambiarCantidad', id: 'c1', cantidad: 0 })
    expect(items).toHaveLength(0)
  })

  test('quitar elimina el item', () => {
    const items = carritoReducer(conTenis(), { tipo: 'quitar', id: 'c1' })
    expect(items).toHaveLength(0)
  })

  test('limpiar vacía el carrito', () => {
    expect(carritoReducer(conTenis(), { tipo: 'limpiar' })).toEqual([])
  })
})

describe('helpers de total y pago', () => {
  test('totalCarrito suma los subtotales', () => {
    let items = conTenis()
    items = carritoReducer(items, { tipo: 'agregar', producto: cafe })
    expect(totalCarrito(items)).toBe(132000)
  })

  test('pagosCuadran exige suma exacta y montos positivos', () => {
    expect(pagosCuadran([{ metodo: 'nequi', monto: 120000 }], 120000)).toBe(true)
    expect(pagosCuadran(
      [{ metodo: 'efectivo', monto: 100000 }, { metodo: 'nequi', monto: 20000 }], 120000)).toBe(true)
    expect(pagosCuadran([{ metodo: 'nequi', monto: 100000 }], 120000)).toBe(false)
    expect(pagosCuadran([{ metodo: 'nequi', monto: 130000 }], 120000)).toBe(false)
    expect(pagosCuadran([], 0)).toBe(false)
  })

  test('montoEfectivo suma solo lo pagado en efectivo', () => {
    expect(montoEfectivo(
      [{ metodo: 'efectivo', monto: 100000 }, { metodo: 'nequi', monto: 20000 }])).toBe(100000)
  })

  test('calcularCambio nunca es negativo', () => {
    expect(calcularCambio(120000, 100000)).toBe(20000)
    expect(calcularCambio(100000, 100000)).toBe(0)
    expect(calcularCambio(0, 100000)).toBe(0)
  })
})
