import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Footprints, Plus, Search, Trash2, X } from 'lucide-react'
import { CATEGORIAS } from '@shared/excel'
import { urlMiniatura } from '@shared/fotos'
import { conPuntosDeMiles as conMiles, pesos, soloDigitos } from '@shared/formato'
import { tallaNumerica, tramoDeTalla, tramoDesdeBorrador, validarTramos, type TramoBorrador } from '@shared/tramos'
import { guardarPreciosReferencia, listarTallasPrecios, listarTodosLosTramos } from '../../lib/datos/precios'
import { contarModelos, hojaDePrecios, rangosIniciales, type FiltrosPrecios, type ModeloPrecios } from '../../lib/precios'
import { Boton, Cargando, Insignia, MensajeError } from '../../componentes/ui'

const soloTalla = (t: string) => t.replace(/[^0-9.,]/g, '').replace(',', '.')

export function Precios() {
  const datos = useQuery({
    queryKey: ['precios'],
    queryFn: async () => ({ tallas: await listarTallasPrecios(), tramos: await listarTodosLosTramos() }),
  })
  const [filtros, setFiltros] = useState<FiltrosPrecios>({ categoria: '', soloSinPrecio: false, texto: '' })
  const [descargando, setDescargando] = useState(false)
  const [errorPdf, setErrorPdf] = useState<string | null>(null)

  const categorias = useMemo(
    () => (datos.data ? hojaDePrecios(datos.data.tallas, datos.data.tramos, filtros) : []),
    [datos.data, filtros],
  )
  const total = contarModelos(categorias)
  const pendientes = categorias.reduce((s, c) => s + c.modelos.filter((m) => m.sinPrecio).length, 0)

  const descargar = async () => {
    setDescargando(true)
    setErrorPdf(null)
    try {
      const { descargarPdfPrecios } = await import('../../lib/pdfPrecios')
      const hoy = new Date().toLocaleDateString('en-CA')
      await descargarPdfPrecios(categorias, `hoja-de-precios-${hoy}.pdf`)
    } catch (e) {
      setErrorPdf(e instanceof Error ? e.message : 'No se pudo crear el PDF.')
    } finally {
      setDescargando(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="text-titulo">Precios por referencia</h1>
          <p className="text-texto2">
            Descarga la hoja con todo el calzado (qué hay de cada color en cada talla) para imprimirla y escribir a mano los rangos de tallas
            con su precio mínimo y máximo, y la garantía. Después pásalos aquí, en el mismo orden de la hoja: cada rango vale para todos los colores.
          </p>
        </div>
        <Boton onClick={descargar} cargando={descargando} disabled={!total}>
          <Download aria-hidden className="size-4" />
          Descargar PDF ({total} {total === 1 ? 'referencia' : 'referencias'})
        </Boton>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-56 flex-1 items-center gap-2 rounded-xl border border-borde bg-fondo px-3 py-2">
          <Search aria-hidden className="size-4 text-texto3" />
          <input
            value={filtros.texto}
            onChange={(e) => setFiltros({ ...filtros, texto: e.target.value })}
            placeholder="Buscar referencia, nombre, marca o color"
            aria-label="Buscar"
            className="w-full bg-transparent text-sm outline-none"
          />
          {filtros.texto ? (
            <button aria-label="Borrar búsqueda" onClick={() => setFiltros({ ...filtros, texto: '' })} className="text-texto3 hover:text-texto">
              <X className="size-4" />
            </button>
          ) : null}
        </label>
        <select
          aria-label="Categoría"
          value={filtros.categoria}
          onChange={(e) => setFiltros({ ...filtros, categoria: e.target.value })}
          className="rounded-xl border border-borde bg-fondo px-3 py-2 text-sm text-texto2"
        >
          <option value="">Todas las categorías</option>
          {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
        </select>
        <label className="flex items-center gap-2 rounded-xl border border-borde bg-fondo px-3 py-2 text-sm text-texto2">
          <input
            type="checkbox"
            checked={filtros.soloSinPrecio}
            onChange={(e) => setFiltros({ ...filtros, soloSinPrecio: e.target.checked })}
          />
          Solo las que siguen en $1
        </label>
      </div>

      {errorPdf ? <MensajeError error={new Error(errorPdf)} /> : null}

      {datos.isPending ? <Cargando /> : datos.isError ? <MensajeError error={datos.error} /> : (
        <>
          <p className="cifras text-sm text-texto2">
            {total} {total === 1 ? 'referencia' : 'referencias'} · {pendientes} sin precio
          </p>
          {categorias.map((c) => (
            <section key={c.categoria} className="flex flex-col gap-3">
              <h2 className="text-lg font-semibold">{c.etiqueta}</h2>
              <ul className="flex flex-col gap-3">
                {c.modelos.map((m) => <TarjetaPrecios key={m.clave} modelo={m} />)}
              </ul>
            </section>
          ))}
          {!total ? <p className="text-texto2">No hay calzado con esos filtros.</p> : null}
        </>
      )}
    </div>
  )
}

function TarjetaPrecios({ modelo: m }: { modelo: ModeloPrecios }) {
  const cliente = useQueryClient()
  const [rangos, setRangos] = useState<TramoBorrador[]>(() => rangosIniciales(m))
  const [garantia, setGarantia] = useState(m.garantia != null ? String(m.garantia) : '')
  const [cambiado, setCambiado] = useState(false)
  const [guardado, setGuardado] = useState(false)

  const guardar = useMutation({
    mutationFn: () => {
      const tramos = rangos.map(tramoDesdeBorrador).filter((t) => t != null)
      return guardarPreciosReferencia(m.referencia!, tramos, garantia ? Number(garantia) : null)
    },
    onSuccess: () => {
      setCambiado(false)
      setGuardado(true)
      cliente.invalidateQueries({ queryKey: ['precios'] })
      cliente.invalidateQueries({ queryKey: ['inventario'] })
    },
  })

  const cambiar = (i: number, campo: keyof TramoBorrador, valor: string) => {
    setRangos(rangos.map((r, j) => (j === i ? { ...r, [campo]: valor } : r)))
    setCambiado(true)
    setGuardado(false)
  }
  const tramos = rangos.map(tramoDesdeBorrador).filter((t) => t != null)
  const problema = validarTramos(rangos)
  const sinRango = m.tallas.filter((t) => tallaNumerica(t) != null && !tramoDeTalla(tramos, t))
  const titulo = [m.referencia, m.descripcion].filter(Boolean).join(' · ')
  const caja = 'rounded-lg border border-borde bg-fondo px-2 py-1.5 text-sm outline-none focus:border-primario'

  return (
    <li className="rounded-2xl border border-borde bg-fondo p-4">
      <div className="flex flex-wrap gap-4">
        {m.foto ? (
          <img src={urlMiniatura(m.foto) ?? m.foto} alt="" loading="lazy" className="size-20 rounded-xl bg-superficie2 object-cover" />
        ) : (
          <span aria-label="Sin foto" className="flex size-20 items-center justify-center rounded-xl bg-superficie2 text-texto3">
            <Footprints aria-hidden className="size-6" />
          </span>
        )}
        <div className="min-w-60 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{titulo}</h3>
            {m.sinPrecio ? <Insignia tono="advertencia">Sin precio</Insignia> : null}
            {guardado ? <Insignia tono="exito">Guardado</Insignia> : null}
          </div>
          <p className="text-sm text-texto2">
            {[m.marca, `${m.total} ${m.total === 1 ? 'par' : 'pares'}`, `tallas ${m.tallas[0]}–${m.tallas[m.tallas.length - 1]}`,
              m.colores.map((c) => c.color).join(', '),
              m.precioActual ? `ahora ${pesos(m.precioActual.min)}${m.precioActual.max !== m.precioActual.min ? ` – ${pesos(m.precioActual.max)}` : ''}` : null,
            ].filter(Boolean).join(' · ')}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {rangos.map((r, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2 text-sm">
            <input aria-label={`Talla desde, rango ${i + 1}`} inputMode="decimal" value={r.desde} onChange={(e) => cambiar(i, 'desde', soloTalla(e.target.value))} placeholder="Desde" className={`${caja} w-16`} />
            <span className="text-texto3">a</span>
            <input aria-label={`Talla hasta, rango ${i + 1}`} inputMode="decimal" value={r.hasta} onChange={(e) => cambiar(i, 'hasta', soloTalla(e.target.value))} placeholder="Hasta" className={`${caja} w-16`} />
            <label className="ml-3 flex items-center gap-1 whitespace-nowrap">
              <span className="text-texto3">Mín $</span>
              <input aria-label={`Precio mínimo, rango ${i + 1}`} inputMode="numeric" value={conMiles(r.minimo)} onChange={(e) => cambiar(i, 'minimo', soloDigitos(e.target.value))} className={`${caja} cifras w-32`} />
            </label>
            <label className="ml-2 flex items-center gap-1 whitespace-nowrap">
              <span className="text-texto3">Máx $</span>
              <input aria-label={`Precio máximo, rango ${i + 1}`} inputMode="numeric" value={conMiles(r.maximo)} onChange={(e) => cambiar(i, 'maximo', soloDigitos(e.target.value))} placeholder="Opcional" className={`${caja} cifras w-32`} />
            </label>
            <button
              aria-label={`Quitar rango ${i + 1}`}
              disabled={rangos.length === 1}
              onClick={() => { setRangos(rangos.filter((_, j) => j !== i)); setCambiado(true); setGuardado(false) }}
              className="rounded-lg p-1.5 text-texto3 hover:text-texto disabled:opacity-30"
            >
              <Trash2 className="size-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => { setRangos([...rangos, { desde: '', hasta: '', minimo: '', maximo: '' }]); setCambiado(true) }}
          className="flex items-center gap-1 text-sm font-medium text-primario"
        >
          <Plus aria-hidden className="size-4" /> Otro rango
        </button>
        <label className="flex items-center gap-2 text-sm">
          <span className="text-texto3">Garantía</span>
          <input
            aria-label="Garantía en días"
            inputMode="numeric"
            value={garantia}
            onChange={(e) => { setGarantia(soloDigitos(e.target.value)); setCambiado(true); setGuardado(false) }}
            placeholder="—"
            className={`${caja} w-16`}
          />
          <span className="text-texto3">días</span>
        </label>
        <div className="ml-auto flex items-center gap-3">
          {cambiado && problema ? <span className="text-sm text-peligro-texto">{problema}</span> : null}
          {cambiado && !problema && sinRango.length ? (
            <span className="text-sm text-texto2">Sin rango (siguen igual): tallas {sinRango.join(', ')}</span>
          ) : null}
          {guardar.isError ? <span className="text-sm text-peligro-texto">{guardar.error instanceof Error ? guardar.error.message : 'No se pudo guardar.'}</span> : null}
          <Boton
            onClick={() => guardar.mutate()}
            cargando={guardar.isPending}
            disabled={!cambiado || !!problema || !m.referencia}
            title={m.referencia ? undefined : 'Este zapato no tiene referencia'}
          >
            Guardar
          </Boton>
        </div>
      </div>
    </li>
  )
}
