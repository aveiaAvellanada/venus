export type TipoProducto = 'calzado' | 'varios'
export type MetodoPago = 'efectivo' | 'nequi' | 'bre_b' | 'otro'

export interface ProductoVendible {
  tipo: TipoProducto
  id: string
  titulo: string
  detalle: string
  precio: number
  stock: number
  unidad?: string
  precioMin?: number
  precioMax?: number
  // Miniatura para la línea del carrito (solo visual).
  foto?: string | null
}

export interface ItemCarrito {
  producto: ProductoVendible
  cantidad: number
  precio: number
  subtotal: number
}

export interface PagoInput {
  metodo: MetodoPago
  monto: number
}

export type AccionCarrito =
  | { tipo: 'agregar'; producto: ProductoVendible }
  | { tipo: 'agregarConCantidad'; producto: ProductoVendible; cantidad: number }
  | { tipo: 'cambiarCantidad'; id: string; cantidad: number }
  | { tipo: 'cambiarPrecio'; id: string; precio: number }
  | { tipo: 'quitar'; id: string }
  | { tipo: 'limpiar' }

// Subtítulo legible de un calzado: marca · Talla N · color (omite los campos vacíos).
// Sin marca, conserva el formato previo "Talla N · color".
export function detalleCalzado(c: { marca?: string | null; talla?: string | null; color?: string | null }): string {
  return [c.marca, c.talla ? `Talla ${c.talla}` : null, c.color].filter(Boolean).join(' · ')
}

export const redondear = (n: number): number => Math.round(n * 100) / 100

// El calzado entra al carrito en su precio MÍNIMO (rediseño del carrito, B2):
// el vendedor sube desde ahí al regatear.
export function precioInicial(producto: ProductoVendible): number {
  if (producto.tipo === 'calzado') return producto.precioMin ?? producto.precio
  return producto.precio
}

function linea(producto: ProductoVendible, cantidad: number, precio: number): ItemCarrito {
  let c = Math.min(cantidad, producto.stock)
  if (producto.tipo === 'calzado') c = Math.floor(c)
  c = Math.max(0, c)
  const p = Math.max(0, precio)
  return { producto, cantidad: c, precio: p, subtotal: redondear(p * c) }
}

export function carritoReducer(items: ItemCarrito[], accion: AccionCarrito): ItemCarrito[] {
  switch (accion.tipo) {
    case 'agregar': {
      const existente = items.find(i => i.producto.id === accion.producto.id)
      if (existente) {
        return items.map(i =>
          i.producto.id === accion.producto.id ? linea(i.producto, i.cantidad + 1, i.precio) : i,
        )
      }
      const nuevo = linea(accion.producto, 1, precioInicial(accion.producto))
      return nuevo.cantidad > 0 ? [...items, nuevo] : items
    }
    case 'agregarConCantidad': {
      // Como 'agregar' pero con una cantidad arbitraria (Granja se vende por
      // peso: libras, media libra, decimales de báscula). linea() conserva el
      // decimal para 'varios' y lo redondea a entero para 'calzado'.
      const existente = items.find(i => i.producto.id === accion.producto.id)
      if (existente) {
        return items.map(i =>
          i.producto.id === accion.producto.id
            ? linea(i.producto, i.cantidad + accion.cantidad, i.precio)
            : i,
        )
      }
      const nuevo = linea(accion.producto, accion.cantidad, precioInicial(accion.producto))
      return nuevo.cantidad > 0 ? [...items, nuevo] : items
    }
    case 'cambiarCantidad':
      return items
        .map(i => (i.producto.id === accion.id ? linea(i.producto, accion.cantidad, i.precio) : i))
        .filter(i => i.cantidad > 0)
    case 'cambiarPrecio':
      return items.map(i =>
        i.producto.id === accion.id ? linea(i.producto, i.cantidad, accion.precio) : i,
      )
    case 'quitar':
      return items.filter(i => i.producto.id !== accion.id)
    case 'limpiar':
      return []
  }
}

export const bajoMinimo = (item: ItemCarrito): boolean =>
  item.producto.tipo === 'calzado' &&
  item.producto.precioMin != null &&
  item.precio < item.producto.precioMin

// El servidor rechaza precios de calzado fuera de [precio_minimo, precio_maximo]
// (registrar_venta, PRD §3.1.1): la app no deja cobrar hasta corregirlos.
export const fueraDeRango = (item: ItemCarrito): boolean =>
  item.producto.tipo === 'calzado' &&
  ((item.producto.precioMin != null && item.precio < item.producto.precioMin) ||
    (item.producto.precioMax != null && item.precio > item.producto.precioMax))

export const puedeCobrar = (items: ItemCarrito[]): boolean =>
  totalCarrito(items) > 0 && !items.some(fueraDeRango)

// "Artículos" del resumen: pares de calzado + una por cada línea de Granja (va por peso).
export const numArticulos = (items: ItemCarrito[]): number =>
  items.reduce((s, i) => s + (i.producto.tipo === 'calzado' ? i.cantidad : 1), 0)

export const PASO_PRECIO = 1000

// Rango del deslizador de precio: múltiplos de $1.000 dentro de [mín, máx]. Si
// no cabe ningún múltiplo, el deslizador cubre el rango exacto en un paso (el
// precio exacto se escribe en la caja).
export function rangoDeslizador(
  min: number,
  max: number,
  paso = PASO_PRECIO,
): { minimo: number; maximo: number; paso: number } {
  const lo = Math.ceil(min / paso) * paso
  const hi = Math.floor(max / paso) * paso
  if (lo > hi) return { minimo: min, maximo: max, paso: Math.max(1, max - min) }
  return { minimo: lo, maximo: hi, paso }
}

export const totalCarrito = (items: ItemCarrito[]): number =>
  redondear(items.reduce((s, i) => s + i.subtotal, 0))

export const sumaPagos = (pagos: PagoInput[]): number =>
  redondear(pagos.reduce((s, p) => s + p.monto, 0))

export const pagosCuadran = (pagos: PagoInput[], total: number): boolean =>
  pagos.length > 0 && pagos.every(p => p.monto > 0) && sumaPagos(pagos) === total

export const montoEfectivo = (pagos: PagoInput[]): number =>
  redondear(pagos.filter(p => p.metodo === 'efectivo').reduce((s, p) => s + p.monto, 0))

export const calcularCambio = (efectivoRecibido: number, efectivoMonto: number): number =>
  redondear(Math.max(0, efectivoRecibido - efectivoMonto))
