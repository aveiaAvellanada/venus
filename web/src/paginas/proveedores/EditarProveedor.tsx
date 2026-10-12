import { useState, type FormEvent } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { guardarProveedor } from '../../lib/datos/proveedores'
import type { Proveedor } from '../../lib/proveedores'
import { AvisoError, Boton, CampoTexto, Dialogo } from '../../componentes/ui'

// Crear (sin `proveedor`) o editar los datos de un proveedor.
export function EditarProveedor({ proveedor, alCerrar, alGuardar }: {
  proveedor?: Proveedor
  alCerrar: () => void
  alGuardar: (p: Proveedor) => void
}) {
  const cliente = useQueryClient()
  const [nombre, setNombre] = useState(proveedor?.nombre ?? '')
  const [nit, setNit] = useState(proveedor?.nit_cedula ?? '')
  const [telefono, setTelefono] = useState(proveedor?.telefono ?? '')
  const [ciudad, setCiudad] = useState(proveedor?.ciudad ?? '')
  const [notas, setNotas] = useState(proveedor?.notas ?? '')
  const [activo, setActivo] = useState(proveedor?.activo ?? true)

  const guardar = useMutation({
    mutationFn: () => guardarProveedor(proveedor?.id ?? null, {
      nombre: nombre.trim(),
      nit_cedula: nit.trim() || null,
      telefono: telefono.trim() || null,
      ciudad: ciudad.trim() || null,
      notas: notas.trim() || null,
      activo,
    }),
    onSuccess: async (p) => {
      await cliente.invalidateQueries({ queryKey: ['proveedores'] })
      alGuardar(p)
    },
  })

  function enviar(e: FormEvent) {
    e.preventDefault()
    if (nombre.trim()) guardar.mutate()
  }

  return (
    <Dialogo
      titulo={proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}
      alCerrar={alCerrar}
      pie={
        <>
          <Boton type="button" variante="fantasma" onClick={alCerrar}>Cancelar</Boton>
          <Boton type="submit" form="form-proveedor" disabled={!nombre.trim()} cargando={guardar.isPending}>Guardar</Boton>
        </>
      }
    >
      <form id="form-proveedor" onSubmit={enviar} className="grid gap-4 sm:grid-cols-2">
        <CampoTexto etiqueta="Nombre *" value={nombre} onChange={(e) => setNombre(e.target.value)} autoFocus className="sm:col-span-2" />
        <CampoTexto etiqueta="NIT o cédula" value={nit} onChange={(e) => setNit(e.target.value)} />
        <CampoTexto etiqueta="Teléfono (WhatsApp)" value={telefono} onChange={(e) => setTelefono(e.target.value)} inputMode="tel" />
        <CampoTexto etiqueta="Ciudad" value={ciudad} onChange={(e) => setCiudad(e.target.value)} />
        <label className="flex items-center gap-2 self-end pb-2 text-sm">
          <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
          Activo (aparece al recibir mercancía)
        </label>
        <label className="block text-sm sm:col-span-2">
          <span className="mb-1.5 block font-medium">Notas</span>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            placeholder="Días de visita, contacto, condiciones…"
            className="w-full rounded-xl border border-borde bg-fondo px-3 py-2 outline-none focus:border-primario"
          />
        </label>
        {guardar.isError ? <div className="sm:col-span-2"><AvisoError error={guardar.error} /></div> : null}
      </form>
    </Dialogo>
  )
}
