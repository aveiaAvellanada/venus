import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { FilePlus2, Search, X } from 'lucide-react'
import { pesos } from '@shared/formato'
import { hoyEn } from '@shared/fechas'
import { listarCompras, type CompraListado } from '../../lib/datos/compras'
import { NEGOCIO } from '../../lib/negocio'
import { plano } from '../../navegacion'
import { esDeuda } from '../../lib/proveedores'
import { Boton, Cargando, Insignia, MensajeError } from '../../componentes/ui'
import { Vencimiento } from '../proveedores/Vencimiento'

type FiltroPago = 'todas' | 'contado' | 'credito' | 'con_saldo'

export const fechaDeCompra = (c: Pick<CompraListado, 'fecha_factura' | 'created_at'>) =>
  c.fecha_factura
    ? new Date(`${c.fecha_factura}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    : new Date(c.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })

export const ESTADO_COMPRA: Record<string, { texto: string; tono: 'neutro' | 'advertencia' }> = {
  completada: { texto: 'Completada', tono: 'neutro' },
  pendiente_revision: { texto: 'Pendiente de costos', tono: 'advertencia' },
  cancelada: { texto: 'Cancelada', tono: 'neutro' },
}

// esDeuda pide el resumen completo de la compra; aquí basta con estos campos.
const conSaldo = (c: CompraListado) =>
  esDeuda({ ...c, monto_pagado: 0, notas: null })

export function Compras() {
  const navegar = useNavigate()
  const hoy = hoyEn(new Date(), NEGOCIO.zonaHoraria)
  const [texto, setTexto] = useState('')
  const [proveedor, setProveedor] = useState('')
  const [pago, setPago] = useState<FiltroPago>('todas')
  const compras = useQuery({ queryKey: ['compras'], queryFn: listarCompras })

  const proveedores = useMemo(
    () => [...new Map((compras.data ?? []).map((c) => [c.proveedor_id, c.proveedor])).entries()].sort((a, b) => a[1].localeCompare(b[1], 'es')),
    [compras.data],
  )
  const visibles = useMemo(() => {
    const buscado = plano(texto.trim())
    return (compras.data ?? []).filter((c) =>
      (!proveedor || c.proveedor_id === proveedor) &&
      (pago === 'todas' || (pago === 'con_saldo' ? conSaldo(c) : c.condicion_pago === pago)) &&
      (!buscado || plano(`${c.numero_factura ?? ''} ${c.proveedor}`).includes(buscado)),
    )
  }, [compras.data, texto, proveedor, pago])
  const total = visibles.filter((c) => c.estado === 'completada').reduce((s, c) => s + (c.total ?? 0), 0)
  const saldo = visibles.filter(conSaldo).reduce((s, c) => s + c.saldo_pendiente, 0)

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Compras y recepción</h1>
          <p className="text-texto2">Facturas de los proveedores. Al registrar una, el stock sube solo.</p>
        </div>
        <Boton onClick={() => navegar('/compras/nueva')}>
          <FilePlus2 aria-hidden className="size-4" />
          Nueva compra
        </Boton>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-60 flex-1 items-center gap-2 rounded-xl border border-borde bg-fondo px-3 py-2 focus-within:border-primario">
          <Search aria-hidden className="size-4 text-texto3" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Número de factura o proveedor"
            aria-label="Buscar compras"
            className="w-full bg-transparent text-sm outline-none"
          />
          {texto ? (
            <button aria-label="Borrar búsqueda" onClick={() => setTexto('')} className="text-texto3 hover:text-texto">
              <X className="size-4" />
            </button>
          ) : null}
        </label>
        <select aria-label="Proveedor" value={proveedor} onChange={(e) => setProveedor(e.target.value)} className="rounded-xl border border-borde bg-fondo px-3 py-2 text-sm text-texto2">
          <option value="">Proveedor: todos</option>
          {proveedores.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
        </select>
        <div role="radiogroup" aria-label="Pago" className="flex rounded-xl border border-borde bg-fondo p-0.5">
          {([['todas', 'Todas'], ['contado', 'Contado'], ['credito', 'Crédito'], ['con_saldo', 'Con saldo']] as const).map(([v, t]) => (
            <button
              key={v}
              role="radio"
              aria-checked={pago === v}
              onClick={() => setPago(v)}
              className={`rounded-lg px-3 py-1.5 text-sm ${pago === v ? 'bg-primario-soft font-semibold text-primario' : 'text-texto2 hover:text-texto'}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {compras.isPending ? <Cargando /> : compras.isError ? <MensajeError error={compras.error} /> : (
        <div className="overflow-x-auto rounded-2xl border border-borde bg-fondo">
          <table className="w-full min-w-[52rem] text-sm">
            <thead className="border-b border-borde text-left text-xs text-texto3">
              <tr>
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="py-3 pr-3 font-medium">Proveedor</th>
                <th className="py-3 pr-3 font-medium">Factura</th>
                <th className="py-3 pr-3 font-medium">Pago</th>
                <th className="py-3 pr-3 text-right font-medium">Total</th>
                <th className="py-3 pr-3 text-right font-medium">Saldo</th>
                <th className="py-3 pr-4 font-medium">Vence</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map((c) => {
                const estado = ESTADO_COMPRA[c.estado] ?? { texto: c.estado, tono: 'neutro' as const }
                return (
                  <tr
                    key={c.id}
                    onClick={() => navegar(`/compras/${c.id}`)}
                    className={`cursor-pointer border-b border-borde last:border-0 hover:bg-superficie ${c.estado === 'cancelada' ? 'text-texto3' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <Link to={`/compras/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-primario">{fechaDeCompra(c)}</Link>
                      {c.estado !== 'completada' ? <span className="block"><Insignia tono={estado.tono}>{estado.texto}</Insignia></span> : null}
                    </td>
                    <td className="py-3 pr-3">{c.proveedor}</td>
                    <td className="py-3 pr-3 text-texto2">{c.numero_factura ?? '—'}</td>
                    <td className="py-3 pr-3 text-texto2">{c.condicion_pago === 'credito' ? 'Crédito' : c.condicion_pago === 'contado' ? 'Contado' : '—'}</td>
                    <td className="cifras py-3 pr-3 text-right">{c.total == null ? '—' : pesos(c.total)}</td>
                    <td className="cifras py-3 pr-3 text-right font-medium">{conSaldo(c) ? pesos(c.saldo_pendiente) : '—'}</td>
                    <td className="py-3 pr-4">{conSaldo(c) ? <Vencimiento fecha={c.fecha_vencimiento} hoy={hoy} /> : '—'}</td>
                  </tr>
                )
              })}
              {visibles.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-texto3">
                    {compras.data.length ? 'Ninguna compra coincide con los filtros.' : 'Todavía no hay compras. Registra la primera factura.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
            {visibles.length ? (
              <tfoot className="border-t border-borde text-sm text-texto2">
                <tr>
                  <td colSpan={4} className="px-4 py-3">{visibles.length} compra{visibles.length === 1 ? '' : 's'}</td>
                  <td className="cifras py-3 pr-3 text-right font-medium text-texto">{pesos(total)}</td>
                  <td className="cifras py-3 pr-3 text-right font-medium text-texto">{pesos(saldo)}</td>
                  <td />
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      )}
    </div>
  )
}
