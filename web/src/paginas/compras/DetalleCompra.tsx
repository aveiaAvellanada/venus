import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { pesos } from '@shared/formato'
import { hoyEn } from '@shared/fechas'
import { obtenerCompra, type CompraDetalle, type ItemDeCompra } from '../../lib/datos/compras'
import { compararTallas } from '../../lib/inventario'
import { NEGOCIO } from '../../lib/negocio'
import { esDeuda } from '../../lib/proveedores'
import { plano } from '../../navegacion'
import { Boton, Cargando, Insignia, MensajeError, Tarjeta } from '../../componentes/ui'
import { Documentos } from '../proveedores/Documentos'
import { RegistrarPago } from '../proveedores/RegistrarPago'
import { Vencimiento } from '../proveedores/Vencimiento'
import { ESTADO_COMPRA, fechaDeCompra } from './Compras'

interface Grupo {
  clave: string
  referencia: string | null
  descripcion: string
  color: string | null
  tallas: ItemDeCompra[]
  unidades: number
  subtotal: number
}

// Los ítems son por talla; en pantalla se agrupan por referencia y color.
export function agruparItems(items: ItemDeCompra[]): Grupo[] {
  const mapa = new Map<string, Grupo>()
  for (const i of items) {
    const clave = `${plano(i.referencia ?? i.descripcion)}|${plano(i.color ?? '')}`
    const g = mapa.get(clave) ?? { clave, referencia: i.referencia, descripcion: i.descripcion, color: i.color, tallas: [], unidades: 0, subtotal: 0 }
    g.tallas.push(i)
    g.unidades += i.cantidad
    g.subtotal += i.subtotal ?? 0
    mapa.set(clave, g)
  }
  for (const g of mapa.values()) g.tallas.sort((a, b) => compararTallas(a.talla, b.talla))
  return [...mapa.values()]
}

// "$30.000" o "$30.000 – $38.000" si el costo cambia por rango de tallas.
const costos = (g: Grupo) => {
  const valores = [...new Set(g.tallas.map((t) => t.costo_unitario).filter((c): c is number => c != null))].sort((a, b) => a - b)
  if (!valores.length) return '—'
  return valores.length === 1 ? pesos(valores[0]) : `${pesos(valores[0])} – ${pesos(valores[valores.length - 1])}`
}

export function DetalleCompra() {
  const { id = '' } = useParams()
  const [parametros] = useSearchParams()
  const hoy = hoyEn(new Date(), NEGOCIO.zonaHoraria)
  const [pagando, setPagando] = useState(false)
  const compra = useQuery({ queryKey: ['compras', id], queryFn: () => obtenerCompra(id) })
  const grupos = useMemo(() => agruparItems(compra.data?.items ?? []), [compra.data])

  if (compra.isPending) return <Cargando />
  if (compra.isError) return <MensajeError error={compra.error} />
  if (!compra.data) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-texto2">No encontramos esta compra.</p>
        <Link to="/compras" className="text-sm font-semibold text-primario">Volver a compras</Link>
      </div>
    )
  }
  const c: CompraDetalle = compra.data
  const estado = ESTADO_COMPRA[c.estado] ?? { texto: c.estado, tono: 'neutro' as const }
  const deuda = esDeuda({ ...c })
  const unidades = grupos.reduce((s, g) => s + g.unidades, 0)

  return (
    <div className="flex flex-col gap-5">
      <Link to="/compras" className="inline-flex items-center gap-1.5 self-start text-sm text-texto2 hover:text-texto">
        <ArrowLeft aria-hidden className="size-4" />
        Compras
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
            {c.numero_factura ? `Factura ${c.numero_factura}` : 'Compra sin número de factura'}
            <Insignia tono={estado.tono}>{estado.texto}</Insignia>
          </h1>
          <p className="text-texto2">
            <Link to={`/proveedores/${c.proveedor_id}`} className="font-medium text-texto hover:text-primario">{c.proveedor}</Link>
            {' · '}{fechaDeCompra(c)}{' · '}{c.condicion_pago === 'credito' ? 'Crédito' : c.condicion_pago === 'contado' ? 'Contado' : 'Sin condición'}
          </p>
          {c.notas ? <p className="mt-1 text-sm text-texto3">{c.notas}</p> : null}
        </div>
        {deuda ? <Boton onClick={() => setPagando(true)}>Registrar pago</Boton> : null}
      </header>

      {parametros.get('archivo') === 'fallo' ? (
        <p role="alert" className="rounded-xl bg-advertencia-soft px-3 py-2 text-sm text-advertencia-texto">
          La compra quedó guardada, pero el archivo de la factura no se pudo subir. Súbelo abajo.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Tarjeta>
          <p className="text-sm text-texto2">Total</p>
          <p className="cifras mt-1 text-2xl font-bold">{c.total == null ? '—' : pesos(c.total)}</p>
          <p className="text-xs text-texto3">{grupos.length} referencias · {unidades} pares</p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-sm text-texto2">Pagado</p>
          <p className="cifras mt-1 text-2xl font-bold">{c.total == null ? '—' : pesos(c.monto_pagado)}</p>
        </Tarjeta>
        <Tarjeta>
          <p className="text-sm text-texto2">Saldo</p>
          <p className="cifras mt-1 text-2xl font-bold">{deuda ? pesos(c.saldo_pendiente) : pesos(0)}</p>
          {deuda ? <div className="mt-0.5 text-xs text-texto3">Vence: <Vencimiento fecha={c.fecha_vencimiento} hoy={hoy} /></div> : null}
        </Tarjeta>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-borde bg-fondo">
        <table className="w-full min-w-[48rem] text-sm">
          <thead className="border-b border-borde text-left text-xs text-texto3">
            <tr>
              <th className="px-4 py-3 font-medium">Referencia</th>
              <th className="py-3 pr-3 font-medium">Tallas (cantidad)</th>
              <th className="py-3 pr-3 text-right font-medium">Pares</th>
              <th className="py-3 pr-3 text-right font-medium">Costo</th>
              <th className="py-3 pr-4 text-right font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {grupos.map((g) => (
              <tr key={g.clave} className="border-b border-borde last:border-0">
                <td className="px-4 py-3">
                  <span className="block font-medium">{g.referencia ?? '—'} · {g.descripcion}</span>
                  <span className="block text-xs text-texto3">{g.color ?? ''}</span>
                </td>
                <td className="py-3 pr-3">
                  <span className="flex flex-wrap gap-1">
                    {g.tallas.map((t) => (
                      <span key={t.id} className="cifras rounded-md bg-superficie2 px-1.5 py-0.5 text-xs text-texto2">{t.talla ?? 'Única'}: {t.cantidad}</span>
                    ))}
                  </span>
                </td>
                <td className="cifras py-3 pr-3 text-right">{g.unidades}</td>
                <td className="cifras py-3 pr-3 text-right text-texto2">{costos(g)}</td>
                <td className="cifras py-3 pr-4 text-right font-medium">{pesos(g.subtotal)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Tarjeta titulo="Factura del proveedor (foto o PDF)">
        <Documentos proveedorId={c.proveedor_id} compraId={c.id} />
      </Tarjeta>

      {pagando ? (
        <RegistrarPago
          compra={{ ...c }}
          hoy={hoy}
          alCerrar={() => setPagando(false)}
        />
      ) : null}
    </div>
  )
}
