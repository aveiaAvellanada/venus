import * as XLSX from 'xlsx';

export async function leerExcel(uri: string): Promise<any[]> {
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.onload = function () {
      resolve(xhr.response);
    };
    xhr.onerror = function (e) {
      reject(new TypeError("Failed to read local file"));
    };
    xhr.responseType = "arraybuffer";
    xhr.open("GET", uri, true);
    xhr.send(null);
  });
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet);
}

const CATEGORIAS_VALIDAS = [
  'Chanclas',
  'Escolar',
  'Botas caucho',
  'Deportivo',
  'Tennis',
  'Clásico',
  'Otros'
];

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
    const precioMin = getColValue(fila, ['preciominimo', 'preciomin']);
    const precioMax = getColValue(fila, ['preciomaximo', 'preciomax']);
    const costo = getColValue(fila, ['costo', 'costocompra']);
    const stock = getColValue(fila, ['stock', 'cantidad', 'stockactual']);

    let validCategory: string | undefined;
    if (categoria) {
      const match = CATEGORIAS_VALIDAS.find(c => 
        c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") === 
        String(categoria).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      );
      if (match) {
        validCategory = match;
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
