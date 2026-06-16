import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';
import { bytesDesdeUriLocal } from './storage';

export async function comprimirYSubirImagen(uri: string): Promise<string> {
  // Comprimir y redimensionar la imagen
  const manipulada = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1080 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  // Generar un nombre único para el archivo
  const nombreArchivo = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

  // En React Native el file:// solo se lee fiable como Blob (XHR responseType
  // 'blob'); 'arraybuffer' falla y fetch() también. Pero subir un Blob a
  // Supabase produce "Network request failed", así que convertimos el Blob a
  // bytes (base64 vía FileReader -> Uint8Array) y subimos esos bytes.
  const bytes = await bytesDesdeUriLocal(manipulada.uri);

  // Subir a Supabase Storage
  const { data, error } = await supabase.storage
    .from('productos')
    .upload(nombreArchivo, bytes, {
      contentType: 'image/jpeg',
    });

  if (error) {
    throw new Error(`Error al subir imagen: ${error.message}`);
  }

  // Retornar la URL pública
  const { data: publicUrlData } = supabase.storage
    .from('productos')
    .getPublicUrl(data.path);

  return publicUrlData.publicUrl;
}
