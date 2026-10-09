import { supabase } from './supabase';
import { Database } from './database.types';
import { comprimirBajoLimite } from './imagenes';

type GastoVariableRow = Database['public']['Tables']['gastos_variables']['Row'];
type GastoVariableInsert = Database['public']['Tables']['gastos_variables']['Insert'];
type GastoFijoRow = Database['public']['Tables']['gastos_fijos']['Row'];
type GastoFijoInsert = Database['public']['Tables']['gastos_fijos']['Insert'];
type GastoFijoPagoRow = Database['public']['Tables']['gastos_fijos_pagos']['Row'];
type GastoFijoPagoInsert = Database['public']['Tables']['gastos_fijos_pagos']['Insert'];

// `valor` es lo que acepta el CHECK de gastos_variables.categoria y lo único que
// viaja a la base; `etiqueta` es lo que lee el usuario. (El formulario era texto
// libre: "Fletes" o "Insumos" con mayúscula rompían el CHECK al guardar.)
export const CATEGORIAS_GASTO = [
  { valor: 'transporte', etiqueta: 'Transporte' },
  { valor: 'reparaciones', etiqueta: 'Reparaciones' },
  { valor: 'insumos', etiqueta: 'Insumos' },
  { valor: 'otros', etiqueta: 'Otros' },
] as const;

export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number]['valor'];

export const etiquetaCategoriaGasto = (valor: string): string =>
  CATEGORIAS_GASTO.find((c) => c.valor === valor)?.etiqueta ?? valor;

// Fecha de hoy en Florencia (YYYY-MM-DD). gastos_variables.fecha es `date`:
// mandar toISOString() (UTC) guardaba los gastos de después de las 7 p. m. con
// la fecha de mañana, y un gasto del cajón no se restaba de la caja de hoy.
export const hoyBogota = (ahora: Date = new Date()): string =>
  ahora.toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });

// 'YYYY-MM-DD' → 'DD/MM/YYYY' sin pasar por Date: new Date('2026-10-09') es
// medianoche UTC y en Colombia se mostraba como el día anterior.
export function fechaCortaGasto(fecha: string): string {
  const [anio, mes, dia] = fecha.slice(0, 10).split('-');
  return `${dia}/${mes}/${anio}`;
}

export async function comprimirYSubirComprobante(uri: string): Promise<string> {
  // Comprime bajo el límite del PRD (≤500KB) reutilizando el helper compartido.
  const bytes = await comprimirBajoLimite(uri);

  const nombreArchivo = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

  const { data, error } = await supabase.storage
    .from('comprobantes')
    .upload(nombreArchivo, bytes, {
      contentType: 'image/jpeg',
    });

  if (error) {
    throw new Error(`Error al subir comprobante: ${error.message}`);
  }

  // Guardamos el path para luego generar signedUrls, o retornamos el path completo.
  // La base de datos guarda 'comprobante_url' (que puede ser el path interno)
  return data.path;
}

export async function obtenerGastosVariables(mes: number, anio: number): Promise<GastoVariableRow[]> {
  const startOfMonth = new Date(anio, mes - 1, 1).toISOString();
  const endOfMonth = new Date(anio, mes, 0, 23, 59, 59, 999).toISOString();

  const { data, error } = await supabase
    .from('gastos_variables')
    .select('*')
    .gte('fecha', startOfMonth)
    .lte('fecha', endOfMonth)
    .order('fecha', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function guardarGastoVariable(
  datos: Omit<GastoVariableInsert, 'comprobante_url'>,
  imagenUri?: string
): Promise<GastoVariableRow> {
  let comprobanteUrl = null;
  if (imagenUri) {
    comprobanteUrl = await comprimirYSubirComprobante(imagenUri);
  }

  const { data, error } = await supabase
    .from('gastos_variables')
    .insert({
      ...datos,
      comprobante_url: comprobanteUrl,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function obtenerGastosFijos(): Promise<GastoFijoRow[]> {
  const { data, error } = await supabase
    .from('gastos_fijos')
    .select('*')
    .eq('activo', true)
    .order('nombre', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function guardarGastoFijo(
  datos: GastoFijoInsert,
  imagenUri?: string
): Promise<GastoFijoRow> {
  let comprobanteUrl: string | null = null;
  if (imagenUri) {
    comprobanteUrl = await comprimirYSubirComprobante(imagenUri);
  }
  const payload = comprobanteUrl ? { ...datos, comprobante_url: comprobanteUrl } : datos;

  if (datos.id) {
    const { data, error } = await supabase
      .from('gastos_fijos')
      .update(payload)
      .eq('id', datos.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('gastos_fijos')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }
}

export async function obtenerPagosGastoFijo(gastoFijoId: string): Promise<GastoFijoPagoRow[]> {
  const { data, error } = await supabase
    .from('gastos_fijos_pagos')
    .select('*')
    .eq('gasto_fijo_id', gastoFijoId)
    .order('fecha_pago', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function registrarPagoFijo(
  datos: Omit<GastoFijoPagoInsert, 'comprobante_url'>,
  imagenUri?: string
): Promise<GastoFijoPagoRow> {
  let comprobanteUrl = null;
  if (imagenUri) {
    comprobanteUrl = await comprimirYSubirComprobante(imagenUri);
  }

  const { data, error } = await supabase
    .from('gastos_fijos_pagos')
    .insert({
      ...datos,
      comprobante_url: comprobanteUrl,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export interface GastoFijoPorVencer {
  id: string;
  nombre: string;
  monto_aproximado: number;
  dia_pago: number;
  dias_restantes: number;
}

export async function obtenerGastosFijosPorVencer(): Promise<GastoFijoPorVencer[]> {
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const endOfMonth = new Date(startOfMonth);
  endOfMonth.setMonth(endOfMonth.getMonth() + 1);
  endOfMonth.setDate(0);
  endOfMonth.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('gastos_fijos')
    .select('*, gastos_fijos_pagos(*)')
    .eq('activo', true)
    .gte('gastos_fijos_pagos.fecha_pago', startOfMonth.toISOString())
    .lte('gastos_fijos_pagos.fecha_pago', endOfMonth.toISOString());

  if (error) throw error;

  const hoy = new Date().getDate();
  return ((data ?? []) as unknown as (GastoFijoRow & { gastos_fijos_pagos: GastoFijoPagoRow[] })[])
    .filter((g) => !g.gastos_fijos_pagos || g.gastos_fijos_pagos.length === 0)
    .map((g) => ({
      id: g.id,
      nombre: g.nombre,
      monto_aproximado: g.monto_aproximado,
      dia_pago: g.dia_pago ?? 1,
      dias_restantes: (g.dia_pago ?? 1) - hoy,
    }))
    .filter((g) => g.dias_restantes <= 3)
    .sort((a, b) => a.dias_restantes - b.dias_restantes);
}
