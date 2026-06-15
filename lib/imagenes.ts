import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from './supabase';

export async function comprimirYSubirImagen(uri: string): Promise<string> {
  // Comprimir y redimensionar la imagen
  const manipulada = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1080 } }],
    { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
  );

  // Generar un nombre único para el archivo
  const nombreArchivo = `${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

  // Convertir uri a blob para la subida
  const response = await fetch(manipulada.uri);
  const blob = await response.blob();

  // Subir a Supabase Storage
  const { data, error } = await supabase.storage
    .from('productos')
    .upload(nombreArchivo, blob, {
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
