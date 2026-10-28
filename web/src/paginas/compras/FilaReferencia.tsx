import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { Camera, CopyPlus, LoaderCircle, Scissors, Trash2, X } from 'lucide-react'
import { pesos } from '@shared/formato'
import { nombreFoto, urlMiniatura } from '@shared/fotos'
import { CATEGORIAS as CATEGORIAS_CALZADO } from '@shared/excel'
import { describirReferencia } from '@shared/referencias'
import {
  dividirRango, enRango, fotoDeFila, fotoDesactualizada, partesColor, subtotalFila, TALLAS, unidadesFila, unirColores, unirRango,
  type FilaFactura, type RangoPrecio,
} from '../../lib/compras'
import { paresSumados } from '@shared/cargaInicial'
import { subirFotoCatalogo } from '../../lib/datos/fotos'
import { referenciaParaModelo } from '../../lib/datos/inventario'
import { procesarFotoProducto, type AjusteRecorte } from '../../lib/imagen'
import { RecortarFoto } from '../../componentes/RecortarFoto'
import { Insignia, PuntoColor } from '../../componentes/ui'

// Las mismas de la app y la base (shared/excel.ts).
export const CATEGORIAS = CATEGORIAS_CALZADO.map((c) => ({ valor: c.valor, titulo: c.etiqueta }))

const entrada = 'w-full rounded-lg border border-borde bg-fondo px-2.5 py-1.5 text-sm outline-none focus:border-primario'
const soloDigitos = (t: string) => t.replace(/[^\d.]/g, '')

// Una referencia (mismo modelo y color) de la factura: datos, cantidades por
// talla (20–45) y costo/precios por rango de tallas. La Carga inicial la usa
// sin costo; en las tallas que ya existen muestra los pares que hay y lo escrito se suma.
export function FilaReferencia({
  fila, indice, opcionesDescripcion, opcionesMarca, referenciaHermana = '', opcionesColor, opcionesColorSimple,
  alCambiar, alReconocer, alQuitar, alOtroColor, alFoto, alSalirDeTalla,
  conCosto = true, sumarExistentes = false,
}: {
  fila: FilaFactura
  indice: number
  // Descripciones del inventario: escribir una reconoce el zapato y su referencia.
  opcionesDescripcion: string
  // La referencia de otra fila del mismo zapato (otro color escrito aparte).
  referenciaHermana?: string
  opcionesMarca: string
  // Colores ya usados (también los de dos, "Rojo y blanco") y los básicos.
  opcionesColor: string
  // Solo colores sueltos, para el segundo color.
  opcionesColorSimple: string
  alCambiar: (f: FilaFactura) => void
  alReconocer: () => void
  alQuitar: () => void
  alOtroColor: () => void
  alFoto: (url: string, referencia: string) => void
  alSalirDeTalla: (talla: string, direccion: 'abajo' | 'arriba') => void
  conCosto?: boolean
  // Carga inicial: en una talla que ya existe lo escrito se suma a su stock.
  sumarExistentes?: boolean
}) {
  // Los dos campos de color se editan tal cual se escriben; "Rojo y blanco"
  // escrito o elegido en el primero se reparte en los dos al salir del campo.
  const [color1, setColor1] = useState(() => partesColor(fila.color)[0])
  const [color2, setColor2] = useState(() => partesColor(fila.color)[1])
  useEffect(() => {
    // El color cambió desde fuera (reconocer, "Otro color"): se vuelve a partir.
    if (unirColores(color1, color2) === fila.color) return
    const [a, b] = partesColor(fila.color)
    setColor1(a)
    setColor2(b)
  }, [fila.color])
  const cambiarColor = (primero: string, segundo: string) => {
    setColor1(primero)
    setColor2(segundo)
    alCambiar({ ...fila, color: unirColores(primero, segundo) })
  }
  function salirDelColor() {
    if (!color2.trim()) {
      const [a, b] = partesColor(color1)
      if (b.trim()) {
        setColor1(a)
        setColor2(b)
      }
    }
    alReconocer()
  }
  const nuevas = TALLAS.filter((t) => Number(fila.cantidades[t]) > 0 && !fila.existentes[t]).length
  const conocida = Object.keys(fila.existentes).length > 0
  const campo = (clave: 'descripcion' | 'marca') => ({
    value: fila[clave],
    onChange: (e: { target: { value: string } }) => alCambiar({ ...fila, [clave]: e.target.value }),
  })
  const cambiarRango = (i: number, cambios: Partial<RangoPrecio>) =>
    alCambiar({ ...fila, rangos: fila.rangos.map((r, j) => (j === i ? { ...r, ...cambios } : r)) })

  function teclas(e: KeyboardEvent<HTMLInputElement>, talla: string) {
    const i = TALLAS.indexOf(talla)
    const mover = (destino: string | undefined) => {
      if (!destino) return
      e.preventDefault()
      document.getElementById(`talla-${fila.id}-${destino}`)?.focus()
    }
    if (e.key === 'ArrowRight') mover(TALLAS[i + 1])
    else if (e.key === 'ArrowLeft') mover(TALLAS[i - 1])
    else if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); alSalirDeTalla(talla, 'abajo') }
    else if (e.key === 'ArrowUp') { e.preventDefault(); alSalirDeTalla(talla, 'arriba') }
  }

  return (
    <section aria-label={`Referencia ${indice + 1}`} className="flex flex-col gap-3 rounded-2xl border border-borde bg-fondo p-4">
      <div className="flex flex-wrap items-end gap-2">
        <FotoColor fila={fila} indice={indice} referenciaHermana={referenciaHermana} alFoto={alFoto} />
        <label className="min-w-48 flex-1 text-xs text-texto3">
          Descripción
          <input {...campo('descripcion')} list={opcionesDescripcion} onBlur={alReconocer} aria-label={`Descripción de la fila ${indice + 1}`} className={entrada} />
        </label>
        <label className="w-32 text-xs text-texto3">
          Marca
          <input {...campo('marca')} list={opcionesMarca} onBlur={alReconocer} aria-label={`Marca de la fila ${indice + 1}`} className={entrada} />
        </label>
        <label className="w-32 text-xs text-texto3">
          <span className="flex items-center gap-1">Color {fila.color.trim() ? <PuntoColor color={fila.color} /> : null}</span>
          <input
            id={`color-${fila.id}`}
            value={color1}
            onChange={(e) => cambiarColor(e.target.value, color2)}
            list={opcionesColor}
            onBlur={salirDelColor}
            aria-label={`Color de la fila ${indice + 1}`}
            className={entrada}
          />
        </label>
        <label className="w-32 text-xs text-texto3">
          Segundo color
          <input
            value={color2}
            onChange={(e) => cambiarColor(color1, e.target.value)}
            list={opcionesColorSimple}
            onBlur={alReconocer}
            placeholder="Opcional"
            disabled={!color1.trim()}
            aria-label={`Segundo color de la fila ${indice + 1}`}
            className={`${entrada} disabled:opacity-50`}
          />
        </label>
        <label className="w-36 text-xs text-texto3">
          Categoría
          <select
            value={fila.categoria}
            onChange={(e) => alCambiar({ ...fila, categoria: e.target.value })}
            aria-label={`Categoría de la fila ${indice + 1}`}
            className={entrada}
          >
            <option value="">Elegir…</option>
            {CATEGORIAS.map((c) => <option key={c.valor} value={c.valor}>{c.titulo}</option>)}
          </select>
        </label>
        <div className="w-36 text-xs text-texto3">
          Referencia
          <p
            aria-label={`Referencia de la fila ${indice + 1}`}
            title={describirReferencia(fila.referencia) ?? 'La referencia se pone sola al guardar'}
            className="truncate py-1.5 text-sm text-texto"
          >
            {fila.referencia.trim() || <span className="text-texto3">Se pone sola</span>}
          </p>
        </div>
        <span className="pb-1.5">
          {conocida ? <Insignia>En inventario</Insignia> : fila.descripcion.trim() ? <Insignia tono="primario">Nueva</Insignia> : null}
        </span>
        <button
          type="button"
          onClick={alOtroColor}
          title="Agrega debajo la misma referencia con otro color: copia descripción, marca, categoría, costo y precios"
          className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-borde px-2.5 py-1.5 text-xs font-semibold text-texto2 hover:bg-superficie2 hover:text-texto"
        >
          <CopyPlus aria-hidden className="size-4" />
          Otro color
        </button>
        <button
          type="button"
          aria-label={`Quitar la fila ${indice + 1}`}
          onClick={alQuitar}
          className="rounded-lg p-1.5 text-texto3 hover:bg-peligro-soft hover:text-peligro-texto"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div>
        <p className="mb-1 text-xs text-texto3">
          Cantidad por talla{nuevas ? <> · <span className="text-primario">{nuevas} talla{nuevas === 1 ? '' : 's'} nueva{nuevas === 1 ? '' : 's'}</span></> : null}
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-1">
          {TALLAS.map((t) => {
            const existente = fila.existentes[t]
            // En la Carga inicial una talla ya cargada muestra debajo los pares
            // que tiene; lo que se escriba se suma.
            const suma = sumarExistentes && !!existente
            return (
              <label key={t} className="flex flex-col items-center gap-0.5">
                <span className={`text-xs ${existente ? 'font-semibold text-texto' : 'text-texto3'}`} title={existente ? 'Ya existe en el inventario' : 'Talla nueva'}>
                  {t}
                </span>
                <input
                  id={`talla-${fila.id}-${t}`}
                  aria-label={`Talla ${t} de la fila ${indice + 1}`}
                  inputMode="numeric"
                  placeholder={suma ? '+' : undefined}
                  title={suma ? `Ya hay ${existente.stock ?? 0} pares: lo que escribas se suma.` : undefined}
                  value={fila.cantidades[t] ?? ''}
                  onChange={(e) => alCambiar({ ...fila, cantidades: { ...fila.cantidades, [t]: e.target.value.replace(/[^\d]/g, '') } })}
                  onKeyDown={(e) => teclas(e, t)}
                  onFocus={(e) => e.target.select()}
                  className={`cifras w-full rounded-md border px-1 py-1 text-center text-sm outline-none focus:border-primario ${
                    Number(fila.cantidades[t]) > 0 ? 'border-primario bg-primario-soft font-semibold' : suma ? 'border-borde bg-superficie2' : 'border-borde bg-fondo'
                  }`}
                />
                {suma ? <span className="cifras text-[10px] leading-none text-texto3" title="Pares que ya hay">hay {existente.stock ?? 0}</span> : null}
              </label>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-texto3">{conCosto ? 'Costo y precios por rango de tallas' : 'Precios por rango de tallas'}</p>
        {fila.rangos.map((r, i) => {
          const usadas = TALLAS.filter((t) => enRango(r, t) && Number(fila.cantidades[t]) > 0)
          const posibles = TALLAS.filter((t) => enRango(r, t) && t !== r.desde)
          return (
            <div key={`${r.desde}-${r.hasta}`} className="flex flex-wrap items-end gap-2 rounded-xl bg-superficie px-3 py-2">
              <span className="w-28 pb-1.5 text-sm font-medium">
                {r.desde === r.hasta ? `Talla ${r.desde}` : `Tallas ${r.desde}–${r.hasta}`}
                <span className="block text-xs font-normal text-texto3">{usadas.length ? `${usadas.length} con cantidad` : 'sin cantidades'}</span>
              </span>
              {(conCosto ? (['costo', 'minimo', 'maximo'] as const) : (['minimo', 'maximo'] as const)).map((c) => (
                <label key={c} className="w-32 text-xs text-texto3">
                  {c === 'costo' ? 'Costo' : c === 'minimo' ? 'Precio mínimo' : 'Precio máximo'}
                  <input
                    value={r[c]}
                    inputMode="numeric"
                    onChange={(e) => cambiarRango(i, { [c]: soloDigitos(e.target.value) })}
                    aria-label={`${c === 'costo' ? 'Costo' : c === 'minimo' ? 'Precio mínimo' : 'Precio máximo'} tallas ${r.desde}–${r.hasta} de la fila ${indice + 1}`}
                    className={`cifras ${entrada}`}
                  />
                </label>
              ))}
              {posibles.length ? (
                <label className="text-xs text-texto3">
                  <span className="flex items-center gap-1"><Scissors aria-hidden className="size-3" /> Precio distinto desde</span>
                  <select
                    value=""
                    aria-label={`Dividir tallas ${r.desde}–${r.hasta} de la fila ${indice + 1}`}
                    onChange={(e) => e.target.value && alCambiar(dividirRango(fila, e.target.value))}
                    className={entrada}
                  >
                    <option value="">talla…</option>
                    {posibles.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </label>
              ) : null}
              {fila.rangos.length > 1 ? (
                <button
                  type="button"
                  aria-label={`Quitar el rango ${r.desde}–${r.hasta} de la fila ${indice + 1}`}
                  onClick={() => alCambiar(unirRango(fila, i))}
                  className="mb-1 rounded-lg p-1.5 text-texto3 hover:bg-superficie2 hover:text-texto"
                  title="Unir con el rango vecino"
                >
                  <X className="size-4" />
                </button>
              ) : null}
            </div>
          )
        })}
      </div>

      <p className="text-right text-sm text-texto2">
        {unidadesFila(fila)} pares{sumarExistentes && paresSumados(fila) ? ` (${paresSumados(fila)} se suman a lo que hay)` : ''}
        {conCosto ? <> · subtotal <strong className="cifras text-texto">{pesos(subtotalFila(fila))}</strong></> : null}
      </p>
    </section>
  )
}

// Foto de esta referencia y color. Se elige (o se arrastra encima), se encuadra
// y se sube recortada y liviana con el nombre de la referencia y el color; al
// guardar queda en todas sus tallas. Si ya tenía, se muestra esa.
function FotoColor({ fila, indice, referenciaHermana, alFoto }: {
  fila: FilaFactura
  indice: number
  referenciaHermana: string
  alFoto: (url: string, referencia: string) => void
}) {
  const entradaArchivo = useRef<HTMLInputElement>(null)
  const [archivo, setArchivo] = useState<File | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const foto = fotoDeFila(fila)
  // La foto se nombra con la referencia y el color; un zapato nuevo aparta la
  // suya, que la base arma con la descripción, la marca y la categoría.
  const puede = !!fila.referencia.trim() || (!!fila.descripcion.trim() && !!fila.categoria)
  const vieja = fotoDesactualizada(fila)

  function elegir(elegido: File | undefined) {
    if (entradaArchivo.current) entradaArchivo.current.value = ''
    if (!elegido) return
    if (!elegido.type.startsWith('image/')) {
      setError('Ese archivo no es una imagen.')
      return
    }
    setError(null)
    setArchivo(elegido)
  }

  async function usar(ajuste: AjusteRecorte) {
    const elegido = archivo
    setArchivo(null)
    if (!elegido || !puede) return
    setSubiendo(true)
    try {
      const referencia = fila.referencia.trim() || referenciaHermana
        || await referenciaParaModelo(fila.descripcion, fila.marca, fila.categoria)
      const nombre = nombreFoto(referencia, fila.descripcion, fila.color)!
      alFoto(await subirFotoCatalogo(nombre, await procesarFotoProducto(elegido, ajuste)), referencia)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo subir la foto.')
    } finally {
      setSubiendo(false)
    }
  }

  function soltar(e: DragEvent<HTMLButtonElement>) {
    e.preventDefault()
    if (puede && !subiendo) elegir(e.dataTransfer.files[0])
  }

  const titulo = !puede
    ? 'Escribe la descripción y elige la categoría para poner la foto'
    : error ?? (vieja ? 'Cambiaste la referencia o el color: vuelve a poner la foto' : foto ? 'Cambiar la foto de este color (o arrastra otra aquí)' : 'Agregar la foto de este color (o arrastra una aquí)')

  return (
    <div className="flex flex-col items-center gap-0.5">
      <input
        ref={entradaArchivo}
        type="file"
        accept="image/*"
        aria-label={`Foto de la fila ${indice + 1}`}
        className="hidden"
        disabled={!puede}
        onChange={(e) => elegir(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => entradaArchivo.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={soltar}
        disabled={!puede || subiendo}
        title={titulo}
        className={`relative flex size-16 items-center justify-center overflow-hidden rounded-xl border bg-superficie2 text-texto3 hover:border-borde-fuerte disabled:cursor-not-allowed disabled:opacity-60 ${error || vieja ? 'border-peligro' : 'border-borde'}`}
      >
        {foto ? <img src={urlMiniatura(foto) ?? foto} alt="" className="size-full object-cover" /> : <Camera aria-hidden className="size-5" />}
        {subiendo ? (
          <span className="absolute inset-0 flex items-center justify-center bg-overlay">
            <LoaderCircle aria-hidden className="size-5 animate-spin text-white" />
          </span>
        ) : null}
      </button>
      <span className={`text-[10px] ${error || vieja ? 'text-peligro-texto' : 'text-texto3'}`}>
        {subiendo ? 'Subiendo…' : error ? 'No se subió' : vieja ? 'Vuelve a ponerla' : fila.foto ? 'Foto nueva' : foto ? 'Foto' : 'Sin foto'}
      </span>
      {archivo && puede ? (
        <RecortarFoto
          archivo={archivo}
          nombre={fila.referencia.trim() ? `${nombreFoto(fila.referencia, fila.descripcion, fila.color)}.webp` : 'la referencia nueva y el color'}
          alUsar={usar}
          alCancelar={() => setArchivo(null)}
        />
      ) : null}
    </div>
  )
}
