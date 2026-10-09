import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { CornerDownLeft, Search, Tags } from 'lucide-react'
import { buscarProductos, limpiarTermino, type ProductoEncontrado } from '../lib/busqueda'
import { seccionesQueCoinciden, type Seccion } from '../navegacion'

type Resultado =
  | { clave: string; tipo: 'seccion'; seccion: Seccion }
  | { clave: string; tipo: 'producto'; producto: ProductoEncontrado }

export function BusquedaGlobal({ abierta, alCerrar }: { abierta: boolean; alCerrar: () => void }) {
  // Montada solo mientras está abierta: cada vez arranca vacía.
  return abierta ? <Dialogo alCerrar={alCerrar} /> : null
}

function Dialogo({ alCerrar }: { alCerrar: () => void }) {
  const navegar = useNavigate()
  const entrada = useRef<HTMLInputElement>(null)
  const [texto, setTexto] = useState('')
  const [termino, setTermino] = useState('')
  const [activo, setActivo] = useState(0)

  useEffect(() => entrada.current?.focus(), [])
  useEffect(() => {
    const t = setTimeout(() => setTermino(limpiarTermino(texto)), 250)
    return () => clearTimeout(t)
  }, [texto])

  const productos = useQuery({
    queryKey: ['busqueda', termino],
    queryFn: () => buscarProductos(termino),
    enabled: termino.length >= 2,
    staleTime: 30_000,
  })

  const resultados = useMemo<Resultado[]>(() => [
    ...seccionesQueCoinciden(texto).map((s) => ({ clave: `s-${s.id}`, tipo: 'seccion' as const, seccion: s })),
    ...(productos.data ?? []).map((p) => ({ clave: `p-${p.tipo}-${p.id}`, tipo: 'producto' as const, producto: p })),
  ], [texto, productos.data])

  useEffect(() => setActivo(0), [resultados.length])

  function elegir(r: Resultado) {
    if (r.tipo === 'seccion') navegar(r.seccion.ruta)
    else navegar(`/inventario?buscar=${encodeURIComponent(r.producto.titulo)}`)
    alCerrar()
  }

  function teclas(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault()
      alCerrar()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActivo((i) => Math.min(i + 1, resultados.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActivo((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && resultados[activo]) {
      e.preventDefault()
      elegir(resultados[activo])
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh]" onMouseDown={alCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Buscar"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={teclas}
        className="w-full max-w-xl overflow-hidden rounded-2xl border border-borde bg-fondo shadow-2xl"
      >
        <div className="flex items-center gap-3 border-b border-borde px-4">
          <Search aria-hidden className="size-4 text-texto3" />
          <input
            ref={entrada}
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Buscar productos o secciones…"
            aria-label="Buscar productos o secciones"
            role="combobox"
            aria-expanded={resultados.length > 0}
            aria-controls="resultados-busqueda"
            aria-activedescendant={resultados[activo]?.clave}
            className="w-full bg-transparent py-4 text-base outline-none placeholder:text-texto3"
          />
          <kbd className="rounded-md border border-borde px-1.5 py-0.5 text-xs text-texto3">Esc</kbd>
        </div>
        <ul id="resultados-busqueda" role="listbox" className="max-h-[50vh] overflow-y-auto p-2">
          {resultados.map((r, i) => (
            <li
              key={r.clave}
              id={r.clave}
              role="option"
              aria-selected={i === activo}
              onMouseEnter={() => setActivo(i)}
              onClick={() => elegir(r)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 ${i === activo ? 'bg-primario-soft' : ''}`}
            >
              {r.tipo === 'seccion' ? (
                <>
                  <r.seccion.icono aria-hidden className="size-4 text-texto3" />
                  <span className="flex-1 text-sm">
                    Ir a <strong>{r.seccion.titulo}</strong>
                  </span>
                </>
              ) : (
                <>
                  <Tags aria-hidden className="size-4 text-texto3" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{r.producto.titulo}</span>
                    <span className="block truncate text-xs text-texto3">{r.producto.detalle}</span>
                  </span>
                  <span className="cifras text-right text-xs">
                    <span className="block font-medium">{r.producto.precio}</span>
                    {r.producto.stock === null ? null : (
                      <span className={`block ${r.producto.stock === 0 ? 'text-peligro-texto' : 'text-texto3'}`}>
                        {r.producto.stock === 0 ? 'Agotado' : `${r.producto.stock} en stock`}
                      </span>
                    )}
                  </span>
                </>
              )}
              <CornerDownLeft aria-hidden className={`size-3.5 shrink-0 text-texto3 ${i === activo ? '' : 'invisible'}`} />
            </li>
          ))}
          {texto && resultados.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-texto3">
              {productos.isFetching || limpiarTermino(texto) !== termino ? 'Buscando…' : 'Sin resultados.'}
            </li>
          ) : null}
          {!texto ? (
            <li className="px-3 py-6 text-center text-sm text-texto3">
              Escribe una referencia, marca, color o el nombre de una sección.
            </li>
          ) : null}
        </ul>
      </div>
    </div>
  )
}
