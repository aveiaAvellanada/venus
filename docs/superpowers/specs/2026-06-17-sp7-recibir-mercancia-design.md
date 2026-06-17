# Especificación de Diseño: Recibir Mercancía (M5)

## 1. Introducción y Objetivos
El módulo **Recibir Mercancía (M5)** permite registrar la llegada física de calzado al negocio, incrementando el stock de forma automática. 

### Roles y Permisos de Negocio
- **Cualquier empleado** puede registrar la llegada física de mercancía (Paso 1, 2 y 3). Sin embargo, no ven costos, precios de compra, totales ni deudas.
- **Solo el Dueño (Andrés) y la Administradora (Sandra)** tienen acceso a completar la información financiera (costos unitarios, totales, condición de pago contado/crédito, fecha de vencimiento y notas).
- Si un empleado registra la llegada física sin datos financieros, la compra queda en estado `pendiente_revision` en Supabase y el dueño es el responsable de completarla. Si la registra un dueño/admin, se completa en el momento.

---

## 2. Flujo de Usuario y Arquitectura de la Interfaz

El módulo estará alojado en la ruta `/recibir-mercancia`.

```
/app/(app)/recibir-mercancia/
  ├── _layout.tsx      <-- Layout con Stack y protección useRequireModulo('recibir-mercancia')
  ├── index.tsx        <-- Listado de Recepciones Pendientes (Solo dueño/admin) y botones de acción
  ├── nueva.tsx        <-- Formulario de Registro de Recepción (Para todos los roles)
  └── [id].tsx         <-- Detalle y Completado Financiero de una recepción pendiente (Solo dueño/admin)
```

### 2.1 Pantalla Principal (`index.tsx`)
- **Para Empleado:**
  - Muestra un botón grande: **"Registrar Nueva Entrada de Mercancía"** que navega a `recibir-mercancia/nueva`.
  - Muestra una lista de recepciones físicas recientes (solo mostrando fecha, nombre del proveedor e ID de la compra, sin valores financieros).
- **Para Dueño (Andrés) o Administradora (Sandra):**
  - Muestra el mismo botón de inicio de recepción.
  - Muestra la lista de **Recepciones Pendientes de Revisión** (compras con estado `'pendiente_revision'`).
  - Al hacer clic en una recepción pendiente, navega a `recibir-mercancia/[id]` para completar los costos unitarios y plazos.

### 2.2 Formulario de Registro (`nueva.tsx`)
1. **Selección de Proveedor:**
   - Buscador/Selector de proveedores activos (`listarProveedores({ activo: true })`).
   - Botón **"Crear Proveedor"** en caso de que no exista en la lista. Abre un modal con el formulario rápido de proveedor. Al guardarlo, se selecciona automáticamente en la entrada de mercancía.
2. **Selección y Adición de Productos:**
   - Lista dinámica de items que están llegando.
   - Para cada item, un buscador inteligente de productos calzado en el catálogo (`listarCalzado`).
   - Botón **"Crear Calzado Nuevo"** si el producto no existe en el catálogo. Abre un formulario rápido con: categoría (dropdown con las 7 fijas), descripción, talla, color, referencia, precio mínimo, precio máximo y stock mínimo. Al guardarlo (RPC `guardar_producto_calzado` con `stock_actual = 0`), queda disponible en la lista de items.
   - Campo numérico para ingresar la **Cantidad** recibida.
3. **Guardado:**
   - **Para Empleados:** Botón **"Confirmar Entrada Física"**. Registra la compra llamando a `registrarLlegadaFisica` (estado `pendiente_revision`, costos nulos).
   - **Para Dueño/Admin:** Pueden elegir entre:
     - Guardar solo entrada física (`registrarLlegadaFisica` -> `pendiente_revision`).
     - Completar Datos Financieros directamente en la misma pantalla (activa formulario de costos por item, condición de pago y notas) y guardar con `registrarCompraDirecta`.

### 2.3 Detalle y Completado de Pendiente (`[id].tsx`)
- Solo accesible para `dueno` y `admin`.
- Muestra el proveedor y los items físicos con las cantidades que el empleado registró.
- Formulario financiero:
  - Input para ingresar el **Costo Unitario** por cada producto recibido.
  - Selector de **Condición de Pago**: Contado / Crédito.
  - Si es crédito: fecha de vencimiento (`fecha_vencimiento`) y notas (`notas`).
- Botón **"Completar Información Financiera"**: Llama a `completarInformacionFinanciera()` de `lib/proveedores.ts`, lo cual actualiza el saldo de compras y pasa el estado a `completada`.

---

## 3. Integración con el Backend (`lib/proveedores.ts` y `lib/inventario.ts`)

Se consumirán las siguientes funciones de acceso a datos:
- `listarProveedores` y `crearProveedor` (de `lib/proveedores.ts`).
- `listarCalzado` y `guardarCalzado` (de `lib/inventario.ts`).
- `registrarLlegadaFisica`, `completarInformacionFinanciera`, `registrarCompraDirecta` y `listarCompras` (de `lib/proveedores.ts`).

---

## 4. Estrategia de Pruebas Unitarias
Escribiremos pruebas en `lib/recibir_mercancia_ui.test.tsx` que simularán el montaje y renderizado de estas vistas comprobando:
1. Gating de seguridad en el layout.
2. Que para el rol `empleado` se oculte la información de costos y la sección de pendientes de revisión en `index.tsx`.
3. Que la creación inline de un proveedor llame a `crearProveedor`.
4. Que la creación inline de un calzado llame a `guardarCalzado`.
5. Que al enviar la entrada como empleado se ejecute `registrarLlegadaFisica`.
6. Que al completar una entrada pendiente como admin/dueño se ejecute `completarInformacionFinanciera`.
