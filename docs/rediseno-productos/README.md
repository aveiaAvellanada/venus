# Rediseño visual del módulo Productos (mockup → app)

**Fuente visual de verdad:** [`productos.html`](./productos.html) — mockup HTML autónomo (ábrelo con doble
clic en un navegador; no requiere servidor). Tiene dos teléfonos interactivos (lista y detalle), botones
Celular/Tablet/PC para probar el grid responsivo y un botón de tema claro/oscuro.

Los tokens del mockup están en el bloque `:root` al inicio de su `<style>`.

> Este documento describe **qué** cambiar en la app real. El mockup es referencia visual: la lógica de
> negocio (permisos, stock, precios, carrito, reglas de `CLAUDE.md`) NO cambia salvo lo indicado aquí.

## Archivos de la app implicados

| Pantalla / componente | Archivo |
|---|---|
| Lista de Productos (Calzado + Granja) | `app/(app)/(tabs)/productos.tsx` |
| Detalle de producto | `app/(app)/productos/[ref].tsx` |
| Filtros (hoja actual) | `components/ui/HojaFiltrosProductos.tsx` |
| Venta de Granja (hoja actual) | `components/ui/HojaVenderGranja.tsx` |
| Perfil (sección Negocio) | `app/(app)/(tabs)/perfil.tsx` |
| Tokens de color | `lib/theme.ts` (`paletaClara`, `paletaOscura`) |
| Agrupación por modelo/color | `lib/productos.ts` (`agruparPorReferencia`, `filtrarModelos`, `colorAHex`) |

## 1. Paleta monocroma (TODA la app)

Reemplazar el azul por negros, grises y blancos en `lib/theme.ts`. Es un cambio global: como los
tokens son la fuente única (`redisign-visual.md`), basta con cambiar los valores de `paletaClara` y
`paletaOscura`. Revisar que no queden hex sueltos fuera de `lib/theme.ts`.

| Token | Claro | Oscuro |
|---|---|---|
| primario | `#111111` | `#F4F4F5` |
| primarioPress | `#000000` | `#FFFFFF` |
| primarioSoft | `#F0F0F1` | `#2A2A2E` |
| sobrePrimario | `#FFFFFF` | `#0E0E10` |
| acento / acentoSoft | `#6B6B72` / `#EDEDEF` | `#A1A1A8` / `#232326` |
| fondo | `#FFFFFF` | `#0E0E10` |
| superficie / superficie2 | `#F6F6F7` / `#EDEDEF` | `#151517` / `#202023` |
| borde / bordeFuerte | `#E4E4E7` / `#CFCFD4` | `#2D2D31` / `#3A3A40` |
| texto / texto2 / texto3 | `#0E0E10` / `#4B4B52` / `#6B6B72` | `#F4F4F5` / `#B4B4BA` / `#8A8A91` |
| textoDeshabilitado | `#A1A1A8` | `#5C5C63` |
| exito / exitoSoft / exitoTexto | `#3F3F46` / `#EDEDEF` / `#27272A` | `#C4C4CA` / `#1F1F22` / `#D4D4D8` |
| peligro / peligroSoft / peligroTexto | `#18181B` / `#E4E4E7` / `#18181B` | `#F4F4F5` / `#2A2A2E` / `#F4F4F5` |
| overlay | `rgba(14,14,16,.5)` | `rgba(0,0,0,.6)` |

Notas:
- `gradienteHero` y `sombraFab` deben quedar en la misma escala neutra (ya no azules).
- Los colores de producto (Negro, Rojo, Azul… → `colorAHex`) son **datos**, no tema: no se tocan.
- Con éxito/peligro en gris, los estados no pueden depender solo del color: ya usan texto, raya
  diagonal y opacidad. Revisar pantallas fuera de Productos (caja, balance, devoluciones) donde
  verde/rojo comunican "entra/sale"; decidir con el dueño si ahí se conserva un acento mínimo.
- Actualizar `design.md` / `redisign-visual.md` y los tests que comparen colores.

## 2. Productos → lista en grid de tarjetas (Calzado)

- Quitar la lista con `FilaLista`/`CardModelo`; usar un **grid responsivo de tarjetas**.
- **Una tarjeta por modelo + color** (cada color es su propio producto, como en la referencia Adidas).
- Columnas según el ancho del contenedor: `<560` → 2 · `≥560` → 3 · `≥820` → 4 · `≥1100` → 5 · `≥1400` → 6.
  En RN usar `useWindowDimensions` / `onLayout` (no media queries).
- Espacio entre columnas = margen lateral de la pantalla (8 px en el mockup).
- Tarjeta: imagen cuadrada (fondo `superficie2`; foto del color o ícono placeholder) →
  precio → nombre (máx. 2 líneas) → marca → `● Color` → `N colores`.
- **Sin referencia** en la tarjeta (solo marca). La referencia sigue visible en el detalle y la
  búsqueda sigue encontrando por referencia.
- Precio: si hay rango, **dos renglones**: máximo arriba con etiqueta `Max`, mínimo abajo con `Min`
  (el máx/mín son del color de esa tarjeta). Un solo precio → una línea sin etiqueta.
- Insignias sobre la imagen: `DESCONTINUADO` (neutro) / `AGOTADO` (si todas las tallas del color están en 0).
- Color agotado → tarjeta opaca. Tocar la tarjeta abre el detalle **con ese color preseleccionado**.
- Quitar la tarjeta "Recibir mercancía" de esta pantalla (ver §6).

## 3. Productos → filtros

- Quitar la fila de chips (categorías + "Ver descontinuados") de la pantalla.
- Todo vive dentro del ícono de filtros, en un **panel a pantalla completa** (reemplaza
  `HojaFiltrosProductos`, que era una hoja inferior):
  - Encabezado: `Borrar todo` (subrayado) · `Filtrar resultados` · `X`.
  - Secciones desplegables con chevron y separadores: **Tipo de zapato** (categorías, selección
    múltiple, casillas con conteo `[n]`), **Marca** (casillas con conteo), **Precio** (slider de
    precio máximo, ya existente), **Estado** (`Ver descontinuados`).
  - Sección con selección activa: barra vertical a la izquierda + resumen debajo del título.
  - Pie fijo: `N artículos encontrados` (se actualiza en vivo con el borrador) + botón
    **`Mostrar artículos`** con el mismo aspecto que "Ir al carrito" (píldora oscura, ancho completo,
    sin flecha). Los filtros se aplican solo al tocarlo; `X` cierra sin aplicar.
- La categoría pasa de selección única (`'Todas'`) a **múltiple**.
- El ícono de filtros se resalta si hay cualquier filtro activo (categoría, marca, precio o descontinuados).
- Sin Talla/Color/Ordenar por por ahora (no existen hoy); el panel está pensado para sumarlos.

## 4. Detalle de producto

- Imagen grande a todo el ancho del color elegido (con botón de volver superpuesto) y, debajo, una
  **tira horizontal de miniaturas, una por color**. El color elegido lleva barra inferior; un color
  con todas las tallas en 0 lleva **raya diagonal `/`** (sigue siendo tocable).
- Si el modelo tiene un solo color, no hay tira.
- Quitar las pills de color. Mostrar "Color: X".
- Bloque de datos: nombre, `Marca · Ref XXX`, color, precio. Precio con rango → **un solo renglón**,
  centrado y más pequeño: `$máx Max   $mín Min` (del color elegido). Con talla elegida → precio exacto
  + "Precio de venta · mínimo $X" (solo staff, como hoy).
- **Tallas** del color elegido en grilla compacta: **mínimo 5 por fila en celular**
  (`repeat(auto-fill, minmax(52px, 1fr))`), cada chip con talla / divisor / stock.
  Talla sin stock: opaca, **raya diagonal `/`** y muestra `0`; no seleccionable.
- **"Ver ficha"**: enlace de texto subrayado, centrado, debajo de las tallas, **siempre visible**
  (aunque no haya stock ni talla elegida).
- **Un solo botón de compra**: barra fija inferior oscura con esquinas superiores redondeadas y el
  texto `Agregar al carrito` (sin ícono de carrito). Deshabilitada hasta elegir talla con stock.
- **Quitar "Compra rápida"** de esta pantalla. ⚠ Verificar que el flujo `/ventas/nueva?modo=rapida`
  siga accesible desde otro punto de entrada; si no, confirmarlo con el dueño antes de quitarlo.

### Hoja "Producto añadido al carrito"
Al agregar, aparece una hoja inferior (misma para Calzado y Granja):
- Título "Producto añadido al carrito" + `X`.
- Imagen vertical (3:4) a la izquierda; a la derecha marca, nombre (+ color), talla (o cantidad en
  Granja) y precio grande.
- Dos botones en píldora, lado a lado: **`Seguir`** (claro, con borde) → cierra y vuelve a la lista
  de Productos; **`Ir al carrito`** (oscuro) → navega al carrito.

## 5. Granja → mismo estilo visual que Calzado

- Misma grilla de tarjetas (mismas columnas, espacios y tipografía). Contenido propio: ícono del
  producto (huevo/paquete, o foto si existe), `Precio al vender`, nombre, `Por {unidad}`.
- El lápiz de editar (solo con permiso `inventario`) va como círculo en la esquina superior derecha
  de la imagen; no abre la hoja de venta.
- Tocar la tarjeta abre una hoja con el **mismo patrón del detalle de Calzado**: imagen + datos,
  campos **Cantidad** y **Precio por {unidad}**, y la misma barra oscura `Agregar al carrito`
  (deshabilitada hasta tener cantidad > 0 y precio > 0). Luego la hoja "Producto añadido al carrito"
  (Seguir / Ir al carrito), con total = cantidad × precio.
- Quitar "Compra rápida" de la hoja de Granja (mismo aviso del §4).
- **Unidad por libra, no por kilo** (Colombia): sugerir/usar `libra` por defecto en
  `app/(app)/inventario/granja/editor.tsx` y migrar productos que hoy digan `kg`. `unidad_medida`
  es texto libre; `lib/carrito.ts` ya admite decimales y media libra.

## 6. Mover "Recibir mercancía" a Perfil → Negocio

- Quitar de `app/(app)/(tabs)/productos.tsx` la `Tarjeta` con la fila "Recibir mercancía" (y los
  imports que queden sin uso).
- Agregar a `NEGOCIO` en `app/(app)/(tabs)/perfil.tsx`:
  ```ts
  { id: 'recibir-mercancia', titulo: 'Recibir mercancía', sub: 'Entrada de mercancía nueva',
    ruta: '/recibir-mercancia', Icono: PackagePlus },
  ```
  e importar `PackagePlus` de `lucide-react-native`.
- El id `recibir-mercancia` ya existe en `lib/permisos.ts` (permiso `recibir_mercancia`), así que
  `puedeAcceder(perfil, a.id)` lo filtra. Verificar que quienes lo veían en Productos mantengan acceso.

## Criterios de aceptación

- `npx tsc --noEmit` y `npm test` sin errores nuevos (actualizar tests de UI que dependan de la
  lista, chips, pills de color, "Compra rápida" o colores).
- Verificar en `npm run web` (o Expo Go): lista 2 columnas en celular, filtros, detalle con
  miniaturas, hoja de carrito y Granja, en tema claro y oscuro.
- Sin cambios en reglas de negocio ni en la base de datos.
