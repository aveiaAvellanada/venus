import { Monitor, Moon, Sun } from 'lucide-react'
import { MODOS, useTema, type ModoTema } from '../lib/tema'

const ICONOS: Record<ModoTema, typeof Sun> = { claro: Sun, oscuro: Moon, sistema: Monitor }

// Claro / Oscuro / Sistema, como en Perfil → Tema de la app.
export function SelectorTema() {
  const [modo, setModo] = useTema()
  return (
    <div role="radiogroup" aria-label="Tema" className="flex rounded-xl border border-borde bg-fondo p-0.5">
      {MODOS.map((m) => {
        const Icono = ICONOS[m.valor]
        return (
          <button
            key={m.valor}
            role="radio"
            aria-checked={modo === m.valor}
            aria-label={m.titulo}
            title={m.titulo}
            onClick={() => setModo(m.valor)}
            className={`rounded-lg p-1.5 ${modo === m.valor ? 'bg-primario-soft text-primario' : 'text-texto3 hover:text-texto'}`}
          >
            <Icono aria-hidden className="size-4" />
          </button>
        )
      })}
    </div>
  )
}
