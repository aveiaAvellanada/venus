import { Platform } from 'react-native';
import * as ImageManipulator from 'expo-image-manipulator';
import type { ImageRef } from 'expo-image-manipulator';
import { LADO_FOTO, LADO_MINIATURA, rutaFoto, rutaMiniatura } from '../shared/fotos';
import { supabase } from './supabase';
import { bytesDesdeUriLocal } from './storage';

// Regla del PRD: las fotos se comprimen a máximo 500KB antes de subir a Storage.
export const LIMITE_BYTES = 500 * 1024;

// Secuencia de intentos (ancho, calidad) de mayor a menor calidad. Se prueban en
// orden hasta que los bytes resultantes quedan bajo el límite; si ninguno cumple,
// se usa el último (el más pequeño) como mejor esfuerzo.
const INTENTOS: { width: number; compress: number }[] = [
  { width: 1080, compress: 0.7 },
  { width: 1080, compress: 0.5 },
  { width: 900, compress: 0.45 },
  { width: 720, compress: 0.4 },
  { width: 560, compress: 0.35 },
];

/**
 * Comprime/redimensiona la imagen en `uri` hasta dejarla bajo LIMITE_BYTES
 * (mejor esfuerzo) y devuelve los bytes listos para subir. En React Native el
 * file:// se lee como Blob y se convierte a bytes (ver lib/storage.ts).
 */
export async function comprimirBajoLimite(uri: string): Promise<Uint8Array> {
  let bytes: Uint8Array | null = null;
  for (const intento of INTENTOS) {
    const manipulada = await ImageManipulator.manipulateAsync(
      uri,
      [{ resize: { width: intento.width } }],
      { compress: intento.compress, format: ImageManipulator.SaveFormat.JPEG }
    );
    bytes = await bytesDesdeUriLocal(manipulada.uri);
    if (bytes.length <= LIMITE_BYTES) break;
  }
  return bytes as Uint8Array;
}

export async function comprimirYSubirImagen(uri: string): Promise<string> {
  const bytes = await comprimirBajoLimite(uri);

  const nombreArchivo = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

  const { data, error } = await supabase.storage
    .from('productos')
    .upload(nombreArchivo, bytes, {
      contentType: 'image/jpeg',
    });

  if (error) {
    throw new Error(`Error al subir imagen: ${error.message}`);
  }

  const { data: publicUrlData } = supabase.storage
    .from('productos')
    .getPublicUrl(data.path);

  return publicUrlData.publicUrl;
}

// ===== Fotos del calzado (catálogo) =====
// Igual que el panel web (web/src/lib/imagen.ts → procesarFotoProducto): recorte
// cuadrado centrado, 1080×1080 y miniatura de 400×400, con nombre fijo por
// referencia y color (shared/fotos.ts). Las de Granja siguen con comprimirYSubirImagen.

const BUCKET_FOTOS = 'productos';
// Un año: cada teléfono la baja una sola vez. Cambiarla cambia el ?v= de la URL.
const CACHE_FOTOS = '31536000';
const CALIDADES_FOTO = [0.82, 0.72, 0.62, 0.5];

export interface FormatoFoto {
  formato: ImageManipulator.SaveFormat;
  extension: 'webp' | 'jpg';
  tipo: 'image/webp' | 'image/jpeg';
}

const JPEG: FormatoFoto = { formato: ImageManipulator.SaveFormat.JPEG, extension: 'jpg', tipo: 'image/jpeg' };

// WebP en Android si el manipulador lo trae; si no, JPEG (urlMiniatura entiende los dos).
export function formatoFotoCatalogo(
  plataforma: string,
  formatos: { WEBP?: ImageManipulator.SaveFormat } = ImageManipulator.SaveFormat,
): FormatoFoto {
  if (plataforma === 'android' && formatos.WEBP) return { formato: formatos.WEBP, extension: 'webp', tipo: 'image/webp' };
  return JPEG;
}

// El cuadrado más grande que cabe, centrado.
export function recorteCentrado(ancho: number, alto: number): { originX: number; originY: number; width: number; height: number } {
  const lado = Math.min(ancho, alto);
  return { originX: Math.floor((ancho - lado) / 2), originY: Math.floor((alto - lado) / 2), width: lado, height: lado };
}

// Lado final: el pedido o menos si la foto es más pequeña (no se agranda).
export const ladoFinal = (ladoRecorte: number, lado: number) => Math.max(1, Math.round(Math.min(lado, ladoRecorte)));

export interface FotosCalzado {
  grande: Uint8Array;
  mini: Uint8Array;
  formato: FormatoFoto;
}

async function guardarBytes(imagen: ImageRef, formato: FormatoFoto, compress: number): Promise<Uint8Array> {
  const resultado = await imagen.saveAsync({ format: formato.formato, compress });
  return bytesDesdeUriLocal(resultado.uri);
}

/**
 * Recorta en cuadrado centrado y deja la foto en 1080×1080 (máximo 500 KB:
 * baja la calidad si hace falta) y su miniatura en 400×400. Si el WebP falla
 * se hace en JPEG.
 */
export async function procesarFotoCalzado(uri: string, formato: FormatoFoto = formatoFotoCatalogo(Platform.OS)): Promise<FotosCalzado> {
  const original = await ImageManipulator.ImageManipulator.manipulate(uri).renderAsync();
  const recorte = recorteCentrado(original.width, original.height);
  const cuadrado = await ImageManipulator.ImageManipulator.manipulate(original).crop(recorte).renderAsync();
  const tamano = (lado: number) => ({ width: ladoFinal(recorte.width, lado), height: ladoFinal(recorte.width, lado) });
  const grande = await ImageManipulator.ImageManipulator.manipulate(cuadrado).resize(tamano(LADO_FOTO)).renderAsync();
  const mini = await ImageManipulator.ImageManipulator.manipulate(cuadrado).resize(tamano(LADO_MINIATURA)).renderAsync();
  // La original de la cámara pesa decenas de MB en memoria: se suelta ya.
  original.release();
  cuadrado.release();

  try {
    let usado = formato;
    for (const calidad of CALIDADES_FOTO) {
      let bytes: Uint8Array;
      try {
        bytes = await guardarBytes(grande, usado, calidad);
      } catch (e) {
        if (usado.extension === 'jpg') throw e;
        usado = JPEG;
        bytes = await guardarBytes(grande, usado, calidad);
      }
      if (bytes.length <= LIMITE_BYTES) {
        return { grande: bytes, mini: await guardarBytes(mini, usado, Math.min(calidad, 0.75)), formato: usado };
      }
    }
    throw new Error('No se pudo dejar la foto por debajo de 500 KB. Prueba con otra.');
  } finally {
    grande.release();
    mini.release();
  }
}

/**
 * Sube la foto de una referencia y color con su nombre fijo (reemplaza la que
 * hubiera) y su miniatura. `nombre` es nombreFoto(referencia, descripcion, color):
 * null si todavía no hay con qué nombrarla. Devuelve la URL pública de la
 * grande, con versión.
 */
export async function subirFotoCalzado(uri: string, nombre: string | null): Promise<string> {
  if (!nombre) throw new Error('Escribe la referencia (o la descripción) para poner la foto.');
  const fotos = await procesarFotoCalzado(uri);
  const { extension, tipo } = fotos.formato;
  const opciones = { upsert: true, cacheControl: CACHE_FOTOS, contentType: tipo };
  const [grande, mini] = await Promise.all([
    supabase.storage.from(BUCKET_FOTOS).upload(rutaFoto(nombre, extension), fotos.grande, opciones),
    supabase.storage.from(BUCKET_FOTOS).upload(rutaMiniatura(nombre, extension), fotos.mini, opciones),
  ]);
  const error = grande.error ?? mini.error;
  if (error) throw new Error(`Error al subir la foto: ${error.message}`);
  const url = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(rutaFoto(nombre, extension)).data.publicUrl;
  return `${url}?v=${Date.now()}`;
}
