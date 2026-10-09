// Catálogo de permisos y reglas: shared/permisos.ts (los usan la app y el panel web).
// Aquí, los módulos de la app del celular.
import { esDueno, tienePermiso, type ConPermisos, type Permiso } from '../shared/permisos'

export * from '../shared/permisos'

export interface Modulo {
  id: string
  titulo: string
  icono: string
  // undefined = cualquier cuenta activa; 'dueno' = solo el dueño (no delegable).
  permiso?: Permiso | 'dueno'
  ruta?: string
}

export const MODULOS: Modulo[] = [
  { id: 'ventas',             titulo: 'Ventas',             icono: '🛒', permiso: 'ventas', ruta: '/ventas/nueva' },
  { id: 'devoluciones',       titulo: 'Devoluciones',       icono: '↩️', permiso: 'devoluciones', ruta: '/movimientos' },
  { id: 'inventario-calzado', titulo: 'Inventario calzado', icono: '👟', ruta: '/productos' },
  { id: 'granja',             titulo: 'Granja',             icono: '🥚', ruta: '/productos' },
  { id: 'recibir-mercancia',  titulo: 'Recibir mercancía',  icono: '📥', permiso: 'recibir_mercancia', ruta: '/recibir-mercancia' },
  { id: 'caja',               titulo: 'Caja',               icono: '🧾', permiso: 'caja', ruta: '/caja' },
  { id: 'gastos-variables',   titulo: 'Gastos variables',   icono: '💸', permiso: 'gastos', ruta: '/gastos' },
  { id: 'proveedores',        titulo: 'Proveedores',        icono: '🚚', permiso: 'proveedores', ruta: '/proveedores' },
  { id: 'gastos-fijos',       titulo: 'Gastos fijos',       icono: '📌', permiso: 'gastos_fijos', ruta: '/gastos/fijos' },
  { id: 'reportes',           titulo: 'Reportes',           icono: '📊', permiso: 'reportes', ruta: '/reportes' },
  { id: 'carga-inicial',      titulo: 'Carga inicial',      icono: '📷', permiso: 'carga_inicial', ruta: '/inventario/carga' },
  { id: 'gestion-empleado',   titulo: 'Empleados',          icono: '👤', permiso: 'dueno', ruta: '/empleados' },
  { id: 'balance',            titulo: 'Balance',            icono: '⚖️', permiso: 'balance', ruta: '/balance' },
  { id: 'analisis-ia',        titulo: 'Análisis IA',        icono: '🤖', permiso: 'dueno' },
]

function permite(p: ConPermisos, m: Modulo): boolean {
  if (m.permiso === undefined) return true
  if (m.permiso === 'dueno') return esDueno(p)
  return tienePermiso(p, m.permiso)
}

export const modulosPara = (p: ConPermisos): Modulo[] => MODULOS.filter((m) => permite(p, m))

export const puedeAcceder = (p: ConPermisos | null | undefined, id: string): boolean => {
  const m = MODULOS.find((x) => x.id === id)
  return !!p && !!m && permite(p, m)
}
