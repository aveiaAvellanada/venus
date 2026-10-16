# Rediseño del Carrito y cobro + correcciones (mockup → app)

**Fuente visual de verdad:** [`carrito.html`](./carrito.html) — mockup HTML autónomo (doble clic en un
navegador). Muestra las tres etapas de `app/(app)/ventas/nueva.tsx` en tres teléfonos que comparten estado:
**1 Carrito → 2 Cobrar → 3 Confirmación**, más diálogo "¿Descartar la venta?", carrito vacío y caja cerrada.
Barra superior: simular caja cerrada, vaciar, restablecer, tema claro/oscuro.

> Este documento dice **qué** cambiar. La lógica de negocio (permisos, stock, idempotencia, reglas de
> `CLAUDE.md`) no cambia salvo lo indicado. La paleta monocroma es la de `docs/rediseno-productos/README.md` §1.

## Archivos de la app implicados

| Qué | Archivo |
|---|---|
| Pantallas de carrito/cobro/confirmación | `app/(app)/ventas/nueva.tsx` |
| Reglas del carrito | `lib/carrito.ts` (`carritoReducer`, `precioInicial`, `totalCarrito`) |
| Estado compartido | `lib/carrito-contexto.tsx` |
| Registro de venta (RPC) | `lib/ventas.ts` → RPC `registrar_venta` |
| Slider de precio | `components/ui/SliderPrecio.tsx` |
| Cierre de caja desde el menú | `app/(app)/(tabs)/index.tsx` (`onPressCaja`) |
| Config de caja | `app/(app)/caja/config.tsx`, `lib/caja.ts` |

---

## A. Correcciones (bugs)

### A1. El carrito no se vacía al terminar una venta
**Causa (verificada en el código):** en `nueva.tsx`, `confirmar()` llama `registrarVenta` y pasa a la etapa
`confirmacion`, pero **no limpia el carrito**. Solo `nuevaVenta()` (botón "Nueva venta") hace
`dispatch({ tipo: 'limpiar' })`. El botón **"Listo"** (y el botón atrás del sistema) salen con `salirAtras()`
sin limpiar. Como `CarritoProvider` es global (`lib/carrito-contexto.tsx`), los productos ya vendidos
siguen en el carrito y pueden venderse otra vez por error.

**Arreglo:**
- En `confirmar()`, justo después de que `registrarVenta` resuelva bien: guardar un snapshot para la
  pantalla de confirmación (`numero`, `total`, `metodos`) y **`dispatch({ tipo: 'limpiar' })`**, reiniciar
  `metodos`, `montos`, `recibido` y `cliente`. `intentoRef.current = null` ya se hace.
- La pantalla de confirmación debe leer el snapshot, no `items` ni `totalCarrito(items)`.
- Si el registro falla, NO limpiar (el vendedor reintenta con la misma clave de idempotencia).
- Test: tras confirmar con éxito, `items` queda `[]` aunque el usuario salga con "Listo" o con atrás.

### A2. Cerrar caja muestra "¿Seguro que quieres cerrar la caja?" en vez de la pantalla de cierre
**Causa (verificada en el código):** `onPressCaja` en `app/(app)/(tabs)/index.tsx` abre ese `Alert` cuando
`modoCierre === 'sin_diferencia'`. Ese valor viene del RPC `obtener_modo_cierre()`
(`caja_config.modo_cierre`, que se cambia en **Caja → Configuración → Modo de cierre → "Sin diferencia"**).
Con "Sin diferencia", cerrar solo confirma y no deja contar el efectivo ni ver el arqueo. Es una opción
global de la base: por eso aparece "a veces" (cuando el valor guardado es `sin_diferencia`, o si hay más de
una fila en `caja_config`, porque el RPC toma `order by created_at limit 1`).
No pude consultar la base desde la sesión que escribió esto; verificar con:
```sql
select id, modo_cierre, created_at from public.caja_config order by created_at;
```

**Decisión del dueño:** el cierre debe llevar SIEMPRE a la pantalla de cierre (`/caja/cierre`: efectivo
esperado, efectivo contado, diferencia y justificación).

**Arreglo:**
- `onPressCaja`: si la caja está abierta → siempre `router.push('/caja/cierre')`. Eliminar la rama del
  `Alert` y el uso de `cerrarCajaSinDiferencia` / `modoCierre` en `index.tsx`.
- Quitar el selector "Modo de cierre" de `caja/config.tsx` (o fijarlo en "Con diferencia").
- Migración que normaliza el dato y evita volver al modo anterior:
  `update public.caja_config set modo_cierre = 'con_diferencia';`
- El servidor ya exige el efectivo contado cuando el modo es `con_diferencia` (`cerrar_caja`); no cambia.
- Test: con la caja abierta, tocar el badge navega a `/caja/cierre` y no abre ningún `Alert`.

---

## B. Cambios de diseño y comportamiento del carrito

### B1. Línea de producto (card)
- **Calzado:** foto/miniatura del color, título (máx. 2 líneas), `Marca · Talla N · Color`, deslizador de
  precio, fila `Mín $X · [ $ precio ] · Máx $X`, subtotal y stepper − / cantidad / +.
  El + se deshabilita al llegar al stock; − en 1 quita la línea.
- **Granja:** ícono, título, `Granja · por {unidad}`, campos cantidad (decimal) × precio unitario,
  subtotal y enlace "Quitar".
- Quitar el texto "$X c/u" (precio por unidad) del calzado.

### B2. Precio del calzado
- **Valor inicial = precio mínimo** (hoy `precioInicial` en `lib/carrito.ts` usa `precioMax`; cambiarlo
  a `precioMin`).
- El deslizador va de `precioMin` a `precioMax` en pasos de **$1.000**.
- Además se puede **escribir el precio exacto** en la caja `$` (entero). Deslizador y caja se sincronizan.
- ⚠ **Rango:** el servidor rechaza precios fuera de `[precio_minimo, precio_maximo]`
  (`registrar_venta`: "El precio de X debe estar entre …", PRD §3.1.1). Por eso el mockup marca
  "Fuera del rango" y **deshabilita Cobrar** hasta corregirlo. NO se implementó margen del 20 % del
  costo ni de $20.000: se habló pero se descartó ("dejemos el mínimo y el máximo"). Si algún día se
  quiere margen, hay que cambiar el servidor y el PRD primero.
- Nota fija bajo la lista: "Mueve el deslizador de $1.000 en $1.000 o escribe el precio exacto…".

### B3. Resumen y cobro
- Resumen: "Artículos" y "Total". Barra inferior oscura fija con `Cobrar $X`, deshabilitada si el total es
  0 o hay una línea fuera de rango.
- Cobrar: total grande, chips de método (Efectivo, Nequi, Bre-B, Otro; combinables), un campo por método
  (con un solo método el monto se llena con el total), estado "✓ Cuadra / Faltan / Sobran", "Efectivo
  recibido" y "Cambio", datos del cliente opcionales, barra "Confirmar venta" (deshabilitada hasta que
  cuadre y el recibido cubra el efectivo).
- Confirmación: "Venta #N registrada", total y métodos, botones "Nueva venta" y "Listo". El carrito ya
  está vacío (A1).
- Diálogo al salir con productos: "¿Descartar la venta?" → Seguir / Descartar.

### B4. Cliente: cédula o razón social (opcional)
Nuevo campo **"Cédula o razón social"** junto a nombre, apellido y teléfono. **Sí requiere cambio en la
base de datos** (hoy `ventas` solo tiene `cliente_nombre`, `cliente_apellido`, `cliente_telefono`):
1. Migración nueva en `supabase/migrations/`:
   ```sql
   alter table public.ventas add column if not exists cliente_documento text;
   ```
   (texto libre: acepta cédula, NIT o razón social; sin restricción de formato). Valorar un índice si se
   va a buscar por documento, igual que `idx_ventas_cliente_tel`.
2. Actualizar el RPC `registrar_venta` (versión vigente en
   `20261009150000_permisos_por_usuario.sql`) con `p_cliente_documento text default null` y guardarlo en
   `ventas.cliente_documento`. Al agregar un parámetro cambia la firma: eliminar la sobrecarga anterior
   para no dejar dos funciones ambiguas y conservar `revoke/grant`.
3. `lib/ventas.ts`: `RegistrarVentaInput.cliente.documento?: string` y `p_cliente_documento`.
4. Regenerar `shared/database.types.ts` (y `lib/database.types.ts` lo re-exporta).
5. Mostrar el documento donde ya se muestra el cliente (`devoluciones/nueva.tsx`, `ventas/[id].tsx`,
   panel web si lista clientes).
6. Es dato personal: respetar la política de privacidad vigente; no registrarlo en logs ni auditoría en claro
   si la auditoría guarda payloads.

### B5. Tipografía
Todo un poco más pequeño para que quepa más (títulos 20 px, cuerpo 14–15 px, inputs 14 px, botones 15 px,
total grande 32 px). Ajustar con los tokens de `lib/theme.ts` si se prefiere escalar globalmente.

---

## Criterios de aceptación
- `npx tsc --noEmit` y `npm test` sin errores nuevos; actualizar tests de `ventas/nueva` y de cierre de caja.
- Vender y salir por "Listo" o por atrás deja el carrito vacío.
- Con la caja abierta, el badge/botón de cerrar caja siempre abre `/caja/cierre`.
- Una venta con cédula/razón social la guarda y la devuelve en el detalle de la venta; sin ella, igual que antes.
- Tema claro y oscuro revisados en Expo Go / `npm run web`.

## Estado de implementación (2026-10-11)

Implementado en la rama `rediseno-carrito` (que incluye `rediseno-productos`), un commit por punto:

- **A1** `ventas/nueva.tsx`: al registrar con éxito se guarda el snapshot (número, total, métodos) y se
  vacían carrito, pago y cliente; si falla no se limpia. Tests en `lib/venta_nueva_ui.test.tsx`.
- **A2** `index.tsx` va siempre a `/caja/cierre`; `caja/config.tsx` sin selector (guarda `con_diferencia`);
  fuera `obtenerModoCierre` / `cerrarCajaSinDiferencia`. Migración
  `20261011120000_caja_cierre_siempre_con_diferencia.sql`. Test en `lib/tabs_menu_ui.test.tsx`.
- **B4** Migración `20261011120100_ventas_cliente_documento.sql`: columna, `registrar_venta` con
  `p_cliente_documento` (sin la sobrecarga anterior) y la auditoría guarda `"(oculto)"` en vez del valor.
  Test SQL `supabase/tests/ventas_cliente_documento_test.sql`. Se muestra en el detalle de la venta y en
  la devolución. El panel web aún no lista clientes (fase 3), así que ahí no hay nada que mostrar.
- **B1–B3, B5** Rediseño de carrito, cobro y confirmación. Precio inicial = mínimo (`precioInicial`).
  Deslizador por `rangoDeslizador`: múltiplos de $1.000 dentro de [mín, máx]; el precio exacto se escribe
  en la caja. Cobrar se deshabilita si alguna línea está fuera de rango (`puedeCobrar`). La escala
  compacta está en `tipografiaCompacta` (`lib/theme.ts`).

**Migraciones aplicadas al remoto el 2026-10-11** (SQL Editor, una transacción, registradas en `supabase_migrations.schema_migrations`; comprobación posterior OK). Antes de aplicarlas regía esto: Orden: primero las migraciones, después la app nueva. La app vieja
sigue funcionando con la base nueva porque `p_cliente_documento` es opcional. La app nueva contra la base
vieja fallaría al vender: `registrar_venta` no conoce ese parámetro.
