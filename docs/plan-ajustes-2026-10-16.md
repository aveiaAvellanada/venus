# Plan de ajustes — 2026-10-16

Estado: **borrador para aprobación**. No se ha tocado código.
Decisiones del dueño (Camilo) ya incorporadas; lo marcado *(mi decisión)* lo puede cambiar.

## Ola 1 — Ajustes rápidos (sin cambios de base de datos)

| # | Ajuste | Dónde | Cómo |
|---|--------|-------|------|
| 1.1 | "Cédula o razón social" → **"Cédula o NIT"** | `app/(app)/ventas/nueva.tsx:552` (placeholder), textos en `lib/venta_nueva_ui.test.tsx`, `lib/devoluciones_ui.test.tsx`, `lib/movimientos.test.ts` | Solo texto de UI. La columna `ventas.cliente_documento` no cambia. *(mi decisión: no se valida formato; sigue siendo texto libre.)* |
| 1.2 | Teclado que tapa los formularios | nuevo `components/ui/ScreenWrapper.tsx`; se usa en todas las pantallas con campos | `KeyboardAvoidingView` (`padding` en iOS, `height` en Android) + `ScrollView` con `keyboardShouldPersistTaps="handled"` y padding inferior. Reemplaza los `KeyboardAvoidingView` sueltos de: devoluciones/nueva, gastos/pagar, gastos/fijos-editor, proveedores/editor y [id], recibir-mercancia/nueva y [id], empleados/nuevo y [id], HojaVenderGranja, FormularioCambiarPin. Además se revisan ventas/nueva (cobro), caja/cierre, caja/config, inventario/calzado/editor, inventario/carga y login. |
| 1.3 | Buscador de calzado de reemplazo no se despliega | `app/(app)/devoluciones/nueva.tsx` (`BuscadorReemplazoModal`, ~línea 834/918) | Se reproduce primero (systematic-debugging) y se corrige la causa. Sospecha a confirmar: `Modal` anidado dentro de un `KeyboardAvoidingView`/`ScrollView`. Se rehace en la Ola 2 (2.1), así que aquí solo se deja funcionando. |
| 1.4 | Confirmar venta: solo chulo animado y volver al menú | `app/(app)/ventas/nueva.tsx` (~362–447) | Se quita la pantalla "Nueva venta y listo". Tras registrar: chulo animado ~1,5 s con "Venta exitosa" y `router.replace` al inicio. El carrito ya se vacía al registrar. La nota de venta queda en el detalle de la venta (Movimientos). |
| 1.5 | Gastos pasa de Movimientos a Negocio (Perfil) | `app/(app)/(tabs)/movimientos.tsx`, `app/(app)/(tabs)/perfil.tsx` (`NEGOCIO`), tests `tabs_*` | Se quita Gastos del control de Movimientos (queda Ventas + Devoluciones). Se agrega entrada **Gastos** en `NEGOCIO` con permiso `gastos` hacia `/gastos`. Los gastos fijos siguen con su permiso `gastos_fijos` dentro del módulo. |
| 1.6 | Botón "Hacer devolución" negro, letra blanca, sin icono | `app/(app)/ventas/[id].tsx:194` | `Boton variante="oscuro"` sin `icono`. *(mi decisión: en modo oscuro usa el token del tema para que no quede negro sobre negro.)* |

Cierre de la ola: `npm test` y tsc en verde.

## Ola 2 — Cambio con precio, garantía y mínimos por rango (con base de datos)

### 2.1 Cambio de calzado con precio de reemplazo y diferencia
Flujo, igual que el carrito de venta:
1. Buscar la **referencia** (buscador en tiempo real).
2. Elegir **color** y **talla** (misma hoja de selección que "agregar al carrito").
3. Fijar el **precio** del nuevo zapato: slider por defecto en el rango mín/máx (comportamiento actual, no cambia) o precio escrito a mano, libre. Sin avisos ni auditoría especial por salirse del rango.
4. Mostrar la **diferencia** = precio del nuevo − lo realmente pagado por el devuelto (`precio_final`). Positiva: el cliente paga más (medios de pago del carrito, incluidos mixtos). Negativa: se le devuelve el excedente en **efectivo**, que sale del cajón de caja.
5. Se admiten **varios zapatos devueltos y varios nuevos** en un mismo cambio.

Trabajo: reutilizar los componentes de selección y slider del carrito (`lib/carrito.ts`, `components/ui`), extraer lógica pura de la diferencia a `lib/devoluciones.ts` con tests, y revisar la RPC de devoluciones (`20260617193112_m2_devoluciones.sql` y sus ajustes de 20261009) para aceptar varios reemplazos con precio y registrar el pago/vuelto.

### 2.2 Garantía por referencia
- Nueva columna en calzado: `garantia_dias int null` (por referencia; null = sin garantía). Migración nueva, tipos regenerados, edición en `inventario/calzado/editor` y en el panel web (`web/`).
- Se **imprime** en la nota de venta (días y fecha de vencimiento).
- En **nueva devolución**: si el item ya pasó `fecha_venta + garantia_dias`, se muestra un **aviso** "Este zapato ya no tiene garantía". No bloquea.

### 2.3 Precios mínimo/máximo por rango de tallas
Reglas: el **mínimo es obligatorio**, el **máximo opcional**; ambos pueden variar por rango de tallas; el rango aplica igual a **todos los colores** de la referencia; el usuario elige cuántos tramos (precios distintos) y entre qué tallas.
- Modelo: tabla de tramos por referencia (`referencia`, `talla_desde`, `talla_hasta`, `precio_min`, `precio_max null`). Sin tramos, se usa el mín/máx actual de la referencia. Migración con RLS (permiso `inventario`), auditoría y relleno inicial desde los precios existentes.
- Validación en base: tramos sin traslape, cubren las tallas existentes, `min > 0`, `max >= min` si hay máximo.
- Editor: en `inventario/calzado/editor` se agrega "Precios por talla" (agregar/quitar tramos).
- Consumo: carrito, hoja de color/talla y cambio (2.1) leen el mín/máx del tramo de la talla elegida. El slider conserva su comportamiento actual.
- Panel web: edición de los mismos tramos en inventario y precios.

### Fuera de alcance (se diseña después)
Cómo se agrega stock con precios por rango: **Recibir mercancía**, **Carga inicial** (Excel/IA) y **Carga masiva** del panel web. En esta ola, esos flujos siguen usando el mín/máx de la referencia y no rompen con los tramos.

## Cierre — APK nuevo
- Al terminar Ola 1 y Ola 2: pruebas, migraciones en el remoto (con confirmación), tipos regenerados, y build del APK con EAS según `docs/despliegue.md` para descargar la versión nueva.

## Orden y control
1. Rama `ajustes-ola1`: 1.1 → 1.6, commit por ajuste.
2. Rama `ajustes-ola2`: 2.3 (modelo de precios) → 2.2 (garantía) → 2.1 (cambio, depende de 2.3).
3. Cada paso: prueba primero, luego código.
4. Actualizar `CLAUDE.md` (estado, garantía, tramos) al final.

## Riesgos
- 2.1 toca dinero y caja: requiere pruebas de diferencia positiva/negativa y de cuadre de caja.
- 2.3 es el cambio de modelo más grande; debe quedar compatible con inventario existente.
- Migraciones al remoto solo con tu confirmación.
