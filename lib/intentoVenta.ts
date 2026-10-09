import type { RegistrarVentaInput } from './ventas'

// Cada venta se confirma con una clave de intento. Si la confirmación falla
// (p. ej. sin señal) y el vendedor reintenta SIN cambiar nada, se reusa la
// clave: si la venta sí alcanzó a guardarse, el servidor devuelve la misma en
// vez de duplicarla. Si cambió el carrito, los pagos o el cliente, es otra venta.
export interface IntentoVenta {
  clave: string
  firma: string
}

export function firmaVenta(input: RegistrarVentaInput): string {
  return JSON.stringify({
    items: input.items.map(i => [i.producto.tipo, i.producto.id, i.cantidad, i.precio]),
    pagos: input.pagos.map(p => [p.metodo, p.monto]),
    efectivo: input.efectivoRecibido,
    cliente: input.cliente ?? null,
  })
}

export function intentoVenta(
  previo: IntentoVenta | null,
  input: RegistrarVentaInput,
  nuevaClave: () => string = generarClave,
): IntentoVenta {
  const firma = firmaVenta(input)
  return previo && previo.firma === firma ? previo : { clave: nuevaClave(), firma }
}

export function generarClave(): string {
  const cripto = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
  if (cripto?.randomUUID) return cripto.randomUUID()
  // Hermes no trae crypto.randomUUID: UUID v4 con Math.random. Basta para
  // distinguir intentos (no es un secreto).
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
