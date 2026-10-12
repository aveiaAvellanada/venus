import { type KeyboardEvent } from 'react'
import { Scissors, Trash2, X } from 'lucide-react'
import { pesos } from '@shared/formato'
import {
  dividirRango, enRango, subtotalFila, TALLAS, unidadesFila, unirRango, type FilaFactura, type RangoPrecio,
} from '../../lib/compras'
import { Insignia } from '../../componentes/ui'

export const CATEGORIAS = [
  { valor: 'Chanclas', titulo: 'Chanclas' },
  { valor: 'Escolar', titulo: 'Escolar' },
  { valor: 'Botas caucho', titulo: 'Botas caucho' },
  { valor: 'Deportivo', titulo: 'Deportivo' },
  { valor: 'Tennis', titulo: 'Tennis' },
  { valor: 'Clasico', titulo: 'Clásico' },
  { valor: 'Otros', titulo: 'Otros' },
]

const entrada = 'w-full rounded-lg border border-borde bg-fondo px-2.5 py-1.5 text-sm outline-none focus:border-primario'
const soloDigitos = (t: string) => t.replace(/[^\d.]/g, '')

// Una referencia (mismo modelo y color) de la factura: datos, cantidades por
// talla (20–45) y costo/precios por rango de tallas.
export function FilaReferencia({ fila, indice, opcionesReferencia, opcionesColor, alCambiar, alReconocer, alQuitar, alSalirDeTalla }: {
  fila: FilaFactura
  indice: number
  opcionesReferencia: string
  opcionesColor: string
  alCambiar: (f: FilaFactura) => void
  alReconocer: () => void
  alQuitar: () => void
  alSalirDeTalla: (talla: string, direccion: 'abajo' | 'arriba') => void
}) {
  const nuevas = TALLAS.filter((t) => Number(fila.cantidades[t]) > 0 && !fila.existentes[t]).length
  const conocida = Object.keys(fila.existentes).length > 0
  const campo = (clave: 'referencia' | 'descripcion' | 'marca' | 'color') => ({
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
        <label className="w-36 text-xs text-texto3">
          Referencia
          <input {...campo('referencia')} list={opcionesReferencia} onBlur={alReconocer} aria-label={`Referencia de la fila ${indice + 1}`} className={entrada} />
        </label>
        <label className="w-32 text-xs text-texto3">
          Color
          <input {...campo('color')} list={opcionesColor} onBlur={alReconocer} aria-label={`Color de la fila ${indice + 1}`} className={entrada} />
        </label>
        <label className="min-w-48 flex-1 text-xs text-texto3">
          Descripción
          <input {...campo('descripcion')} aria-label={`Descripción de la fila ${indice + 1}`} className={entrada} />
        </label>
        <label className="w-32 text-xs text-texto3">
          Marca
          <input {...campo('marca')} aria-label={`Marca de la fila ${indice + 1}`} className={entrada} />
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
        <span className="pb-1.5">
          {conocida ? <Insignia>En inventario</Insignia> : fila.referencia.trim() ? <Insignia tono="primario">Nueva</Insignia> : null}
        </span>
        <button
          type="button"
          aria-label={`Quitar la fila ${indice + 1}`}
          onClick={alQuitar}
          className="ml-auto rounded-lg p-1.5 text-texto3 hover:bg-peligro-soft hover:text-peligro-texto"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      <div>
        <p className="mb-1 text-xs text-texto3">
          Cantidad por talla{nuevas ? <> · <span className="text-primario">{nuevas} talla{nuevas === 1 ? '' : 's'} nueva{nuevas === 1 ? '' : 's'}</span></> : null}
        </p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(3rem,1fr))] gap-1">
          {TALLAS.map((t) => (
            <label key={t} className="flex flex-col items-center gap-0.5">
              <span className={`text-xs ${fila.existentes[t] ? 'font-semibold text-texto' : 'text-texto3'}`} title={fila.existentes[t] ? 'Ya existe en el inventario' : 'Talla nueva'}>
                {t}
              </span>
              <input
                id={`talla-${fila.id}-${t}`}
                aria-label={`Talla ${t} de la fila ${indice + 1}`}
                inputMode="numeric"
                value={fila.cantidades[t] ?? ''}
                onChange={(e) => alCambiar({ ...fila, cantidades: { ...fila.cantidades, [t]: e.target.value.replace(/[^\d]/g, '') } })}
                onKeyDown={(e) => teclas(e, t)}
                onFocus={(e) => e.target.select()}
                className={`cifras w-full rounded-md border px-1 py-1 text-center text-sm outline-none focus:border-primario ${Number(fila.cantidades[t]) > 0 ? 'border-primario bg-primario-soft font-semibold' : 'border-borde bg-fondo'}`}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs text-texto3">Costo y precios por rango de tallas</p>
        {fila.rangos.map((r, i) => {
          const usadas = TALLAS.filter((t) => enRango(r, t) && Number(fila.cantidades[t]) > 0)
          const posibles = TALLAS.filter((t) => enRango(r, t) && t !== r.desde)
          return (
            <div key={`${r.desde}-${r.hasta}`} className="flex flex-wrap items-end gap-2 rounded-xl bg-superficie px-3 py-2">
              <span className="w-28 pb-1.5 text-sm font-medium">
                {r.desde === r.hasta ? `Talla ${r.desde}` : `Tallas ${r.desde}–${r.hasta}`}
                <span className="block text-xs font-normal text-texto3">{usadas.length ? `${usadas.length} con cantidad` : 'sin cantidades'}</span>
              </span>
              {(['costo', 'minimo', 'maximo'] as const).map((c) => (
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
        {unidadesFila(fila)} pares · subtotal <strong className="cifras text-texto">{pesos(subtotalFila(fila))}</strong>
      </p>
    </section>
  )
}
