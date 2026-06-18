export type Rol = 'dueno' | 'admin' | 'empleado'

export interface Modulo {
  id: string
  titulo: string
  icono: string
  roles: Rol[]
  ruta?: string
}

const TODOS: Rol[] = ['dueno', 'admin', 'empleado']
const STAFF_ADMIN: Rol[] = ['dueno', 'admin']
const SOLO_DUENO: Rol[] = ['dueno']

export const MODULOS: Modulo[] = [
  { id: 'ventas',             titulo: 'Ventas',             icono: '🛒', roles: TODOS, ruta: '/ventas' },
  { id: 'devoluciones',       titulo: 'Devoluciones',       icono: '↩️', roles: TODOS, ruta: '/devoluciones' },
  { id: 'inventario-calzado', titulo: 'Inventario calzado', icono: '👟', roles: TODOS, ruta: '/inventario/calzado' },
  { id: 'granja',             titulo: 'Granja',             icono: '🥚', roles: TODOS, ruta: '/inventario/granja' },
  { id: 'recibir-mercancia',  titulo: 'Recibir mercancía',  icono: '📥', roles: TODOS, ruta: '/recibir-mercancia' },
  { id: 'caja',               titulo: 'Caja',               icono: '🧾', roles: TODOS, ruta: '/caja' },
  { id: 'gastos-variables',   titulo: 'Gastos variables',   icono: '💸', roles: TODOS, ruta: '/gastos' },
  { id: 'proveedores',        titulo: 'Proveedores',        icono: '🚚', roles: STAFF_ADMIN, ruta: '/proveedores' },
  { id: 'gastos-fijos',       titulo: 'Gastos fijos',       icono: '📌', roles: STAFF_ADMIN, ruta: '/gastos/fijos' },
  { id: 'reportes',           titulo: 'Reportes',           icono: '📊', roles: STAFF_ADMIN, ruta: '/reportes' },
  { id: 'carga-inicial',      titulo: 'Carga inicial',      icono: '📷', roles: STAFF_ADMIN, ruta: '/inventario/carga' },
  { id: 'gestion-empleado',   titulo: 'Empleados',          icono: '👤', roles: SOLO_DUENO, ruta: '/empleados' },
  { id: 'balance',            titulo: 'Balance',            icono: '⚖️', roles: SOLO_DUENO, ruta: '/balance' },
  { id: 'analisis-ia',        titulo: 'Análisis IA',        icono: '🤖', roles: SOLO_DUENO },
]

export const modulosPara = (rol: Rol): Modulo[] =>
  MODULOS.filter(m => m.roles.includes(rol))

export const puedeAcceder = (rol: Rol, id: string): boolean =>
  MODULOS.find(m => m.id === id)?.roles.includes(rol) ?? false
