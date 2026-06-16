# Venus — SP-5: Carga Inicial de Inventario (Excel)
**Design Specification**

## 1. Objetivo
Permitir a Andrés Artunduaga migrar masivamente todo el inventario de su cuaderno físico o de un Excel previo hacia la nueva base de datos de Supabase de manera estructurada, evitando la creación manual de los productos uno a uno.

Este módulo se centra en la **Fase 1: Importación por Plantilla Excel**, la cual es la manera más confiable y libre de errores de reconocimiento óptico (OCR).

---

## 2. Roles y Accesos
- **Uso Exclusivo:** Solo el usuario con rol de `dueno` (Andrés Artunduaga) tendrá acceso a la pantalla de "Carga Inicial" (probablemente accesible desde el área de Inventario o Configuración). Los empleados no verán esta opción para evitar inyecciones accidentales de inventario duplicado.

---

## 3. Lógica Funcional

### 3.1. Descarga de la Plantilla
La pantalla ofrecerá un botón para **"Descargar Plantilla Vacía"**.
- Al presionarlo, el sistema generará y descargará un archivo `.xlsx` con las cabeceras exactas que necesita el sistema.
- **Columnas obligatorias:** Categoría, Descripción, Talla, Color, Precio de Venta (Mínimo), Precio Máximo, Costo de Compra, Stock.
- **Columnas opcionales:** Referencia de Proveedor.
- *Nota:* Como la app funciona offline-first / mobile, se habilitará la función para subir el archivo desde el almacenamiento del celular o enviarlo a través de un selector de documentos nativo (`expo-document-picker`).

### 3.2. Proceso de Lectura (Parsing)
Al seleccionar el archivo de Excel lleno:
1. La aplicación leerá el archivo localmente usando la librería `xlsx`.
2. Se analizarán las filas y se mostrará un **Resumen de Pre-visualización** en la pantalla:
   - "Se encontraron 150 productos válidos."
   - "Se encontraron 3 errores" (ej. Falta el precio de venta en la fila 4, o la Categoría no pertenece a las 7 oficiales).
3. Si hay errores críticos de formato, el botón de "Cargar" estará bloqueado hasta que se suba un archivo corregido, previniendo así ensuciar la base de datos.

### 3.3. Inserción Transaccional (Escritura)
Si todo está correcto y se presiona **Cargar Inventario**:
1. Se iteran los productos válidos y se estructuran los datos.
2. Se invoca repetidamente (o mediante un Bulk Insert RPC) a la base de datos para insertar en `productos_calzado`.
3. Se insertan paralelamente los costos correspondientes en la tabla privada `historial_precios_calzado` para mantener el mismo flujo contable estipulado en SP-2 y SP-3.
4. Al finalizar, se muestra una animación de éxito y se bloquea el botón para evitar que el usuario vuelva a picar y duplique la carga.

---

## 4. Consideraciones Técnicas
- **Librerías necesarias:** 
  - `expo-document-picker` para abrir el selector de archivos del teléfono.
  - `xlsx` (SheetJS) u otra librería ligera compatible con React Native para extraer la data del buffer del archivo.
- **Bulk Insert (Opcional pero recomendado):** En lugar de hacer 150 llamadas `supabase.rpc(...)`, si la carga demora demasiado se podría crear un RPC especial que acepte un array JSON y los cargue de un solo golpe. Para mantener la simplicidad inicial, usaremos llamadas individuales con concurrencia limitada (ej. `Promise.all` en lotes de 10) reusando la RPC de `guardar_producto_calzado`.

---

## 5. Criterios de Aceptación (Smoke Tests)
1. El Dueño visualiza la pestaña "Carga Excel", la Empleada no la ve.
2. Al subir un Excel con la categoría escrita como "Zapato" (inválido, en vez de "Clásico" o "Deportivo"), el sistema muestra error en pantalla y no guarda nada.
3. Al subir un Excel válido de 10 filas, el inventario crece en 10 filas y la tabla de historial de costos refleja la carga inicial.
