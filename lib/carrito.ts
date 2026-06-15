export type TipoProducto = 'calzado' | 'varios'
export type MetodoPago = 'efectivo' | 'nequi' | 'daviplata'

export interface ProductoVendible {
  tipo: TipoProducto
  id: string
  titulo: string
  detalle: string
  precio: number
  stock: number
  unidad?: string
}

export interface ItemCarrito {
  producto: ProductoVendible
  cantidad: number
  subtotal: number
}

export interface PagoInput {
  metodo: MetodoPago
  monto: number
}

export type AccionCarrito =
  | { tipo: 'agregar'; producto: ProductoVendible }
  | { tipo: 'cambiarCantidad'; id: string; cantidad: number }
  | { tipo: 'quitar'; id: string }
  | { tipo: 'limpiar' }

export const redondear = (n: number): number => Math.round(n * 100) / 100

function conCantidad(producto: ProductoVendible, cantidad: number): ItemCarrito {
  let c = Math.min(cantidad, producto.stock)
  if (producto.tipo === 'calzado') c = Math.floor(c)
  c = Math.max(0, c)
  return { producto, cantidad: c, subtotal: redondear(producto.precio * c) }
}

export function carritoReducer(items: ItemCarrito[], accion: AccionCarrito): ItemCarrito[] {
  switch (accion.tipo) {
    case 'agregar': {
      const existente = items.find(i => i.producto.id === accion.producto.id)
      if (existente) {
        return items.map(i =>
          i.producto.id === accion.producto.id ? conCantidad(i.producto, i.cantidad + 1) : i,
        )
      }
      const nuevo = conCantidad(accion.producto, 1)
      return nuevo.cantidad > 0 ? [...items, nuevo] : items
    }
    case 'cambiarCantidad':
      return items
        .map(i => (i.producto.id === accion.id ? conCantidad(i.producto, accion.cantidad) : i))
        .filter(i => i.cantidad > 0)
    case 'quitar':
      return items.filter(i => i.producto.id !== accion.id)
    case 'limpiar':
      return []
  }
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
