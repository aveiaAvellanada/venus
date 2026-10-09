import { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useQueryClient } from '@tanstack/react-query'
import { LogOut, Menu, Search, X } from 'lucide-react'
import { useSesion } from '../lib/auth'
import { BarraLateral } from './BarraLateral'
import { BusquedaGlobal } from './BusquedaGlobal'
import { Boton } from './ui'

export function Estructura() {
  const { estado, salir } = useSesion()
  const cliente = useQueryClient()
  const ubicacion = useLocation()
  const [menuAbierto, setMenuAbierto] = useState(false)
  const [buscando, setBuscando] = useState(false)

  // Ctrl+K / ⌘K abre la búsqueda desde cualquier pantalla.
  useEffect(() => {
    function atajo(e: globalThis.KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setBuscando(true)
      }
      if (e.key === 'Escape') setMenuAbierto(false)
    }
    window.addEventListener('keydown', atajo)
    return () => window.removeEventListener('keydown', atajo)
  }, [])

  useEffect(() => setMenuAbierto(false), [ubicacion.pathname])

  async function cerrarSesion() {
    await salir()
    cliente.clear()
  }

  const nombre = estado.tipo === 'dentro' ? estado.perfil.nombre : ''

  return (
    <div className="min-h-dvh bg-superficie lg:grid lg:grid-cols-[18rem_1fr]">
      <aside className="sticky top-0 hidden h-dvh border-r border-borde bg-fondo lg:block">
        <BarraLateral />
      </aside>

      {menuAbierto ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMenuAbierto(false)} />
          <aside className="absolute inset-y-0 left-0 w-72 max-w-[85vw] border-r border-borde bg-fondo">
            <button
              aria-label="Cerrar menú"
              onClick={() => setMenuAbierto(false)}
              className="absolute right-3 top-5 rounded-lg p-1.5 text-texto3 hover:bg-superficie2"
            >
              <X className="size-5" />
            </button>
            <BarraLateral alNavegar={() => setMenuAbierto(false)} />
          </aside>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-borde bg-fondo/90 px-4 py-3 backdrop-blur lg:px-8">
          <button
            aria-label="Abrir menú"
            onClick={() => setMenuAbierto(true)}
            className="rounded-lg p-2 text-texto2 hover:bg-superficie2 lg:hidden"
          >
            <Menu className="size-5" />
          </button>
          <button
            onClick={() => setBuscando(true)}
            className="flex min-w-0 max-w-md flex-1 items-center gap-2 rounded-xl border border-borde bg-superficie px-3 py-2 text-left text-sm text-texto3 hover:border-borde-fuerte"
          >
            <Search aria-hidden className="size-4 shrink-0" />
            <span className="flex-1 truncate">Buscar productos o secciones…</span>
            <kbd className="hidden rounded-md border border-borde px-1.5 text-xs sm:inline">Ctrl K</kbd>
          </button>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-sm text-texto2 sm:inline">{nombre}</span>
            <Boton variante="fantasma" onClick={cerrarSesion} aria-label="Salir">
              <LogOut aria-hidden className="size-4" />
              <span className="hidden sm:inline">Salir</span>
            </Boton>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>

      <BusquedaGlobal abierta={buscando} alCerrar={() => setBuscando(false)} />
    </div>
  )
}
