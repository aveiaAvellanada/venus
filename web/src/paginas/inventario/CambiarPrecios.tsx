import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowRight, X } from 'lucide-react'
import { pesos } from '@shared/formato'
import { cambiarPrecios, type CamposPrecio, type ReglaPrecio, type ResultadoPrecios } from '../../lib/datos/inventario'
import { Boton, Insignia } from '../../componentes/ui'

type Tipo = 'porcentaje' | 'suma' | 'fijo'

const TIPOS: { valor: Tipo; titulo: string }[] = [
  { valor: 'porcentaje', titulo: 'Subir o bajar %' },
  { valor: 'suma', titulo: 'Sumar o restar $' },
  { valor: 'fijo', titulo: 'Precio fijo' },
]

export function construirRegla(f: {
  tipo: Tipo; valor: string; minimo: string; maximo: string; campos: CamposPrecio; redondeo: number; motivo: string
}): ReglaPrecio | null {
  // Pesos: el punto separa miles ("50.000"). Porcentaje: punto o coma decimal ("2.5", "2,5").
  const num = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(/\./g, '').replace(',', '.')))
  const porcentaje = (s: string) => (s.trim() === '' ? NaN : Number(s.replace(',', '.')))
  const motivo = f.motivo.trim() || undefined
  if (f.tipo === 'fijo') {
    const minimo = num(f.minimo)
    const maximo = num(f.maximo)
    if (f.campos !== 'maximo' && Number.isNaN(minimo)) return null
    if (f.campos !== 'minimo' && Number.isNaN(maximo)) return null
    return {
      tipo: 'fijo', campos: f.campos, redondeo: f.redondeo, motivo,
      ...(f.campos !== 'maximo' ? { minimo } : {}),
      ...(f.campos !== 'minimo' ? { maximo } : {}),
    }
  }
  const valor = f.tipo === 'porcentaje' ? porcentaje(f.valor) : num(f.valor)
  if (Number.isNaN(valor) || valor === 0) return null
  return { tipo: f.tipo, valor, campos: f.campos, redondeo: f.redondeo, motivo }
}

export function CambiarPrecios({ ids, alCerrar, alAplicar }: { ids: string[]; alCerrar: () => void; alAplicar: () => void }) {
  const cliente = useQueryClient()
  const [tipo, setTipo] = useState<Tipo>('porcentaje')
  const [valor, setValor] = useState('')
  const [minimo, setMinimo] = useState('')
  const [maximo, setMaximo] = useState('')
  const [campos, setCampos] = useState<CamposPrecio>('ambos')
  const [redondeo, setRedondeo] = useState(1000)
  const [motivo, setMotivo] = useState('')
  const [vista, setVista] = useState<ResultadoPrecios | null>(null)

  const regla = construirRegla({ tipo, valor, minimo, maximo, campos, redondeo, motivo })

  const previa = useMutation({
    mutationFn: (r: ReglaPrecio) => cambiarPrecios(ids, r, false),
    onSuccess: setVista,
  })
  const aplicar = useMutation({
    mutationFn: (r: ReglaPrecio) => cambiarPrecios(ids, r, true),
    onSuccess: async () => {
      await cliente.invalidateQueries({ queryKey: ['inventario'] })
      alAplicar()
    },
  })

  function verPrevia(e: FormEvent) {
    e.preventDefault()
    if (regla) previa.mutate(regla)
  }

  // Cualquier cambio en la regla invalida la vista previa.
  const cambiar = <T,>(fijar: (v: T) => void) => (v: T) => { fijar(v); setVista(null) }

  const cambian = vista?.filas.filter((f) => Number(f.min_nuevo) !== Number(f.min_antes) || Number(f.max_nuevo) !== Number(f.max_antes)).length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 px-4 py-[6vh]" onMouseDown={alCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-precios"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && alCerrar()}
        className="w-full max-w-3xl rounded-2xl border border-borde bg-fondo shadow-2xl"
      >
        <header className="flex items-center justify-between border-b border-borde px-5 py-4">
          <h2 id="titulo-precios" className="text-lg font-semibold">Cambiar precios de {ids.length} talla{ids.length === 1 ? '' : 's'}</h2>
          <button aria-label="Cerrar" onClick={alCerrar} className="rounded-lg p-1.5 text-texto3 hover:bg-superficie2"><X className="size-5" /></button>
        </header>

        <form onSubmit={verPrevia} className="grid gap-4 px-5 py-4 sm:grid-cols-2">
          <fieldset className="sm:col-span-2">
            <legend className="mb-1.5 text-sm font-medium">Regla</legend>
            <div className="flex flex-wrap gap-2">
              {TIPOS.map((t) => (
                <label key={t.valor} className={`cursor-pointer rounded-xl border px-3 py-2 text-sm ${tipo === t.valor ? 'border-primario bg-primario-soft text-primario' : 'border-borde'}`}>
                  <input type="radio" name="tipo" value={t.valor} checked={tipo === t.valor} onChange={() => cambiar(setTipo)(t.valor)} className="sr-only" />
                  {t.titulo}
                </label>
              ))}
            </div>
          </fieldset>

          {tipo === 'fijo' ? (
            <>
              {campos !== 'maximo' ? <Campo etiqueta="Precio mínimo" valor={minimo} alCambiar={cambiar(setMinimo)} /> : null}
              {campos !== 'minimo' ? <Campo etiqueta="Precio máximo" valor={maximo} alCambiar={cambiar(setMaximo)} /> : null}
            </>
          ) : (
            <Campo
              etiqueta={tipo === 'porcentaje' ? 'Porcentaje (negativo para bajar)' : 'Valor en pesos (negativo para restar)'}
              valor={valor}
              alCambiar={cambiar(setValor)}
            />
          )}

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Aplicar a</span>
            <select value={campos} onChange={(e) => cambiar(setCampos)(e.target.value as CamposPrecio)} className="w-full rounded-xl border border-borde bg-fondo px-3 py-2">
              <option value="ambos">Mínimo y máximo</option>
              <option value="minimo">Solo el mínimo</option>
              <option value="maximo">Solo el máximo</option>
            </select>
          </label>

          <label className="block text-sm">
            <span className="mb-1.5 block font-medium">Redondear a</span>
            <select value={redondeo} onChange={(e) => cambiar(setRedondeo)(Number(e.target.value))} className="w-full rounded-xl border border-borde bg-fondo px-3 py-2">
              <option value={0}>Sin redondeo</option>
              <option value={500}>$500</option>
              <option value={1000}>$1.000</option>
              <option value={5000}>$5.000</option>
            </select>
          </label>

          <label className="block text-sm sm:col-span-2">
            <span className="mb-1.5 block font-medium">Motivo (queda en el historial)</span>
            <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej.: temporada escolar" className="w-full rounded-xl border border-borde bg-fondo px-3 py-2" />
          </label>

          <div className="sm:col-span-2">
            <Boton type="submit" variante="fantasma" disabled={!regla} cargando={previa.isPending} className="border border-borde">
              Ver cómo quedan
            </Boton>
          </div>
        </form>

        {previa.isError ? <p role="alert" className="mx-5 mb-4 rounded-xl bg-peligro-soft px-3 py-2 text-sm text-peligro-texto">{previa.error.message}</p> : null}

        {vista ? (
          <div className="border-t border-borde px-5 py-4">
            <p className="mb-3 text-sm text-texto2">
              Cambian <strong>{cambian}</strong> de {vista.filas.length}.
              {vista.invalidos ? <> <Insignia tono="peligro">{vista.invalidos} con mínimo mayor que el máximo</Insignia></> : null}
            </p>
            <div className="max-h-72 overflow-y-auto rounded-xl border border-borde">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-superficie text-left text-xs text-texto3">
                  <tr><th className="px-3 py-2 font-medium">Producto</th><th className="px-3 py-2 text-right font-medium">Antes</th><th /><th className="px-3 py-2 text-right font-medium">Después</th></tr>
                </thead>
                <tbody>
                  {vista.filas.map((f) => (
                    <tr key={f.id} className={`border-t border-borde ${f.valido ? '' : 'bg-peligro-soft text-peligro-texto'}`}>
                      <td className="px-3 py-1.5">{f.referencia ?? f.descripcion} · talla {f.talla ?? 'única'}</td>
                      <td className="cifras px-3 py-1.5 text-right text-texto2">{pesos(f.min_antes)} – {pesos(f.max_antes)}</td>
                      <td className="text-texto3"><ArrowRight aria-hidden className="size-3.5" /></td>
                      <td className="cifras px-3 py-1.5 text-right font-medium">{pesos(f.min_nuevo)} – {pesos(f.max_nuevo)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {aplicar.isError ? <p role="alert" className="mx-5 mb-4 rounded-xl bg-peligro-soft px-3 py-2 text-sm text-peligro-texto">{aplicar.error.message}</p> : null}

        <footer className="flex justify-end gap-2 border-t border-borde px-5 py-4">
          <Boton variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
          <Boton
            onClick={() => regla && aplicar.mutate(regla)}
            disabled={!vista || vista.invalidos > 0 || cambian === 0}
            cargando={aplicar.isPending}
          >
            Aplicar a {cambian} talla{cambian === 1 ? '' : 's'}
          </Boton>
        </footer>
      </div>
    </div>
  )
}

function Campo({ etiqueta, valor, alCambiar }: { etiqueta: string; valor: string; alCambiar: (v: string) => void }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 block font-medium">{etiqueta}</span>
      <input
        value={valor}
        onChange={(e) => alCambiar(e.target.value.replace(/[^\d,.-]/g, ''))}
        inputMode="decimal"
        className="cifras w-full rounded-xl border border-borde bg-fondo px-3 py-2"
      />
    </label>
  )
}
