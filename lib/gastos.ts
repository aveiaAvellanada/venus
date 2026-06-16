import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';
import { Database } from './database.types';

type GastoVariableRow = Database['public']['Tables']['gastos_variables']['Row'];
type GastoVariableInsert = Database['public']['Tables']['gastos_variables']['Insert'];
type GastoFijoRow = Database['public']['Tables']['gastos_fijos']['Row'];
type GastoFijoInsert = Database['public']['Tables']['gastos_fijos']['Insert'];
type GastoFijoPagoRow = Database['public']['Tables']['gastos_fijos_pagos']['Row'];
type GastoFijoPagoInsert = Database['public']['Tables']['gastos_fijos_pagos']['Insert'];

export async function comprimirYSubirComprobante(uri: string): Promise<string> {
  const manipulada = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1080 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  const nombreArchivo = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
  
  const response = await fetch(manipulada.uri);
  const blob = await response.blob();

  const { data, error } = await supabase.storage
    .from('comprobantes')
    .upload(nombreArchivo, blob, {
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

export async function guardarGastoFijo(datos: GastoFijoInsert): Promise<GastoFijoRow> {
  if (datos.id) {
    const { data, error } = await supabase
      .from('gastos_fijos')
      .update(datos)
      .eq('id', datos.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase
      .from('gastos_fijos')
      .insert(datos)
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
