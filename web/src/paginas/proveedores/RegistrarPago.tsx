import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { pesos } from '@shared/formato'
import { registrarPago } from '../../lib/datos/proveedores'
import { leerPesos, type CompraResumen } from '../../lib/proveedores'
import { AvisoError, Boton, CampoTexto, Dialogo } from '../../componentes/ui'

// Abono o pago total de una compra a crédito. La base valida contra el saldo
// (registrar_pago_proveedor); aquí solo se evita mandar algo que ya sabemos inválido.
export function RegistrarPago({ compra, hoy, alCerrar }: { compra: CompraResumen; hoy: string; alCerrar: () => void }) {
  const cliente = useQueryClient()
  const [monto, setMonto] = useState(String(compra.saldo_pendiente))
  const [fecha, setFecha] = useState(hoy)
  const [notas, setNotas] = useState('')
  const valor = leerPesos(monto)
  const invalido =
    Number.isNaN(valor) || valor <= 0 ? 'Escribe un monto mayor a cero.'
      : valor > compra.saldo_pendiente ? `No puede pasar del saldo (${pesos(compra.saldo_pendiente)}).`
        : !fecha || fecha > hoy ? 'La fecha no puede ser futura.'
          : null

  const pagar = useMutation({
    mutationFn: () => registrarPago({ compraId: compra.id, monto: valor, fecha, notas }),
    onSuccess: async () => {
      await Promise.all([
        cliente.invalidateQueries({ queryKey: ['proveedores'] }),
        cliente.invalidateQueries({ queryKey: ['compras'] }),
      ])
      alCerrar()
    },
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (!invalido) pagar.mutate()
  }

  return (
    <Dialogo
      titulo="Registrar pago"
      alCerrar={alCerrar}
      pie={
        <>
          <Boton type="button" variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
          <Boton type="submit" form="form-pago" disabled={!!invalido} cargando={pagar.isPending}>
            Registrar {Number.isNaN(valor) || valor <= 0 ? 'pago' : pesos(valor)}
          </Boton>
        </>
      }
    >
      <form id="form-pago" onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
        <p className="text-sm text-texto2 sm:col-span-2">
          Compra del {new Date(compra.created_at).toLocaleDateString('es-CO')} · total{' '}
          <strong className="cifras text-texto">{pesos(compra.total ?? 0)}</strong> · saldo{' '}
          <strong className="cifras text-texto">{pesos(compra.saldo_pendiente)}</strong>
        </p>
        <CampoTexto
          etiqueta="Monto"
          value={monto}
          onChange={(e) => setMonto(e.target.value.replace(/[^\d.]/g, ''))}
          inputMode="numeric"
          autoFocus
        />
        <CampoTexto etiqueta="Fecha del pago" type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value)} />
        <CampoTexto
          etiqueta="Notas (opcional)"
          value={notas}
          onChange={(e) => setNotas(e.target.value)}
          placeholder="Ej.: transferencia Bancolombia"
          className="sm:col-span-2"
        />
        {monto && invalido ? <p className="text-sm text-peligro-texto sm:col-span-2">{invalido}</p> : null}
        {pagar.isError ? <div className="sm:col-span-2"><AvisoError error={pagar.error} /></div> : null}
      </form>
    </Dialogo>
  )
}
