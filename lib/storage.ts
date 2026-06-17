// Lectura de archivos locales (file://) para subir a Supabase Storage en React Native.
//
// Contexto / por qué este camino tan indirecto:
// - fetch('file://...') falla en RN ("Network request failed") al leer locales.
// - XHR con responseType 'arraybuffer' también falla para file:// en este entorno.
// - XHR con responseType 'blob' SÍ lee el archivo local de forma fiable.
// - Pero subir un Blob a supabase.storage.upload() produce "Network request failed".
//   El cuerpo de subida fiable en RN es un ArrayBuffer/Uint8Array.
// Por eso: leemos como Blob, lo pasamos a base64 con FileReader.readAsDataURL
// (estándar en RN) y lo convertimos a Uint8Array para subir.

/** Lee un archivo local (file://) y devuelve sus bytes como Uint8Array. */
export async function bytesDesdeUriLocal(uri: string): Promise<Uint8Array> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = () => resolve(xhr.response);
    xhr.onerror = () => reject(new TypeError('No se pudo leer el archivo local'));
    xhr.responseType = 'blob';
    xhr.open('GET', uri, true);
    xhr.send(null);
  });

  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new TypeError('No se pudo procesar el archivo local'));
    reader.onload = () => {
      const resultado = reader.result as string;
      // resultado es "data:<mime>;base64,<datos>"; nos quedamos con <datos>.
      resolve(resultado.substring(resultado.indexOf(',') + 1));
    };
    reader.readAsDataURL(blob);
  });

  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) {
    bytes[i] = binario.charCodeAt(i);
  }
  return bytes;
}
