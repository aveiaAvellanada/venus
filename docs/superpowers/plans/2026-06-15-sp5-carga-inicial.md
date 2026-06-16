# SP-5: Carga Inicial de Inventario (Excel)
**Execution Plan**

REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task.

## Contexto
Este plan construye la funcionalidad para importar de forma masiva el inventario de zapatos usando una plantilla de Excel (`.xlsx`). La importación utiliza la misma lógica segura (`RPC`) diseñada en SP-3 para garantizar que los costos queden guardados en el historial secreto del dueño.

---

## Task 1: Instalación de Dependencias

Para poder leer archivos físicos y parsear el formato binario de Excel dentro del ecosistema React Native (Expo), necesitamos librerías especializadas.

**Files:** `package.json`

- [x] **Step 1:** Ejecutar `npm install expo-document-picker xlsx`.
- [x] **Step 2:** Ejecutar `npx tsc --noEmit` para asegurar que las instalaciones no rompieron tipos globales.
- [x] **Step 3:** Commit rápido con el mensaje "chore: instalar expo-document-picker y xlsx para SP-5".

---

## Task 2: Utilidad Lógica de Parseo `lib/excel.ts`

Aquí extraeremos la lógica pesada de transformar el binario de Excel en un array de JavaScript entendible.

**Files:** `lib/excel.ts`

- [x] **Step 1:** Crear `lib/excel.ts`.
- [x] **Step 2:** Exportar función `leerExcel(uri: string): Promise<any[]>`.
- [x] **Step 3:** Implementar lectura: 
   - Utilizar `fetch(uri).then(res => res.arrayBuffer())` para obtener el archivo.
   - Usar `XLSX.read(buffer, { type: 'array' })`.
   - Usar `XLSX.utils.sheet_to_json(sheet)` para retornar el array de objetos.
- [x] **Step 4:** Exportar una función de validación `validarFilas(filas)` que verifique que cada fila tenga: Categoria válida (Clásico, Deportivo, etc), Descripcion, Precio Minimo, Precio Maximo, Costo Compra y Stock. Devuelve un objeto con filas válidas y una lista de errores encontrados.
- [x] **Step 5:** Typecheck y Commit.

---

## Task 3: Interfaz de Pre-visualización de Carga

Crearemos la pantalla donde el Dueño subirá el archivo y verá si todo está en orden.

**Files:** `app/(app)/inventario/carga.tsx`

- [x] **Step 1:** Crear el archivo `carga.tsx`.
- [x] **Step 2:** Proteger la ruta usando `usePermisos` para que solo el rol `dueno` pueda verla.
- [x] **Step 3:** Interfaz: Mostrar botón "Subir Archivo Excel". Al hacer tap, invoca `DocumentPicker.getDocumentAsync({ type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })`.
- [x] **Step 4:** Al obtener el URI, pasarlo a `leerExcel` y luego a `validarFilas`.
- [x] **Step 5:** Mostrar en pantalla el resumen: Cuántos productos se van a subir y si hubo errores (con un listado de las filas erróneas para que el usuario pueda ir al Excel a arreglarlas).
- [x] **Step 6:** Typecheck y Commit.

---

## Task 4: Inserción Masiva en Base de Datos

Conectaremos el botón de carga con la base de datos reusando la función `guardar_producto_calzado`.

**Files:** `app/(app)/inventario/carga.tsx`

- [x] **Step 1:** Agregar botón "Confirmar y Subir" en la UI. Este botón solo estará activo si `errores.length === 0` y hay al menos 1 fila válida.
- [x] **Step 2:** Crear la función `cargarMasivamente()` que itere las filas válidas y por cada una llame a `guardarCalzado` (desde `lib/inventario.ts`).
   *Tip: Usar un bucle for-of o Promise.all para manejar asincronía limpiamente y mostrar un spinner de estado "Cargando (5/100)...".*
- [x] **Step 3:** Tras finalizar, mostrar Alert de éxito, limpiar el estado de la pantalla y navegar de vuelta al índice de inventario.
- [x] **Step 4:** Typecheck y Commit final de SP-5.
