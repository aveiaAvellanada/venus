import { Fragment, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Download, Search, Tag, X } from 'lucide-react'
import { pesos } from '@shared/formato'
import {
  aCsv, agrupar, costoDeGrupo, filtrar, margen, totales,
  type EstadoInventario, type GrupoReferencia, type ProductoCalzado,
} from '../../lib/inventario'
import { actualizarTalla, costosPorProducto, listarCalzado } from '../../lib/datos/inventario'
import { Boton, Cargando, Insignia, MensajeError } from '../../componentes/ui'
import { CambiarPrecios } from './CambiarPrecios'

const ESTADOS: { valor: EstadoInventario; titulo: string }[] = [
  { valor: 'activos', titulo: 'Activos' },
  { valor: 'bajo_minimo', titulo: 'Bajo mínimo' },
  { valor: 'agotados', titulo: 'Agotados' },
  { valor: 'inactivos', titulo: 'Inactivos' },
]
const POR_PAGINA = 100

export function Inventario() {
  const [parametros] = useSearchParams()
  const [texto, setTexto] = useState(parametros.get('buscar') ?? '')
  const [categoria, setCategoria] = useState('')
  const [marca, setMarca] = useState('')
  const [estado, setEstado] = useState<EstadoInventario>('activos')
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [cambiando, setCambiando] = useState(false)
  const [visibles, setVisibles] = useState(POR_PAGINA)

  const productos = useQuery({ queryKey: ['inventario'], queryFn: listarCalzado })
  // Sin permiso de costos la base responde con error: la pantalla sigue sin esas columnas.
  const costos = useQuery({ queryKey: ['costos'], queryFn: costosPorProducto, retry: false })
  const mapaCostos = costos.data

  const grupos = useMemo(() => agrupar(productos.data ?? []), [productos.data])
  const filtrados = useMemo(
    () => filtrar(grupos, { texto, categoria, marca, estado }),
    [grupos, texto, categoria, marca, estado],
  )
  const suma = useMemo(() => totales(filtrados, mapaCostos), [filtrados, mapaCostos])
  const categorias = useMemo(() => [...new Set(grupos.map((g) => g.categoria))].sort(), [grupos])
  const marcas = useMemo(
    () => [...new Set(grupos.map((g) => g.marca).filter((m): m is string => !!m))].sort(),
    [grupos],
  )

  const seleccionados = useMemo(
    () => grupos.filter((g) => seleccion.has(g.clave)),
    [grupos, seleccion],
  )
  const idsSeleccionados = seleccionados.flatMap((g) => g.tallas.filter((t) => t.activo).map((t) => t.id))

  function alternar(conjunto: Set<string>, clave: string): Set<string> {
    const nuevo = new Set(conjunto)
    if (nuevo.has(clave)) nuevo.delete(clave)
    else nuevo.add(clave)
    return nuevo
  }

  function exportar() {
    const blob = new Blob([aCsv(filtrados, mapaCostos)], { type: 'text/csv;charset=utf-8' })
    const enlace = document.createElement('a')
    enlace.href = URL.createObjectURL(blob)
    enlace.download = `inventario-${new Date().toISOString().slice(0, 10)}.csv`
    enlace.click()
    URL.revokeObjectURL(enlace.href)
  }

  const todosVisiblesMarcados = filtrados.length > 0 && filtrados.slice(0, visibles).every((g) => seleccion.has(g.clave))

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Inventario y precios</h1>
          <p className="text-texto2">Calzado por referencia, con sus tallas. El stock solo cambia con compras, ventas y devoluciones.</p>
        </div>
        <Boton variante="fantasma" onClick={exportar} disabled={!filtrados.length}>
          <Download aria-hidden className="size-4" />
          Exportar
        </Boton>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-60 flex-1 items-center gap-2 rounded-xl border border-borde bg-fondo px-3 py-2 focus-within:border-primario">
          <Search aria-hidden className="size-4 text-texto3" />
          <input
            value={texto}
            onChange={(e) => { setTexto(e.target.value); setVisibles(POR_PAGINA) }}
            placeholder="Referencia, descripción, marca o color"
            aria-label="Buscar en el inventario"
            className="w-full bg-transparent text-sm outline-none"
          />
          {texto ? (
            <button aria-label="Borrar búsqueda" onClick={() => setTexto('')} className="text-texto3 hover:text-texto">
              <X className="size-4" />
            </button>
          ) : null}
        </label>
        <Selector etiqueta="Categoría" valor={categoria} opciones={categorias} alCambiar={setCategoria} />
        <Selector etiqueta="Marca" valor={marca} opciones={marcas} alCambiar={setMarca} />
        <div role="radiogroup" aria-label="Estado" className="flex rounded-xl border border-borde bg-fondo p-0.5">
          {ESTADOS.map((e) => (
            <button
              key={e.valor}
              role="radio"
              aria-checked={estado === e.valor}
              onClick={() => { setEstado(e.valor); setSeleccion(new Set()) }}
              className={`rounded-lg px-3 py-1.5 text-sm ${estado === e.valor ? 'bg-primario-soft font-semibold text-primario' : 'text-texto2 hover:text-texto'}`}
            >
              {e.titulo}
            </button>
          ))}
        </div>
      </div>

      {seleccion.size ? (
        <div className="sticky top-16 z-20 flex flex-wrap items-center gap-3 rounded-xl border border-primario bg-primario-soft px-4 py-2.5 text-sm">
          <span className="font-semibold text-primario">
            {seleccion.size} referencia{seleccion.size === 1 ? '' : 's'} · {idsSeleccionados.length} talla{idsSeleccionados.length === 1 ? '' : 's'}
          </span>
          <Boton onClick={() => setCambiando(true)} disabled={!idsSeleccionados.length} className="py-1.5">
            <Tag aria-hidden className="size-4" />
            Cambiar precios
          </Boton>
          <Boton variante="fantasma" onClick={() => setSeleccion(new Set())} className="py-1.5">Quitar selección</Boton>
        </div>
      ) : null}

      {productos.isPending ? <Cargando /> : productos.isError ? <MensajeError error={productos.error} /> : (
        <div className="overflow-x-auto rounded-2xl border border-borde bg-fondo">
          <table className="w-full min-w-[56rem] text-sm">
            <thead className="border-b border-borde text-left text-xs text-texto3">
              <tr>
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    aria-label="Seleccionar todo lo visible"
                    checked={todosVisiblesMarcados}
                    onChange={() => setSeleccion(todosVisiblesMarcados
                      ? new Set()
                      : new Set(filtrados.slice(0, visibles).map((g) => g.clave)))}
                  />
                </th>
                <th className="py-3 pr-3 font-medium">Referencia</th>
                <th className="py-3 pr-3 font-medium">Categoría</th>
                <th className="py-3 pr-3 font-medium">Tallas (stock)</th>
                <th className="py-3 pr-3 text-right font-medium">Stock</th>
                <th className="py-3 pr-3 text-right font-medium">Precio</th>
                {mapaCostos ? <th className="py-3 pr-3 text-right font-medium">Costo</th> : null}
                {mapaCostos ? <th className="py-3 pr-4 text-right font-medium">Margen</th> : null}
              </tr>
            </thead>
            <tbody>
              {filtrados.slice(0, visibles).map((g) => (
                <Fragment key={g.clave}>
                  <FilaGrupo
                    grupo={g}
                    costo={costoDeGrupo(g, mapaCostos)}
                    conCostos={!!mapaCostos}
                    abierto={abiertos.has(g.clave)}
                    marcado={seleccion.has(g.clave)}
                    alAbrir={() => setAbiertos((a) => alternar(a, g.clave))}
                    alMarcar={() => setSeleccion((s) => alternar(s, g.clave))}
                  />
                  {abiertos.has(g.clave) ? (
                    <tr className="border-b border-borde bg-superficie">
                      <td />
                      <td colSpan={mapaCostos ? 7 : 5} className="py-3 pr-4">
                        <DetalleTallas tallas={g.tallas} costos={mapaCostos} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
              {filtrados.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-texto3">Ningún producto coincide con los filtros.</td></tr>
              ) : null}
            </tbody>
            <tfoot className="border-t border-borde text-sm">
              <tr>
                <td />
                <td colSpan={3} className="py-3 pr-3 text-texto2">
                  {suma.referencias} referencias · {suma.unidades} pares en stock · valor a precio máximo{' '}
                  <strong className="cifras text-texto">{pesos(suma.valorPrecio)}</strong>
                  {mapaCostos ? (
                    <>
                      {' '}· a costo <strong className="cifras text-texto">{pesos(suma.valorCosto)}</strong>
                      {suma.sinCosto ? <span className="text-texto3"> ({suma.sinCosto} tallas con stock sin costo registrado)</span> : null}
                    </>
                  ) : null}
                </td>
                <td colSpan={mapaCostos ? 4 : 2} />
              </tr>
            </tfoot>
          </table>
          {filtrados.length > visibles ? (
            <div className="border-t border-borde p-3 text-center">
              <Boton variante="fantasma" onClick={() => setVisibles((v) => v + POR_PAGINA)}>
                Mostrar más ({filtrados.length - visibles} restantes)
              </Boton>
            </div>
          ) : null}
        </div>
      )}

      {cambiando ? (
        <CambiarPrecios
          ids={idsSeleccionados}
          alCerrar={() => setCambiando(false)}
          alAplicar={() => { setCambiando(false); setSeleccion(new Set()) }}
        />
      ) : null}
    </div>
  )
}

function Selector({ etiqueta, valor, opciones, alCambiar }: {
  etiqueta: string
  valor: string
  opciones: string[]
  alCambiar: (v: string) => void
}) {
  return (
    <select
      aria-label={etiqueta}
      value={valor}
      onChange={(e) => alCambiar(e.target.value)}
      className="rounded-xl border border-borde bg-fondo px-3 py-2 text-sm text-texto2"
    >
      <option value="">{etiqueta}: todas</option>
      {opciones.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  )
}

function FilaGrupo({ grupo: g, costo, conCostos, abierto, marcado, alAbrir, alMarcar }: {
  grupo: GrupoReferencia
  costo: number | undefined
  conCostos: boolean
  abierto: boolean
  marcado: boolean
  alAbrir: () => void
  alMarcar: () => void
}) {
  const m = margen(g.precioMax, costo)
  const nombre = g.referencia ?? g.descripcion
  return (
    <tr className={`border-b border-borde hover:bg-superficie ${marcado ? 'bg-primario-soft/40' : ''}`}>
      <td className="px-3 py-2.5">
        <input type="checkbox" aria-label={`Seleccionar ${nombre}`} checked={marcado} onChange={alMarcar} />
      </td>
      <td className="py-2.5 pr-3">
        <button onClick={alAbrir} aria-expanded={abierto} className="flex items-start gap-1.5 text-left">
          {abierto ? <ChevronDown aria-hidden className="mt-0.5 size-4 text-texto3" /> : <ChevronRight aria-hidden className="mt-0.5 size-4 text-texto3" />}
          <span>
            <span className="block font-medium">{g.referencia ?? '—'} · {g.descripcion}</span>
            <span className="block text-xs text-texto3">{[g.marca, g.color].filter(Boolean).join(' · ')}</span>
          </span>
        </button>
      </td>
      <td className="py-2.5 pr-3 text-texto2">{g.categoria}</td>
      <td className="py-2.5 pr-3">
        <span className="flex flex-wrap gap-1">
          {g.tallas.filter((t) => t.activo).map((t) => (
            <span
              key={t.id}
              title={`Talla ${t.talla}: ${t.stock_actual} (mínimo ${t.stock_minimo})`}
              className={`cifras rounded-md px-1.5 py-0.5 text-xs ${
                t.stock_actual === 0 ? 'bg-peligro-soft text-peligro-texto'
                  : t.stock_actual <= t.stock_minimo ? 'bg-advertencia-soft text-advertencia-texto'
                    : 'bg-superficie2 text-texto2'
              }`}
            >
              {t.talla ?? 'Única'}: {t.stock_actual}
            </span>
          ))}
        </span>
      </td>
      <td className="cifras py-2.5 pr-3 text-right font-medium">
        {g.agotado ? <Insignia tono="peligro">Agotado</Insignia> : g.stock}
      </td>
      <td className="cifras py-2.5 pr-3 text-right">
        {g.precioMin === g.precioMax ? pesos(g.precioMax) : `${pesos(g.precioMin)} – ${pesos(g.precioMax)}`}
      </td>
      {conCostos ? <td className="cifras py-2.5 pr-3 text-right text-texto2">{costo === undefined ? '—' : pesos(costo)}</td> : null}
      {conCostos ? (
        <td className={`cifras py-2.5 pr-4 text-right ${m !== null && m < 0.2 ? 'font-semibold text-peligro-texto' : 'text-texto2'}`}>
          {m === null ? '—' : `${Math.round(m * 100)} %`}
        </td>
      ) : null}
    </tr>
  )
}

function DetalleTallas({ tallas, costos }: { tallas: ProductoCalzado[]; costos: Map<string, { ultimo: number }> | undefined }) {
  const cliente = useQueryClient()
  const guardar = useMutation({
    mutationFn: ({ id, cambios }: { id: string; cambios: { stock_minimo?: number; activo?: boolean } }) => actualizarTalla(id, cambios),
    onSettled: () => cliente.invalidateQueries({ queryKey: ['inventario'] }),
  })
  return (
    <div className="flex flex-col gap-2">
      <table className="text-sm">
        <thead className="text-left text-xs text-texto3">
          <tr>
            <th className="pr-6 font-medium">Talla</th>
            <th className="pr-6 text-right font-medium">Stock</th>
            <th className="pr-6 font-medium">Stock mínimo</th>
            <th className="pr-6 text-right font-medium">Precio</th>
            {costos ? <th className="pr-6 text-right font-medium">Último costo</th> : null}
            <th className="font-medium">Activa</th>
          </tr>
        </thead>
        <tbody>
          {tallas.map((t) => (
            <tr key={t.id} className={t.activo ? '' : 'text-texto3'}>
              <td className="py-1 pr-6">{t.talla ?? 'Única'}</td>
              <td className="cifras py-1 pr-6 text-right">{t.stock_actual}</td>
              <td className="py-1 pr-6">
                <input
                  type="number"
                  min={0}
                  defaultValue={t.stock_minimo}
                  aria-label={`Stock mínimo talla ${t.talla}`}
                  onBlur={(e) => {
                    const valor = Math.max(0, Math.round(Number(e.target.value)))
                    if (valor !== t.stock_minimo) guardar.mutate({ id: t.id, cambios: { stock_minimo: valor } })
                  }}
                  className="cifras w-20 rounded-lg border border-borde bg-fondo px-2 py-1"
                />
              </td>
              <td className="cifras py-1 pr-6 text-right">
                {Number(t.precio_minimo) === Number(t.precio_maximo) ? pesos(t.precio_maximo) : `${pesos(t.precio_minimo)} – ${pesos(t.precio_maximo)}`}
              </td>
              {costos ? <td className="cifras py-1 pr-6 text-right">{costos.get(t.id) ? pesos(costos.get(t.id)!.ultimo) : '—'}</td> : null}
              <td className="py-1">
                <input
                  type="checkbox"
                  checked={t.activo}
                  aria-label={`Talla ${t.talla} activa`}
                  onChange={(e) => guardar.mutate({ id: t.id, cambios: { activo: e.target.checked } })}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {guardar.isError ? <MensajeError error={guardar.error} /> : null}
      <p className="text-xs text-texto3">El stock mínimo se guarda al salir del campo. Una talla inactiva no aparece para vender.</p>
    </div>
  )
}
