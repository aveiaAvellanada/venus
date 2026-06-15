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
  { id: 'devoluciones',       titulo: 'Devoluciones',       icono: '↩️', roles: TODOS },
  { id: 'inventario-calzado', titulo: 'Inventario calzado', icono: '👟', roles: TODOS },
  { id: 'granja',             titulo: 'Granja',             icono: '🥚', roles: TODOS },
  { id: 'recibir-mercancia',  titulo: 'Recibir mercancía',  icono: '📥', roles: TODOS },
  { id: 'caja',               titulo: 'Caja',               icono: '🧾', roles: TODOS },
  { id: 'gastos-variables',   titulo: 'Gastos variables',   icono: '💸', roles: TODOS },
  { id: 'proveedores',        titulo: 'Proveedores',        icono: '🚚', roles: STAFF_ADMIN },
  { id: 'gastos-fijos',       titulo: 'Gastos fijos',       icono: '📌', roles: STAFF_ADMIN },
  { id: 'reportes',           titulo: 'Reportes',           icono: '📊', roles: STAFF_ADMIN },
  { id: 'carga-inicial',      titulo: 'Carga inicial',      icono: '📷', roles: STAFF_ADMIN },
  { id: 'gestion-empleado',   titulo: 'Empleados',          icono: '👤', roles: SOLO_DUENO },
  { id: 'balance',            titulo: 'Balance',            icono: '⚖️', roles: SOLO_DUENO },
  { id: 'analisis-ia',        titulo: 'Análisis IA',        icono: '🤖', roles: SOLO_DUENO },
]

export const modulosPara = (rol: Rol): Modulo[] =>
  MODULOS.filter(m => m.roles.includes(rol))

export const puedeAcceder = (rol: Rol, id: string): boolean =>
  MODULOS.find(m => m.id === id)?.roles.includes(rol) ?? false
