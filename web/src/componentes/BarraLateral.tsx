import { NavLink } from 'react-router'
import { NAVEGACION } from '../navegacion'
import { NEGOCIO } from '../lib/negocio'

export function BarraLateral({ alNavegar }: { alNavegar?: () => void }) {
  return (
    <nav aria-label="Secciones" className="flex h-full flex-col gap-6 overflow-y-auto px-3 py-5">
      <div className="flex items-center gap-3 px-2">
        <img src="/favicon.svg" alt="" className="size-9" />
        <div>
          <p className="font-bold leading-tight">{NEGOCIO.nombre}</p>
          <p className="text-xs text-texto3">Panel del dueño</p>
        </div>
      </div>
      {NAVEGACION.map((grupo) => (
        <div key={grupo.titulo ?? 'principal'} className="flex flex-col gap-0.5">
          {grupo.titulo ? (
            <p className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-texto3">{grupo.titulo}</p>
          ) : null}
          {grupo.secciones.map((s) => (
            <NavLink
              key={s.id}
              to={s.ruta}
              end={s.ruta === '/'}
              onClick={alNavegar}
              className={({ isActive }) =>
                `group flex items-center gap-3 rounded-xl px-2 py-2 text-sm transition-colors ${
                  isActive
                    ? 'bg-primario-soft font-semibold text-primario'
                    : s.lista
                      ? 'text-texto hover:bg-superficie2'
                      : 'text-texto3 hover:bg-superficie2 hover:text-texto2'
                }`
              }
            >
              <s.icono aria-hidden className="size-4 shrink-0" />
              <span className="flex-1 truncate">{s.titulo}</span>
              {s.lista ? null : (
                <span className="rounded-md bg-superficie2 px-1.5 py-0.5 text-[10px] font-medium text-texto3">
                  Fase {s.fase}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  )
}
