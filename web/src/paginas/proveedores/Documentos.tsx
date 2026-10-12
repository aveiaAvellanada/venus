import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, FileText, Image, Trash2, Upload } from 'lucide-react'
import {
  documentosDelProveedor, eliminarDocumento, enlaceDocumento, subirDocumento, type Documento,
} from '../../lib/datos/proveedores'
import { comprimirFoto, MAX_PDF } from '../../lib/imagen'
import { AvisoError, Boton, Cargando, MensajeError } from '../../componentes/ui'

// Documentos del proveedor (RUT, cámara de comercio, facturas): PDF de hasta
// 5 MB o fotos, que se comprimen a 500 KB antes de subir. Bucket privado.
export function Documentos({ proveedorId, compraId }: { proveedorId: string; compraId?: string }) {
  const cliente = useQueryClient()
  const entrada = useRef<HTMLInputElement>(null)
  const clave = ['proveedores', proveedorId, 'documentos', compraId ?? 'todos']
  const docs = useQuery({ queryKey: clave, queryFn: () => documentosDelProveedor(proveedorId, compraId) })
  const [abriendo, setAbriendo] = useState<string | null>(null)

  const subir = useMutation({
    mutationFn: async (archivo: File) => {
      if (archivo.type === 'application/pdf') {
        if (archivo.size > MAX_PDF) throw new Error('El PDF pesa más de 5 MB.')
        return subirDocumento(proveedorId, archivo, archivo.name, 'pdf', compraId)
      }
      if (!archivo.type.startsWith('image/')) throw new Error('Solo se aceptan PDF o fotos.')
      return subirDocumento(proveedorId, await comprimirFoto(archivo), archivo.name, 'imagen', compraId)
    },
    onSettled: () => cliente.invalidateQueries({ queryKey: clave }),
  })
  const borrar = useMutation({
    mutationFn: eliminarDocumento,
    onSettled: () => cliente.invalidateQueries({ queryKey: clave }),
  })
  const abrir = useMutation({
    mutationFn: async (doc: Documento) => {
      setAbriendo(doc.id)
      // La pestaña se abre antes de pedir el enlace para que el navegador no la bloquee.
      const ventana = window.open('', '_blank')
      try {
        const url = await enlaceDocumento(doc.url)
        if (ventana) ventana.location.href = url
        else window.location.href = url
      } catch (e) {
        ventana?.close()
        throw e
      } finally {
        setAbriendo(null)
      }
    },
  })

  if (docs.isPending) return <Cargando />
  if (docs.isError) return <MensajeError error={docs.error} />

  return (
    <div className="flex flex-col gap-3">
      {docs.data.length ? (
        <ul className="divide-y divide-borde rounded-2xl border border-borde bg-fondo">
          {docs.data.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-4 py-3">
              {d.tipo === 'pdf'
                ? <FileText aria-hidden className="size-5 text-texto3" />
                : <Image aria-hidden className="size-5 text-texto3" />}
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{d.nombre_archivo ?? 'Documento'}</p>
                <p className="text-xs text-texto3">
                  {d.tipo === 'pdf' ? 'PDF' : 'Foto'} · subido el {new Date(d.created_at).toLocaleDateString('es-CO')}
                </p>
              </div>
              <Boton variante="fantasma" onClick={() => abrir.mutate(d)} cargando={abriendo === d.id} className="py-1.5">
                <ExternalLink aria-hidden className="size-4" />
                Abrir
              </Boton>
              <button
                aria-label={`Borrar ${d.nombre_archivo ?? 'documento'}`}
                onClick={() => window.confirm(`¿Borrar ${d.nombre_archivo ?? 'este documento'}?`) && borrar.mutate(d)}
                className="rounded-lg p-1.5 text-texto3 hover:bg-peligro-soft hover:text-peligro-texto"
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-xl border border-borde bg-fondo px-4 py-6 text-center text-sm text-texto3">
          {compraId ? 'Sin factura adjunta. Súbela en PDF o foto.' : 'Sin documentos. Sube el RUT, la cámara de comercio o facturas en PDF o foto.'}
        </p>
      )}
      {subir.isError ? <AvisoError error={subir.error} /> : null}
      {borrar.isError ? <AvisoError error={borrar.error} /> : null}
      {abrir.isError ? <AvisoError error={abrir.error} /> : null}
      <input
        ref={entrada}
        type="file"
        accept="application/pdf,image/*"
        aria-label="Archivo del documento"
        className="hidden"
        onChange={(e) => {
          const archivo = e.target.files?.[0]
          if (archivo) subir.mutate(archivo)
          e.target.value = ''
        }}
      />
      <Boton variante="fantasma" onClick={() => entrada.current?.click()} cargando={subir.isPending} className="self-start border border-borde">
        <Upload aria-hidden className="size-4" />
        Subir documento
      </Boton>
    </div>
  )
}
