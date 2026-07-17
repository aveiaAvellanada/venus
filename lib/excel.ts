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

// Las 7 categorías canónicas de calzado (PRD v4.0 §3). Única fuente de verdad:
// cualquier pantalla que muestre chips de categoría debe importar esto.
//
// `valor` es lo que acepta el CHECK de productos_calzado.categoria y lo único
// que puede viajar a la base; `etiqueta` es lo que lee el usuario. Difieren solo
// en Clasico/Clásico: la tilde nunca puede llegar a la DB.
export const CATEGORIAS = [
  { valor: 'Chanclas', etiqueta: 'Chanclas' },
  { valor: 'Escolar', etiqueta: 'Escolar' },
  { valor: 'Botas caucho', etiqueta: 'Botas caucho' },
  { valor: 'Deportivo', etiqueta: 'Deportivo' },
  { valor: 'Tennis', etiqueta: 'Tennis' },
  { valor: 'Clasico', etiqueta: 'Clásico' },
  { valor: 'Otros', etiqueta: 'Otros' }
] as const;

export type CategoriaCalzado = (typeof CATEGORIAS)[number]['valor'];

function sinTildes(texto: string): string {
  return texto.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function getColValue(row: any, possibleKeys: string[]): any {
  for (const key of Object.keys(row)) {
    const normalizedKey = key.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/_/g, "");
    for (const possible of possibleKeys) {
      if (normalizedKey === possible) {
        return row[key];
      }
    }
  }
  return undefined;
}

export function validarFilas(filas: any[]) {
  const validas: any[] = [];
  const errores: any[] = [];

  filas.forEach((fila, index) => {
    const filaNum = index + 2; // Assuming header on row 1
    const erroresFila: string[] = [];

    const categoria = getColValue(fila, ['categoria']);
    const descripcion = getColValue(fila, ['descripcion']);
    const marca = getColValue(fila, ['marca']);
    const referencia = getColValue(fila, ['referencia', 'ref']);
    const talla = getColValue(fila, ['talla']);
    const color = getColValue(fila, ['color']);
    const precioMin = getColValue(fila, ['preciominimo', 'preciomin']);
    const precioMax = getColValue(fila, ['preciomaximo', 'preciomax']);
    const costo = getColValue(fila, ['costo', 'costocompra']);
    const stock = getColValue(fila, ['stock', 'cantidad', 'stockactual']);

    let validCategory: string | undefined;
    if (categoria) {
      // Se compara sin tildes para aceptar "Cl\u00e1sico" o "Clasico" del Excel,
      // pero lo que se guarda es siempre el valor que acepta la DB.
      const match = CATEGORIAS.find(c => sinTildes(c.valor) === sinTildes(String(categoria)));
      if (match) {
        validCategory = match.valor;
      }
    }

    if (!validCategory) {
      erroresFila.push(`Categoría inválida o no encontrada: ${categoria || 'vacía'}`);
    }

    if (!descripcion || String(descripcion).trim() === '') {
      erroresFila.push('Descripción vacía');
    }

    const nPrecioMin = Number(precioMin);
    if (precioMin === undefined || isNaN(nPrecioMin) || nPrecioMin < 0) {
      erroresFila.push('Precio mínimo inválido');
    }

    const nPrecioMax = Number(precioMax);
    if (precioMax === undefined || isNaN(nPrecioMax) || nPrecioMax < 0 || (!isNaN(nPrecioMin) && nPrecioMax < nPrecioMin)) {
      erroresFila.push('Precio máximo inválido');
    }

    const nCosto = Number(costo);
    if (costo === undefined || isNaN(nCosto) || nCosto < 0) {
      erroresFila.push('Costo inválido');
    }

    const nStock = Number(stock);
    if (stock === undefined || isNaN(nStock) || nStock < 0 || !Number.isInteger(nStock)) {
      erroresFila.push('Stock inválido');
    }

    if (erroresFila.length > 0) {
      errores.push({
        fila: filaNum,
        datos: fila,
        errores: erroresFila
      });
    } else {
      validas.push({
        categoria: validCategory,
        descripcion: String(descripcion).trim(),
        marca: marca ? String(marca).trim() : null,
        referencia: referencia != null && String(referencia).trim() !== '' ? String(referencia).trim() : null,
        talla: talla != null && String(talla).trim() !== '' ? String(talla).trim() : null,
        color: color ? String(color).trim() : null,
        precio_min: nPrecioMin,
        precio_max: nPrecioMax,
        costo: nCosto,
        stock: nStock,
        datos_originales: fila
      });
    }
  });

  return { validas, errores };
}
