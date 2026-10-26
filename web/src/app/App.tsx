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
import { Carga } from '../paginas/carga/Carga'
import { CargaInicial } from '../paginas/carga/CargaInicial'
import { Conteos } from '../paginas/conteo/Conteos'
import { DetalleConteo } from '../paginas/conteo/DetalleConteo'
import { NuevoConteo } from '../paginas/conteo/NuevoConteo'
import { Compras } from '../paginas/compras/Compras'
import { DetalleCompra } from '../paginas/compras/DetalleCompra'
import { NuevaCompra } from '../paginas/compras/NuevaCompra'
import { FichaProveedor } from '../paginas/proveedores/FichaProveedor'
import { Proveedores } from '../paginas/proveedores/Proveedores'

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
          <Route path="/compras" element={<Compras />} />
          <Route path="/compras/nueva" element={<NuevaCompra />} />
          <Route path="/compras/:id" element={<DetalleCompra />} />
          <Route path="/carga" element={<Carga />} />
          <Route path="/carga-inicial" element={<CargaInicial />} />
          <Route path="/proveedores" element={<Proveedores />} />
          <Route path="/proveedores/:id" element={<FichaProveedor />} />
          <Route path="/conteo" element={<Conteos />} />
          <Route path="/conteo/nuevo" element={<NuevoConteo />} />
          <Route path="/conteo/:id" element={<DetalleConteo />} />
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
