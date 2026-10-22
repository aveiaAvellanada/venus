import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'
import { LoaderCircle, X } from 'lucide-react'
import { hexesDeColor } from '@shared/colores'

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
    ? 'bg-primario text-sobre-primario hover:bg-primario-press disabled:opacity-50'
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

// Círculo con el color del zapato; con dos colores ("Rojo y blanco") se parte a
// la mitad: el primero a la izquierda y el segundo a la derecha.
export function PuntoColor({ color }: { color: string }) {
  return (
    <span aria-hidden data-testid="punto-color" className="inline-flex size-2.5 shrink-0 overflow-hidden rounded-full border border-borde-fuerte align-middle">
      {hexesDeColor(color).map((hex, i) => (
        <span key={i} data-testid="punto-color-mitad" className="flex-1" style={{ backgroundColor: hex }} />
      ))}
    </span>
  )
}

// Color con su círculo, para las líneas de detalle ("Venus · ● Rojo y blanco").
export function ConColor({ color }: { color: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <PuntoColor color={color} />
      {color}
    </span>
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

// Ventana modal: cierra con Escape, con la X o tocando fuera.
export function Dialogo({ titulo, alCerrar, children, pie, ancho = 'max-w-lg' }: {
  titulo: string
  alCerrar: () => void
  children: ReactNode
  pie?: ReactNode
  ancho?: string
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-overlay px-4 py-[8vh]" onMouseDown={alCerrar}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.key === 'Escape' && alCerrar()}
        className={`w-full ${ancho} rounded-2xl border border-borde bg-fondo shadow-2xl`}
      >
        <header className="flex items-center justify-between border-b border-borde px-5 py-4">
          <h2 className="text-subtitulo">{titulo}</h2>
          <button type="button" aria-label="Cerrar" onClick={alCerrar} className="rounded-lg p-1.5 text-texto3 hover:bg-superficie2">
            <X className="size-5" />
          </button>
        </header>
        <div className="px-5 py-4">{children}</div>
        {pie ? <footer className="flex justify-end gap-2 border-t border-borde px-5 py-4">{pie}</footer> : null}
      </div>
    </div>
  )
}

export function CampoTexto({ etiqueta, className = '', ...props }: InputHTMLAttributes<HTMLInputElement> & { etiqueta: string }) {
  return (
    <label className={`block text-sm ${className}`}>
      <span className="mb-1.5 block font-medium">{etiqueta}</span>
      <input {...props} className="w-full rounded-xl border border-borde bg-fondo px-3 py-2 outline-none focus:border-primario" />
    </label>
  )
}

export function AvisoError({ error }: { error: unknown }) {
  return (
    <p role="alert" className="rounded-xl bg-peligro-soft px-3 py-2 text-sm text-peligro-texto">
      {error instanceof Error ? error.message : 'Algo salió mal.'}
    </p>
  )
}

// Logo con los colores del tema (en oscuro, cuadro claro con la letra oscura).
export function Logo({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 64 64" className={className}>
      <rect width="64" height="64" rx="14" className="fill-primario" />
      <path d="M18 18h8l6 20 6-20h8L36 46h-8z" className="fill-sobre-primario" />
    </svg>
  )
}
