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

  // Leer el archivo local como ArrayBuffer vía XMLHttpRequest.
  // En React Native, fetch() falla con URIs file:// y subir un Blob a
  // Supabase Storage produce "Network request failed"; subir un ArrayBuffer
  // sí funciona (patrón documentado por Supabase para Expo/React Native).
  const arrayBuffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      resolve(xhr.response);
    };
    xhr.onerror = function () {
      reject(new TypeError("No se pudo leer el archivo local"));
    };
    xhr.responseType = "arraybuffer";
    xhr.open("GET", manipulada.uri, true);
    xhr.send(null);
  });

  // Subir a Supabase Storage
  const { data, error } = await supabase.storage
    .from('productos')
    .upload(nombreArchivo, arrayBuffer, {
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
