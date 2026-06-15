# SP-3: Módulos de Inventario (Calzado y Granja)
**Execution Plan**

REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task.

## Contexto
Este plan implementa la gestión del catálogo de la tienda.
- **Dependencias:** Autenticación y roles de SP-1, y el esquema de precios ajustado en SP-2.

---

## Task 1: Configuración de Storage y Utilidad de Compresión de Imágenes

**Files:** `supabase/migrations/<ts>_sp3_storage_productos.sql`, `lib/imagenes.ts`

- [x] **Step 1:** Crear migración MCP para configurar el bucket público `productos` en Supabase Storage (si no existe) y permitir lectura a `public` y escritura a `authenticated`.
- [x] **Step 2:** Instalar dependencia para manipulación de imágenes local en Expo:
  `npm install expo-image-manipulator expo-image-picker`
- [x] **Step 3:** Escribir `lib/imagenes.ts` con una función `comprimirYSubirImagen(uri: string): Promise<string>` que redimensione la imagen (width: 1080, compress: 0.7) y la suba a Supabase Storage devolviendo la URL pública.
- [x] **Step 4:** Typecheck y Commit.

---

## Task 2: Lógica Segura de Base de Datos (RPC) para Calzado

En SP-2 eliminamos los triggers del historial para facilitar la migración. Ahora crearemos una función RPC para guardar productos asegurando que el historial se registre como `dueno`.

**Files:** `supabase/migrations/<ts>_sp3_rpc_guardar_producto.sql`

- [x] **Step 1:** Crear migración con la función `public.guardar_producto_calzado`. La función debe aceptar todos los campos. Si es un UPDATE y el precio_minimo, precio_maximo o costo cambiaron, debe registrarlo en `private.historial_precios_calzado` (o `public` según RLS de SP-1).
- [x] **Step 2:** Aplicar migración vía MCP.
- [x] **Step 3:** Testear vía MCP `execute_sql` insertando y luego actualizando un precio, y comprobando la fila del historial.
- [x] **Step 4:** Commit.

---

## Task 3: Capa de Servicios `lib/inventario.ts`

**Files:** `lib/inventario.ts`

- [x] **Step 1:** Crear `lib/inventario.ts`.
- [x] **Step 2:** Añadir función `listarCalzado(filtros)` que soporte búsqueda por texto y categoría.
- [x] **Step 3:** Añadir función `guardarCalzado(datos)` que llame a la RPC.
- [x] **Step 4:** Añadir funciones similares para la Granja (`listarVarios`, `guardarVarios`) operando directamente con Supabase (ya que la granja no tiene historial restrictivo de la misma manera).
- [x] **Step 5:** Typecheck y Commit.

---

## Task 4: UI — Listado y Detalle de Calzado

**Files:** `app/(app)/inventario/calzado/index.tsx`, `app/(app)/inventario/calzado/[id].tsx`

- [x] **Step 1:** Crear el layout general si no existe.
- [x] **Step 2:** Pantalla `index.tsx`: Implementar FlatList con la función `listarCalzado`. Añadir barra superior con filtro por Categoría (scroll horizontal de chips).
- [x] **Step 3:** Pantalla `[id].tsx` (Detalle): Mostrar imagen, datos y botón de Editar.
- [x] **Step 4:** Control de permisos: Si el usuario es empleado, ocultar el botón "Nuevo" y "Editar". Si el usuario es dueño, mostrar la fila de "Costo de compra".
- [x] **Step 5:** Typecheck y Commit.

---

## Task 5: UI — Formulario de Editor de Calzado

**Files:** `app/(app)/inventario/calzado/editor.tsx`

- [x] **Step 1:** Pantalla con formulario usando `ScrollView` y componentes nativos para capturar todos los datos del calzado.
- [x] **Step 2:** Integrar `expo-image-picker` para capturar fotos.
- [x] **Step 3:** Control de roles: Validar mediante redirección temprana que solo Dueño o Sandra puedan entrar a esta pantalla.
- [x] **Step 4:** Al guardado exitosamente (si el ID era nuevo), disparar un `Alert` preguntando "¿Agregar otro similar?". Si sí: limpiar solo Talla y Color y mantener la pantalla; si no: volver atrás.
- [x] **Step 5:** Typecheck y Commit.

---

## Task 6: UI — Inventario de Granja (Productos Varios)

**Files:** `app/(app)/inventario/granja/index.tsx`, `app/(app)/inventario/granja/editor.tsx`

- [ ] **Step 1:** Pantalla `index.tsx` para Granja: Búsqueda simple, listado de productos mostrando precio sugerido y unidad de medida. Sin indicador de stock.
- [ ] **Step 2:** Pantalla `editor.tsx`: Formulario ultracompacto (Nombre, Unidad, Precio sugerido, Proveedor).
- [ ] **Step 3:** Test manual/visual.
- [ ] **Step 4:** Typecheck, Suite completa de tests locales y Commit final de SP-3.
