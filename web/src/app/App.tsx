import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { ProveedorSesion, useSesion } from '../lib/auth'
import { SECCIONES } from '../navegacion'
import { Estructura } from '../componentes/Estructura'
import { Cargando } from '../componentes/ui'
import { Entrar } from '../paginas/Entrar'
import { Inicio } from '../paginas/Inicio'
import { Inventario } from '../paginas/inventario/Inventario'
import { NoEncontrada } from '../paginas/NoEncontrada'
import { Proximamente } from '../paginas/Proximamente'

const cliente = new QueryClient({
  defaultOptions: { queries: { staleTime: 60_000, retry: 1 } },
})

export function App() {
  return (
    <QueryClientProvider client={cliente}>
      <ProveedorSesion>
        <BrowserRouter>
          <Rutas />
        </BrowserRouter>
      </ProveedorSesion>
    </QueryClientProvider>
  )
}

export function Rutas() {
  return (
    <Routes>
      <Route path="/entrar" element={<Entrar />} />
      <Route element={<SoloConSesion />}>
        <Route element={<Estructura />}>
          <Route index element={<Inicio />} />
          <Route path="/inventario" element={<Inventario />} />
          {SECCIONES.filter((s) => !s.lista).map((s) => (
            <Route key={s.id} path={s.ruta} element={<Proximamente seccion={s} />} />
          ))}
          <Route path="*" element={<NoEncontrada />} />
        </Route>
      </Route>
    </Routes>
  )
}

function SoloConSesion() {
  const { estado } = useSesion()
  if (estado.tipo === 'cargando') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Cargando texto="Abriendo el panel…" />
      </div>
    )
  }
  if (estado.tipo === 'fuera') return <Navigate to="/entrar" replace />
  return <Outlet />
}
