import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { tituloMotivo } from '../../lib/conteo'
import { compararTallas } from '../../lib/inventario'
import { obtenerConteo, type ItemDeConteo } from '../../lib/datos/conteo'
import { Cargando, ConColor, MensajeError, Tarjeta } from '../../componentes/ui'
import { fechaDeConteo } from './Conteos'

const nombreDe = (i: ItemDeConteo) => i.producto?.referencia || i.producto?.descripcion || '—'

export function DetalleConteo() {
  const { id = '' } = useParams()
  const [todas, setTodas] = useState(false)
  const conteo = useQuery({ queryKey: ['conteo', id], queryFn: () => obtenerConteo(id) })

  const items = useMemo(() => [...(conteo.data?.items ?? [])].sort((a, b) =>
    nombreDe(a).localeCompare(nombreDe(b), 'es')
      || (a.producto?.color ?? '').localeCompare(b.producto?.color ?? '', 'es')
      || compararTallas(a.producto?.talla ?? null, b.producto?.talla ?? null)), [conteo.data])

  if (conteo.isPending) return <Cargando />
  if (conteo.isError) return <MensajeError error={conteo.error} />
  const c = conteo.data
  if (!c) return <p className="text-texto2">Este conteo no existe.</p>
  const visibles = todas ? items : items.filter((i) => i.diferencia !== 0)

  return (
    <div className="flex flex-col gap-5">
      <Link to="/conteo" className="inline-flex items-center gap-1.5 self-start text-sm text-texto2 hover:text-texto">
        <ArrowLeft aria-hidden className="size-4" />
        Conteos
      </Link>
      <header>
        <h1 className="text-titulo">Conteo · {c.alcance}</h1>
        <p className="text-texto2">{fechaDeConteo(c.created_at)}{c.autor ? ` · por ${c.autor}` : ''}</p>
      </header>

      <Tarjeta>
        <dl className="grid gap-4 text-sm sm:grid-cols-4">
          <Dato titulo="Tallas contadas" valor={String(c.tallas_contadas)} />
          <Dato titulo="Con diferencia" valor={String(c.tallas_ajustadas)} />
          <Dato titulo="Sobrantes" valor={c.unidades_sobrantes ? `+${c.unidades_sobrantes}` : '0'} />
          <Dato titulo="Faltantes" valor={c.unidades_faltantes ? `−${c.unidades_faltantes}` : '0'} peligro={c.unidades_faltantes > 0} />
        </dl>
        {c.nota ? <p className="mt-4 text-sm text-texto2">{c.nota}</p> : null}
      </Tarjeta>

      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{todas ? 'Todas las tallas contadas' : 'Tallas ajustadas'}</h2>
        <label className="flex items-center gap-2 text-sm text-texto2">
          <input type="checkbox" checked={todas} onChange={(e) => setTodas(e.target.checked)} />
          Ver también las que coincidieron
        </label>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-borde bg-fondo">
        <table className="w-full min-w-[46rem] text-sm">
          <thead className="border-b border-borde text-left text-xs text-texto3">
            <tr>
              <th className="px-4 py-3 font-medium">Referencia</th>
              <th className="py-3 pr-3 font-medium">Talla</th>
              <th className="py-3 pr-3 text-right font-medium">Sistema</th>
              <th className="py-3 pr-3 text-right font-medium">Contado</th>
              <th className="py-3 pr-3 text-right font-medium">Diferencia</th>
              <th className="py-3 pr-4 font-medium">Motivo</th>
            </tr>
          </thead>
          <tbody>
            {visibles.map((i) => (
              <tr key={i.id} className="border-b border-borde last:border-0">
                <td className="px-4 py-2.5">
                  <span className="block font-medium">{nombreDe(i)}{i.producto?.referencia ? ` · ${i.producto.descripcion}` : ''}</span>
                  <span className="block text-xs text-texto3">
                    {i.producto?.marca}{i.producto?.marca && i.producto?.color ? ' · ' : ''}{i.producto?.color ? <ConColor color={i.producto.color} /> : null}
                  </span>
                </td>
                <td className="py-2.5 pr-3">{i.producto?.talla ?? 'Única'}</td>
                <td className="cifras py-2.5 pr-3 text-right">{i.sistema}</td>
                <td className="cifras py-2.5 pr-3 text-right">{i.contado}</td>
                <td className={`cifras py-2.5 pr-3 text-right font-medium ${i.diferencia < 0 ? 'text-peligro-texto' : ''}`}>
                  {i.diferencia === 0 ? '✓' : i.diferencia > 0 ? `+${i.diferencia}` : `−${-i.diferencia}`}
                </td>
                <td className="py-2.5 pr-4">
                  {i.diferencia === 0 ? <span className="text-texto3">—</span> : tituloMotivo(i.motivo)}
                  {i.nota ? <span className="block text-xs text-texto3">{i.nota}</span> : null}
                </td>
              </tr>
            ))}
            {visibles.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-texto3">Todo lo contado coincidió con el sistema.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function Dato({ titulo, valor, peligro = false }: { titulo: string; valor: string; peligro?: boolean }) {
  return (
    <div>
      <dt className="text-texto3">{titulo}</dt>
      <dd className={`cifras text-2xl font-extrabold tracking-tight ${peligro ? 'text-peligro-texto' : ''}`}>{valor}</dd>
    </div>
  )
}
