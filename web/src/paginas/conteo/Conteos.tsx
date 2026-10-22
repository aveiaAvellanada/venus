import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ClipboardCheck } from 'lucide-react'
import { listarConteos } from '../../lib/datos/conteo'
import { NEGOCIO } from '../../lib/negocio'
import { horaCorta } from '../../lib/tiempo'
import { Boton, Cargando, MensajeError } from '../../componentes/ui'
import { hayBorrador } from './NuevoConteo'

export const fechaDeConteo = (momento: string) =>
  `${new Date(momento).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: NEGOCIO.zonaHoraria })} · ${horaCorta(momento, NEGOCIO.zonaHoraria)}`

export function Conteos() {
  const navegar = useNavigate()
  const conteos = useQuery({ queryKey: ['conteos'], queryFn: listarConteos })
  const seguir = hayBorrador()

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Conteo físico</h1>
          <p className="text-texto2">
            Cuenta lo que hay en la tienda y compáralo con el sistema. Al confirmar, el stock queda igual a lo contado y cada diferencia guarda su motivo.
          </p>
        </div>
        <Boton onClick={() => navegar('/conteo/nuevo')}>
          <ClipboardCheck aria-hidden className="size-4" />
          {seguir ? 'Seguir con el conteo' : 'Nuevo conteo'}
        </Boton>
      </header>

      {conteos.isPending ? <Cargando /> : conteos.isError ? <MensajeError error={conteos.error} /> : (
        <div className="overflow-x-auto rounded-2xl border border-borde bg-fondo">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="border-b border-borde text-left text-xs text-texto3">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="py-3 pr-3 font-medium">Qué se contó</th>
                <th className="py-3 pr-3 font-medium">Hecho por</th>
                <th className="py-3 pr-3 text-right font-medium">Tallas contadas</th>
                <th className="py-3 pr-3 text-right font-medium">Con diferencia</th>
                <th className="py-3 pr-3 text-right font-medium">Sobrantes</th>
                <th className="py-3 pr-4 text-right font-medium">Faltantes</th>
              </tr>
            </thead>
            <tbody>
              {conteos.data.map((c) => (
                <tr key={c.id} onClick={() => navegar(`/conteo/${c.id}`)} className="cursor-pointer border-b border-borde last:border-0 hover:bg-superficie">
                  <td className="px-4 py-3">
                    <Link to={`/conteo/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-primario">{fechaDeConteo(c.created_at)}</Link>
                  </td>
                  <td className="py-3 pr-3">
                    {c.alcance}
                    {c.nota ? <span className="block truncate text-xs text-texto3">{c.nota}</span> : null}
                  </td>
                  <td className="py-3 pr-3 text-texto2">{c.autor ?? '—'}</td>
                  <td className="cifras py-3 pr-3 text-right">{c.tallas_contadas}</td>
                  <td className="cifras py-3 pr-3 text-right">{c.tallas_ajustadas || '—'}</td>
                  <td className="cifras py-3 pr-3 text-right">{c.unidades_sobrantes ? `+${c.unidades_sobrantes}` : '—'}</td>
                  <td className={`cifras py-3 pr-4 text-right ${c.unidades_faltantes ? 'font-medium text-peligro-texto' : ''}`}>
                    {c.unidades_faltantes ? `−${c.unidades_faltantes}` : '—'}
                  </td>
                </tr>
              ))}
              {conteos.data.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-texto3">
                    Todavía no hay conteos. Empieza por una categoría: es más fácil contar por partes.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
