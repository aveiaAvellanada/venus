import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Plus } from 'lucide-react'
import {
  avisosCargaInicial, erroresCargaInicial, filasParaCargar, resumenCargaInicial,
} from '@shared/cargaInicial'
import { filaVacia, otroColor, type FilaFactura } from '../../lib/compras'
import { cargarInventario, type ResultadoCarga } from '../../lib/datos/carga'
import { listarCalzado } from '../../lib/datos/inventario'
import { nuevoId } from '../../lib/id'
import { AvisoError, Boton, Cargando, Dialogo, Tarjeta } from '../../componentes/ui'
import { reconocerFila, useCatalogo } from '../compras/catalogo'
import { FilaReferencia } from '../compras/FilaReferencia'

const BORRADOR = 'panel-carga-inicial-borrador'
const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

function leerBorrador(): FilaFactura[] {
  try {
    const guardado = localStorage.getItem(BORRADOR)
    if (guardado) return JSON.parse(guardado) as FilaFactura[]
  } catch {
    // borrador ilegible: se empieza de cero
  }
  return [filaVacia(nuevoId())]
}

// Carga inicial: la mercancía que ya está en la tienda, sin proveedor ni costo.
// Una fila por referencia y color con la cantidad de cada talla, sus precios y
// su foto. Se guarda todo junto (cargar_inventario); lo que ya estaba cargado
// no cambia su stock.
export function CargaInicial() {
  const cliente = useQueryClient()
  const [filas, setFilas] = useState<FilaFactura[]>(leerBorrador)
  const [revisando, setRevisando] = useState(false)
  const [intentoGuardar, setIntentoGuardar] = useState(false)
  const [listo, setListo] = useState<ResultadoCarga | null>(null)

  // El borrador vive en este navegador: se puede seguir otro día.
  useEffect(() => {
    try { localStorage.setItem(BORRADOR, JSON.stringify(filas)) } catch { /* sin espacio: se sigue sin borrador */ }
  }, [filas])

  const inventario = useQuery({ queryKey: ['inventario'], queryFn: listarCalzado })
  const { conocidas, modelos, descripciones, marcas, colores, coloresSimples } = useCatalogo(inventario.data)

  const cambiarFila = (id: string, fila: FilaFactura) => setFilas((fs) => fs.map((x) => (x.id === id ? fila : x)))
  // La foto llega cuando termina de subir: se pone sobre la fila como esté en ese momento.
  const fijarFoto = (id: string, foto: string, referencia: string) =>
    setFilas((fs) => fs.map((x) => (x.id === id ? { ...x, foto, referencia } : x)))
  function reconocer(fila: FilaFactura) {
    const nueva = reconocerFila(fila, conocidas, modelos)
    if (nueva !== fila) cambiarFila(fila.id, nueva)
  }
  // "Otro color": la misma referencia justo debajo, lista para escribir el color.
  function agregarOtroColor(fila: FilaFactura) {
    const nueva = otroColor(fila, nuevoId())
    setFilas((fs) => {
      const copia = [...fs]
      copia.splice(copia.findIndex((x) => x.id === fila.id) + 1, 0, nueva)
      return copia
    })
    setTimeout(() => document.getElementById(`color-${nueva.id}`)?.focus(), 0)
  }
  function moverEntreFilas(indice: number, talla: string, direccion: 'abajo' | 'arriba') {
    const destino = filas[indice + (direccion === 'abajo' ? 1 : -1)]
    if (destino) document.getElementById(`talla-${destino.id}-${talla}`)?.focus()
    else if (direccion === 'abajo') {
      const nueva = filaVacia(nuevoId())
      setFilas((fs) => [...fs, nueva])
      setTimeout(() => document.getElementById(`talla-${nueva.id}-${talla}`)?.focus(), 0)
    }
  }

  const resumen = resumenCargaInicial(filas)
  const errores = erroresCargaInicial(filas)
  const avisos = avisosCargaInicial(filas)

  const guardar = useMutation({
    mutationFn: () => cargarInventario(filasParaCargar(filas), null),
    onSuccess: async (r) => {
      try { localStorage.removeItem(BORRADOR) } catch { /* nada */ }
      setRevisando(false)
      setListo(r)
      setFilas([filaVacia(nuevoId())])
      setIntentoGuardar(false)
      await cliente.invalidateQueries({ queryKey: ['inventario'] })
    },
  })

  function descartar() {
    if (!window.confirm('¿Descartar lo que llevas? Se borra el borrador (las fotos ya subidas quedan guardadas).')) return
    try { localStorage.removeItem(BORRADOR) } catch { /* nada */ }
    setFilas([filaVacia(nuevoId())])
    setIntentoGuardar(false)
  }

  if (inventario.isPending) return <Cargando />

  return (
    <div className="flex flex-col gap-5 pb-28">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-titulo">Carga inicial</h1>
          <p className="text-texto2">
            Los zapatos que ya están en la tienda: una fila por referencia y color, con los pares de cada talla, el precio y la foto.
          </p>
        </div>
        <Boton variante="fantasma" onClick={descartar}>Descartar borrador</Boton>
      </header>

      {listo ? (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-xl bg-exito-soft px-4 py-3 text-sm text-exito-texto">
          <CheckCircle2 aria-hidden className="size-5" />
          <span className="flex-1">
            Guardado: {plural(listo.creados, 'talla nueva', 'tallas nuevas')}
            {listo.actualizados ? `, ${plural(listo.actualizados, 'talla actualizada', 'tallas actualizadas')}` : ''}. Sigue con la siguiente tanda.
          </span>
          <Link to="/inventario" className="font-semibold underline">Ver inventario</Link>
        </div>
      ) : null}

      <Tarjeta titulo="Así funciona">
        <ul className="list-disc space-y-1 pl-5 text-sm text-texto2">
          <li>Escribe la descripción, la marca y el color: si el zapato ya existe se reconoce solo, y si es nuevo la referencia se pone sola. Las flechas y Enter mueven entre tallas y filas.</li>
          <li><strong>Foto:</strong> toca la cámara o arrastra la foto encima. La encuadras en cuadrado y se guarda liviana con el nombre de la referencia y el color, en todas sus tallas.</li>
          <li><strong>Otro color</strong> copia la referencia con sus precios para escribir solo el color, las cantidades y su foto.</li>
          <li>Lo que ya está cargado aparece en gris con su stock y no cambia aquí; para corregir un stock usa <Link to="/conteo" className="font-semibold underline">Conteo físico</Link>.</li>
          <li>El borrador se guarda en este navegador: puedes cerrar y seguir otro día. Conviene guardar por tandas (por ejemplo, una caja o una categoría).</li>
        </ul>
      </Tarjeta>

      <datalist id="opciones-descripcion">
        {descripciones.map((d) => <option key={d} value={d} />)}
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

      {filas.map((fila, i) => (
        <FilaReferencia
          key={fila.id}
          fila={fila}
          indice={i}
          conCosto={false}
          bloquearExistentes
          opcionesDescripcion="opciones-descripcion"
          opcionesMarca="opciones-marca"
          opcionesColor="opciones-color"
          opcionesColorSimple="opciones-color-simple"
          alCambiar={(nueva) => cambiarFila(fila.id, nueva)}
          alOtroColor={() => agregarOtroColor(fila)}
          alFoto={(url, referencia) => fijarFoto(fila.id, url, referencia)}
          alReconocer={() => reconocer(fila)}
          alQuitar={() => setFilas((fs) => (fs.length > 1 ? fs.filter((x) => x.id !== fila.id) : [filaVacia(nuevoId())]))}
          alSalirDeTalla={(talla, direccion) => moverEntreFilas(i, talla, direccion)}
        />
      ))}

      <Boton variante="fantasma" onClick={() => setFilas((fs) => [...fs, filaVacia(nuevoId())])} className="self-start border border-borde">
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
            {plural(resumen.referencias, 'referencia', 'referencias')} · {plural(resumen.tallasNuevas, 'talla nueva', 'tallas nuevas')} ·{' '}
            <strong className="cifras text-lg text-texto">{resumen.pares}</strong> pares · {plural(resumen.fotos, 'foto', 'fotos')}
            {avisos.length ? (
              <span className="ml-2 inline-flex items-center gap-1 text-advertencia-texto" title={avisos.join('\n')}>
                <AlertTriangle aria-hidden className="size-4" />
                {plural(avisos.length, 'aviso', 'avisos')}
              </span>
            ) : null}
          </p>
          <Boton onClick={() => { setIntentoGuardar(true); setListo(null); if (!errores.length) setRevisando(true) }} disabled={!resumen.referencias}>
            Revisar y guardar
          </Boton>
        </div>
      </div>

      {revisando ? (
        <Dialogo
          titulo="Confirmar carga"
          alCerrar={() => setRevisando(false)}
          pie={
            <>
              <Boton variante="fantasma" onClick={() => setRevisando(false)}>Volver</Boton>
              <Boton onClick={() => guardar.mutate()} cargando={guardar.isPending}>Guardar en el inventario</Boton>
            </>
          }
        >
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
            <dt className="text-texto3">Referencias</dt><dd className="font-medium">{resumen.referencias} (contando cada color)</dd>
            <dt className="text-texto3">Tallas nuevas</dt><dd>{resumen.tallasNuevas}</dd>
            <dt className="text-texto3">Pares</dt><dd className="cifras text-lg font-bold">{resumen.pares}</dd>
            <dt className="text-texto3">Fotos</dt><dd>{resumen.fotos}</dd>
          </dl>
          {avisos.length ? (
            <ul className="mt-4 list-disc rounded-xl bg-advertencia-soft py-2 pl-8 pr-3 text-sm text-advertencia-texto">
              {avisos.map((a) => <li key={a}>{a}</li>)}
            </ul>
          ) : null}
          {guardar.isError ? <div className="mt-4"><AvisoError error={guardar.error} /></div> : null}
          {guardar.isError ? <p className="mt-2 text-xs text-texto3">Si fue la conexión, vuelve a intentar: no se duplica nada.</p> : null}
        </Dialogo>
      ) : null}
    </div>
  )
}
