import * as XLSX from 'xlsx';
import { bytesDesdeUriLocal } from './storage';

export async function leerExcel(uri: string): Promise<any[]> {
  // Reutiliza el lector confiable de archivos locales (blob -> bytes), el mismo
  // que usan las subidas de imágenes; XLSX.read acepta un Uint8Array con type 'array'.
  const bytes = await bytesDesdeUriLocal(uri);
  const workbook = XLSX.read(bytes, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet);
}

// Categorías y validación viven en shared/ (también las usa el panel web).
export * from '../shared/excel';
