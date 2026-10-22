import { useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { MessageCircle, Plus, Search, X } from 'lucide-react'
import { pesos } from '@shared/formato'
import { hoyEn } from '@shared/fechas'
import { enlaceWhatsApp } from '@shared/proveedores'
import { comprasConSaldo, listarProveedores } from '../../lib/datos/proveedores'
import { NEGOCIO } from '../../lib/negocio'
import { filtrarProveedores, resumirDeudas, type FiltroProveedores } from '../../lib/proveedores'
import { Boton, Cargando, MensajeError, Tarjeta } from '../../componentes/ui'
import { EditarProveedor } from './EditarProveedor'
import { Vencimiento } from './Vencimiento'

const FILTROS: { valor: FiltroProveedores; titulo: string; conDeudas?: boolean }[] = [
  { valor: 'activos', titulo: 'Activos' },
  { valor: 'con_deuda', titulo: 'Con deuda', conDeudas: true },
  { valor: 'vencidos', titulo: 'Vencidos', conDeudas: true },
  { valor: 'inactivos', titulo: 'Inactivos' },
]

export function Proveedores() {
  const navegar = useNavigate()
  const [parametros] = useSearchParams()
  const [texto, setTexto] = useState(parametros.get('buscar') ?? '')
  const [filtro, setFiltro] = useState<FiltroProveedores>('activos')
  const [creando, setCreando] = useState(false)
  const hoy = hoyEn(new Date(), NEGOCIO.zonaHoraria)

  const proveedores = useQuery({ queryKey: ['proveedores'], queryFn: listarProveedores })
  // Sin permiso de deudas la base no entrega saldos: la lista sigue sin esas columnas.
  const compras = useQuery({ queryKey: ['proveedores', 'deudas'], queryFn: comprasConSaldo, retry: false })
  const deudas = useMemo(() => (compras.data ? resumirDeudas(compras.data, hoy) : undefined), [compras.data, hoy])

  const visibles = useMemo(
    () => filtrarProveedores(proveedores.data ?? [], deudas, { texto, filtro }),
    [proveedores.data, deudas, texto, filtro],
  )
  const totales = useMemo(() => {
    const lista = [...(deudas?.values() ?? [])]
    return {
      deuda: lista.reduce((s, d) => s + d.deuda, 0),
      vencido: lista.reduce((s, d) => s + d.vencido, 0),
      proveedores: lista.length,
    }
  }, [deudas])

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-titulo">Proveedores</h1>
          <p className="text-texto2">Datos, cuentas, documentos, deudas y pagos de cada proveedor.</p>
        </div>
        <Boton onClick={() => setCreando(true)}>
          <Plus aria-hidden className="size-4" />
          Nuevo proveedor
        </Boton>
      </header>

      {deudas ? (
        <div className="grid gap-3 sm:grid-cols-3">
          <Tarjeta>
            <p className="text-sm text-texto2">Deuda con proveedores</p>
            <p className="cifras mt-1 text-2xl font-extrabold tracking-tight">{pesos(totales.deuda)}</p>
            <p className="text-xs text-texto3">{totales.proveedores} proveedor{totales.proveedores === 1 ? '' : 'es'} con saldo</p>
          </Tarjeta>
          <Tarjeta>
            <p className="text-sm text-texto2">Vencido</p>
            <p className={`cifras mt-1 text-2xl font-extrabold tracking-tight ${totales.vencido > 0 ? 'text-peligro-texto' : ''}`}>{pesos(totales.vencido)}</p>
            <p className="text-xs text-texto3">Compras a crédito con la fecha de pago ya pasada</p>
          </Tarjeta>
          <Tarjeta>
            <p className="text-sm text-texto2">Proveedores activos</p>
            <p className="cifras mt-1 text-2xl font-extrabold tracking-tight">{(proveedores.data ?? []).filter((p) => p.activo).length}</p>
            <p className="text-xs text-texto3">{(proveedores.data ?? []).filter((p) => !p.activo).length} inactivos</p>
          </Tarjeta>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex min-w-60 flex-1 items-center gap-2 rounded-xl border border-borde bg-fondo px-3 py-2 focus-within:border-primario">
          <Search aria-hidden className="size-4 text-texto3" />
          <input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Nombre, NIT, ciudad o teléfono"
            aria-label="Buscar proveedores"
            className="w-full bg-transparent text-sm outline-none"
          />
          {texto ? (
            <button aria-label="Borrar búsqueda" onClick={() => setTexto('')} className="text-texto3 hover:text-texto">
              <X className="size-4" />
            </button>
          ) : null}
        </label>
        <div role="radiogroup" aria-label="Mostrar" className="flex rounded-xl border border-borde bg-fondo p-0.5">
          {FILTROS.filter((f) => !f.conDeudas || deudas).map((f) => (
            <button
              key={f.valor}
              role="radio"
              aria-checked={filtro === f.valor}
              onClick={() => setFiltro(f.valor)}
              className={`rounded-lg px-3 py-1.5 text-sm ${filtro === f.valor ? 'bg-primario-soft font-semibold text-primario' : 'text-texto2 hover:text-texto'}`}
            >
              {f.titulo}
            </button>
          ))}
        </div>
      </div>

      {proveedores.isPending ? <Cargando /> : proveedores.isError ? <MensajeError error={proveedores.error} /> : (
        <div className="overflow-x-auto rounded-2xl border border-borde bg-fondo">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="border-b border-borde text-left text-xs text-texto3">
              <tr>
                <th className="px-4 py-3 font-medium">Proveedor</th>
                <th className="py-3 pr-3 font-medium">Teléfono</th>
                {deudas ? <th className="py-3 pr-3 text-right font-medium">Deuda</th> : null}
                {deudas ? <th className="py-3 pr-4 font-medium">Próximo vencimiento</th> : null}
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => {
                const d = deudas?.get(p.id)
                const whatsapp = enlaceWhatsApp(p.telefono)
                return (
                  <tr
                    key={p.id}
                    onClick={() => navegar(`/proveedores/${p.id}`)}
                    className={`cursor-pointer border-b border-borde last:border-0 hover:bg-superficie ${p.activo ? '' : 'text-texto3'}`}
                  >
                    <td className="px-4 py-3">
                      <Link to={`/proveedores/${p.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:text-primario">
                        {p.nombre}
                      </Link>
                      <span className="block text-xs text-texto3">{[p.nit_cedula && `NIT/CC ${p.nit_cedula}`, p.ciudad].filter(Boolean).join(' · ') || '—'}</span>
                    </td>
                    <td className="py-3 pr-3">
                      {whatsapp ? (
                        <a
                          href={whatsapp}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          aria-label={`WhatsApp a ${p.nombre}`}
                          className="inline-flex items-center gap-1.5 text-texto2 hover:text-primario"
                        >
                          <MessageCircle aria-hidden className="size-4" />
                          <span className="cifras">{p.telefono}</span>
                        </a>
                      ) : <span className="text-texto3">—</span>}
                    </td>
                    {deudas ? (
                      <td className="cifras py-3 pr-3 text-right font-medium">
                        {d ? pesos(d.deuda) : <span className="font-normal text-texto3">—</span>}
                        {d && d.compras > 1 ? <span className="block text-xs font-normal text-texto3">{d.compras} compras</span> : null}
                      </td>
                    ) : null}
                    {deudas ? (
                      <td className="py-3 pr-4">
                        {d ? <Vencimiento fecha={d.proximoVencimiento} hoy={hoy} /> : <span className="text-texto3">—</span>}
                      </td>
                    ) : null}
                  </tr>
                )
              })}
              {visibles.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-texto3">
                    {proveedores.data?.length ? 'Ningún proveedor coincide con la búsqueda.' : 'Todavía no hay proveedores. Crea el primero.'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      {creando ? (
        <EditarProveedor alCerrar={() => setCreando(false)} alGuardar={(p) => navegar(`/proveedores/${p.id}`)} />
      ) : null}
    </div>
  )
}
