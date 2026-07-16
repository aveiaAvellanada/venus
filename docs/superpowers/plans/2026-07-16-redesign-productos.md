# Rediseño Venus — Paso 7: Productos agrupados + detalle unificado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Parte D del redisign: lista de Productos con **un card por referencia** (agrupado en el cliente, sin tocar la BD) y pantalla de **detalle de producto** con selector de color (pills) y grid de tallas con stock. Toggle Calzado/Granja con la lista de Granja en línea.

**Architecture:** `lib/productos.ts` con lógica pura testeable: `agruparPorReferencia` (clave = referencia, fallback descripcion), `filtrarModelos`, `colorAHex`. Componentes `ChipTalla` y `PillColor` (§6.13). Rebuild de `(tabs)/productos.tsx` (toggle + búsqueda + chips de las 7 categorías canónicas de lib/excel.ts + cards agrupados + vista Granja con `listarVarios`) y pantalla nueva `app/(app)/productos/[ref].tsx`. Datos vía `listarCalzado()` existente. **El CTA "Agregar al carrito" NO va en este paso** — llega en el paso 8 con el carrito compartido de Nueva Venta; el detalle en modo Productos ofrece "Ver ficha" (→ detalle/editor existente de la variante) para dueño/admin.

## Global Constraints

- Las de fases anteriores. Categorías: `Todas + ['Chanclas','Escolar','Botas caucho','Deportivo','Tennis','Clásico','Otros']` (lib/excel.ts, PRD §3).
- Card agrupado: SIN talla; muestra foto/placeholder, nombre, `marca · Ref N · X colores`, rango `$min – $max` (o precio único si min==max), Badge AGOTADO si TODAS las variantes tienen stock ≤ 0 (siguen visibles, regla de negocio).
- ChipTalla: talla arriba / divisor / stock abajo (formato fracción, sin "u"); stock 0 = visible deshabilitada (opacity 0.38, accessibilityState disabled); seleccionada = borde 2 primario + soft + pop spring.
- `CampoTexto.etiqueta` pasa a opcional (variante búsqueda sin label).
- Commits con `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.

---

### Task 1: Rama
- [ ] `git checkout main && git pull && git checkout -b feat/redesign-productos` + commit del plan.

### Task 2: `lib/productos.ts` (TDD)

**Interfaces (produce):**
- `ModeloCalzado { clave: string; referencia: string | null; nombre: string; marca: string | null; categoria: string; foto: string | null; colores: string[]; precioMin: number; precioMax: number; agotado: boolean; variantes: ProductoCalzado[] }`
- `agruparPorReferencia(filas: ProductoCalzado[]): ModeloCalzado[]` — agrupa por `referencia` (trim, case-insensitive); filas sin referencia agrupan por `descripcion`; solo filas `activo`; variantes ordenadas por talla numérica asc; colores únicos no-nulos; foto = primera no nula.
- `filtrarModelos(modelos, busqueda)` — lowercase includes sobre nombre/marca/referencia.
- `colorAHex(nombre: string): string` — mapa es→hex (negro #1C1C1E, blanco #FFFFFF, gris #9CA3AF, azul #2563EB, rojo #DC2626, verde #16A34A, amarillo #EAB308, café/marrón #92400E, rosado/rosa #EC4899, morado #8B5CF6, naranja #F97316, beige #D6C7A1, dorado #EAB308, plateado #CBD5E1); desconocido → #9CA3AF; case-insensitive.

- [ ] Test que falla (`lib/productos.test.ts`): agrupa 3 filas de una ref + 1 de otra → 2 modelos con colores/rango/agotado correctos; sin referencia agrupa por descripcion; inactivas fuera; orden de tallas; filtrar por marca; colorAHex.
- [ ] FAIL → implementar → PASS + tsc → commit `feat(productos): agrupación por referencia y helpers puros`.

### Task 3: `ChipTalla` + `PillColor` (TDD)

- `ChipTalla({ talla: string; stock: number; seleccionada: boolean; onPress: () => void })` y `PillColor({ nombre: string; seleccionado: boolean; onPress: () => void })` (swatch con `colorAHex`, borde hairline).
- [ ] Test (`components/ui/ChipTalla.test.tsx`): stock 0 → disabled y no dispara onPress; seleccionada usa primario; PillColor seleccionado marca selected y dispara onPress. FAIL → implementar (+exports barrel, `CampoTexto.etiqueta?`) → PASS → commit `feat(ui): ChipTalla y PillColor`.

### Task 4: Rebuild `(tabs)/productos.tsx` (TDD)

- Toggle `[Calzado][Granja]` + búsqueda (CampoTexto sin label, placeholder "Buscar por nombre, marca o ref…") + chips de categorías (solo Calzado).
- Calzado: `listarCalzado()` en focus → agrupar → filtrar por categoría/búsqueda en cliente → cards (press → `/productos/{clave}` con encodeURIComponent). AGOTADO en gris + badge. EstadoVacio.
- Granja: `listarVarios(busqueda)` → filas (nombre + unidad_medida caption) → press `/inventario/granja` (módulo existente). Nota v4: Granja sin stock/precio — la migración del modelo es tarea aparte; aquí solo se lista.
- Sección "Ingresar mercancía" (Recibir + Carga por rol): SIN CAMBIOS.
- [ ] Actualizar `lib/tabs_secciones_ui.test.tsx` (describe Productos): mocks de `../lib/inventario`; (a) agrupa: 2 filas misma ref → 1 card con "2 colores" y rango, press → push `/productos/4521`; (b) búsqueda filtra; (c) toggle Granja lista varios; (d) empleado sin Carga inicial (se conserva). Movimientos intacto.
- [ ] FAIL → implementar → PASS → commit `feat(ui): Productos agrupados por referencia con búsqueda y categorías`.

### Task 5: Detalle `app/(app)/productos/[ref].tsx` (TDD)

- Carga `listarCalzado()` → agrupar → buscar por `clave` (param). No encontrado → EstadoVacio.
- Foto grande (Image `foto` o placeholder Footprints sobre superficie2, 4:3, radio lg), nombre h2, `marca · Ref N` caption, precio: sin selección → rango; con talla seleccionada → `precio_maximo` de la variante (caption "precio de venta · mín $X" para dueño/admin, regateo).
- `PillColor` row (si >1 color; seleccionar filtra variantes), grid de `ChipTalla` (5 por fila) de las variantes del color activo; talla seleccionada → estado.
- Dueño/admin: `Boton secundario "Ver ficha"` (deshabilitado sin talla seleccionada) → push `/inventario/calzado/{varianteId}`. Empleado: sin botón.
- ⏳ CTA "Agregar al carrito" llega en paso 8 (anotado).
- [ ] Test (`lib/producto_detalle_ui.test.tsx`): render agrupado (nombre, ref, rango); seleccionar color filtra tallas; talla sin stock disabled; seleccionar talla muestra su precio y habilita Ver ficha (dueño) que navega; empleado sin Ver ficha.
- [ ] FAIL → implementar → PASS → commit `feat(ui): detalle de producto unificado con colores y tallas`.

### Task 6: Verificación + cierre
- [ ] tsc + suite completa → finishing-a-development-branch.

## Self-Review
1. **Cobertura Parte D/§7.4:** agrupación cliente ✓ (Opción A, BD intacta), card sin talla ✓, marca buscable ✓, categorías canónicas ✓ (la pantalla vieja de inventario usa otra lista — se anota, no se toca), chip talla formato fracción ✓, sin stock visible-deshabilitada ✓, pills color ✓, Editar por rol ✓ (vía ficha existente). Carrito ⏳ paso 8 (decisión de scope explícita).
2. **Placeholders:** columnas verificadas (marca, referencia, stock_actual, precio_minimo/maximo, foto_url).
3. **Tipos:** `ModeloCalzado.variantes` = `ProductoCalzado[]` (tipo existente).
