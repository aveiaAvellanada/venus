import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Pencil, Plus, Trash2 } from 'lucide-react'
import {
  cuentasDelProveedor, eliminarCuenta, guardarCuenta, TIPOS_CUENTA, type CuentaBancaria, type TipoCuenta,
} from '../../lib/datos/proveedores'
import { AvisoError, Boton, CampoTexto, Cargando, Dialogo, MensajeError } from '../../componentes/ui'

const NOMBRE_TIPO: Record<TipoCuenta, string> = {
  ahorros: 'Ahorros', corriente: 'Corriente', nequi: 'Nequi', daviplata: 'Daviplata',
}

export function Cuentas({ proveedorId }: { proveedorId: string }) {
  const cliente = useQueryClient()
  const clave = ['proveedores', proveedorId, 'cuentas']
  const cuentas = useQuery({ queryKey: clave, queryFn: () => cuentasDelProveedor(proveedorId) })
  const [editando, setEditando] = useState<CuentaBancaria | 'nueva' | null>(null)
  const [copiada, setCopiada] = useState<string | null>(null)
  const borrar = useMutation({
    mutationFn: eliminarCuenta,
    onSettled: () => cliente.invalidateQueries({ queryKey: clave }),
  })

  async function copiar(c: CuentaBancaria) {
    await navigator.clipboard?.writeText(c.numero_cuenta)
    setCopiada(c.id)
    setTimeout(() => setCopiada(null), 1500)
  }

  if (cuentas.isPending) return <Cargando />
  if (cuentas.isError) return <MensajeError error={cuentas.error} />

  return (
    <div className="flex flex-col gap-3">
      {cuentas.data.length ? (
        <ul className="grid gap-3 sm:grid-cols-2">
          {cuentas.data.map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 rounded-2xl border border-borde bg-fondo p-4">
              <div>
                <p className="font-semibold">{c.banco}</p>
                <p className="text-sm text-texto2">{NOMBRE_TIPO[c.tipo_cuenta as TipoCuenta] ?? c.tipo_cuenta}</p>
                <p className="cifras mt-1 text-lg">{c.numero_cuenta}</p>
                {c.titular ? <p className="text-sm text-texto3">A nombre de {c.titular}</p> : null}
              </div>
              <div className="flex gap-1">
                <button aria-label={`Copiar número de ${c.banco}`} onClick={() => copiar(c)} className="rounded-lg p-1.5 text-texto3 hover:bg-superficie2 hover:text-texto">
                  <Copy className="size-4" />
                </button>
                <button aria-label={`Editar cuenta de ${c.banco}`} onClick={() => setEditando(c)} className="rounded-lg p-1.5 text-texto3 hover:bg-superficie2 hover:text-texto">
                  <Pencil className="size-4" />
                </button>
                <button
                  aria-label={`Borrar cuenta de ${c.banco}`}
                  onClick={() => window.confirm(`¿Borrar la cuenta ${c.banco} ${c.numero_cuenta}?`) && borrar.mutate(c.id)}
                  className="rounded-lg p-1.5 text-texto3 hover:bg-peligro-soft hover:text-peligro-texto"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
              {copiada === c.id ? <span role="status" className="sr-only">Número copiado</span> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-borde bg-fondo px-4 py-6 text-center text-sm text-texto3">
          Sin cuentas registradas. Agrega una para tenerla a mano al pagar.
        </p>
      )}
      {borrar.isError ? <AvisoError error={borrar.error} /> : null}
      <Boton variante="fantasma" onClick={() => setEditando('nueva')} className="self-start border border-borde">
        <Plus aria-hidden className="size-4" />
        Agregar cuenta
      </Boton>
      {editando ? (
        <EditarCuenta
          proveedorId={proveedorId}
          cuenta={editando === 'nueva' ? undefined : editando}
          alCerrar={() => setEditando(null)}
          alGuardar={() => { setEditando(null); cliente.invalidateQueries({ queryKey: clave }) }}
        />
      ) : null}
    </div>
  )
}

function EditarCuenta({ proveedorId, cuenta, alCerrar, alGuardar }: {
  proveedorId: string
  cuenta?: CuentaBancaria
  alCerrar: () => void
  alGuardar: () => void
}) {
  const [banco, setBanco] = useState(cuenta?.banco ?? '')
  const [tipo, setTipo] = useState<TipoCuenta>((cuenta?.tipo_cuenta as TipoCuenta) ?? 'ahorros')
  const [numero, setNumero] = useState(cuenta?.numero_cuenta ?? '')
  const [titular, setTitular] = useState(cuenta?.titular ?? '')
  const guardar = useMutation({
    mutationFn: () => guardarCuenta(proveedorId, cuenta?.id ?? null, {
      banco: banco.trim(), tipo_cuenta: tipo, numero_cuenta: numero.trim(), titular: titular.trim() || null,
    }),
    onSuccess: alGuardar,
  })
  const completo = banco.trim() && numero.trim()

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (completo) guardar.mutate()
  }

  return (
    <Dialogo
      titulo={cuenta ? 'Editar cuenta' : 'Nueva cuenta bancaria'}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton type="button" variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
          <Boton type="submit" form="form-cuenta" disabled={!completo} cargando={guardar.isPending}>Guardar</Boton>
        </>
      }
    >
      <form id="form-cuenta" onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
        <CampoTexto etiqueta="Banco *" value={banco} onChange={(e) => setBanco(e.target.value)} placeholder="Ej.: Bancolombia" autoFocus />
        <label className="block text-sm">
          <span className="mb-1.5 block font-medium">Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoCuenta)} className="w-full rounded-xl border border-borde bg-fondo px-3 py-2">
            {TIPOS_CUENTA.map((t) => <option key={t} value={t}>{NOMBRE_TIPO[t]}</option>)}
          </select>
        </label>
        <CampoTexto etiqueta="Número *" value={numero} onChange={(e) => setNumero(e.target.value)} inputMode="numeric" />
        <CampoTexto etiqueta="Titular" value={titular} onChange={(e) => setTitular(e.target.value)} />
        {guardar.isError ? <div className="sm:col-span-2"><AvisoError error={guardar.error} /></div> : null}
      </form>
    </Dialogo>
  )
}
