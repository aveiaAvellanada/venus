# Venus — Rediseño de navegación y pantallas (documento de decisiones)

> Documento vivo. Recoge todas las decisiones de rediseño tomadas en la sesión de
> brainstorming. Cuando terminemos de decidir todas las partes, pasamos al diseño
> visual e implementación. Basado en la app actual (`app/`) y en `design.md`
> (sistema de diseño: azul `#1E66F5` primario, texto `#0F172A`, superficie
> `#F8FAFC`, verde `#16A34A` éxito, rojo `#DC2626` peligro; botones grandes
> táctiles; español directo; mobile-first vertical).

**Contexto:** Venus es una app móvil Android para una tienda de calzado familiar,
usada por personas no técnicas. Hoy la home es un grid de módulos filtrado por
rol, con rutas separadas por módulo. El rediseño unifica todo en **una sola app
con un nav bar inferior**, integrando los módulos en un mismo ecosistema.

Leyenda: ✅ decidido · ⏳ pendiente · ⚠️ gap técnico (backend por construir)

---

## Parte A — Nav bar (base de toda la app) ✅

Barra de navegación inferior de **5 slots** (2 tabs + botón central + 2 tabs):

```
   ☰        🔁         ⊕         👟        👤
  Menú  Movimientos           Productos   Perfil
```

- **Orden:** Menú · Movimientos · [+] · Productos · Perfil
- El slot 2 se llama **Movimientos** (contiene Ventas + Devoluciones + Gastos).
- **Botón central [+]:** elevado y más grande (estilo Iconly), fondo azul
  `#1E66F5`, sombra propia, sobresale por encima de la barra. Al tocarlo → va
  **directo a Nueva Venta** (es la acción más frecuente del mostrador).
- **Los otros 4 tabs:** icono vectorial + label 12px. Activo en azul, inactivo en
  gris `#9CA3AF`.
- **"Perfil"** reemplaza a "Configuración"; las opciones configurables viven
  dentro de Perfil.
- **Caja:** no es un tab del nav bar. Vive como **botón/badge en la esquina**
  superior del dashboard (Menú), mostrando estado ABIERTA/CERRADA.

---

## Parte B — Menú = resumen general (dashboard) ✅

Pantalla de aterrizaje tipo Nequi, con el resumen del negocio.

```
┌─────────────────────────────────────┐
│  Hola, Camilo          🧾 CAJA ABIERTA│  ← esquina: badge de caja
├─────────────────────────────────────┤
│  [Hoy] [Semana] [Mes] [Año] [Rango▾] │
│                                       │
│      TOTAL VENDIDO                    │
│      $1.250.000        ▲ 12%          │
│      18 ventas                        │
│                                       │
│  ┌────────┐┌────────┐┌────────┐      │
│  │Efectivo││ Nequi  ││ Bre-B  │      │
│  │$600.000││$400.000││$250.000│      │
│  └────────┘└────────┘└────────┘      │
│                                       │
│   📊 ▂▅▇▃▆█▄  (ventas por día)        │
│                                       │
│  GASTOS DEL PERÍODO                   │
│  Arriendo (fijo)          $300.000    │
│  Domicilio (variable)      $15.000    │
│  Total gastos              $315.000   │
└─────────────────────────────────────┘
```

Contenido decidido:
- Saludo + badge de caja (ABIERTA/CERRADA) en la esquina.
- Selector de período: **Hoy / Semana / Mes / Año / Rango de fechas**.
- **Total vendido** grande + comparación vs período anterior (▲/▼ %).
- Cantidad de ventas del período.
- **Desglose por método de pago** (Efectivo / Nequi / Bre-B / otro) en mini-grid.
- ⚠️ **Gráfico de barras** de ventas por día/semana/mes según el período. *Gap: no
  existe función que agregue ventas por sub-período; falta RPC nueva o agrupar en
  cliente.*
- ⚠️ **Gastos del período**: fijos + variables **mezclados** en una sola lista,
  con total. *Gap: no hay función lista; se filtran `gastos_variables.fecha` +
  `gastos_fijos_pagos.fecha_pago` por período.*
- **Quitados a propósito:** top de productos y alerta de stock bajo.

Backend ya disponible: `obtenerReportePeriodo(desde, hasta)` (total, comparación,
desglose por método, etc.) y `compararConAyer()`.

---

## Parte C — Ventas (historial + detalle + devoluciones) ✅ (con 1 pendiente)

### Tab Ventas — historial
- Resumen arriba (total + cantidad del período) y gráfico simple de la semana.
- Filtros de período: **Hoy / Semana / Mes / Rango de fechas**.
- Lista de ventas (monto, #número, método, hora). Click en una fila → detalle.

### Detalle de una venta
Al tocar una venta se muestra:

```
┌─────────────────────────────────────┐
│  ← Venta #102          COMPLETADA    │
│  15 jul 2026 · 2:14 PM · Camilo      │
├─────────────────────────────────────┤
│  Cliente: Ana Torres · 300 123 4567  │
├─────────────────────────────────────┤
│  Nike Air Max · Talla 40 · Negro     │
│  1 x $180.000            $180.000     │
│  ────────────────────────────────    │
│  Medias x3                $15.000     │
├─────────────────────────────────────┤
│  Total                   $195.000     │
│  Efectivo   $200.000                  │
│  Cambio      $5.000                   │
├─────────────────────────────────────┤
│  Nota: "cliente pidió factura"        │
├─────────────────────────────────────┤
│  [   ↩️  Hacer devolución   ]          │
└─────────────────────────────────────┘
```

Secciones:
1. **Encabezado:** número, fecha/hora, estado (completada/cancelada/corregida
   como badge), vendedor (`vendedor_id` → nombre).
2. **Cliente** (si se capturó): nombre, apellido, teléfono.
3. **Productos vendidos** (`venta_items`): descripción, talla y color (snapshot),
   cantidad × precio unitario = subtotal por línea.
4. **Pago:** total, desglose por método (`metodos_pago_venta`), efectivo recibido,
   cambio, saldo pendiente si aplica.
5. **Nota** (si el vendedor la dejó).
6. **Historial de corrección** (si `corregida = true`): quién, cuándo, motivo.
7. **Botón "Hacer devolución"** → elegir uno o varios `venta_items` a devolver.

### Tab = hub de movimientos (Opción A) ✅
El tab (slot 2 del nav bar) es un **hub de movimientos de dinero** con un **toggle
segmentado de 3** arriba: `[ Ventas ][ Devoluciones ][ Gastos ]`. Comparte los
mismos filtros de período en las tres vistas.

- ⏳ **Nombre del tab pendiente:** como ahora incluye Gastos, "Ventas" queda corto.
  Candidatos: **Movimientos** o **Caja** (por confirmar; el nav bar se relabela).

```
┌─────────────────────────────────────┐
│   [ Ventas ][ Devoluciones ][ Gastos ]│  ← toggle de 3
├─────────────────────────────────────┤
│   HOY · $180.000 devueltos · 3       │
│   [Hoy][Semana][Mes][Rango▾]         │
│                                       │
│  ┌─────────────────────────────┐     │
│  │ Venta #102      PARCIAL      │ ›   │
│  │ Devuelto $85.000 · 2:40 PM   │     │
│  ├─────────────────────────────┤     │
│  │ Venta #98       CAMBIO       │ ›   │
│  │ Cobrado $12.000 · 1:10 PM    │     │
│  └─────────────────────────────┘     │
└─────────────────────────────────────┘
```

### Devoluciones ✅
- Se **crean** desde el detalle de la venta (botón "Hacer devolución").
- El **historial** vive en la vista "Devoluciones" del toggle.

- **Detalle de una devolución** (al tocar una fila): venta original (#), ítems
  devueltos (descripción, talla, color, cantidad), tipo (total/parcial/cambio),
  motivo, método y monto de reembolso/cobro, enlace a la venta original.

Backend/datos: tablas `ventas`, `venta_items`, `metodos_pago_venta`;
`devolucion_items` referencia `venta_item_id`. Devoluciones guardan tipo
(total/parcial/cambio), motivo, método reembolso/cobro y montos. ⚠️ *Gap: no hay
función para listar el historial; falta `listarDevoluciones(período)`.*

---

## Parte D — Productos (antes "Inventario calzado") ✅

### Modelo de datos — decisión clave
Hoy cada fila de `productos_calzado` es una combinación específica de
talla + color + precio + stock (no hay "producto padre"; `referencia` es solo
texto). Se confirmó que **la referencia es siempre la misma para todas las
tallas y colores de un mismo modelo**.

➡️ **Opción A elegida (agrupar en el cliente por `referencia`)**: la lista trae
todas las filas y las agrupa en pantalla. **No se toca la base de datos** ni el
resto del código (carrito, ventas, editor de precios). (Opción B —tabla de
variantes con FK— descartada por ahora: implicaría migración y tocar mucho código.)

### Lista de Productos
- **Un card por referencia** (agrupado). El card muestra: foto, nombre, marca,
  referencia, nº de colores, rango de precio. **Sin talla en el card.**
- **Marca es importante:** se usa para buscar/filtrar por marca.
- Filtros por categoría (Todas / Tenis / Botas / Sandalias / Casual / Deportivo)
  + buscador.

```
┌─────────────────────────────────────┐
│  Productos          🔍 buscar        │
│  [Todas][Tenis][Botas][Sandalias]... │
│                                       │
│  ┌───┐ Nike Air Max            ›      │
│  │📷 │ Ref: 4521 · 3 colores          │
│  └───┘ $180.000 - $220.000            │
│  ┌───┐ Croydon Urbano          ›      │
│  │📷 │ Ref: 3310 · 1 color            │
│  └───┘ $95.000                        │
└─────────────────────────────────────┘
```

### Detalle de producto (pantalla unificada)
Es la **misma pantalla** usada para (a) ver el producto desde el tab Productos y
(b) agregar al carrito dentro de Nueva Venta. La búsqueda de productos en Nueva
Venta y el detalle de Productos **convergen aquí**.

```
┌─────────────────────────────────────┐
│  ←   Tenis Adidas VL Court 3.0        │
├─────────────────────────────────────┤
│         [ 📷 foto del producto ]      │
├─────────────────────────────────────┤
│  Tenis Adidas VL Court 3.0            │
│  Adidas · Ref: 4521                   │
│  $263.900                             │
│                                       │
│  Color:  [Negro] [Blanco] [Gris]      │
│                                       │
│  Talla                                │
│  ┌────┐┌────┐┌────┐┌────┐┌────┐     │
│  │ 39 ││ 40 ││ 41 ││ 42 ││ 43 │     │
│  │ ── ││ ── ││ ── ││ ── ││ ── │     │
│  │  2 ││  5 ││  0 ││  3 ││  1 │     │
│  └────┘└────┘└────┘└────┘└────┘     │
│        (41 gris/deshabilitada,        │
│         sin stock)                    │
├─────────────────────────────────────┤
│  [      Agregar al carrito      ]     │
└─────────────────────────────────────┘
```

Decidido:
- **Chip de talla:** talla arriba, **línea divisora**, cantidad abajo
  (ej. `39 / 2`, sin la "u"). Formato tipo fracción.
- **Talla sin stock (0):** se muestra **deshabilitada pero visible** (gris), no se
  oculta.
- **Selector de color** en pills, si la referencia tiene varios colores.
- **"Agregar al carrito"** añade la variante (talla + color) seleccionada al
  carrito de la venta.
- **Después de agregar al carrito → vuelve a la lista de Productos** para buscar
  otro modelo.
- **Botón "Editar"** visible según rol/contexto (dueño/admin, no empleado).
- Al finalizar, el carrito acumula todos los productos de la venta y se procede a
  vender (checkout con métodos de pago).

---

## Parte E — Distribución de módulos ✅ (con 2 pendientes)

| Ubicación | Módulos / contenido |
|---|---|
| **Menú** | Dashboard + estadísticas · **Balance** (dueño) · **Reportes** (detalle a fondo) · **Proveedores** (módulo) · **Análisis IA** (dueño) |
| **Movimientos** (slot 2) | `[ Ventas ][ Devoluciones ][ Gastos ]` |
| **Productos** | Toggle `[ Calzado ][ Granja ]` · acciones **"Recibir mercancía"** y **"Carga inicial"** |
| **Perfil** | Tema · automatización de caja · **Empleados** (admin del dueño) |

Decidido:
- **Nombre del slot 2 → "Movimientos"** (Ventas + Devoluciones + Gastos).
- **Gastos** (fijos + variables) → tercera vista del toggle de Movimientos.
- **Empleados** → **solo en Perfil** (admin del dueño). Ya no aparece en Menú.
- **Reportes** → **al Menú** (junto al dashboard), no en Perfil.
- **Balance** → en Menú/estadísticas (dueño).
- **Proveedores** → módulo accesible desde Menú.
- **Granja** → dentro de **Productos**, como toggle `[ Calzado ][ Granja ]` (ambos
  son inventario vendible; Nueva Venta busca en los dos).
- **Recibir mercancía** y **Carga inicial** → acciones dentro de Productos (ambas
  ingresan mercancía).
- **Análisis IA** → en el Menú, cerca de las estadísticas (dueño).

---

## Parte F — Login / teclado de PIN propio ✅

Hoy el PIN usa un `TextInput` con `keyboardType="number-pad"`, que abre el teclado
del sistema. Se cambia por un **teclado numérico propio, renderizado en la app**
(estilo Nequi): sin teclado del dispositivo.

```
┌─────────────────────────────────────┐
│        Escribe tu clave              │
│                                       │
│      ▢    ▢    ▢    ▢                 │  ← 4 puntos del PIN
│   No dudamos de que seas tú...       │
│                                       │
│      1        2        3             │
│      4        5        6             │
│      7        8        9             │
│               0        ⌫             │
│                                       │
│         🔵 ¿Se te olvidó?            │
└─────────────────────────────────────┘
```

- 4 puntos que se llenan al teclear (sin desplegar teclado del sistema).
- Dígitos 0–9 + borrar (⌫), con `Pressable` en la app.
- **Auto-envío al completar los 4 dígitos** (sin botón "Entrar"), como la
  referencia — más rápido en el mostrador.
- Enlace abajo: "Cambiar usuario / ¿Se te olvidó?".
- Implica reemplazar el `TextInput` de `app/(auth)/login.tsx` por el teclado
  propio; la lógica de `iniciarSesion` no cambia.

## Pendientes abiertos (para próximas sesiones)
1. ✅ Diseño visual detallado → **hecho en `redisign-visual.md`** (2026-07-15):
   tokens claro/oscuro, Plus Jakarta Sans, iconos Lucide, motion system,
   librería de componentes y spec por pantalla.
2. ⚠️ Gaps de backend a construir: agregación de ventas por sub-período (gráfico),
   gastos por período (fijos + variables), y `listarDevoluciones(período)` para el
   historial.
3. Detalle de Perfil: qué ajustes exactos de tema y de automatización de caja.
