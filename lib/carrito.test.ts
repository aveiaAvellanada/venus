import {
  carritoReducer, bajoMinimo, totalCarrito, pagosCuadran, montoEfectivo, calcularCambio,
  detalleCalzado, precioInicial, fueraDeRango, puedeCobrar, numArticulos, rangoDeslizador,
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
  test('calzado: el precio de la línea inicia en el MÍNIMO', () => {
    const items = carritoReducer([], { tipo: 'agregar', producto: calzado() })
    expect(items[0].precio).toBe(5000)
    expect(items[0].subtotal).toBe(5000)
    expect(precioInicial(calzado({ precioMin: undefined }))).toBe(10000)
    expect(precioInicial(granja())).toBe(4000)
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

describe('agregarConCantidad — Granja por peso (libras, decimales)', () => {
  test('Granja nuevo con cantidad fraccionaria: media libra', () => {
    const items = carritoReducer([], { tipo: 'agregarConCantidad', producto: cafe, cantidad: 0.5 })
    expect(items).toHaveLength(1)
    expect(items[0].cantidad).toBe(0.5)
    expect(items[0].subtotal).toBe(6000) // 12000 × 0.5
  })

  test('Granja nuevo con 1.5 libras NO redondea a 2 (el bug del bucle for)', () => {
    const items = carritoReducer([], { tipo: 'agregarConCantidad', producto: granja(), cantidad: 1.5 })
    expect(items[0].cantidad).toBe(1.5)
    expect(items[0].subtotal).toBe(6000) // 4000 × 1.5
  })

  test('Granja existente: suma la cantidad fraccionaria a la que ya había', () => {
    let items = carritoReducer([], { tipo: 'agregarConCantidad', producto: granja(), cantidad: 2 })
    items = carritoReducer(items, { tipo: 'agregarConCantidad', producto: granja(), cantidad: 1.5 })
    expect(items).toHaveLength(1)
    expect(items[0].cantidad).toBe(3.5)
  })

  test('nuevo item usa el precio del producto (Granja: precio de venta ingresado)', () => {
    const items = carritoReducer([], { tipo: 'agregarConCantidad', producto: granja({ precio: 5000 }), cantidad: 2 })
    expect(items[0].precio).toBe(5000)
    expect(items[0].subtotal).toBe(10000)
  })

  test('calzado sigue redondeando a entero y respetando stock', () => {
    const items = carritoReducer([], { tipo: 'agregarConCantidad', producto: calzado({ stock: 2 }), cantidad: 5 })
    expect(items[0].cantidad).toBe(2) // recortado por stock
    const b = carritoReducer([], { tipo: 'agregarConCantidad', producto: calzado(), cantidad: 2.9 })
    expect(b[0].cantidad).toBe(2) // floor
  })
})

describe('detalleCalzado — subtítulo con marca', () => {
  test('combina marca, talla y color en ese orden', () => {
    expect(detalleCalzado({ marca: 'Nike', talla: '38', color: 'Negro' })).toBe('Nike · Talla 38 · Negro')
  })

  test('sin marca preserva el formato previo (talla · color)', () => {
    expect(detalleCalzado({ talla: '38', color: 'Negro' })).toBe('Talla 38 · Negro')
  })

  test('solo marca', () => {
    expect(detalleCalzado({ marca: 'Adidas' })).toBe('Adidas')
  })

  test('campos vacíos o nulos producen cadena vacía', () => {
    expect(detalleCalzado({})).toBe('')
    expect(detalleCalzado({ marca: null, talla: null, color: null })).toBe('')
  })
})

describe('rediseño del carrito — rango de precio', () => {
  test('fueraDeRango: bajo el mínimo o sobre el máximo; Granja nunca', () => {
    let items = carritoReducer([], { tipo: 'agregar', producto: calzado() })
    expect(fueraDeRango(items[0])).toBe(false)
    items = carritoReducer(items, { tipo: 'cambiarPrecio', id: 'c1', precio: 4999 })
    expect(fueraDeRango(items[0])).toBe(true)
    items = carritoReducer(items, { tipo: 'cambiarPrecio', id: 'c1', precio: 10001 })
    expect(fueraDeRango(items[0])).toBe(true)
    items = carritoReducer(items, { tipo: 'cambiarPrecio', id: 'c1', precio: 10000 })
    expect(fueraDeRango(items[0])).toBe(false)
    const g = carritoReducer([], { tipo: 'agregar', producto: granja() })
    expect(fueraDeRango(carritoReducer(g, { tipo: 'cambiarPrecio', id: 'g1', precio: 1 })[0])).toBe(false)
  })

  test('puedeCobrar: total > 0 y ninguna línea fuera de rango', () => {
    expect(puedeCobrar([])).toBe(false)
    let items = carritoReducer([], { tipo: 'agregar', producto: calzado() })
    expect(puedeCobrar(items)).toBe(true)
    items = carritoReducer(items, { tipo: 'cambiarPrecio', id: 'c1', precio: 3000 })
    expect(puedeCobrar(items)).toBe(false)
  })

  test('numArticulos: pares de calzado + 1 por línea de Granja', () => {
    let items = carritoReducer([], { tipo: 'agregar', producto: calzado() })
    items = carritoReducer(items, { tipo: 'agregar', producto: calzado() })
    items = carritoReducer(items, { tipo: 'agregarConCantidad', producto: granja(), cantidad: 2.5 })
    expect(numArticulos(items)).toBe(3)
  })

  test('rangoDeslizador: múltiplos de $1.000 dentro del rango', () => {
    expect(rangoDeslizador(120000, 150000)).toEqual({ minimo: 120000, maximo: 150000, paso: 1000 })
    expect(rangoDeslizador(28500, 35400)).toEqual({ minimo: 29000, maximo: 35000, paso: 1000 })
    // sin múltiplos dentro: cubre el rango exacto
    expect(rangoDeslizador(28100, 28900)).toEqual({ minimo: 28100, maximo: 28900, paso: 800 })
    expect(rangoDeslizador(30000, 30000)).toEqual({ minimo: 30000, maximo: 30000, paso: 1000 })
  })
})
