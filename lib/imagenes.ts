import * as ImageManipulator from 'expo-image-manipulator';
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
