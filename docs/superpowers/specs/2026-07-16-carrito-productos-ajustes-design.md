# Diseño — Rediseño de Carrito/Productos + ajustes rápidos (mercancía, gastos fijos, movimientos, safe-area)

**Fecha:** 2026-07-16
**Módulos:** 1 (Nueva Venta), 3 (Inventario de Calzado), 4 (Granja), 5 (Recibir Mercancía), 9 (Gastos Fijos), 15 (Carga Inicial)
**Rama:** `feat/redesign-nueva-venta` (continúa ahí)
**Estado:** aprobado en brainstorming, pendiente de revisión del spec

---

## 1. Contexto y problema

Segundo batch de pedidos sobre la misma rama de rediseño, con dos partes muy distintas en tamaño:

- **Bloque A** — 5 ajustes puntuales e independientes (reordenar secciones, mover Carga Inicial a Perfil, agregar foto a Gastos Fijos, arreglar un bug de safe-area que quedó fuera del barrido anterior).
- **Bloque B** — una reestructuración grande: Productos pasa a ser la pantalla principal para vender (no solo para gestionar inventario), con un carrito persistente accesible desde un ícono en la barra inferior, negociación de precio vía slider, "compra rápida", filtros por marca/precio, y productos descontinuados.

## 2. Decisiones tomadas (brainstorming)

- **Compra rápida:** agrega el ítem al carrito compartido (`lib/carrito-contexto.tsx`), pero salta la revisión del carrito completo — muestra un paso breve con el slider de precio de ese ítem y va directo a cobrar.
- **Slider de precio:** un solo componente, usado dentro de la línea del carrito (reemplaza el `TextInput` libre actual en `LineaCarrito`). Al agregar desde Productos, el ítem entra con `precio_maximo` por defecto; el ajuste fino se hace ahí. Compra rápida reutiliza el mismo componente como paso previo al pago.
- **Ícono de carrito:** reemplaza el FAB central del `TabBar` (el "+" que hoy abre Nueva Venta). Un solo lugar, con contador de ítems (badge).
- **Descontinuados:** ocultos de Productos por defecto; un toggle "Ver descontinuados" los muestra atenuados con opción de reactivar. El control de activar/desactivar vive en la pantalla de detalle/editor del producto. La columna `activo` **ya existe** en `productos_calzado` (desde el esquema inicial) y ya la acepta `guardar_producto_calzado` — no hace falta migración para esto, solo UI + filtro de consulta.
- **Filtros:** marca (multi-select) + rango de precio (slider min–max). Nada de talla/color por ahora, ni las ideas extra propuestas (deshacer, barra de total siempre visible) — descartadas explícitamente.
- **Agregar a carrito ya NO navega automáticamente** a la pantalla de carrito (cambio de comportamiento respecto a hoy). Con Productos como hub principal, forzar la navegación en cada ítem interrumpiría comprar varias cosas seguidas. Se mantiene solo un toast + haptic feedback, igual que ya hace el agregar-desde-búsqueda dentro de Nueva Venta hoy.
- **Nueva Venta deja de tener su propio buscador.** Productos es ahora la única vía para buscar/elegir qué vender. La ruta `/ventas/nueva` (destino del ícono de carrito) se simplifica a: lista de ítems del carrito + botón de cobrar (lo que hoy ya es la etapa "carrito", menos la barra de búsqueda y resultados de arriba).
- **Granja gana una forma de venderse desde Productos.** Hoy, tocar un ítem de Granja en Productos navega a una pantalla de *edición* (`/inventario/granja/editor`), no existe ninguna vía de venta directa ahí (antes se vendía buscando por nombre dentro de Nueva Venta). Como ese buscador desaparece, Granja necesita su propio punto de venta en Productos — se agrega una hoja modal "Vender" (cantidad + precio libre, sin slider porque Granja no tiene precio mínimo/máximo) con los mismos dos botones (Agregar a carrito / Compra rápida). La edición del producto Granja se mueve a un ícono de lápiz aparte (solo dueño/admin), no se pierde.

## 3. Alcance

**Incluye:** los 5 puntos del Bloque A + todo el Bloque B descrito arriba.

**No incluye (fuera de alcance):**
- Deshacer al quitar un ítem del carrito, o barra de total siempre visible — descartado explícitamente por el usuario.
- Filtros de talla o color — solo marca y precio.
- Cambios al modelo de datos de `ItemCarrito`/`registrarVenta` más allá de lo necesario para el slider (el shape ya soporta precio por línea).
- Cualquier feature nueva no pedida (persistencia offline del carrito, múltiples carritos, etc.).

---

## 4. Bloque A — Ajustes rápidos

### 4.1 Recibir Mercancía al inicio de Productos

`app/(app)/(tabs)/productos.tsx`: la sección "Ingresar mercancía" (líneas 239-268, hoy al final del `ScrollView`) se mueve a justo después del título "Productos" (línea 152) y antes del `ControlSegmentado` Calzado/Granja. Solo cambia el orden de bloques JSX, sin tocar su contenido — excepto que la fila "Carga inicial" se elimina de aquí (ver 4.2).

### 4.2 Carga Inicial se mueve a Perfil

- Se quita la fila "Carga inicial" de `productos.tsx` (la que estaba gated por `puedeAcceder(perfil.rol, 'carga-inicial')`, líneas 252-267).
- Se agrega como una fila más dentro de la sección **"Negocio"** de `app/(app)/(tabs)/perfil.tsx` (creada en la sesión anterior), gated con el mismo `puedeAcceder(perfil.rol, 'carga-inicial')`, apuntando a `/inventario/carga`. Ícono `Camera` (el mismo que usaba antes), subtítulo "Plantilla Excel o cámara".

### 4.3 Foto/comprobante en Gastos Fijos

**Migración** — agrega la columna que falta en `gastos_fijos` (mismo nombre que ya usa `gastos_variables`/`gastos_fijos_pagos`, por consistencia):

```sql
alter table public.gastos_fijos
  add column if not exists comprobante_url text;
```

**`lib/gastos.ts`** — `guardarGastoFijo` gana un segundo parámetro opcional `imagenUri`, replicando exactamente el patrón de `guardarGastoVariable`:

```ts
export async function guardarGastoFijo(
  datos: GastoFijoInsert,
  imagenUri?: string
): Promise<GastoFijoRow> {
  let comprobanteUrl: string | null = null;
  if (imagenUri) {
    comprobanteUrl = await comprimirYSubirComprobante(imagenUri);
  }
  const payload = { ...datos, ...(comprobanteUrl ? { comprobante_url: comprobanteUrl } : {}) };
  if (datos.id) {
    const { data, error } = await supabase.from('gastos_fijos').update(payload).eq('id', datos.id).select().single();
    if (error) throw error;
    return data;
  } else {
    const { data, error } = await supabase.from('gastos_fijos').insert(payload).select().single();
    if (error) throw error;
    return data;
  }
}
```

**`app/(app)/gastos/fijos-editor.tsx`** — agrega el mismo bloque de "Tomar Foto"/"Cambiar Foto" + preview que ya existe en `gastos/index.tsx:245-276` (import `* as ImagePicker from 'expo-image-picker'`, `Camera` de lucide, `Image` de react-native, estado `fotoUri`, función `pickImage` idéntica), y pasa `fotoUri || undefined` como segundo argumento a `guardarGastoFijo`.

### 4.4 "Registrar gasto" al inicio de la vista Gastos en Movimientos

`app/(app)/(tabs)/movimientos.tsx`: dentro del render de `vista === 2` (líneas 253-321), la `Tarjeta` con "Registrar gasto variable"/"Gastos fijos" (líneas 292-320) se mueve **antes** de la `Tarjeta`/`EstadoVacio` del resumen de gastos del período (líneas 255-290), para que no haya que deslizar para llegar a ella.

### 4.5 Fix de safe-area en Nueva Venta

`app/(app)/ventas/nueva.tsx:468` — la barra inferior del carrito (`<Tarjeta estilo={{..., paddingBottom: espacio.xxl}}>`) usa un valor fijo, igual que los ~26 casos ya corregidos en el barrido anterior. Se agrega `usePaddingInferior(espacio.xxl)` y se reemplaza ese `paddingBottom`. (Esta pantalla se reescribe de todos modos en el Bloque B — el fix se aplica directamente sobre la versión nueva, ver §5.6).

---

## 5. Bloque B — Carrito y Productos

### 5.1 Dependencia nueva: slider

Se agrega `@react-native-community/slider` (compatible con Expo Go, sin config nativo adicional) vía `npx expo install @react-native-community/slider`.

### 5.2 Componente nuevo `components/ui/SliderPrecio.tsx`

```tsx
import React from 'react'
import { Text, View } from 'react-native'
import Slider from '@react-native-community/slider'
import { useTema } from '../../lib/tema'
import { espacio, tabular, tipografia } from '../../lib/theme'

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

interface Props {
  valor: number
  minimo: number
  maximo: number
  onCambio: (valor: number) => void
  paso?: number
}

// Slider de precio para regateo: entre precio_minimo y precio_maximo, en múltiplos de $1.000.
export function SliderPrecio({ valor, minimo, maximo, onCambio, paso = 1000 }: Props) {
  const { paleta } = useTema()
  const bajoMinimo = valor < minimo

  return (
    <View style={{ gap: espacio.xs }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={[tipografia.caption, { color: paleta.texto3 }]}>{pesos(minimo)}</Text>
        <Text
          style={[
            tipografia.h3, tabular,
            { color: bajoMinimo ? paleta.peligroTexto : paleta.texto },
          ]}
        >
          {pesos(valor)}
        </Text>
        <Text style={[tipografia.caption, { color: paleta.texto3 }]}>{pesos(maximo)}</Text>
      </View>
      <Slider
        minimumValue={minimo}
        maximumValue={Math.max(maximo, minimo + paso)}
        step={paso}
        value={valor}
        onValueChange={onCambio}
        minimumTrackTintColor={paleta.primario}
        maximumTrackTintColor={paleta.borde}
        thumbTintColor={paleta.primario}
        accessibilityLabel="Precio de venta"
      />
    </View>
  )
}
```

Exportar en `components/ui/index.ts`: `export { SliderPrecio } from './SliderPrecio'`.

- [ ] **Test** `components/ui/SliderPrecio.test.tsx`: renderiza con los valores correctos de min/max/valor; `onValueChange` del `Slider` dispara `onCambio` con el valor recibido; el texto de precio se pinta en rojo (`paleta.peligroTexto`) cuando `valor < minimo`.

### 5.3 `LineaCarrito` usa el slider en vez del `TextInput` de precio

En `app/(app)/ventas/nueva.tsx`, dentro de `LineaCarrito` (líneas 52-150), reemplaza el bloque del `TextInput` de precio para calzado (líneas 85-102) por:

```tsx
{esCalzado ? (
  <View style={{ gap: espacio.xs }}>
    <SliderPrecio
      valor={item.precio}
      minimo={item.producto.precioMin ?? 0}
      maximo={item.producto.precioMax ?? item.precio}
      onCambio={(v) => dispatch({ tipo: 'cambiarPrecio', id: item.producto.id, precio: v })}
    />
  </View>
) : (
  // ...bloque de cantidad/precio de Granja sin cambios (líneas 104-122)
)}
```

El `precioTxt`/`commitPrecio`/`setPrecioTxt` dejan de usarse para calzado (el slider llama a `dispatch` directamente `onValueChange`, sin paso de texto intermedio); se mantienen solo para Granja (cantidad y precio libre, que no tiene slider).

- [ ] **Test:** actualizar cualquier test existente de `nueva.tsx`/`LineaCarrito` que dependa del `TextInput` de precio de calzado, para interactuar con el `Slider` en su lugar (buscar por `accessibilityLabel="Precio de venta"`).

### 5.4 `nueva.tsx` pierde el buscador — queda solo el carrito

Se elimina de `NuevaVenta` (etapa `'carrito'`, líneas 407-466 actuales): el `CampoTexto` de búsqueda, el estado `query`/`resultados`/`buscando`/`errorBusqueda`/`primeraCarga`/`debounce`, la función `buscar`, y el `ScrollView` de resultados. La pantalla en la etapa `'carrito'` queda: encabezado ("Carrito" en vez de "Nueva venta") + lista de `LineaCarrito` + botón "Cobrar" — sin el paso previo de búsqueda. Las etapas `'cobrar'` y `'confirmacion'` no cambian.

Import de `buscarProductos` se elimina de `lib/ventas` si ya no se usa en ningún otro lado de este archivo (verificar con grep antes de quitar el import).

### 5.5 Nueva etapa `'ajustarPrecio'` para Compra Rápida

Se agrega una cuarta etapa al tipo `Etapa`: `'carrito' | 'ajustarPrecio' | 'cobrar' | 'confirmacion'`. `NuevaVenta` lee un parámetro de ruta `modo` (`useLocalSearchParams<{ modo?: string }>()`); si `modo === 'rapida'` y el carrito tiene exactamente 1 ítem al montar, la etapa inicial es `'ajustarPrecio'` en vez de `'carrito'`.

Render de la etapa `'ajustarPrecio'` (calzado con slider; Granja sin slider, ya se definió el precio en la hoja "Vender"):

```tsx
if (etapa === 'ajustarPrecio') {
  const item = items[0]
  return (
    <View style={{ flex: 1, backgroundColor: paleta.fondo, padding: espacio.xl, paddingTop: 56, gap: espacio.l }}>
      <Text style={[tipografia.h2, { color: paleta.texto }]}>{item.producto.titulo}</Text>
      {item.producto.tipo === 'calzado' ? (
        <SliderPrecio
          valor={item.precio}
          minimo={item.producto.precioMin ?? 0}
          maximo={item.producto.precioMax ?? item.precio}
          onCambio={(v) => dispatch({ tipo: 'cambiarPrecio', id: item.producto.id, precio: v })}
        />
      ) : null}
      <Text style={[tipografia.h3, tabular, { color: paleta.texto }]}>Subtotal {pesos(item.subtotal)}</Text>
      <Boton titulo="Continuar a pago" onPress={() => setEtapa('cobrar')} />
    </View>
  )
}
```

### 5.6 `app/(app)/(tabs)/productos.tsx` — acciones de venta por producto

**Calzado**: la fila en la lista (`CardModelo`) no cambia — sigue navegando a `/productos/[ref]` para elegir talla/color, porque un modelo agrupado puede tener varias variantes y no se puede vender sin elegir una. El cambio ocurre dentro de `productos/[ref].tsx`, que hoy tiene un solo botón "Agregar al carrito" y pasa a tener dos:
- "Agregar al carrito" → `dispatch({tipo:'agregar', producto})`, toast + haptic, **sin navegar** (cambio respecto a hoy, que hacía `router.push('/ventas/nueva')`).
- Nuevo botón "Compra rápida" (debajo del anterior) → `dispatch({tipo:'limpiar'})`, luego `dispatch({tipo:'agregar', producto})`, luego `router.push('/ventas/nueva?modo=rapida')`.

**Granja**: tocar una fila de Granja en `productos.tsx` abre una hoja modal nueva `HojaVenderGranja` (en vez de navegar al editor):

```tsx
// components/ui/HojaVenderGranja.tsx (nuevo)
interface Props {
  visible: boolean
  producto: ProductoVarios | null
  onCerrar: () => void
  onAgregar: (cantidad: number, precio: number) => void
  onCompraRapida: (cantidad: number, precio: number) => void
}
```
Contiene: nombre del producto, `CampoTexto` cantidad (`keyboardType="decimal-pad"`, sufijo `unidad_medida`), `CampoTexto` precio (`keyboardType="number-pad"`), y los botones "Agregar a carrito" / "Compra rápida" (misma lógica que calzado: agregar dispara toast sin navegar; compra rápida limpia+agrega+navega con `?modo=rapida`).

Se agrega un ícono de lápiz (`Pencil`, solo `esDueno || esAdmin`) al lado derecho de cada fila de Granja, que sí navega a `/inventario/granja/editor?id=X` para editar — así no se pierde la vía de edición existente.

### 5.7 FAB del `TabBar` → ícono de carrito

`components/ui/TabBar.tsx`:

```tsx
import { ShoppingCart } from 'lucide-react-native'
import { useCarrito } from '../../lib/carrito-contexto'
// ...
export function TabBar({ state, navigation }: BottomTabBarProps) {
  const { items } = useCarrito()
  const cantidad = items.reduce((s, i) => s + i.cantidad, 0)
  // ...
  const abrirCarrito = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {})
    router.push('/ventas/nueva')
  }
  // en el JSX del botón central: <Plus .../> se reemplaza por <ShoppingCart size={26} color={paleta.sobrePrimario} strokeWidth={2.2} />
  // y se agrega un badge numérico si cantidad > 0 (círculo pequeño arriba a la derecha del ícono, con el número).
}
```

`abrirNuevaVenta` se renombra a `abrirCarrito`, con el mismo `router.push('/ventas/nueva')` (sin `?modo=rapida`, entra a la etapa `'carrito'` normal). El badge: `View` absoluto arriba-derecha del círculo del FAB, `backgroundColor: paleta.peligro`, texto blanco pequeño con `cantidad` (o `'9+'` si es mayor a 9), oculto si `cantidad === 0`.

- [ ] **Test:** actualizar `components/ui/TabBar.test.tsx` — el test "el FAB va a Nueva Venta" pasa a esperar el mismo `router.push('/ventas/nueva')` pero verificando el ícono de carrito; agregar un test nuevo que monte `TabBar` dentro de un `CarritoProvider` con 2 ítems y confirme que el badge muestra "2".

### 5.8 Filtros por marca y precio en Productos

Nuevo componente `components/ui/HojaFiltrosProductos.tsx` (modal/bottom-sheet, mismo patrón visual que `SelectorRango`): lista de marcas distintas (derivadas de los modelos cargados, `[...new Set(modelos.map(m => m.marca).filter(Boolean))]`) como chips multi-select, y un rango de precio con dos `SliderPrecio` (o un slider de rango simple min/max sobre `Math.min/max` de todos los `precioMin`/`precioMax` visibles). Se abre desde un botón "Filtros" al lado del buscador en `productos.tsx`. El filtrado se aplica en memoria sobre `modelosVisibles` (ya filtrado por categoría/búsqueda), sin tocar `lib/inventario.ts` ni la consulta a Supabase.

### 5.9 Productos descontinuados

- **`lib/inventario.ts`**: `listarCalzado` agrega un filtro opcional `activo?: boolean` (default implícito `true` en la pantalla, no en la función — la función sigue devolviendo todo, el filtro por defecto vive en `productos.tsx` para no romper otros consumidores como `recibir-mercancia`/`inventario/carga` que necesitan ver todo).
- **`app/(app)/(tabs)/productos.tsx`**: nuevo estado `verDescontinuados` (boolean, toggle/chip "Ver descontinuados"). `modelosVisibles` filtra por `m.activo !== false` salvo que `verDescontinuados` esté activo; cuando están visibles, se muestran con `opacity: 0.5` (mismo patrón que `agotado`) y sin los botones de venta (deshabilitados), con un botón "Reactivar" en su lugar.
- **`app/(app)/inventario/calzado/[id].tsx`** (o `editor.tsx`, donde tenga más sentido según el flujo de edición existente): se agrega un `Switch` "Producto activo" que llama a `guardarCalzado({...datos, activo})` — la RPC `guardar_producto_calzado` ya acepta `p_activo`, no requiere cambios de backend.
- `agruparPorReferencia` (en `lib/productos.ts`) agrupa variantes por referencia en un `ModeloCalzado`. Con `activo` mixto entre variantes de un mismo modelo, la regla es: el modelo agrupado se considera **activo si al menos una variante lo es** (`modelo.activo = variantes.some(v => v.activo)`) — así el modelo sigue apareciendo en Productos mientras tenga algo vendible, y el toggle de "ver descontinuados" filtra a nivel de variante dentro del detalle (`productos/[ref].tsx`), no a nivel de modelo completo.

---

## 6. Permisos (sin cambios respecto al PRD v4.0)

Todas las acciones nuevas (agregar a carrito, compra rápida, filtros, ver descontinuados) usan los mismos permisos ya vigentes para Ventas e Inventario — ningún rol nuevo, ninguna restricción nueva.

## 7. Pruebas

- **Unit:** `SliderPrecio.test.tsx` (nuevo, ver §5.2). `carrito.test.ts` no cambia (el reducer no se toca). `lib/gastos.ts` — test para `guardarGastoFijo` con `imagenUri` (llama a `comprimirYSubirComprobante` y setea `comprobante_url`).
- **Componentes:** `TabBar.test.tsx` actualizado (badge). Cualquier test de `nueva.tsx`/`productos.tsx`/`productos/[ref].tsx` que referencie el buscador eliminado o el botón "Agregar al carrito" navegando, se actualiza a la conducta nueva (sin navegar, `modo=rapida` para compra rápida).
- Verificación final: `tsc --noEmit` limpio + `npm test` verde + recorrido manual en Expo Go: agregar 2 productos distintos desde Productos sin salir de la pantalla, abrir el carrito desde el FAB, ajustar precio con el slider, cobrar; y por separado, probar "Compra rápida" de un solo ítem.

## 8. Archivos afectados (referencia)

- **Nuevo:** `components/ui/SliderPrecio.tsx` (+test), `components/ui/HojaFiltrosProductos.tsx`, `components/ui/HojaVenderGranja.tsx`, migración `alter table gastos_fijos add column comprobante_url`.
- **Modificados:** `app/(app)/(tabs)/productos.tsx`, `app/(app)/(tabs)/perfil.tsx`, `app/(app)/(tabs)/movimientos.tsx`, `app/(app)/ventas/nueva.tsx`, `app/(app)/productos/[ref].tsx`, `app/(app)/inventario/calzado/[id].tsx` o `editor.tsx`, `app/(app)/gastos/fijos-editor.tsx`, `components/ui/TabBar.tsx`, `lib/gastos.ts`, `lib/inventario.ts`, `components/ui/index.ts`.
- **Dependencia nueva:** `@react-native-community/slider`.
