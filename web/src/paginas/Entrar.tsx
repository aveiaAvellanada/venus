import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router'
import { useSesion } from '../lib/auth'
import { NEGOCIO } from '../lib/negocio'
import { Boton } from '../componentes/ui'

export function Entrar() {
  const { estado, entrar } = useSesion()
  const [usuario, setUsuario] = useState('')
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (estado.tipo === 'dentro') return <Navigate to="/" replace />

  async function enviar(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setEnviando(true)
    try {
      await entrar(usuario, pin)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión.')
      setPin('')
    } finally {
      setEnviando(false)
    }
  }

  const aviso = error ?? (estado.tipo === 'fuera' ? estado.aviso : null)

  return (
    <main className="flex min-h-dvh items-center justify-center bg-superficie px-4">
      <form onSubmit={enviar} className="w-full max-w-sm rounded-3xl border border-borde bg-fondo p-8 shadow-sm">
        <img src="/favicon.svg" alt="" className="mb-6 size-12" />
        <h1 className="text-2xl font-bold">{NEGOCIO.nombre}</h1>
        <p className="mb-8 text-sm text-texto2">Panel del dueño</p>

        <div className="mb-4">
          <label htmlFor="usuario" className="mb-1.5 block text-sm font-medium">Usuario</label>
          <input
            id="usuario"
            value={usuario}
            onChange={(e) => setUsuario(e.target.value.replace(/\s/g, '').toLowerCase())}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            className="w-full rounded-xl border border-borde bg-fondo px-3 py-2.5 outline-none focus:border-primario focus:ring-2 focus:ring-primario-soft"
          />
        </div>

        <div className="mb-6">
          <label htmlFor="pin" className="mb-1.5 block text-sm font-medium">PIN</label>
          <input
            id="pin"
            aria-describedby="pin-ayuda"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            type="password"
            inputMode="numeric"
            autoComplete="current-password"
            maxLength={6}
            className="cifras w-full rounded-xl border border-borde bg-fondo px-3 py-2.5 tracking-[0.4em] outline-none focus:border-primario focus:ring-2 focus:ring-primario-soft"
          />
          <p id="pin-ayuda" className="mt-1.5 text-xs text-texto3">El mismo de la app del celular (6 números).</p>
        </div>

        {aviso ? (
          <p role="alert" className="mb-4 rounded-xl bg-peligro-soft px-3 py-2 text-sm text-peligro-texto">
            {aviso}
          </p>
        ) : null}

        <Boton type="submit" cargando={enviando} disabled={!usuario || pin.length !== 6} className="w-full">
          Entrar
        </Boton>
      </form>
    </main>
  )
}
