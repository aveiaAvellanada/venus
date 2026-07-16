# Plantilla de Carga Inicial de Inventario (Calzado)

Guía para llenar y subir `plantilla_carga_inventario.xlsx`. Todo lo de aquí está
tomado del validador real de la app (`lib/excel.ts` → `validarFilas`) y del subidor
(`app/(app)/inventario/carga.tsx`). Solo aplica a **calzado** (no a productos de Granja).

## Quién y dónde
- **Solo Andrés (dueño)** puede usar esta carga.
- En la app: **Inventario → Carga inicial → Subir Archivo Excel → (revisar resumen) → Confirmar y Subir**.

## Reglas generales del archivo
- Formato **`.xlsx`** o **`.xls`**.
- Se lee **solo la primera hoja** del libro.
- **Fila 1 = encabezados** (los nombres de columna). Los datos van **desde la fila 2**.
- El **orden de las columnas no importa**: se identifican por el nombre del encabezado. Columnas extra se ignoran.
- **Todo o nada:** si **una sola fila** tiene un error, la app lo muestra y **bloquea toda la carga** (el botón "Confirmar y Subir" queda deshabilitado). Hay que dejar **0 errores**.

### Cómo se interpretan los nombres de encabezado
El nombre del encabezado se normaliza así: **ignora mayúsculas/minúsculas, ignora tildes,
quita guiones bajos `_` y recorta espacios al inicio/final**, pero **NO quita espacios
en medio**.
- ✅ `Categoría`, `CATEGORIA`, `categoria` → todos equivalen a `categoria`.
- ✅ `precio_minimo`, `PrecioMinimo`, `preciomin` → equivalen.
- ❌ `Precio Minimo` (con espacio en medio) → **no se reconoce**. **Evita espacios en los encabezados.**

## Columnas

| Columna | Obligatoria | Tipo de dato | Restricciones | Encabezados aceptados |
|---|---|---|---|---|
| **categoria** | Sí | Texto (lista cerrada) | Debe ser **una de las 7 categorías** (ver abajo). | `categoria`, `Categoría` |
| **descripcion** | Sí | Texto | No puede estar vacía. Se recorta (trim). | `descripcion`, `Descripción` |
| **marca** | No | Texto | Libre. Vacío → sin marca (null). Se recorta. | `marca`, `Marca` |
| **referencia** | No | Texto | Libre. Vacío → null. Se recorta. | `referencia`, `ref` |
| **talla** | No | Texto o número | Libre. Si pones un número (38) se guarda como texto ("38"). Vacío → null. | `talla`, `Talla` |
| **color** | No | Texto | Libre. Vacío → null. Se recorta. | `color`, `Color` |
| **precio_minimo** | Sí | Número | `≥ 0`. Sin símbolos (ver "Formato de números"). | `precio_minimo`, `preciomin`, `precio_min` |
| **precio_maximo** | Sí | Número | `≥ 0` **y `≥ precio_minimo`**. | `precio_maximo`, `preciomax`, `precio_max` |
| **costo** | Sí | Número | `≥ 0`. Es el costo de compra (dato financiero, solo dueño). | `costo`, `costo_compra` |
| **stock** | Sí | Número entero | `≥ 0` y **sin decimales** (8 sí, 8.5 no). | `stock`, `cantidad`, `stock_actual` |

### Las 7 categorías válidas (exactas)
```
Chanclas · Escolar · Botas caucho · Deportivo · Tennis · Clásico · Otros
```
- La comparación **ignora mayúsculas y tildes**, pero **el espacio sí cuenta**:
  `Botas caucho` debe llevar el espacio (`Botascaucho` falla).
- Es **`Tennis`** (doble n), no "Tenis". `Clásico` también vale escrito `Clasico`.
- Cualquier otro valor produce el error *"Categoría inválida o no encontrada"*.

### Formato de números (precios, costo, stock)
- Escribe **números planos**: `90000`. **No** uses `$`, ni separador de miles
  (`90.000` / `90,000`), ni texto: si la celda es texto con símbolos, da error.
- En Excel, deja esas celdas como **número** (no como texto).
- `precio_minimo`, `precio_maximo` y `costo` admiten decimales y `0` como mínimo, pero
  **deben estar presentes** en cada fila.
- `stock` debe ser **entero** (`Number.isInteger`).

## Mensajes de error (qué significan)
| Mensaje | Causa |
|---|---|
| `Categoría inválida o no encontrada: X` | La categoría no es una de las 7, o falta. |
| `Descripción vacía` | Falta la descripción o quedó en blanco. |
| `Precio mínimo inválido` | Falta, no es número, o es negativo. |
| `Precio máximo inválido` | Falta, no es número, es negativo, o es **menor** que el mínimo. |
| `Costo inválido` | Falta, no es número, o es negativo. |
| `Stock inválido` | Falta, no es número, es negativo, o tiene **decimales**. |

La app muestra el **número de fila** del Excel junto a cada error.

## Qué NO se puede cargar por este Excel
- **`stock_minimo`**: se fija automáticamente en **0** (sin alerta de stock bajo). Se ajusta luego producto por producto si hace falta.
- **Proveedor** y **foto**: no se importan aquí.
- Todos los productos se crean **activos**.

## Ejemplo (las filas que ya trae la plantilla)

| categoria | descripcion | marca | referencia | talla | color | precio_minimo | precio_maximo | costo | stock |
|---|---|---|---|---|---|---|---|---|---|
| Tennis | Air Max | Nike | NK-001 | 38 | Negro | 90000 | 120000 | 70000 | 8 |
| Botas caucho | Bota alta | Croydon | CR-22 | 40 | Verde | 45000 | 60000 | 35000 | 20 |
| Otros | Pantufla |  |  |  | Rosado | 12000 | 18000 | 8000 | 15 |

La tercera fila deja **marca, referencia y talla** en blanco a propósito: es válida y
esos campos quedan sin valor. Borra las filas de ejemplo antes de subir tu inventario real.
