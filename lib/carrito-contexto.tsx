import React, { createContext, useContext, useReducer, useRef } from 'react'
import { carritoReducer } from './carrito'
import type { AccionCarrito, ItemCarrito } from './carrito'
import type { IntentoVenta } from './intentoVenta'

// Carrito compartido del rediseño (§7.4/§7.5): permite agregar desde el
// detalle de producto y cobrar en Nueva Venta. Vive bajo el guard de sesión.

interface ContextoCarrito {
  items: ItemCarrito[]
  dispatch: (accion: AccionCarrito) => void
  // Clave del último intento de cobro fallido. Vive aquí (no en la pantalla)
  // para que sobreviva si el vendedor sale de Nueva Venta y vuelve a cobrar.
  intento: React.MutableRefObject<IntentoVenta | null>
}

const Contexto = createContext<ContextoCarrito | null>(null)

export function CarritoProvider({ children }: { children: React.ReactNode }) {
  const [items, dispatch] = useReducer(carritoReducer, [])
  const intento = useRef<IntentoVenta | null>(null)
  return <Contexto.Provider value={{ items, dispatch, intento }}>{children}</Contexto.Provider>
}

export function useCarrito(): ContextoCarrito {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useCarrito debe usarse dentro de <CarritoProvider>')
  return ctx
}
