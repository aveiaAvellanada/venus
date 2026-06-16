import {
  carritoReducer, bajoMinimo, totalCarrito, pagosCuadran, montoEfectivo, calcularCambio,
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

const calzado = (over: Partial<ProductoVendible> = {}): ProductoVendible => ({
  tipo: 'calzado', id: 'c1', titulo: 'Tenis', detalle: '', precio: 10000,
  stock: 3, precioMin: 5000, precioMax: 10000, ...over,
})
const granja = (over: Partial<ProductoVendible> = {}): ProductoVendible => ({
  tipo: 'varios', id: 'g1', titulo: 'Maíz', detalle: 'por kg', precio: 4000,
  stock: Number.POSITIVE_INFINITY, unidad: 'kg', ...over,
})

describe('carrito SP-2 — precio por línea', () => {
  test('calzado: el precio de la línea inicia en el máximo', () => {
    const items = carritoReducer([], { tipo: 'agregar', producto: calzado() })
    expect(items[0].precio).toBe(10000)
    expect(items[0].subtotal).toBe(10000)
  })

  test('cambiarPrecio permite bajar del mínimo (rango informativo, sin recorte)', () => {
    let items = carritoReducer([], { tipo: 'agregar', producto: calzado() })
    items = carritoReducer(items, { tipo: 'cambiarPrecio', id: 'c1', precio: 3000 })
    expect(items[0].precio).toBe(3000)
    expect(items[0].subtotal).toBe(3000)
    expect(bajoMinimo(items[0])).toBe(true)
  })

  test('bajoMinimo es false dentro del rango y para Granja', () => {
    let items = carritoReducer([], { tipo: 'agregar', producto: calzado() })
    items = carritoReducer(items, { tipo: 'cambiarPrecio', id: 'c1', precio: 7000 })
    expect(bajoMinimo(items[0])).toBe(false)
    const g = carritoReducer([], { tipo: 'agregar', producto: granja() })
    expect(bajoMinimo(g[0])).toBe(false)
  })

  test('Granja: cantidad decimal sin recorte por stock; subtotal = precio × cantidad', () => {
    let items = carritoReducer([], { tipo: 'agregar', producto: granja() })
    items = carritoReducer(items, { tipo: 'cambiarCantidad', id: 'g1', cantidad: 2.5 })
    expect(items[0].cantidad).toBe(2.5)
    expect(items[0].subtotal).toBe(10000)
  })

  test('Granja: cambiarPrecio recalcula el subtotal', () => {
    let items = carritoReducer([], { tipo: 'agregar', producto: granja() })
    items = carritoReducer(items, { tipo: 'cambiarCantidad', id: 'g1', cantidad: 2 })
    items = carritoReducer(items, { tipo: 'cambiarPrecio', id: 'g1', precio: 5000 })
    expect(items[0].subtotal).toBe(10000)
  })

  test('calzado: la cantidad sigue recortada por stock y a entero', () => {
    let items = carritoReducer([], { tipo: 'agregar', producto: calzado({ stock: 2 }) })
    items = carritoReducer(items, { tipo: 'cambiarCantidad', id: 'c1', cantidad: 9 })
    expect(items[0].cantidad).toBe(2)
  })
})
