import { Link } from 'react-router'
import type { Seccion } from '../navegacion'
import { Insignia } from '../componentes/ui'

export function Proximamente({ seccion }: { seccion: Seccion }) {
  return (
    <div className="mx-auto max-w-xl py-12 text-center">
      <div className="mx-auto mb-5 flex size-14 items-center justify-center rounded-2xl bg-primario-soft text-primario">
        <seccion.icono aria-hidden className="size-7" />
      </div>
      <Insignia tono="primario">Llega en la fase {seccion.fase}</Insignia>
      <h1 className="mt-3 text-2xl font-bold">{seccion.titulo}</h1>
      <p className="mt-3 text-texto2">{seccion.descripcion}</p>
      <Link to="/" className="mt-8 inline-block text-sm font-semibold text-primario hover:underline">
        Volver al inicio
      </Link>
    </div>
  )
}
