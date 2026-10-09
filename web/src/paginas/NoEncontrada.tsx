import { Link } from 'react-router'

export function NoEncontrada() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">Esta página no existe</h1>
      <Link to="/" className="mt-6 inline-block text-sm font-semibold text-primario hover:underline">
        Volver al inicio
      </Link>
    </div>
  )
}
