import React, { createContext, useContext, useReducer } from 'react'
import { carritoReducer } from './carrito'
import type { AccionCarrito, ItemCarrito } from './carrito'

// Carrito compartido del rediseño (§7.4/§7.5): permite agregar desde el
// detalle de producto y cobrar en Nueva Venta. Vive bajo el guard de sesión.

interface ContextoCarrito {
  items: ItemCarrito[]
  dispatch: (accion: AccionCarrito) => void
}

const Contexto = createContext<ContextoCarrito | null>(null)

export function CarritoProvider({ children }: { children: React.ReactNode }) {
  const [items, dispatch] = useReducer(carritoReducer, [])
  return <Contexto.Provider value={{ items, dispatch }}>{children}</Contexto.Provider>
}

export function useCarrito(): ContextoCarrito {
  const ctx = useContext(Contexto)
  if (!ctx) throw new Error('useCarrito debe usarse dentro de <CarritoProvider>')
  return ctx
}
