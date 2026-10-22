import { useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowLeft, ArrowUp, MessageCircle, Pencil } from 'lucide-react'
import { pesos, porcentaje } from '@shared/formato'
import { hoyEn } from '@shared/fechas'
import { enlaceWhatsApp } from '@shared/proveedores'
import { comprasDelProveedor, itemsDelProveedor, obtenerProveedor, pagosDelProveedor } from '../../lib/datos/proveedores'
import { NEGOCIO } from '../../lib/negocio'
import { costosPorReferencia, esDeuda, resumirDeudas, type CompraResumen } from '../../lib/proveedores'
import { Boton, Cargando, ConColor, Insignia, MensajeError, Tarjeta } from '../../componentes/ui'
import { Cuentas } from './Cuentas'
import { Documentos } from './Documentos'
import { EditarProveedor } from './EditarProveedor'
import { RegistrarPago } from './RegistrarPago'
import { Vencimiento } from './Vencimiento'

type Pestana = 'compras' | 'costos' | 'cuentas' | 'documentos'
const PESTANAS: { valor: Pestana; titulo: string }[] = [
  { valor: 'compras', titulo: 'Compras y pagos' },
  { valor: 'costos', titulo: 'Costos por referencia' },
  { valor: 'cuentas', titulo: 'Cuentas bancarias' },
  { valor: 'documentos', titulo: 'Documentos' },
]

const fecha = (iso: string) => new Date(iso).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })
const fechaDia = (dia: string) => fecha(`${dia}T12:00:00Z`)

export function FichaProveedor() {
  const { id = '' } = useParams()
  const [pestana, setPestana] = useState<Pestana>('compras')
  const [editando, setEditando] = useState(false)
  const hoy = hoyEn(new Date(), NEGOCIO.zonaHoraria)

  const proveedor = useQuery({ queryKey: ['proveedores', id], queryFn: () => obtenerProveedor(id) })
  // Compras con total y saldo piden `costos` o `deudas`: sin ellos, la ficha sigue sin esas partes.
  const compras = useQuery({ queryKey: ['proveedores', id, 'compras'], queryFn: () => comprasDelProveedor(id), retry: false })
  const deuda = useMemo(() => (compras.data ? resumirDeudas(compras.data, hoy).get(id) : undefined), [compras.data, hoy, id])

  if (proveedor.isPending) return <Cargando />
  if (proveedor.isError) return <MensajeError error={proveedor.error} />
  if (!proveedor.data) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-texto2">No encontramos este proveedor.</p>
        <Link to="/proveedores" className="text-sm font-semibold text-primario">Volver a proveedores</Link>
      </div>
    )
  }
  const p = proveedor.data
  const whatsapp = enlaceWhatsApp(p.telefono, `Hola ${p.nombre}, le escribimos de ${NEGOCIO.nombre}.`)

  return (
    <div className="flex flex-col gap-5">
      <Link to="/proveedores" className="inline-flex items-center gap-1.5 self-start text-sm text-texto2 hover:text-texto">
        <ArrowLeft aria-hidden className="size-4" />
        Proveedores
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex flex-wrap items-center gap-2 text-2xl font-bold">
            {p.nombre}
            {p.activo ? null : <Insignia>Inactivo</Insignia>}
          </h1>
          <p className="text-texto2">
            {[p.nit_cedula && `NIT/CC ${p.nit_cedula}`, p.ciudad, p.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto'}
          </p>
          {p.notas ? <p className="mt-1 max-w-2xl whitespace-pre-line text-sm text-texto3">{p.notas}</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {whatsapp ? (
            <a
              href={whatsapp}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 rounded-xl border border-borde px-4 py-2.5 text-sm font-semibold text-texto2 hover:bg-superficie2 hover:text-texto"
            >
              <MessageCircle aria-hidden className="size-4" />
              WhatsApp
            </a>
          ) : null}
          <Boton variante="fantasma" onClick={() => setEditando(true)} className="border border-borde">
            <Pencil aria-hidden className="size-4" />
            Editar datos
          </Boton>
        </div>
      </header>

      {compras.data ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Tarjeta>
            <p className="text-sm text-texto2">Se le debe</p>
            <p className="cifras mt-1 text-2xl font-bold">{pesos(deuda?.deuda ?? 0)}</p>
            <p className="text-xs text-texto3">{deuda ? `${deuda.compras} compra${deuda.compras === 1 ? '' : 's'} a crédito con saldo` : 'Sin compras pendientes de pago'}</p>
          </Tarjeta>
          <Tarjeta>
            <p className="text-sm text-texto2">Vencido</p>
            <p className={`cifras mt-1 text-2xl font-bold ${deuda?.vencido ? 'text-peligro-texto' : ''}`}>{pesos(deuda?.vencido ?? 0)}</p>
            <div className="mt-0.5 text-xs text-texto3">
              Próximo pago: {deuda ? <Vencimiento fecha={deuda.proximoVencimiento} hoy={hoy} /> : '—'}
            </div>
          </Tarjeta>
          <Tarjeta>
            <p className="text-sm text-texto2">Comprado en total</p>
            <p className="cifras mt-1 text-2xl font-bold">
              {pesos(compras.data.filter((c) => c.estado === 'completada').reduce((s, c) => s + (c.total ?? 0), 0))}
            </p>
            <p className="text-xs text-texto3">{compras.data.filter((c) => c.estado !== 'cancelada').length} compras registradas</p>
          </Tarjeta>
        </div>
      ) : null}

      <div role="tablist" aria-label="Secciones del proveedor" className="flex flex-wrap gap-1 border-b border-borde">
        {PESTANAS.map((t) => (
          <button
            key={t.valor}
            role="tab"
            aria-selected={pestana === t.valor}
            onClick={() => setPestana(t.valor)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${pestana === t.valor ? 'border-primario font-semibold text-primario' : 'border-transparent text-texto2 hover:text-texto'}`}
          >
            {t.titulo}
          </button>
        ))}
      </div>

      <div role="tabpanel">
        {pestana === 'compras' ? <ComprasYPagos compras={compras} hoy={hoy} /> : null}
        {pestana === 'costos' ? <Costos compras={compras.data} /> : null}
        {pestana === 'cuentas' ? <Cuentas proveedorId={p.id} /> : null}
        {pestana === 'documentos' ? <Documentos proveedorId={p.id} /> : null}
      </div>

      {editando ? <EditarProveedor proveedor={p} alCerrar={() => setEditando(false)} alGuardar={() => setEditando(false)} /> : null}
    </div>
  )
}

const ESTADOS: Record<string, { texto: string; tono: 'neutro' | 'exito' | 'advertencia' }> = {
  completada: { texto: 'Completada', tono: 'neutro' },
  pendiente_revision: { texto: 'Pendiente de costos', tono: 'advertencia' },
  cancelada: { texto: 'Cancelada', tono: 'neutro' },
}

function SinPermiso({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-borde bg-fondo px-4 py-6 text-center text-sm text-texto3">{children}</p>
}

function ComprasYPagos({ compras, hoy }: {
  compras: { data?: CompraResumen[]; isPending: boolean; isError: boolean }
  hoy: string
}) {
  const [pagando, setPagando] = useState<CompraResumen | null>(null)
  const ids = compras.data?.map((c) => c.id) ?? []
  const pagos = useQuery({
    queryKey: ['proveedores', 'pagos', ids],
    queryFn: () => pagosDelProveedor(ids),
    enabled: !!compras.data,
    retry: false,
  })

  if (compras.isPending) return <Cargando />
  if (compras.isError || !compras.data) return <SinPermiso>Las compras y deudas se ven con el permiso de costos o de deudas.</SinPermiso>
  if (!compras.data.length) return <SinPermiso>Todavía no hay compras de este proveedor.</SinPermiso>

  const fechaCompra = new Map(compras.data.map((c) => [c.id, c.created_at]))

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-x-auto rounded-2xl border border-borde bg-fondo">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="border-b border-borde text-left text-xs text-texto3">
            <tr>
              <th className="px-4 py-3 font-medium">Compra</th>
              <th className="py-3 pr-3 font-medium">Pago</th>
              <th className="py-3 pr-3 text-right font-medium">Total</th>
              <th className="py-3 pr-3 text-right font-medium">Pagado</th>
              <th className="py-3 pr-3 text-right font-medium">Saldo</th>
              <th className="py-3 pr-3 font-medium">Vence</th>
              <th className="py-3 pr-4" />
            </tr>
          </thead>
          <tbody>
            {compras.data.map((c) => {
              const estado = ESTADOS[c.estado] ?? { texto: c.estado, tono: 'neutro' as const }
              return (
                <tr key={c.id} className={`border-b border-borde last:border-0 ${c.estado === 'cancelada' ? 'text-texto3 line-through decoration-texto3/50' : ''}`}>
                  <td className="px-4 py-3">
                    <span className="block font-medium">{fecha(c.created_at)}</span>
                    <Insignia tono={estado.tono}>{estado.texto}</Insignia>
                  </td>
                  <td className="py-3 pr-3 text-texto2">{c.condicion_pago === 'credito' ? 'Crédito' : c.condicion_pago === 'contado' ? 'Contado' : '—'}</td>
                  <td className="cifras py-3 pr-3 text-right">{c.total == null ? '—' : pesos(c.total)}</td>
                  <td className="cifras py-3 pr-3 text-right text-texto2">{c.total == null ? '—' : pesos(c.monto_pagado)}</td>
                  <td className="cifras py-3 pr-3 text-right font-medium">{esDeuda(c) ? pesos(c.saldo_pendiente) : '—'}</td>
                  <td className="py-3 pr-3">{esDeuda(c) ? <Vencimiento fecha={c.fecha_vencimiento} hoy={hoy} /> : '—'}</td>
                  <td className="py-3 pr-4 text-right">
                    {esDeuda(c) && pagos.isSuccess ? (
                      <Boton onClick={() => setPagando(c)} className="py-1.5">Registrar pago</Boton>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <Tarjeta titulo="Pagos registrados">
        {pagos.isPending ? <Cargando /> : pagos.isError ? (
          <p className="text-sm text-texto3">Los pagos se ven con el permiso de deudas.</p>
        ) : !pagos.data.length ? (
          <p className="text-sm text-texto3">Todavía no hay pagos a este proveedor.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-texto3">
              <tr>
                <th className="pb-2 font-medium">Fecha</th>
                <th className="pb-2 font-medium">Compra</th>
                <th className="pb-2 text-right font-medium">Monto</th>
                <th className="pb-2 pl-4 font-medium">Notas</th>
              </tr>
            </thead>
            <tbody>
              {pagos.data.map((pg) => (
                <tr key={pg.id} className="border-t border-borde">
                  <td className="py-2">{fechaDia(pg.fecha)}</td>
                  <td className="py-2 text-texto2">{fechaCompra.get(pg.compra_id) ? `Del ${fecha(fechaCompra.get(pg.compra_id)!)}` : '—'}</td>
                  <td className="cifras py-2 text-right font-medium">{pesos(pg.monto)}</td>
                  <td className="py-2 pl-4 text-texto2">{pg.notas ?? ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Tarjeta>

      {pagando ? <RegistrarPago compra={pagando} hoy={hoy} alCerrar={() => setPagando(null)} /> : null}
    </div>
  )
}

function Costos({ compras }: { compras?: CompraResumen[] }) {
  const items = useQuery({
    queryKey: ['proveedores', 'items', compras?.map((c) => c.id)],
    queryFn: () => itemsDelProveedor(compras ?? []),
    enabled: !!compras,
    retry: false,
  })
  const filas = useMemo(() => costosPorReferencia(items.data ?? []), [items.data])

  if (!compras) return <SinPermiso>Los costos se ven con el permiso de costos.</SinPermiso>
  if (items.isPending) return <Cargando />
  if (items.isError) return <SinPermiso>Los costos se ven con el permiso de costos.</SinPermiso>
  if (!filas.length) return <SinPermiso>Todavía no hay compras con costo registrado de este proveedor.</SinPermiso>

  return (
    <div className="overflow-x-auto rounded-2xl border border-borde bg-fondo">
      <table className="w-full min-w-[52rem] text-sm">
        <thead className="border-b border-borde text-left text-xs text-texto3">
          <tr>
            <th className="px-4 py-3 font-medium">Referencia</th>
            <th className="py-3 pr-3 font-medium">Tallas</th>
            <th className="py-3 pr-3 text-right font-medium">Unidades</th>
            <th className="py-3 pr-3 text-right font-medium">Último costo</th>
            <th className="py-3 pr-3 text-right font-medium">Anterior</th>
            <th className="py-3 pr-4 text-right font-medium">Cambio</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.clave} className="border-b border-borde last:border-0">
              <td className="px-4 py-3">
                <span className="block font-medium">{f.referencia ?? '—'} · {f.descripcion}</span>
                <span className="block text-xs text-texto3">{f.color ? <><ConColor color={f.color} />{' · '}</> : null}{`${f.compras} compra${f.compras === 1 ? '' : 's'}`}</span>
              </td>
              <td className="py-3 pr-3 text-texto2">{f.tallas.join(', ') || '—'}</td>
              <td className="cifras py-3 pr-3 text-right">{f.unidades}</td>
              <td className="cifras py-3 pr-3 text-right font-medium">
                {pesos(f.ultimoCosto)}
                <span className="block text-xs font-normal text-texto3">{fechaDia(f.ultimaFecha)}</span>
              </td>
              <td className="cifras py-3 pr-3 text-right text-texto2">{f.costoAnterior == null ? '—' : pesos(f.costoAnterior)}</td>
              <td className="cifras py-3 pr-4 text-right">
                {f.variacion == null || f.variacion === 0 ? <span className="text-texto3">—</span> : (
                  <span className={`inline-flex items-center gap-1 ${f.variacion > 0 ? 'text-peligro-texto' : 'text-exito-texto'}`}>
                    {f.variacion > 0 ? <ArrowUp aria-hidden className="size-3.5" /> : <ArrowDown aria-hidden className="size-3.5" />}
                    {porcentaje(f.variacion)}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
