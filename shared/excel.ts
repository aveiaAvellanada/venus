// Plantilla de carga de inventario (plantilla_carga_inventario.md): categorías
// y validación de filas. Puro, sin Expo ni React Native: lo usan la app del
// celular (lib/excel.ts, que además lee el archivo) y el panel web.

// Las 7 categorías canónicas de calzado (PRD v4.0 §3). Única fuente de verdad:
// cualquier pantalla que muestre chips de categoría debe importar esto.
//
// `valor` es lo que acepta el CHECK de productos_calzado.categoria y lo único
// que puede viajar a la base; `etiqueta` es lo que lee el usuario. Difieren solo
// en Clasico/Clásico: la tilde nunca puede llegar a la DB.
import { coloresDeNombre, MAX_COLORES, MENSAJE_MAX_COLORES, nombreColores } from './colores';

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

function getColValue(row: Record<string, unknown>, possibleKeys: string[]): unknown {
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

export interface FilaValida {
  fila: number;
  categoria: CategoriaCalzado;
  descripcion: string;
  marca: string | null;
  referencia: string | null;
  talla: string | null;
  color: string | null;
  precio_min: number;
  precio_max: number;
  costo: number | null;
  stock: number;
  datos_originales: Record<string, unknown>;
}

export interface FilaConError {
  fila: number;
  datos: Record<string, unknown>;
  errores: string[];
}

export interface OpcionesValidacion {
  // La app exige el costo en cada fila. El panel lo deja vacío al exportar
  // tallas sin costo conocido y lo ignora en las que ya existen.
  costoObligatorio?: boolean;
}

// Número de fila del Excel: XLSX.utils.sheet_to_json deja `__rowNum__` (base 0,
// no enumerable) y salta las filas en blanco; sin él se asume encabezado en la fila 1.
function numeroDeFila(fila: Record<string, unknown>, index: number): number {
  const n = (fila as { __rowNum__?: unknown }).__rowNum__;
  return typeof n === 'number' ? n + 1 : index + 2;
}

export function validarFilas(
  filas: Record<string, unknown>[],
  { costoObligatorio = true }: OpcionesValidacion = {}
): { validas: FilaValida[]; errores: FilaConError[] } {
  const validas: FilaValida[] = [];
  const errores: FilaConError[] = [];

  filas.forEach((fila, index) => {
    const filaNum = numeroDeFila(fila, index);
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

    let validCategory: CategoriaCalzado | undefined;
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

    const sinCosto = costo === undefined || costo === null || String(costo).trim() === '';
    const nCosto = Number(costo);
    if (sinCosto ? costoObligatorio : isNaN(nCosto) || nCosto < 0) {
      erroresFila.push('Costo inválido');
    }

    const nStock = Number(stock);
    if (stock === undefined || isNaN(nStock) || nStock < 0 || !Number.isInteger(nStock)) {
      erroresFila.push('Stock inválido');
    }

    if (coloresDeNombre(color != null ? String(color) : null).length > MAX_COLORES) {
      erroresFila.push(MENSAJE_MAX_COLORES);
    }

    if (erroresFila.length > 0) {
      errores.push({
        fila: filaNum,
        datos: fila,
        errores: erroresFila
      });
    } else {
      validas.push({
        fila: filaNum,
        categoria: validCategory!,
        descripcion: String(descripcion).trim(),
        marca: marca ? String(marca).trim() : null,
        referencia: referencia != null && String(referencia).trim() !== '' ? String(referencia).trim() : null,
        talla: talla != null && String(talla).trim() !== '' ? String(talla).trim() : null,
        // "rojo/blanco" → "Rojo y blanco": así se reconoce la talla que ya existe.
        color: color != null ? nombreColores(String(color)) : null,
        precio_min: nPrecioMin,
        precio_max: nPrecioMax,
        costo: sinCosto ? null : nCosto,
        stock: nStock,
        datos_originales: fila
      });
    }
  });

  return { validas, errores };
}
