import { supabase } from './supabase'
import type { Permiso } from './permisos'

// ─── Tipos de acceso a datos ────────────────────────────────────────────────

export type EmpleadoConfig = {
  sueldo_mensual: number | null
  fecha_inicio: string | null
  dias_trabajo_semana: number | null
  activo: boolean
}

export type Empleado = {
  id: string
  nombre: string
  usuario: string
  rol: 'empleado'
  permisos: Permiso[]
  activo: boolean
  config: EmpleadoConfig | null
}

export type NuevoEmpleadoInput = {
  nombre: string
  usuario: string
  pin: string
  permisos: Permiso[]
}

export type PagoEmpleado = {
  id: string
  monto: number
  fecha_pago: string
  periodo_inicio: string | null
  periodo_fin: string | null
  dias_trabajados: number | null
  nota: string | null
}

export type RegistrarPagoInput = {
  empleado_id: string
  monto: number
  fecha_pago: string
  periodo_inicio?: string | null
  periodo_fin?: string | null
  dias_trabajados?: number | null
  nota?: string | null
}

// ─── Acceso a datos ──────────────────────────────────────────────────────────

/** Empleados del negocio = todos menos el dueño, con sus permisos y config. Activos primero. */
export async function listarEmpleados(): Promise<Empleado[]> {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, nombre, usuario, rol, permisos, activo')
    .eq('rol', 'empleado')
    .order('activo', { ascending: false })
    .order('nombre')
  if (error) throw error

  const ids = (users ?? []).map((u) => u.id)
  const { data: configs, error: e2 } = await supabase
    .from('empleado_config')
    .select('empleado_id, sueldo_mensual, fecha_inicio, dias_trabajo_semana, activo')
    .in('empleado_id', ids.length ? ids : ['00000000-0000-0000-0000-000000000000'])
  if (e2) throw e2

  const byId = new Map((configs ?? []).map((c) => [c.empleado_id, c]))
  return (users ?? []).map((u) => {
    const c = byId.get(u.id)
    return {
      id: u.id,
      nombre: u.nombre,
      usuario: u.usuario,
      rol: 'empleado' as const,
      permisos: (u.permisos ?? []) as Permiso[],
      activo: u.activo,
      config: c
        ? {
            sueldo_mensual: c.sueldo_mensual,
            fecha_inicio: c.fecha_inicio,
            dias_trabajo_semana: c.dias_trabajo_semana,
            activo: c.activo,
          }
        : null,
    }
  })
}

export async function guardarConfigEmpleado(
  empleadoId: string,
  cfg: { sueldo_mensual: number; fecha_inicio?: string | null; dias_trabajo_semana?: number | null }
): Promise<void> {
  const { error } = await supabase
    .from('empleado_config')
    .upsert(
      {
        empleado_id: empleadoId,
        sueldo_mensual: cfg.sueldo_mensual,
        fecha_inicio: cfg.fecha_inicio ?? null,
        dias_trabajo_semana: cfg.dias_trabajo_semana ?? null,
      },
      { onConflict: 'empleado_id' }
    )
  if (error) throw error
}

// Las cuentas se gestionan por RPC (solo el dueño): crean el acceso en Auth,
// validan usuario/PIN/permisos y, al desactivar, bloquean el login y cierran sesiones.

/** Crea la cuenta (nombre, usuario, PIN de 6) con sus permisos. Devuelve el id. */
export async function crearEmpleado(input: NuevoEmpleadoInput): Promise<string> {
  const { data, error } = await supabase.rpc('crear_empleado', {
    p_nombre: input.nombre,
    p_usuario: input.usuario,
    p_pin: input.pin,
    p_permisos: input.permisos,
  })
  if (error) throw error
  return data as string
}

/** Cambia el nombre y/o los permisos (lo que no se pase queda igual). */
export async function actualizarEmpleado(
  empleadoId: string,
  cambios: { nombre?: string; permisos?: Permiso[] }
): Promise<void> {
  const { error } = await supabase.rpc('actualizar_empleado', {
    p_id: empleadoId,
    p_nombre: cambios.nombre,
    p_permisos: cambios.permisos,
  })
  if (error) throw error
}

export async function restablecerPinEmpleado(empleadoId: string, pin: string): Promise<void> {
  const { error } = await supabase.rpc('restablecer_pin_empleado', { p_id: empleadoId, p_pin: pin })
  if (error) throw error
}

export async function setActivoEmpleado(empleadoId: string, activo: boolean): Promise<void> {
  const { error } = await supabase.rpc('cambiar_estado_empleado', { p_id: empleadoId, p_activo: activo })
  if (error) throw error
}

export async function diasTrabajadosMes(
  empleadoId: string,
  anio: number,
  mes: number
): Promise<number> {
  const { data, error } = await supabase.rpc('obtener_dias_trabajados', {
    p_empleado_id: empleadoId,
    p_anio: anio,
    p_mes: mes,
  })
  if (error) throw error
  return (data as number) ?? 0
}

export async function registrarPagoEmpleado(input: RegistrarPagoInput): Promise<void> {
  const { error } = await supabase.from('empleado_pagos').insert({
    empleado_id: input.empleado_id,
    monto: input.monto,
    fecha_pago: input.fecha_pago,
    periodo_inicio: input.periodo_inicio ?? null,
    periodo_fin: input.periodo_fin ?? null,
    dias_trabajados: input.dias_trabajados ?? null,
    nota: input.nota ?? null,
  })
  if (error) throw error
}

export async function historialPagos(empleadoId: string): Promise<PagoEmpleado[]> {
  const { data, error } = await supabase
    .from('empleado_pagos')
    .select('id, monto, fecha_pago, periodo_inicio, periodo_fin, dias_trabajados, nota')
    .eq('empleado_id', empleadoId)
    .order('fecha_pago', { ascending: false })
  if (error) throw error
  return (data ?? []) as PagoEmpleado[]
}

// ─── Lógica pura ─────────────────────────────────────────────────────────────

export function diasEsperadosMes(diasTrabajoSemana: number | null, anio: number, mes: number): number {
  const dts = diasTrabajoSemana ?? 6
  const diasDelMes = new Date(anio, mes, 0).getDate() // mes 1-12 → último día de ese mes
  return Math.round((dts * diasDelMes) / 7)
}

export function montoSugeridoPago(sueldoMensual: number, diasTrabajados: number, diasEsperados: number): number {
  if (diasEsperados <= 0) return Math.round(sueldoMensual)
  return Math.round((sueldoMensual * Math.min(diasTrabajados, diasEsperados)) / diasEsperados)
}
