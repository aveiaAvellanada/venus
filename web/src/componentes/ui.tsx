import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { LoaderCircle } from 'lucide-react'

export function Tarjeta({ titulo, accion, children, className = '' }: {
  titulo?: ReactNode
  accion?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={`rounded-2xl border border-borde bg-fondo p-5 ${className}`}>
      {titulo || accion ? (
        <header className="mb-4 flex items-center justify-between gap-3">
          {titulo ? <h2 className="text-sm font-semibold text-texto2">{titulo}</h2> : <span />}
          {accion}
        </header>
      ) : null}
      {children}
    </section>
  )
}

type TonoInsignia = 'neutro' | 'exito' | 'peligro' | 'advertencia' | 'primario'

const TONOS: Record<TonoInsignia, string> = {
  neutro: 'bg-superficie2 text-texto2',
  exito: 'bg-exito-soft text-exito-texto',
  peligro: 'bg-peligro-soft text-peligro-texto',
  advertencia: 'bg-advertencia-soft text-advertencia-texto',
  primario: 'bg-primario-soft text-primario',
}

export function Insignia({ tono = 'neutro', children }: { tono?: TonoInsignia; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${TONOS[tono]}`}>
      {children}
    </span>
  )
}

export function Boton({ variante = 'primario', cargando = false, children, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'primario' | 'fantasma'
  cargando?: boolean
}) {
  const estilos = variante === 'primario'
    ? 'bg-primario text-white hover:bg-primario-press disabled:opacity-50'
    : 'text-texto2 hover:bg-superficie2 hover:text-texto'
  return (
    <button
      {...props}
      disabled={props.disabled || cargando}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primario disabled:cursor-not-allowed ${estilos} ${className}`}
    >
      {cargando ? <LoaderCircle aria-hidden className="size-4 animate-spin" /> : null}
      {children}
    </button>
  )
}

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div role="status" className="flex items-center gap-2 text-sm text-texto3">
      <LoaderCircle aria-hidden className="size-4 animate-spin" />
      {texto}
    </div>
  )
}

export function MensajeError({ error }: { error: unknown }) {
  const texto = error instanceof Error ? error.message : 'Algo salió mal.'
  return (
    <p role="alert" className="rounded-xl bg-peligro-soft px-3 py-2 text-sm text-peligro-texto">
      No se pudo cargar: {texto}
    </p>
  )
}
