import { useState } from 'react'
import { pesos } from '@shared/formato'
import {
  cambiarMotivo, MOTIVOS, motivoParaTodas, nombreTalla,
  type BorradorConteo, type Linea, type Motivo, type ResumenConteo,
} from '../../lib/conteo'
import { AvisoError, Boton, Dialogo } from '../../componentes/ui'

const entrada = 'w-full rounded-lg border border-borde bg-fondo px-2 py-1 text-sm outline-none focus:border-primario'

// Antes de ajustar: el resumen, el motivo de cada diferencia y la nota del conteo.
export function RevisarConteo({ alcance, borrador, lineas, resumen: r, valor, errores, guardando, error, alCambiar, alConfirmar, alCerrar }: {
  alcance: string
  borrador: BorradorConteo
  lineas: Linea[]
  resumen: ResumenConteo
  valor: { sobrante: number; faltante: number; sinCosto: number } | null
  errores: string[]
  guardando: boolean
  error: unknown
  alCambiar: (b: BorradorConteo) => void
  alConfirmar: () => void
  alCerrar: () => void
}) {
  const [intento, setIntento] = useState(false)
  const [paraTodas, setParaTodas] = useState<Motivo | ''>('')
  const diferencias = lineas.filter((l) => l.diferencia !== 0)

  function confirmar() {
    setIntento(true)
    if (!errores.length) alConfirmar()
  }

  return (
    <Dialogo
      titulo="Confirmar conteo"
      ancho="max-w-4xl"
      alCerrar={alCerrar}
      pie={
        <>
          <Boton variante="fantasma" onClick={alCerrar}>Seguir contando</Boton>
          <Boton onClick={confirmar} cargando={guardando}>
            {r.conDiferencia
              ? `Ajustar ${r.conDiferencia} talla${r.conDiferencia === 1 ? '' : 's'}`
              : 'Guardar conteo sin diferencias'}
          </Boton>
        </>
      }
    >
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
        <dt className="text-texto3">Qué se contó</dt><dd className="font-medium">{alcance}</dd>
        <dt className="text-texto3">Tallas</dt>
        <dd>
          {r.contadas} contada{r.contadas === 1 ? '' : 's'}
          {r.sinContar ? <span className="text-texto3"> · {r.sinContar} sin contar (no se tocan)</span> : null}
        </dd>
        <dt className="text-texto3">Diferencias</dt>
        <dd>
          {r.conDiferencia ? (
            <>
              {r.conDiferencia} talla{r.conDiferencia === 1 ? '' : 's'}
              {r.sobrantes ? <> · <span className="cifras">+{r.sobrantes}</span> sobrante{r.sobrantes === 1 ? '' : 's'}</> : null}
              {r.faltantes ? <> · <span className="cifras font-medium text-peligro-texto">−{r.faltantes}</span> faltante{r.faltantes === 1 ? '' : 's'}</> : null}
            </>
          ) : 'Todo coincide con el sistema'}
        </dd>
        {valor && r.conDiferencia ? (
          <>
            <dt className="text-texto3">A costo</dt>
            <dd className="cifras">
              {valor.faltante ? <>faltan {pesos(valor.faltante)}</> : null}
              {valor.faltante && valor.sobrante ? ' · ' : null}
              {valor.sobrante ? <>sobran {pesos(valor.sobrante)}</> : null}
              {!valor.faltante && !valor.sobrante ? '—' : null}
              {valor.sinCosto ? <span className="text-texto3"> ({valor.sinCosto} sin costo registrado)</span> : null}
            </dd>
          </>
        ) : null}
      </dl>

      <label className="mt-4 block text-sm">
        <span className="mb-1.5 block font-medium">Nota del conteo</span>
        <input
          value={borrador.nota}
          onChange={(e) => alCambiar({ ...borrador, nota: e.target.value })}
          placeholder="Ej.: conteo de fin de mes"
          className="w-full rounded-xl border border-borde bg-fondo px-3 py-2 outline-none focus:border-primario"
        />
      </label>

      {diferencias.length ? (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium">Motivo para las que no tienen:</span>
            <select
              aria-label="Motivo para todas"
              value={paraTodas}
              onChange={(e) => setParaTodas(e.target.value as Motivo | '')}
              className="rounded-lg border border-borde bg-fondo px-2 py-1"
            >
              <option value="">Elegir…</option>
              {MOTIVOS.map((m) => <option key={m.valor} value={m.valor}>{m.titulo}</option>)}
            </select>
            <Boton
              variante="fantasma"
              className="border border-borde py-1"
              disabled={!paraTodas}
              onClick={() => paraTodas && alCambiar(motivoParaTodas(borrador, lineas, paraTodas))}
            >
              Aplicar
            </Boton>
            <span className="text-xs text-texto3">Pérdida y daño solo se ponen en los faltantes.</span>
          </div>
          <div className="mt-3 max-h-[45vh] overflow-auto rounded-xl border border-borde">
            <table className="w-full min-w-[40rem] text-sm">
              <thead className="sticky top-0 border-b border-borde bg-fondo text-left text-xs text-texto3">
                <tr>
                  <th className="px-3 py-2 font-medium">Talla</th>
                  <th className="py-2 pr-3 text-right font-medium">Sistema</th>
                  <th className="py-2 pr-3 text-right font-medium">Contado</th>
                  <th className="py-2 pr-3 text-right font-medium">Diferencia</th>
                  <th className="py-2 pr-3 font-medium">Motivo</th>
                  <th className="py-2 pr-3 font-medium">Nota</th>
                </tr>
              </thead>
              <tbody>
                {diferencias.map((l) => {
                  const nombre = nombreTalla(l.producto)
                  return (
                    <tr key={l.producto.id} className="border-b border-borde last:border-0">
                      <td className="px-3 py-2">{nombre}</td>
                      <td className="cifras py-2 pr-3 text-right">{l.sistema}</td>
                      <td className="cifras py-2 pr-3 text-right">{l.contado ?? l.texto}</td>
                      <td className={`cifras py-2 pr-3 text-right font-medium ${l.diferencia !== null && l.diferencia < 0 ? 'text-peligro-texto' : ''}`}>
                        {l.diferencia === null ? '¿?' : l.diferencia > 0 ? `+${l.diferencia}` : `−${-l.diferencia}`}
                      </td>
                      <td className="py-2 pr-3">
                        <select
                          aria-label={`Motivo de ${nombre}`}
                          value={l.motivo}
                          onChange={(e) => alCambiar(cambiarMotivo(borrador, l.producto.id, { motivo: e.target.value as Motivo | '' }))}
                          className={entrada}
                        >
                          <option value="">Elegir…</option>
                          {MOTIVOS.map((m) => (
                            <option key={m.valor} value={m.valor} disabled={m.soloFaltante && (l.diferencia ?? 0) > 0}>{m.titulo}</option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-3">
                        <input
                          aria-label={`Nota de ${nombre}`}
                          value={l.nota}
                          onChange={(e) => alCambiar(cambiarMotivo(borrador, l.producto.id, { nota: e.target.value }))}
                          placeholder={l.motivo === 'otro' ? 'Obligatoria' : 'Opcional'}
                          className={entrada}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {intento && errores.length ? (
        <div role="alert" className="mt-4 rounded-xl bg-peligro-soft px-4 py-3 text-sm text-peligro-texto">
          <p className="font-semibold">Falta corregir:</p>
          <ul className="list-disc pl-5">{errores.slice(0, 8).map((e) => <li key={e}>{e}</li>)}</ul>
          {errores.length > 8 ? <p className="mt-1">… y {errores.length - 8} más.</p> : null}
        </div>
      ) : null}
      {error ? <div className="mt-4"><AvisoError error={error} /></div> : null}
      {error ? <p className="mt-2 text-xs text-texto3">Si fue la conexión, vuelve a intentar: el conteo no se aplica dos veces.</p> : null}
    </Dialogo>
  )
}
