# Venus — SP-3: Módulos de Inventario (Calzado y Granja)
**Design Specification**

## 1. Objetivo
Proveer la interfaz y lógica para administrar el catálogo base de la tienda. Este plan aborda dos módulos del PRD:
- **Módulo 3 (Inventario de Calzado):** Gestión estructurada con stock, variantes (tallas/colores) y rangos de precio.
- **Módulo 4 (Granja):** Gestión flexible sin stock físico, con unidades de medida, donde el precio final se decide siempre en la caja.

Esto permitirá que la pantalla de `Nueva Venta` deje de depender de datos de semilla (mocks) y empiece a consumir el inventario real del negocio creado por Don Carlos o Sandra.

---

## 2. Roles y Accesos (RLS)
- **Visualización:** Todos los usuarios (Andrés, Sandra, Camilo, Beatriz, Nikol) pueden **ver** el catálogo para poder vender y buscar.
- **Creación y Edición:** Solo **Andrés** y **Sandra** tienen permisos para crear nuevos productos o editar los existentes (modificar descripciones, precios, fotos).
- **Finanzas/Costos:** Solo **Andrés** puede ver el costo de compra y los márgenes de ganancia. Esto ya está protegido por RLS en la tabla `historial_precios_calzado` y vistas asociadas.

---

## 3. Especificaciones por Módulo

### 3.1. Inventario de Calzado
La base de datos (`productos_calzado`) ya soporta este modelo.

**Campos principales:**
- Categoría (Chanclas, Escolar, Botas caucho, Deportivo, Tennis, Clásico, Otros) - *Obligatoria*.
- Descripción y Referencia.
- Talla y Color.
- **Precios:** Precio Mínimo y Precio Máximo (visibles para ventas).
- **Costo de compra:** Se registra únicamente para el historial financiero (solo Andrés).
- **Stock:** Actual y Mínimo para generar alertas de reabastecimiento.
- **Foto:** Captura desde cámara o galería, con compresión obligatoria en el cliente (máximo 500KB) antes de subir a Supabase Storage.

**Flujos de UI:**
1. **Listado/Buscador:** Búsqueda en tiempo real por texto (descripción/referencia) combinada con chips de filtro por categoría y estado (Disponible, Agotado).
2. **Detalle:** Muestra la información completa. Si el usuario es Andrés, se despliega una sección de "Historial de Precios/Costos".
3. **Agregar/Editar:** Formulario optimizado. Al guardar un producto nuevo, se debe ofrecer un botón/flujo de **"¿Agregar otro similar?"** que mantenga la categoría, descripción y precio, limpiando solo talla y color, para agilizar el ingreso de curvas de tallas.

### 3.2. Granja (Productos Varios)
Adaptado tras los cambios de SP-2 (`productos_varios`).

**Campos principales:**
- Nombre.
- Unidad de medida (Panel, Libra, Kilo, Litro, Unidad, Gramo).
- Precio Sugerido (informativo para la caja, pero no restrictivo).
- Notas internas y Proveedor vinculado.
- **Foto:** Opcional (comprimida a 500KB).
- *Nota:* Ya no se gestiona stock para la Granja.

**Flujos de UI:**
1. **Listado:** Pantalla limpia, similar al calzado pero sin filtros de categoría/talla.
2. **Agregar/Editar:** Formulario ultra simplificado.

---

## 4. Consideraciones Técnicas

### 4.1. Almacenamiento de Fotos (Supabase Storage)
- **Bucket:** Se debe crear/usar un bucket público llamado `productos` en Supabase.
- **Optimización Front-end:** Utilizar librerías nativas de Expo (ej. `expo-image-manipulator`) para redimensionar y comprimir la imagen (calidad ~0.7, max width ~1080px) asegurando que el archivo no supere los 500KB (Regla PRD 19) antes de invocar la subida.
- **Ruta:** Las imágenes deben guardarse con un UUID único (ej. `calzado/123e4567.jpg`).

### 4.2. Base de Datos & Auditoría
- Todos los cambios de precios en Calzado deben disparar o alimentar correctamente el historial. (En SP-2 eliminamos los triggers problemáticos para la migración, por lo que el front-end o una nueva RPC deberá encargarse de registrar los cambios en `historial_precios_calzado` si se modifica el costo o precio).
- RLS ya cubre la segregación de `historial_precios_calzado` para que solo el rol `dueno` pueda hacer SELECT/INSERT.

---

## 5. Criterios de Aceptación (Smoke Tests)
1. Sandra (empleada autorizada) puede crear un producto de Calzado y subir una foto comprimida.
2. Camilo (empleado normal) puede ver el producto pero el botón "Editar" no le aparece y si intenta forzar la ruta, el sistema lo rechaza.
3. Andrés (dueño) puede ver el Costo de Compra en el detalle del producto; los demás no ven esa sección.
4. Al crear Calzado, el sistema pregunta "¿Agregar otro similar?" y pre-llena los datos al aceptar.
5. El buscador de Granja no muestra ni pide "Stock" en ninguna pantalla.
