import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowLeft, Paperclip, Plus } from 'lucide-react'
import { pesos } from '@shared/formato'
import { hoyEn } from '@shared/fechas'
import { COLORES_BASE, coloresDeNombre, nombreColores } from '@shared/colores'
import {
  avisosFactura, erroresFactura, filaVacia, otroColor, rangosDesdeExistentes, resumenFactura,
  type Factura, type FilaFactura, type TallaExistente,
} from '../../lib/compras'
import { fijarFotos, registrarCompra } from '../../lib/datos/compras'
import { costosPorProducto, listarCalzado } from '../../lib/datos/inventario'
import { listarProveedores, subirDocumento } from '../../lib/datos/proveedores'
import { comprimirFoto, MAX_PDF } from '../../lib/imagen'
import { plano } from '../../navegacion'
import { nuevoId } from '../../lib/id'
import { NEGOCIO } from '../../lib/negocio'
import { AvisoError, Boton, Cargando, CampoTexto, Dialogo, Tarjeta } from '../../componentes/ui'
import { FilaReferencia } from './FilaReferencia'

const BORRADOR = 'panel-compra-borrador'

interface Borrador {
  factura: Factura
  clave: string
}

function leerBorrador(hoy: string): Borrador {
  try {
    const guardado = localStorage.getItem(BORRADOR)
    if (guardado) return JSON.parse(guardado) as Borrador
  } catch {
    // borrador ilegible: se empieza de cero
  }
  return {
    clave: nuevoId(),
    factura: { proveedorId: '', numeroFactura: '', fechaFactura: hoy, condicion: 'contado', fechaVencimiento: '', notas: '', filas: [filaVacia(nuevoId())] },
  }
}

interface ReferenciaConocida {
  referencia: string
  descripcion: string
  marca: string
  categoria: string
  color: string
  existentes: Record<string, TallaExistente>
}

// "rojo/blanco" reconoce la referencia guardada como "Rojo y blanco".
const claveRef = (referencia: string, color: string) => `${plano(referencia)}|${plano(nombreColores(color) ?? '')}`

export function NuevaCompra() {
  const navegar = useNavigate()
  const cliente = useQueryClient()
  const hoy = hoyEn(new Date(), NEGOCIO.zonaHoraria)
  const [borrador, setBorrador] = useState<Borrador>(() => leerBorrador(hoy))
  const [archivo, setArchivo] = useState<File | null>(null)
  const [revisando, setRevisando] = useState(false)
  const [intentoGuardar, setIntentoGuardar] = useState(false)
  const entradaArchivo = useRef<HTMLInputElement>(null)
  const f = borrador.factura

  // El borrador vive en este navegador: una factura a medias no se pierde.
  useEffect(() => {
    try { localStorage.setItem(BORRADOR, JSON.stringify(borrador)) } catch { /* sin espacio: se sigue sin borrador */ }
  }, [borrador])

  const proveedores = useQuery({ queryKey: ['proveedores'], queryFn: listarProveedores })
  const inventario = useQuery({ queryKey: ['inventario'], queryFn: listarCalzado })
  const costos = useQuery({ queryKey: ['costos'], queryFn: costosPorProducto, retry: false })

  // Referencias del inventario por referencia + color, con sus tallas y precios.
  const conocidas = useMemo(() => {
    const mapa = new Map<string, ReferenciaConocida>()
    for (const p of inventario.data ?? []) {
      if (!p.referencia || !p.talla) continue
      const clave = claveRef(p.referencia, p.color ?? '')
      const r = mapa.get(clave) ?? {
        referencia: p.referencia, descripcion: p.descripcion, marca: p.marca ?? '', categoria: p.categoria,
        color: p.color ?? '', existentes: {},
      }
      r.existentes[p.talla] = {
        id: p.id, precio_minimo: Number(p.precio_minimo), precio_maximo: Number(p.precio_maximo ?? p.precio_minimo), foto_url: p.foto_url ?? null,
      }
      mapa.set(clave, r)
    }
    return mapa
  }, [inventario.data])
  const referencias = useMemo(() => [...new Set([...conocidas.values()].map((r) => r.referencia))].sort(), [conocidas])
  // Marcas y colores ya usados en el inventario, para elegirlos o escribir uno nuevo.
  const marcas = useMemo(
    () => [...new Set((inventario.data ?? []).map((p) => p.marca?.trim()).filter((m): m is string => !!m))].sort((a, b) => a.localeCompare(b, 'es')),
    [inventario.data],
  )
  const coloresUsados = useMemo(
    () => [...new Set((inventario.data ?? []).map((p) => nombreColores(p.color)).filter((c): c is string => !!c))],
    [inventario.data],
  )
  const coloresSimples = useMemo(() => {
    const vistos = new Map<string, string>()
    for (const c of [...COLORES_BASE, ...coloresUsados.flatMap((c) => coloresDeNombre(c))]) {
      const nombre = nombreColores(c)!
      if (!vistos.has(plano(nombre))) vistos.set(plano(nombre), nombre)
    }
    return [...vistos.values()].sort((a, b) => a.localeCompare(b, 'es'))
  }, [coloresUsados])
  // Para el primer color: los de dos colores ya usados ("Rojo y blanco") y los sueltos.
  const colores = useMemo(
    () => [...coloresUsados.filter((c) => coloresDeNombre(c).length > 1).sort((a, b) => a.localeCompare(b, 'es')), ...coloresSimples],
    [coloresUsados, coloresSimples],
  )

  const cambiarFactura = (cambios: Partial<Factura>) => setBorrador((b) => ({ ...b, factura: { ...b.factura, ...cambios } }))
  const cambiarFila = (id: string, fila: FilaFactura) =>
    setBorrador((b) => ({ ...b, factura: { ...b.factura, filas: b.factura.filas.map((x) => (x.id === id ? fila : x)) } }))
  // La foto llega cuando termina de subir: se pone sobre la fila como esté en ese momento.
  const fijarFoto = (id: string, foto: string) =>
    setBorrador((b) => ({ ...b, factura: { ...b.factura, filas: b.factura.filas.map((x) => (x.id === id ? { ...x, foto } : x)) } }))

  // "Otro color": la misma referencia justo debajo, lista para escribir el color.
  function agregarOtroColor(fila: FilaFactura) {
    const nueva = otroColor(fila, nuevoId())
    setBorrador((b) => {
      const filas = [...b.factura.filas]
      filas.splice(filas.findIndex((x) => x.id === fila.id) + 1, 0, nueva)
      return { ...b, factura: { ...b.factura, filas } }
    })
    setTimeout(() => document.getElementById(`color-${nueva.id}`)?.focus(), 0)
  }

  // Al escribir referencia y color de algo que ya existe: trae descripción, marca,
  // categoría, las tallas existentes y sus precios (y el último costo).
  function reconocer(fila: FilaFactura) {
    const r = conocidas.get(claveRef(fila.referencia, fila.color))
    if (!r) {
      if (Object.keys(fila.existentes).length) cambiarFila(fila.id, { ...fila, existentes: {} })
      return
    }
    if (fila.existentes === r.existentes) return
    const sinPrecios = fila.rangos.every((x) => !x.costo && !x.minimo && !x.maximo)
    cambiarFila(fila.id, {
      ...fila,
      referencia: r.referencia,
      color: r.color,
      descripcion: fila.descripcion || r.descripcion,
      marca: fila.marca || r.marca,
      categoria: fila.categoria || r.categoria,
      existentes: r.existentes,
      rangos: sinPrecios ? rangosDesdeExistentes(r.existentes, costos.data) : fila.rangos,
    })
  }

  function moverEntreFilas(indice: number, talla: string, direccion: 'abajo' | 'arriba') {
    const destino = f.filas[indice + (direccion === 'abajo' ? 1 : -1)]
    if (destino) document.getElementById(`talla-${destino.id}-${talla}`)?.focus()
    else if (direccion === 'abajo') {
      const nueva = filaVacia(nuevoId())
      cambiarFactura({ filas: [...f.filas, nueva] })
      setTimeout(() => document.getElementById(`talla-${nueva.id}-${talla}`)?.focus(), 0)
    }
  }

  const resumen = resumenFactura(f)
  const errores = erroresFactura(f, hoy)
  const avisos = avisosFactura(f)
  const proveedor = proveedores.data?.find((p) => p.id === f.proveedorId)

  const guardar = useMutation({
    mutationFn: async () => {
      const resultado = await registrarCompra(f, borrador.clave)
      let fotoFallo = false
      try {
        await fijarFotos(resultado.compra_id, f)
      } catch {
        // La compra ya quedó: la foto se puede poner después desde la app.
        fotoFallo = true
      }
      if (archivo) {
        try {
          if (archivo.type === 'application/pdf') {
            if (archivo.size > MAX_PDF) throw new Error('El PDF pesa más de 5 MB.')
            await subirDocumento(f.proveedorId, archivo, archivo.name, 'pdf', resultado.compra_id)
          } else {
            await subirDocumento(f.proveedorId, await comprimirFoto(archivo), archivo.name, 'imagen', resultado.compra_id)
          }
        } catch {
          // La compra ya quedó: el archivo se puede subir después desde el detalle.
          return { ...resultado, archivoFallo: true, fotoFallo }
        }
      }
      return { ...resultado, archivoFallo: false, fotoFallo }
    },
    onSuccess: async (r) => {
      try { localStorage.removeItem(BORRADOR) } catch { /* nada */ }
      await Promise.all([
        cliente.invalidateQueries({ queryKey: ['inventario'] }),
        cliente.invalidateQueries({ queryKey: ['costos'] }),
        cliente.invalidateQueries({ queryKey: ['compras'] }),
        cliente.invalidateQueries({ queryKey: ['proveedores'] }),
      ])
      const avisos = [r.archivoFallo ? 'archivo=fallo' : '', r.fotoFallo ? 'foto=fallo' : ''].filter(Boolean).join('&')
      navegar(`/compras/${r.compra_id}${avisos ? `?${avisos}` : ''}`)
    },
  })

  function descartar() {
    if (!window.confirm('¿Descartar esta factura? Se borra el borrador.')) return
    try { localStorage.removeItem(BORRADOR) } catch { /* nada */ }
    setBorrador(leerBorrador(hoy))
    setArchivo(null)
    setIntentoGuardar(false)
  }

  if (proveedores.isPending || inventario.isPending) return <Cargando />

  return (
    <div className="flex flex-col gap-5 pb-28">
      <Link to="/compras" className="inline-flex items-center gap-1.5 self-start text-sm text-texto2 hover:text-texto">
        <ArrowLeft aria-hidden className="size-4" />
        Compras
      </Link>
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-titulo">Nueva compra</h1>
          <p className="text-texto2">
            La factura del proveedor: una fila por referencia y color, con la cantidad de cada talla. Al guardar sube el stock.
          </p>
        </div>
        <Boton variante="fantasma" onClick={descartar}>Descartar borrador</Boton>
      </header>

      <Tarjeta>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm lg:col-span-2">
            <span className="mb-1.5 block font-medium">Proveedor *</span>
            <select
              value={f.proveedorId}
              onChange={(e) => cambiarFactura({ proveedorId: e.target.value })}
              className="w-full rounded-xl border border-borde bg-fondo px-3 py-2"
            >
              <option value="">Elegir proveedor…</option>
              {(proveedores.data ?? []).filter((p) => p.activo || p.id === f.proveedorId).map((p) => (
                <option key={p.id} value={p.id}>{p.nombre}</option>
              ))}
            </select>
          </label>
          <CampoTexto etiqueta="Número de factura" value={f.numeroFactura} onChange={(e) => cambiarFactura({ numeroFactura: e.target.value })} placeholder="Ej.: FV-1001" />
          <CampoTexto etiqueta="Fecha de la factura" type="date" max={hoy} value={f.fechaFactura} onChange={(e) => cambiarFactura({ fechaFactura: e.target.value })} />
          <fieldset className="text-sm">
            <legend className="mb-1.5 font-medium">Pago</legend>
            <div className="flex rounded-xl border border-borde bg-fondo p-0.5">
              {(['contado', 'credito'] as const).map((c) => (
                <label key={c} className={`flex-1 cursor-pointer rounded-lg px-3 py-1.5 text-center ${f.condicion === c ? 'bg-primario-soft font-semibold text-primario' : 'text-texto2'}`}>
                  <input type="radio" name="condicion" value={c} checked={f.condicion === c} onChange={() => cambiarFactura({ condicion: c })} className="sr-only" />
                  {c === 'contado' ? 'Contado' : 'Crédito'}
                </label>
              ))}
            </div>
          </fieldset>
          {f.condicion === 'credito' ? (
            <CampoTexto etiqueta="Vence *" type="date" min={f.fechaFactura} value={f.fechaVencimiento} onChange={(e) => cambiarFactura({ fechaVencimiento: e.target.value })} />
          ) : null}
          <CampoTexto etiqueta="Notas" value={f.notas} onChange={(e) => cambiarFactura({ notas: e.target.value })} className={f.condicion === 'credito' ? '' : 'lg:col-span-2'} />
          <div className="text-sm">
            <span className="mb-1.5 block font-medium">Foto o PDF de la factura</span>
            <input
              ref={entradaArchivo}
              type="file"
              accept="application/pdf,image/*"
              aria-label="Foto o PDF de la factura"
              className="hidden"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
            <Boton type="button" variante="fantasma" onClick={() => entradaArchivo.current?.click()} className="w-full justify-start border border-borde">
              <Paperclip aria-hidden className="size-4" />
              <span className="truncate">{archivo ? archivo.name : 'Adjuntar'}</span>
            </Boton>
          </div>
        </div>
      </Tarjeta>

      <datalist id="opciones-referencia">
        {referencias.map((r) => <option key={r} value={r} />)}
      </datalist>
      <datalist id="opciones-color">
        {colores.map((c) => <option key={c} value={c} />)}
      </datalist>
      <datalist id="opciones-color-simple">
        {coloresSimples.map((c) => <option key={c} value={c} />)}
      </datalist>
      <datalist id="opciones-marca">
        {marcas.map((m) => <option key={m} value={m} />)}
      </datalist>

      {f.filas.map((fila, i) => (
        <FilaReferencia
          key={fila.id}
          fila={fila}
          indice={i}
          opcionesReferencia="opciones-referencia"
          opcionesMarca="opciones-marca"
          opcionesColor="opciones-color"
          opcionesColorSimple="opciones-color-simple"
          alCambiar={(nueva) => cambiarFila(fila.id, nueva)}
          alOtroColor={() => agregarOtroColor(fila)}
          alFoto={(url) => fijarFoto(fila.id, url)}
          alReconocer={() => reconocer(fila)}
          alQuitar={() => cambiarFactura({ filas: f.filas.length > 1 ? f.filas.filter((x) => x.id !== fila.id) : [filaVacia(nuevoId())] })}
          alSalirDeTalla={(talla, direccion) => moverEntreFilas(i, talla, direccion)}
        />
      ))}

      <Boton variante="fantasma" onClick={() => cambiarFactura({ filas: [...f.filas, filaVacia(nuevoId())] })} className="self-start border border-borde">
        <Plus aria-hidden className="size-4" />
        Agregar referencia
      </Boton>

      {intentoGuardar && errores.length ? (
        <div role="alert" className="rounded-xl bg-peligro-soft px-4 py-3 text-sm text-peligro-texto">
          <p className="font-semibold">Falta corregir:</p>
          <ul className="list-disc pl-5">{errores.map((e) => <li key={e}>{e}</li>)}</ul>
        </div>
      ) : null}

      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-borde bg-fondo/95 px-4 py-3 backdrop-blur lg:left-72">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-texto2">
            {resumen.referencias} referencia{resumen.referencias === 1 ? '' : 's'} · {resumen.unidades} pares · total{' '}
            <strong className="cifras text-lg text-texto">{pesos(resumen.total)}</strong>
            {avisos.length ? (
              <span className="ml-2 inline-flex items-center gap-1 text-advertencia-texto" title={avisos.join('\n')}>
                <AlertTriangle aria-hidden className="size-4" />
                {avisos.length} aviso{avisos.length === 1 ? '' : 's'}
              </span>
            ) : null}
          </p>
          <Boton
            onClick={() => { setIntentoGuardar(true); if (!errores.length) setRevisando(true) }}
            disabled={resumen.unidades === 0}
          >
            Revisar y guardar
          </Boton>
        </div>
      </div>

      {revisando ? (
        <Dialogo
          titulo="Confirmar compra"
          alCerrar={() => setRevisando(false)}
          pie={
            <>
              <Boton variante="fantasma" onClick={() => setRevisando(false)}>Volver</Boton>
              <Boton onClick={() => guardar.mutate()} cargando={guardar.isPending}>Guardar y subir stock</Boton>
            </>
          }
        >
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-texto3">Proveedor</dt><dd className="font-medium">{proveedor?.nombre}</dd>
            <dt className="text-texto3">Factura</dt><dd>{f.numeroFactura.trim() || 'Sin número'} · {new Date(`${f.fechaFactura}T12:00:00Z`).toLocaleDateString('es-CO', { timeZone: 'UTC' })}</dd>
            <dt className="text-texto3">Pago</dt><dd>{f.condicion === 'contado' ? 'Contado' : `Crédito, vence el ${new Date(`${f.fechaVencimiento}T12:00:00Z`).toLocaleDateString('es-CO', { timeZone: 'UTC' })}`}</dd>
            <dt className="text-texto3">Mercancía</dt><dd>{resumen.referencias} referencias · {resumen.unidades} pares</dd>
            <dt className="text-texto3">Inventario</dt>
            <dd>
              {resumen.tallasNuevas ? `${resumen.tallasNuevas} talla${resumen.tallasNuevas === 1 ? '' : 's'} nueva${resumen.tallasNuevas === 1 ? '' : 's'} se crea${resumen.tallasNuevas === 1 ? '' : 'n'}` : 'Sin tallas nuevas'}
              {resumen.preciosCambiados ? ` · ${resumen.preciosCambiados} cambio${resumen.preciosCambiados === 1 ? '' : 's'} de precio` : ''}
            </dd>
            <dt className="text-texto3">Total</dt><dd className="cifras text-lg font-bold">{pesos(resumen.total)}</dd>
            {archivo ? <><dt className="text-texto3">Adjunto</dt><dd className="truncate">{archivo.name}</dd></> : null}
          </dl>
          {avisos.length ? (
            <ul className="mt-4 list-disc rounded-xl bg-advertencia-soft py-2 pl-8 pr-3 text-sm text-advertencia-texto">
              {avisos.map((a) => <li key={a}>{a}</li>)}
            </ul>
          ) : null}
          {guardar.isError ? <div className="mt-4"><AvisoError error={guardar.error} /></div> : null}
          {guardar.isError ? <p className="mt-2 text-xs text-texto3">Si fue la conexión, vuelve a intentar: la compra no se duplica.</p> : null}
        </Dialogo>
      ) : null}
    </div>
  )
}

