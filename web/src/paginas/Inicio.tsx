import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, CheckCircle2, Clock, Lock, Unlock } from 'lucide-react'
import { fechaLarga, hoyEn, sumarDias } from '@shared/fechas'
import { pesos, porcentaje, variacion } from '@shared/formato'
import type { ResumenDia } from '@shared/reportes'
import { useSesion } from '../lib/auth'
import { alertasDelDueno, cajaDelDia, productosConStockBajo, resumenDelDia, type CajaDelDia } from '../lib/datos/inicio'
import { NEGOCIO } from '../lib/negocio'
import { horaCorta, horaEn, saludo } from '../lib/tiempo'
import { Cargando, Insignia, MensajeError, Tarjeta } from '../componentes/ui'

const UN_MINUTO = 60_000

export function Inicio() {
  const { estado } = useSesion()
  const ahora = new Date()
  const hoy = hoyEn(ahora, NEGOCIO.zonaHoraria)
  const ayer = sumarDias(hoy, -1)

  const resumenHoy = useQuery({ queryKey: ['resumen-dia', hoy], queryFn: () => resumenDelDia(hoy), refetchInterval: UN_MINUTO })
  const resumenAyer = useQuery({ queryKey: ['resumen-dia', ayer], queryFn: () => resumenDelDia(ayer) })
  const caja = useQuery({ queryKey: ['caja-dia', hoy], queryFn: () => cajaDelDia(hoy), refetchInterval: UN_MINUTO })
  const alertas = useQuery({ queryKey: ['alertas-dueno'], queryFn: () => alertasDelDueno(7) })
  const stockBajo = useQuery({ queryKey: ['stock-bajo'], queryFn: productosConStockBajo })

  const nombre = estado.tipo === 'dentro' ? estado.perfil.nombre.split(' ')[0] : ''
  const fecha = fechaLarga(hoy)

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold">
          {saludo(horaEn(ahora, NEGOCIO.zonaHoraria))}{nombre ? `, ${nombre}` : ''}
        </h1>
        <p className="text-texto2">{fecha.charAt(0).toUpperCase() + fecha.slice(1)}</p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <Tarjeta titulo="Vendido hoy">
          {resumenHoy.isPending ? <Cargando /> : resumenHoy.isError ? <MensajeError error={resumenHoy.error} /> : (
            <>
              <p className="cifras text-4xl font-bold tracking-tight">{pesos(Number(resumenHoy.data.total_general))}</p>
              <ComparacionAyer hoy={Number(resumenHoy.data.total_general)} ayer={resumenAyer.data} />
            </>
          )}
        </Tarjeta>

        <Tarjeta titulo="Ventas">
          {resumenHoy.isPending ? <Cargando /> : resumenHoy.isError ? <MensajeError error={resumenHoy.error} /> : (
            <>
              <p className="cifras text-4xl font-bold tracking-tight">{Number(resumenHoy.data.total_ventas)}</p>
              <p className="mt-2 text-sm text-texto2">
                {Number(resumenHoy.data.total_ventas) > 0
                  ? `Promedio por venta: ${pesos(Number(resumenHoy.data.total_general) / Number(resumenHoy.data.total_ventas))}`
                  : 'Todavía no hay ventas hoy.'}
              </p>
            </>
          )}
        </Tarjeta>

        <Tarjeta titulo="Caja">
          {caja.isPending ? <Cargando /> : caja.isError ? <MensajeError error={caja.error} /> : <EstadoCaja caja={caja.data} />}
        </Tarjeta>
      </div>

      <Tarjeta titulo="Por método de pago">
        {resumenHoy.isPending ? <Cargando /> : resumenHoy.isError ? <MensajeError error={resumenHoy.error} /> : (
          <MetodosDePago resumen={resumenHoy.data} />
        )}
      </Tarjeta>

      <div className="grid gap-4 lg:grid-cols-3">
        <Tarjeta
          titulo="Stock bajo"
          accion={stockBajo.data ? <Insignia tono={stockBajo.data.length ? 'advertencia' : 'exito'}>{stockBajo.data.length}</Insignia> : null}
        >
          {stockBajo.isPending ? <Cargando /> : stockBajo.isError ? <MensajeError error={stockBajo.error} /> : stockBajo.data.length === 0 ? (
            <Vacio>Ningún producto por debajo de su mínimo.</Vacio>
          ) : (
            <Lista>
              {stockBajo.data.slice(0, 8).map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0 truncate">
                    {p.descripcion}{p.talla ? <span className="text-texto3"> · talla {p.talla}</span> : null}
                  </span>
                  <span className={`cifras shrink-0 ${p.stock_actual === 0 ? 'font-semibold text-peligro-texto' : 'text-texto2'}`}>
                    {p.stock_actual === 0 ? 'Agotado' : `${p.stock_actual} de ${p.stock_minimo}`}
                  </span>
                </li>
              ))}
              {stockBajo.data.length > 8 ? (
                <li className="pt-2 text-xs text-texto3">y {stockBajo.data.length - 8} más</li>
              ) : null}
            </Lista>
          )}
        </Tarjeta>

        <Tarjeta titulo="Pagos a proveedores (7 días)">
          {alertas.isPending ? <Cargando /> : alertas.isError ? <MensajeError error={alertas.error} /> : alertas.data.proveedores_por_vencer.length === 0 ? (
            <Vacio>Nada por pagar esta semana.</Vacio>
          ) : (
            <Lista>
              {alertas.data.proveedores_por_vencer.map((p, i) => (
                <li key={`${p.proveedor}-${p.fecha_vencimiento}-${i}`} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="min-w-0">
                    <span className="block truncate">{p.proveedor}</span>
                    <span className="text-xs text-texto3">{p.vencida ? 'Venció' : 'Vence'} el {fechaLarga(p.fecha_vencimiento)}</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="cifras font-medium">{pesos(Number(p.saldo))}</span>
                    {p.vencida ? (
                      <Insignia tono="peligro"><AlertTriangle aria-hidden className="size-3" />Vencida</Insignia>
                    ) : null}
                  </span>
                </li>
              ))}
            </Lista>
          )}
        </Tarjeta>

        <Tarjeta titulo="Sin actividad hoy">
          {alertas.isPending ? <Cargando /> : alertas.isError ? <MensajeError error={alertas.error} /> : alertas.data.empleados_sin_actividad.length === 0 ? (
            <Vacio>Todos los empleados registraron actividad.</Vacio>
          ) : (
            <Lista>
              {alertas.data.empleados_sin_actividad.map((e) => (
                <li key={e.id} className="py-2 text-sm">{e.nombre}</li>
              ))}
            </Lista>
          )}
        </Tarjeta>
      </div>
    </div>
  )
}

function ComparacionAyer({ hoy, ayer }: { hoy: number; ayer: ResumenDia | undefined }) {
  if (!ayer) return <p className="mt-2 text-sm text-texto3">Comparando con ayer…</p>
  const totalAyer = Number(ayer.total_general)
  const cambio = variacion(hoy, totalAyer)
  if (cambio === null) return <p className="mt-2 text-sm text-texto3">Ayer no hubo ventas.</p>
  const sube = cambio >= 0
  return (
    <p className="mt-2 flex flex-wrap items-center gap-2 text-sm text-texto2">
      <Insignia tono={sube ? 'exito' : 'peligro'}>
        {sube ? <ArrowUpRight aria-hidden className="size-3" /> : <ArrowDownRight aria-hidden className="size-3" />}
        {porcentaje(cambio)}
      </Insignia>
      <span>frente a ayer ({pesos(totalAyer)})</span>
    </p>
  )
}

function EstadoCaja({ caja }: { caja: CajaDelDia | null }) {
  const zona = NEGOCIO.zonaHoraria
  if (!caja) {
    return (
      <div className="flex items-start gap-3">
        <Clock aria-hidden className="mt-1 size-5 text-advertencia" />
        <div>
          <p className="text-xl font-semibold">Sin abrir</p>
          <p className="text-sm text-texto2">La caja de hoy no se ha abierto.</p>
        </div>
      </div>
    )
  }
  if (caja.estado === 'abierta') {
    return (
      <div className="flex items-start gap-3">
        <Unlock aria-hidden className="mt-1 size-5 text-exito" />
        <div>
          <p className="text-xl font-semibold">Abierta</p>
          <p className="text-sm text-texto2">
            {caja.apertura_at ? `Desde las ${horaCorta(caja.apertura_at, zona)}` : 'Abierta hoy'} · base {pesos(Number(caja.base_inicial))}
          </p>
        </div>
      </div>
    )
  }
  const diferencia = caja.diferencia === null ? null : Number(caja.diferencia)
  return (
    <div className="flex items-start gap-3">
      <Lock aria-hidden className="mt-1 size-5 text-texto3" />
      <div>
        <p className="text-xl font-semibold">Cerrada</p>
        <p className="text-sm text-texto2">{caja.cierre_at ? `A las ${horaCorta(caja.cierre_at, zona)}` : 'Cerrada hoy'}</p>
        <div className="mt-2">
          {diferencia === null ? (
            <Insignia>Cierre automático, sin conteo</Insignia>
          ) : diferencia === 0 ? (
            <Insignia tono="exito"><CheckCircle2 aria-hidden className="size-3" />Cuadró</Insignia>
          ) : (
            <Insignia tono="peligro">
              <AlertTriangle aria-hidden className="size-3" />
              {diferencia > 0 ? 'Sobraron' : 'Faltaron'} {pesos(Math.abs(diferencia))}
            </Insignia>
          )}
        </div>
      </div>
    </div>
  )
}

// Comparar montos entre métodos: barras de un solo color, con el valor escrito.
function MetodosDePago({ resumen }: { resumen: ResumenDia }) {
  const filas = [
    { metodo: 'Efectivo', monto: Number(resumen.total_efectivo) },
    { metodo: 'Nequi', monto: Number(resumen.total_nequi) },
    { metodo: 'Bre-B', monto: Number(resumen.total_bre_b) },
    { metodo: 'Otro', monto: Number(resumen.total_otro) },
  ]
  const total = filas.reduce((s, f) => s + f.monto, 0)
  const mayor = Math.max(...filas.map((f) => f.monto))
  if (total === 0) return <Vacio>Sin pagos registrados hoy.</Vacio>
  return (
    <ul className="flex flex-col gap-3">
      {filas.map((f) => (
        <li
          key={f.metodo}
          title={`${f.metodo}: ${pesos(f.monto)}`}
          className="grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-1.5 text-sm sm:grid-cols-[6rem_1fr_auto]"
        >
          <span className="text-texto2">{f.metodo}</span>
          {/* En el celular la barra va debajo, a todo el ancho. */}
          <span className="order-last col-span-2 h-2 rounded-full bg-superficie2 sm:order-none sm:col-span-1">
            <span
              className="block h-2 rounded-full bg-primario"
              style={{ width: mayor ? `${(f.monto / mayor) * 100}%` : 0 }}
            />
          </span>
          <span className="cifras text-right sm:w-40">
            <span className="font-medium">{pesos(f.monto)}</span>
            <span className="ml-2 text-texto3">{Math.round((f.monto / total) * 100)} %</span>
          </span>
        </li>
      ))}
    </ul>
  )
}

function Lista({ children }: { children: ReactNode }) {
  return <ul className="divide-y divide-borde">{children}</ul>
}

function Vacio({ children }: { children: ReactNode }) {
  return <p className="text-sm text-texto3">{children}</p>
}
