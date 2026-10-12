import { diasHasta, estadoVencimiento } from '../../lib/proveedores'
import { Insignia } from '../../componentes/ui'

const fechaCorta = (fecha: string) =>
  new Date(`${fecha}T12:00:00Z`).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

// Fecha de pago con su estado: vencida (rojo), en los próximos 7 días (ámbar) o al día.
export function Vencimiento({ fecha, hoy }: { fecha: string | null; hoy: string }) {
  const estado = estadoVencimiento(fecha, hoy)
  if (!fecha || estado === 'sin_fecha') return <span className="text-texto3">Sin fecha</span>
  const dias = diasHasta(fecha, hoy)
  const detalle =
    estado === 'vencida' ? `vencida hace ${-dias} día${dias === -1 ? '' : 's'}`
      : dias === 0 ? 'vence hoy'
        : `en ${dias} día${dias === 1 ? '' : 's'}`
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="cifras">{fechaCorta(fecha)}</span>
      <Insignia tono={estado === 'vencida' ? 'peligro' : estado === 'pronto' ? 'advertencia' : 'neutro'}>{detalle}</Insignia>
    </span>
  )
}
