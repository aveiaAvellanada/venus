import { useMemo, useRef, useState, type DragEvent } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, FileUp } from 'lucide-react'
import { pesos } from '@shared/formato'
import { hoyEn } from '@shared/fechas'
import { CATEGORIAS, validarFilas, type FilaConError, type FilaValida } from '@shared/excel'
import {
  COLUMNAS, INSTRUCCIONES, MAX_FILAS, filasDeExportacion, payloadCarga, revisarCarga,
  type EstadoFila, type FilaRevisada,
} from '../../lib/carga'
import { cargarInventario, type ResultadoCarga } from '../../lib/datos/carga'
import { costosPorProducto, listarCalzado } from '../../lib/datos/inventario'
import { listarProveedores } from '../../lib/datos/proveedores'
import { descargarExcel, leerArchivoExcel } from '../../lib/excel'
import { NEGOCIO } from '../../lib/negocio'
import { AvisoError, Boton, Cargando, Insignia, MensajeError, Tarjeta } from '../../componentes/ui'

interface Lectura {
  nombre: string
  validacion: { validas: FilaValida[]; errores: FilaConError[] }
}

const FILTROS: { valor: EstadoFila | 'todas'; titulo: string }[] = [
  { valor: 'todas', titulo: 'Todas' },
  { valor: 'nueva', titulo: 'Nuevas' },
  { valor: 'cambia', titulo: 'Cambian' },
  { valor: 'igual', titulo: 'Sin cambios' },
]
const ESTADO: Record<EstadoFila, { texto: string; tono: 'exito' | 'primario' | 'neutro' }> = {
  nueva: { texto: 'Nueva', tono: 'exito' },
  cambia: { texto: 'Cambia', tono: 'primario' },
  igual: { texto: 'Sin cambios', tono: 'neutro' },
}
const ANCHOS = [14, 28, 14, 14, 8, 12, 14, 14, 12, 8]
const POR_PAGINA = 200
const MAX_ERRORES = 50
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`
const etiqueta = (valor: string) => CATEGORIAS.find((c) => c.valor === valor)?.etiqueta ?? valor

export function Carga() {
  const cliente = useQueryClient()
  const entrada = useRef<HTMLInputElement>(null)
  const [lectura, setLectura] = useState<Lectura | null>(null)
  const [leyendo, setLeyendo] = useState(false)
  const [errorLectura, setErrorLectura] = useState<Error | null>(null)
  const [arrastrando, setArrastrando] = useState(false)
  const [filtro, setFiltro] = useState<EstadoFila | 'todas'>('todas')
  const [visibles, setVisibles] = useState(POR_PAGINA)
  const [proveedorId, setProveedorId] = useState('')
  const [resultado, setResultado] = useState<ResultadoCarga | null>(null)
  const [exportando, setExportando] = useState(false)

  const inventario = useQuery({ queryKey: ['inventario'], queryFn: listarCalzado })
  // Sin permiso de costos la base responde con error: se exporta sin costo.
  const costos = useQuery({ queryKey: ['costos'], queryFn: costosPorProducto, retry: false })
  const proveedores = useQuery({ queryKey: ['proveedores'], queryFn: listarProveedores })

  const revision = useMemo(
    () => (lectura && inventario.data ? revisarCarga(lectura.validacion, inventario.data) : null),
    [lectura, inventario.data],
  )
  const filasFiltradas = useMemo(
    () => (revision?.filas ?? []).filter((f) => filtro === 'todas' || f.estado === filtro),
    [revision, filtro],
  )

  const guardar = useMutation({
    mutationFn: () => cargarInventario(payloadCarga(revision?.filas ?? []), revision?.nuevas ? proveedorId || null : null),
    onSuccess: async (r) => {
      setResultado(r)
      setLectura(null)
      await Promise.all([
        cliente.invalidateQueries({ queryKey: ['inventario'] }),
        cliente.invalidateQueries({ queryKey: ['costos'] }),
      ])
    },
  })

  async function leer(archivo: File | undefined) {
    if (!archivo) return
    setErrorLectura(null)
    setResultado(null)
    guardar.reset()
    setLeyendo(true)
    try {
      if (!/\.xlsx?$/i.test(archivo.name)) throw new Error('Elige un archivo de Excel (.xlsx o .xls).')
      const filas = await leerArchivoExcel(archivo)
      if (!filas.length) throw new Error('La primera hoja no tiene filas debajo de los encabezados.')
      if (filas.length > MAX_FILAS) throw new Error(`El archivo tiene ${filas.length} filas; el máximo por carga es ${MAX_FILAS}. Divídelo en varios archivos.`)
      setLectura({ nombre: archivo.name, validacion: validarFilas(filas, { costoObligatorio: false }) })
      setFiltro('todas')
      setVisibles(POR_PAGINA)
    } catch (e) {
      setLectura(null)
      setErrorLectura(e instanceof Error ? e : new Error('No se pudo leer el archivo.'))
    } finally {
      setLeyendo(false)
      if (entrada.current) entrada.current.value = ''
    }
  }

  function soltar(e: DragEvent) {
    e.preventDefault()
    setArrastrando(false)
    void leer(e.dataTransfer.files[0])
  }

  async function exportar(vacia: boolean) {
    setExportando(true)
    try {
      const hoy = hoyEn(new Date(), NEGOCIO.zonaHoraria)
      const filas = vacia ? [[...COLUMNAS]] : filasDeExportacion(inventario.data ?? [], costos.data)
      await descargarExcel(vacia ? 'plantilla-inventario.xlsx' : `inventario-${hoy}.xlsx`, [
        { nombre: 'Inventario', filas, anchos: ANCHOS },
        { nombre: 'Instrucciones', filas: INSTRUCCIONES, anchos: [120] },
      ])
    } finally {
      setExportando(false)
    }
  }

  const porGuardar = revision ? revision.nuevas + revision.cambian : 0
  const bloqueado = !revision || revision.errores.length > 0 || porGuardar === 0

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Carga masiva</h1>
          <p className="max-w-2xl text-texto2">
            Sube el inventario en Excel con la plantilla de siempre, revisa y guarda. También puedes descargarlo,
            corregir precios en Excel y volver a subirlo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Boton variante="fantasma" onClick={() => void exportar(true)} disabled={exportando}>
            <FileSpreadsheet aria-hidden className="size-4" />
            Plantilla vacía
          </Boton>
          <Boton variante="fantasma" onClick={() => void exportar(false)} disabled={exportando || !inventario.data?.length}>
            <Download aria-hidden className="size-4" />
            Descargar inventario
          </Boton>
        </div>
      </header>

      {resultado ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-2xl border border-borde bg-exito-soft px-5 py-4 text-exito-texto">
          <CheckCircle2 aria-hidden className="size-5 shrink-0" />
          <p className="flex-1 text-sm">
            <strong>Inventario guardado.</strong>{' '}
            {plural(resultado.creados, 'talla nueva', 'tallas nuevas')}, {plural(resultado.actualizados, 'actualizada', 'actualizadas')} y{' '}
            {resultado.sin_cambios} sin cambios.
          </p>
          <Link to="/inventario" className="text-sm font-semibold underline">Ver inventario</Link>
        </div>
      ) : null}

      <label
        onDragOver={(e) => { e.preventDefault(); setArrastrando(true) }}
        onDragLeave={() => setArrastrando(false)}
        onDrop={soltar}
        className={`flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 text-center transition-colors ${
          lectura ? 'py-4' : 'py-10'
        } ${arrastrando ? 'border-primario bg-primario-soft' : 'border-borde bg-fondo hover:border-primario'}`}
      >
        <input ref={entrada} type="file" accept=".xlsx,.xls" className="sr-only" onChange={(e) => void leer(e.target.files?.[0])} aria-label="Archivo de Excel" />
        {leyendo ? <Cargando texto="Leyendo el archivo…" /> : (
          <>
            <FileUp aria-hidden className="size-6 text-primario" />
            <span className="font-semibold">
              {lectura ? <>Archivo: {lectura.nombre} · <span className="text-primario">elegir otro</span></> : 'Elige o arrastra el archivo de Excel'}
            </span>
            {lectura ? null : (
              <span className="text-sm text-texto3">
                Se lee la primera hoja, con los encabezados en la fila 1. Hasta {MAX_FILAS.toLocaleString('es-CO')} filas.
              </span>
            )}
          </>
        )}
      </label>

      {errorLectura ? <AvisoError error={errorLectura} /> : null}

      {!lectura && !resultado ? (
        <Tarjeta titulo="Así funciona">
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-texto2">
            <li>Cada fila es una talla: categoría, descripción, marca, referencia, talla, color, precios, costo y stock.</li>
            <li>Las tallas nuevas se crean con el stock del archivo.</li>
            <li>
              Las que ya existen (misma referencia —o descripción si no tiene—, color y talla) actualizan descripción, marca,
              categoría y precios. <strong className="text-texto">Su stock no cambia</strong>: el stock cambia con compras, ventas y devoluciones.
            </li>
            <li>Antes de guardar ves qué es nuevo, qué cambia y qué filas tienen errores. Si hay uno solo, no se guarda nada.</li>
          </ul>
        </Tarjeta>
      ) : null}

      {lectura && inventario.isPending ? <Cargando texto="Comparando con el inventario…" /> : null}
      {lectura && inventario.isError ? <MensajeError error={inventario.error} /> : null}

      {revision ? (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Cifra titulo="Tallas nuevas" valor={revision.nuevas} detalle={`${plural(revision.paresNuevos, 'par', 'pares')} entran al stock`} />
            <Cifra titulo="Cambian" valor={revision.cambian} detalle="datos o precios" />
            <Cifra titulo="Sin cambios" valor={revision.iguales} detalle="iguales al inventario" />
            <Cifra titulo="Con errores" valor={revision.errores.length} detalle={revision.errores.length ? 'corrígelas en el Excel' : 'ninguna'} alerta={revision.errores.length > 0} />
          </div>

          {revision.errores.length ? (
            <section role="alert" className="rounded-2xl border border-peligro-texto/30 bg-peligro-soft px-5 py-4 text-sm text-peligro-texto">
              <p className="mb-2 font-semibold">
                {plural(revision.errores.length, 'fila tiene', 'filas tienen')} errores. Corrígelas en el Excel y vuelve a subirlo: mientras haya errores no se guarda nada.
              </p>
              <ul className="flex flex-col gap-1">
                {revision.errores.slice(0, MAX_ERRORES).map((e) => (
                  <li key={`${e.fila}-${e.errores[0]}`}><strong className="cifras">Fila {e.fila}:</strong> {e.errores.join(' · ')}</li>
                ))}
              </ul>
              {revision.errores.length > MAX_ERRORES ? <p className="mt-2">y {revision.errores.length - MAX_ERRORES} más.</p> : null}
            </section>
          ) : null}

          {revision.stockIgnorado ? (
            <p className="flex gap-2 rounded-xl bg-advertencia-soft px-4 py-3 text-sm text-advertencia-texto">
              <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
              <span>
                {plural(revision.stockIgnorado, 'talla que ya existe trae', 'tallas que ya existen traen')} otro stock en el archivo.
                Ese stock no se carga: para sumar mercancía usa <Link to="/compras/nueva" className="font-semibold underline">Compras</Link>.
              </span>
            </p>
          ) : null}

          <div role="radiogroup" aria-label="Mostrar" className="flex self-start rounded-xl border border-borde bg-fondo p-0.5">
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                role="radio"
                aria-checked={filtro === f.valor}
                onClick={() => { setFiltro(f.valor); setVisibles(POR_PAGINA) }}
                className={`rounded-lg px-3 py-1.5 text-sm ${filtro === f.valor ? 'bg-primario-soft font-semibold text-primario' : 'text-texto2 hover:text-texto'}`}
              >
                {f.titulo}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-borde bg-fondo">
            <table className="w-full min-w-[52rem] text-sm">
              <thead className="border-b border-borde text-left text-xs text-texto3">
                <tr>
                  <th className="px-4 py-3 font-medium">Fila</th>
                  <th className="py-3 pr-3 font-medium">Referencia</th>
                  <th className="py-3 pr-3 font-medium">Talla</th>
                  <th className="py-3 pr-3 font-medium">Categoría</th>
                  <th className="py-3 pr-3 text-right font-medium">Precio</th>
                  <th className="py-3 pr-3 text-right font-medium">Stock</th>
                  <th className="py-3 pr-4 font-medium">Qué pasa</th>
                </tr>
              </thead>
              <tbody>
                {filasFiltradas.slice(0, visibles).map((f) => <Fila key={f.fila} f={f} />)}
                {!filasFiltradas.length ? (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-texto3">No hay filas en este grupo.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
          {filasFiltradas.length > visibles ? (
            <Boton variante="fantasma" className="self-center" onClick={() => setVisibles((v) => v + POR_PAGINA)}>
              Ver {Math.min(POR_PAGINA, filasFiltradas.length - visibles)} más de {filasFiltradas.length}
            </Boton>
          ) : null}

          <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center gap-3 rounded-2xl border border-borde bg-fondo px-4 py-3 shadow-lg">
            {revision.nuevas ? (
              <label className="flex items-center gap-2 text-sm">
                <span className="text-texto2">Proveedor de las nuevas</span>
                <select
                  value={proveedorId}
                  onChange={(e) => setProveedorId(e.target.value)}
                  className="rounded-xl border border-borde bg-fondo px-3 py-2 text-sm"
                >
                  <option value="">Sin proveedor</option>
                  {(proveedores.data ?? []).filter((p) => p.activo).map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </label>
            ) : null}
            <p className="flex-1 text-sm text-texto2">
              {revision.errores.length ? 'Corrige los errores para poder guardar.'
                : porGuardar === 0 ? 'Nada que guardar: el archivo es igual al inventario.'
                  : `Se guardan ${plural(revision.nuevas, 'talla nueva', 'tallas nuevas')} y ${plural(revision.cambian, 'cambio', 'cambios')}, todo junto.`}
            </p>
            <Boton onClick={() => guardar.mutate()} disabled={bloqueado} cargando={guardar.isPending}>
              Guardar {porGuardar ? plural(porGuardar, 'talla', 'tallas') : ''}
            </Boton>
            {guardar.isError ? <div className="w-full"><AvisoError error={guardar.error} /></div> : null}
          </div>
        </>
      ) : null}
    </div>
  )
}

function Cifra({ titulo, valor, detalle, alerta = false }: { titulo: string; valor: number; detalle: string; alerta?: boolean }) {
  return (
    <div className={`rounded-2xl border p-4 ${alerta ? 'border-peligro-texto/30 bg-peligro-soft text-peligro-texto' : 'border-borde bg-fondo'}`}>
      <p className={`text-sm ${alerta ? '' : 'text-texto2'}`}>{titulo}</p>
      <p className="cifras mt-1 text-2xl font-bold">{valor.toLocaleString('es-CO')}</p>
      <p className={`text-xs ${alerta ? '' : 'text-texto3'}`}>{detalle}</p>
    </div>
  )
}

function Fila({ f }: { f: FilaRevisada }) {
  const d = f.datos
  const estado = ESTADO[f.estado]
  return (
    <tr className="border-b border-borde align-top last:border-0">
      <td className="cifras px-4 py-2.5 text-texto3">{f.fila}</td>
      <td className="py-2.5 pr-3">
        <span className="block font-medium">{d.referencia ? `${d.referencia} · ` : ''}{d.descripcion}</span>
        <span className="block text-xs text-texto3">{[d.marca, d.color].filter(Boolean).join(' · ')}</span>
      </td>
      <td className="cifras py-2.5 pr-3">{d.talla ?? 'Única'}</td>
      <td className="py-2.5 pr-3 text-texto2">{etiqueta(d.categoria)}</td>
      <td className="cifras py-2.5 pr-3 text-right">{pesos(d.precio_min)}–{pesos(d.precio_max)}</td>
      <td className="cifras py-2.5 pr-3 text-right">
        {f.estado === 'nueva' ? d.stock : (
          <span title="El stock de lo que ya existe no cambia con la carga">
            {f.stockSistema ?? d.stock}
            {f.stockSistema != null ? <span className="block text-xs text-advertencia-texto">archivo: {d.stock}</span> : null}
          </span>
        )}
      </td>
      <td className="py-2.5 pr-4">
        <Insignia tono={estado.tono}>{estado.texto}</Insignia>
        {f.cambios.map((c) => <span key={c} className="mt-1 block text-xs text-texto2">{c}</span>)}
      </td>
    </tr>
  )
}
