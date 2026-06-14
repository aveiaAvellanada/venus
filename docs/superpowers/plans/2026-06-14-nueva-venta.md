# Nueva Venta — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Registrar una venta completa (zapatos y/o productos varios) desde el celular, con pago simple o mixto, descuento de stock atómico, y persistencia de efectivo recibido y cambio.

**Architecture:** Online-first. Una RPC Postgres `registrar_venta` `SECURITY DEFINER` hace toda la venta en una transacción (valida identidad por `auth.uid()`, precios del servidor, stock con bloqueo de fila, cuadre de pagos). La UI es una pantalla única con máquina de estados `carrito → cobrar → confirmacion`, con el carrito en un reducer puro y testeable.

**Tech Stack:** React Native / Expo SDK 54, expo-router, TypeScript estricto, Supabase (Postgres 17, RLS), jest.

**Spec:** `docs/superpowers/specs/2026-06-14-nueva-venta-design.md`

**Project ref Supabase:** `xqspsaghukeynlizbjvc`

---

## Setup (antes de la Tarea 1)

- [ ] Crear rama de trabajo desde `main`:

```bash
cd /home/aveia/Development/work/Venus
git checkout main && git pull --ff-only
git checkout -b feat/nueva-venta
```

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/<ts>_nueva_venta.sql` | Columnas `efectivo_recibido`/`cambio` + función `registrar_venta` |
| `supabase/seeds/demo_inventario.sql` | Datos de prueba idempotentes |
| `lib/carrito.ts` | Tipos + reducer puro del carrito + helpers de pago |
| `lib/carrito.test.ts` | Tests del reducer y helpers |
| `lib/ventas.ts` | Acceso a datos: buscar, registrar, resumen/lista de hoy |
| `lib/permisos.ts` | Campo `ruta?` en `Modulo` + ruta de `ventas` |
| `lib/permisos.test.ts` | Test de la ruta de `ventas` |
| `app/(app)/index.tsx` | Grilla usa `m.ruta` si existe |
| `app/(app)/ventas/index.tsx` | Hub de Ventas (resumen + lista de hoy + botón) |
| `app/(app)/ventas/nueva.tsx` | Flujo de nueva venta (3 etapas) |
| `lib/database.types.ts` | Regenerado tras la migración |

---

## Task 1: Migración — columnas y RPC `registrar_venta`

**Files:**
- Create: `supabase/migrations/<timestamp>_nueva_venta.sql`
- Apply: vía MCP `supabase.apply_migration` (mismo SQL)

- [ ] **Step 1: Escribir el archivo de migración**

Usa como `<timestamp>` el formato `YYYYMMDDHHMMSS` en hora actual (ej. `20260614180000`). Crea `supabase/migrations/<timestamp>_nueva_venta.sql` con EXACTAMENTE:

```sql
-- Nueva Venta: columnas de cuadre de caja + RPC transaccional de venta completa.

alter table public.ventas
  add column if not exists efectivo_recibido numeric(12,2) check (efectivo_recibido >= 0),
  add column if not exists cambio numeric(12,2) not null default 0 check (cambio >= 0);

comment on column public.ventas.efectivo_recibido is
  'Efectivo entregado por el cliente; null si la venta no tuvo componente en efectivo';
comment on column public.ventas.cambio is
  'Vuelto entregado = efectivo_recibido - porcion pagada en efectivo';

create or replace function public.registrar_venta(
  p_items jsonb,
  p_pagos jsonb,
  p_efectivo_recibido numeric default null,
  p_cliente_nombre text default null,
  p_cliente_apellido text default null,
  p_cliente_telefono text default null
) returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_venta_id uuid;
  v_numero bigint;
  v_total numeric(12,2) := 0;
  v_total_pagos numeric(12,2) := 0;
  v_efectivo_monto numeric(12,2) := 0;
  v_efectivo_recibido numeric(12,2);
  v_cambio numeric(12,2) := 0;
  it jsonb;
  pg jsonb;
  v_tipo text;
  v_pid uuid;
  v_cant numeric(12,3);
  v_precio numeric(12,2);
  v_desc text;
  v_talla text;
  v_color text;
  v_stock numeric(12,3);
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;
  if p_pagos is null or jsonb_array_length(p_pagos) = 0 then
    raise exception 'La venta no tiene pagos';
  end if;

  insert into public.ventas (vendedor_id, total, monto_pagado, saldo_pendiente, estado,
                             cliente_nombre, cliente_apellido, cliente_telefono)
    values (v_uid, 0, 0, 0, 'completada',
            p_cliente_nombre, p_cliente_apellido, p_cliente_telefono)
    returning id, numero into v_venta_id, v_numero;

  for it in
    select value from jsonb_array_elements(p_items)
    order by value->>'producto_id'   -- orden estable para evitar deadlocks
  loop
    v_tipo := it->>'tipo';
    v_pid  := (it->>'producto_id')::uuid;
    v_cant := (it->>'cantidad')::numeric;
    if v_cant is null or v_cant <= 0 then
      raise exception 'Cantidad inválida';
    end if;

    if v_tipo = 'calzado' then
      select descripcion, precio_venta, talla, color, stock_actual
        into v_desc, v_precio, v_talla, v_color, v_stock
        from public.productos_calzado
        where id = v_pid and activo
        for update;
    elsif v_tipo = 'varios' then
      select nombre, precio_venta, null::text, null::text, stock_actual
        into v_desc, v_precio, v_talla, v_color, v_stock
        from public.productos_varios
        where id = v_pid and activo
        for update;
    else
      raise exception 'Tipo de producto inválido: %', v_tipo;
    end if;

    if v_desc is null then
      raise exception 'Producto no disponible';
    end if;
    if v_stock < v_cant then
      raise exception 'Stock insuficiente para %', v_desc;
    end if;

    if v_tipo = 'calzado' then
      update public.productos_calzado set stock_actual = stock_actual - v_cant where id = v_pid;
    else
      update public.productos_varios set stock_actual = stock_actual - v_cant where id = v_pid;
    end if;

    insert into public.venta_items (venta_id, tipo_producto,
        producto_calzado_id, producto_varios_id,
        descripcion_snapshot, talla, color, cantidad, precio_unitario, subtotal)
      values (v_venta_id, v_tipo,
        case when v_tipo = 'calzado' then v_pid end,
        case when v_tipo = 'varios'  then v_pid end,
        v_desc, v_talla, v_color, v_cant, v_precio, round(v_precio * v_cant, 2));

    v_total := v_total + round(v_precio * v_cant, 2);
  end loop;

  for pg in select value from jsonb_array_elements(p_pagos)
  loop
    if (pg->>'metodo') not in ('efectivo','nequi','daviplata') then
      raise exception 'Método de pago inválido';
    end if;
    if (pg->>'monto')::numeric <= 0 then
      raise exception 'Monto de pago inválido';
    end if;
    v_total_pagos := v_total_pagos + (pg->>'monto')::numeric;
    if (pg->>'metodo') = 'efectivo' then
      v_efectivo_monto := v_efectivo_monto + (pg->>'monto')::numeric;
    end if;
    insert into public.metodos_pago_venta (venta_id, metodo, monto, es_anticipo)
      values (v_venta_id, pg->>'metodo', (pg->>'monto')::numeric, false);
  end loop;

  if v_total_pagos <> v_total then
    raise exception 'Los pagos no suman el total';
  end if;

  if v_efectivo_monto > 0 then
    v_efectivo_recibido := coalesce(p_efectivo_recibido, v_efectivo_monto);
    if v_efectivo_recibido < v_efectivo_monto then
      raise exception 'El efectivo recibido es menor al pago en efectivo';
    end if;
    v_cambio := v_efectivo_recibido - v_efectivo_monto;
  else
    v_efectivo_recibido := null;
    v_cambio := 0;
  end if;

  update public.ventas
    set total = v_total, monto_pagado = v_total, saldo_pendiente = 0,
        efectivo_recibido = v_efectivo_recibido, cambio = v_cambio
    where id = v_venta_id;

  return jsonb_build_object('venta_id', v_venta_id, 'numero', v_numero);
end;
$$;

revoke all on function public.registrar_venta(jsonb, jsonb, numeric, text, text, text) from public;
grant execute on function public.registrar_venta(jsonb, jsonb, numeric, text, text, text) to authenticated;
```

- [ ] **Step 2: Aplicar la migración a la DB remota**

Usa la herramienta MCP `supabase.apply_migration` con `project_id: "xqspsaghukeynlizbjvc"`, `name: "nueva_venta"`, y `query` = el contenido completo del SQL anterior.
Expected: aplica sin error.

- [ ] **Step 3: Smoke test de la RPC (happy path, con rollback)**

Ejecuta vía MCP `supabase.execute_sql` (`project_id: "xqspsaghukeynlizbjvc"`). **Aún no hay seed**, así que este bloque inserta su propio producto de prueba y revierte todo con un error centinela:

```sql
do $$
declare
  v_uid uuid;
  v_pid uuid;
  v_after numeric;
  v_res jsonb;
begin
  select id into v_uid from public.users where rol = 'empleado' limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);

  insert into public.productos_calzado (categoria, descripcion, precio_venta, stock_actual, talla, color)
    values ('Tennis', 'SMOKE TEST', 100000, 3, '40', 'Negro') returning id into v_pid;

  v_res := public.registrar_venta(
    jsonb_build_array(jsonb_build_object('tipo','calzado','producto_id',v_pid,'cantidad',1)),
    jsonb_build_array(jsonb_build_object('metodo','efectivo','monto',100000)),
    120000
  );

  select stock_actual into v_after from public.productos_calzado where id = v_pid;
  if v_after <> 2 then raise exception 'FALLO stock: esperaba 2, obtuve %', v_after; end if;
  if (select cambio from public.ventas where id = (v_res->>'venta_id')::uuid) <> 20000 then
    raise exception 'FALLO cambio: esperaba 20000';
  end if;
  if (select efectivo_recibido from public.ventas where id = (v_res->>'venta_id')::uuid) <> 120000 then
    raise exception 'FALLO efectivo_recibido';
  end if;

  raise exception 'SMOKE_OK_ROLLBACK';
end $$;
```

Expected: el comando termina con error `SMOKE_OK_ROLLBACK` (significa que todas las aserciones pasaron y NADA se persistió). Cualquier otro mensaje `FALLO ...` es un bug a corregir.

- [ ] **Step 4: Smoke test de guardas (stock insuficiente, pagos no cuadran, efectivo corto)**

Ejecuta vía MCP `supabase.execute_sql`:

```sql
do $$
declare
  v_uid uuid;
  v_pid uuid;
  v_err text;
begin
  select id into v_uid from public.users where rol = 'empleado' limit 1;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text, true);
  insert into public.productos_calzado (categoria, descripcion, precio_venta, stock_actual)
    values ('Tennis', 'SMOKE GUARD', 50000, 1) returning id into v_pid;

  -- a) stock insuficiente
  begin
    perform public.registrar_venta(
      jsonb_build_array(jsonb_build_object('tipo','calzado','producto_id',v_pid,'cantidad',5)),
      jsonb_build_array(jsonb_build_object('metodo','nequi','monto',250000)), null);
    raise exception 'FALLO: no rechazó stock insuficiente';
  exception when others then
    if sqlerrm not like 'Stock insuficiente%' then raise exception 'FALLO stock msg: %', sqlerrm; end if;
  end;

  -- b) pagos no cuadran
  begin
    perform public.registrar_venta(
      jsonb_build_array(jsonb_build_object('tipo','calzado','producto_id',v_pid,'cantidad',1)),
      jsonb_build_array(jsonb_build_object('metodo','nequi','monto',40000)), null);
    raise exception 'FALLO: no rechazó pagos que no cuadran';
  exception when others then
    if sqlerrm <> 'Los pagos no suman el total' then raise exception 'FALLO pagos msg: %', sqlerrm; end if;
  end;

  -- c) efectivo recibido corto
  begin
    perform public.registrar_venta(
      jsonb_build_array(jsonb_build_object('tipo','calzado','producto_id',v_pid,'cantidad',1)),
      jsonb_build_array(jsonb_build_object('metodo','efectivo','monto',50000)), 40000);
    raise exception 'FALLO: no rechazó efectivo corto';
  exception when others then
    if sqlerrm <> 'El efectivo recibido es menor al pago en efectivo' then raise exception 'FALLO efectivo msg: %', sqlerrm; end if;
  end;

  raise exception 'GUARDS_OK_ROLLBACK';
end $$;
```

Expected: termina con error `GUARDS_OK_ROLLBACK`. Cualquier `FALLO ...` es un bug.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): RPC registrar_venta y columnas de cuadre de caja"
```

---

## Task 2: Seed de datos de prueba

**Files:**
- Create: `supabase/seeds/demo_inventario.sql`

- [ ] **Step 1: Escribir el seed idempotente**

Crea `supabase/seeds/demo_inventario.sql` con EXACTAMENTE:

```sql
-- Seed de demostración para probar Nueva Venta. Idempotente: borra por marca y reinserta.
-- NO es una migración de esquema; se aplica manualmente a la DB remota.

delete from public.productos_calzado where referencia like 'DEMO-%';
delete from public.productos_varios where nombre like 'DEMO %';

insert into public.productos_calzado (referencia, categoria, descripcion, talla, color, precio_venta, stock_actual, stock_minimo) values
  ('DEMO-NK-AF1', 'Tennis',  'Tenis Nike Air Force', '38', 'Negro',  120000, 2, 1),
  ('DEMO-NK-AF1', 'Tennis',  'Tenis Nike Air Force', '39', 'Negro',  120000, 3, 1),
  ('DEMO-NK-AF1', 'Tennis',  'Tenis Nike Air Force', '40', 'Negro',  120000, 1, 1),
  ('DEMO-NK-AF1', 'Tennis',  'Tenis Nike Air Force', '38', 'Blanco', 120000, 0, 1),
  ('DEMO-CH-RIO', 'Chanclas','Chancla Rio',           '36', 'Azul',    25000, 6, 2),
  ('DEMO-CH-RIO', 'Chanclas','Chancla Rio',           '38', 'Rosado',  25000, 4, 2),
  ('DEMO-ESC-01', 'Escolar', 'Zapato escolar negro',  '34', 'Negro',   80000, 5, 1),
  ('DEMO-BC-01',  'Botas caucho','Bota caucho',       '40', 'Negro',   60000, 3, 1);

insert into public.productos_varios (nombre, unidad_medida, precio_venta, stock_actual, stock_minimo) values
  ('DEMO Huevos', 'panel', 16000,  8,   2),
  ('DEMO Café',   'libra', 12000, 10, 1.5),
  ('DEMO Limón',  'libra',  3000, 20,   3);
```

- [ ] **Step 2: Aplicar el seed a la DB remota**

Ejecuta vía MCP `supabase.execute_sql` (`project_id: "xqspsaghukeynlizbjvc"`) con el contenido completo del seed.
Expected: sin error.

- [ ] **Step 3: Verificar conteos**

Ejecuta vía MCP `supabase.execute_sql`:

```sql
select
  (select count(*) from public.productos_calzado where referencia like 'DEMO-%') as calzado,
  (select count(*) from public.productos_varios where nombre like 'DEMO %') as varios,
  (select count(*) from public.productos_calzado where referencia like 'DEMO-%' and stock_actual > 0) as calzado_disp;
```

Expected: `calzado=8, varios=3, calzado_disp=7` (uno está agotado a propósito).

- [ ] **Step 4: Commit**

```bash
git add supabase/seeds/demo_inventario.sql
git commit -m "chore(db): seed de inventario de demostración"
```

---

## Task 3: Regenerar tipos de TypeScript

**Files:**
- Modify: `lib/database.types.ts` (regenerado)

- [ ] **Step 1: Generar los tipos**

Usa la herramienta MCP `supabase.generate_typescript_types` con `project_id: "xqspsaghukeynlizbjvc"` y **sobrescribe** `lib/database.types.ts` con el resultado completo.

- [ ] **Step 2: Verificar que `registrar_venta` y las columnas aparecen**

Run: `grep -n "registrar_venta\|efectivo_recibido\|cambio" lib/database.types.ts`
Expected: aparecen `registrar_venta` bajo `Functions`, y `efectivo_recibido` / `cambio` en `ventas`.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add lib/database.types.ts
git commit -m "chore(types): regenerar database.types tras migración de venta"
```

---

## Task 4: `lib/carrito.ts` — reducer puro y helpers (TDD)

**Files:**
- Create: `lib/carrito.ts`
- Test: `lib/carrito.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Crea `lib/carrito.test.ts` con EXACTAMENTE:

```ts
import {
  carritoReducer, totalCarrito, pagosCuadran, montoEfectivo, calcularCambio,
  type ItemCarrito, type ProductoVendible,
} from './carrito'

const tenis: ProductoVendible = {
  tipo: 'calzado', id: 'c1', titulo: 'Tenis Nike', detalle: 'Talla 39 · Negro', precio: 120000, stock: 2,
}
const cafe: ProductoVendible = {
  tipo: 'varios', id: 'v1', titulo: 'Café', detalle: 'por libra', precio: 12000, stock: 10, unidad: 'libra',
}

const conTenis = (): ItemCarrito[] => carritoReducer([], { tipo: 'agregar', producto: tenis })

describe('carritoReducer', () => {
  test('agregar un producto nuevo lo pone con cantidad 1', () => {
    const items = conTenis()
    expect(items).toHaveLength(1)
    expect(items[0].cantidad).toBe(1)
    expect(items[0].subtotal).toBe(120000)
  })

  test('agregar el mismo producto fusiona y suma cantidad', () => {
    let items = conTenis()
    items = carritoReducer(items, { tipo: 'agregar', producto: tenis })
    expect(items).toHaveLength(1)
    expect(items[0].cantidad).toBe(2)
  })

  test('no supera el stock disponible (calzado)', () => {
    let items = conTenis()
    items = carritoReducer(items, { tipo: 'agregar', producto: tenis })
    items = carritoReducer(items, { tipo: 'agregar', producto: tenis })
    expect(items[0].cantidad).toBe(2) // stock = 2
  })

  test('calzado redondea la cantidad hacia abajo a entero', () => {
    let items = conTenis()
    items = carritoReducer(items, { tipo: 'cambiarCantidad', id: 'c1', cantidad: 1.9 })
    expect(items[0].cantidad).toBe(1)
  })

  test('varios permite cantidad decimal', () => {
    let items = carritoReducer([], { tipo: 'agregar', producto: cafe })
    items = carritoReducer(items, { tipo: 'cambiarCantidad', id: 'v1', cantidad: 0.5 })
    expect(items[0].cantidad).toBe(0.5)
    expect(items[0].subtotal).toBe(6000)
  })

  test('cambiar cantidad a 0 elimina el item', () => {
    let items = conTenis()
    items = carritoReducer(items, { tipo: 'cambiarCantidad', id: 'c1', cantidad: 0 })
    expect(items).toHaveLength(0)
  })

  test('quitar elimina el item', () => {
    const items = carritoReducer(conTenis(), { tipo: 'quitar', id: 'c1' })
    expect(items).toHaveLength(0)
  })

  test('limpiar vacía el carrito', () => {
    expect(carritoReducer(conTenis(), { tipo: 'limpiar' })).toEqual([])
  })
})

describe('helpers de total y pago', () => {
  test('totalCarrito suma los subtotales', () => {
    let items = conTenis()
    items = carritoReducer(items, { tipo: 'agregar', producto: cafe })
    expect(totalCarrito(items)).toBe(132000)
  })

  test('pagosCuadran exige suma exacta y montos positivos', () => {
    expect(pagosCuadran([{ metodo: 'nequi', monto: 120000 }], 120000)).toBe(true)
    expect(pagosCuadran(
      [{ metodo: 'efectivo', monto: 100000 }, { metodo: 'nequi', monto: 20000 }], 120000)).toBe(true)
    expect(pagosCuadran([{ metodo: 'nequi', monto: 100000 }], 120000)).toBe(false)
    expect(pagosCuadran([{ metodo: 'nequi', monto: 130000 }], 120000)).toBe(false)
    expect(pagosCuadran([], 0)).toBe(false)
  })

  test('montoEfectivo suma solo lo pagado en efectivo', () => {
    expect(montoEfectivo(
      [{ metodo: 'efectivo', monto: 100000 }, { metodo: 'nequi', monto: 20000 }])).toBe(100000)
  })

  test('calcularCambio nunca es negativo', () => {
    expect(calcularCambio(120000, 100000)).toBe(20000)
    expect(calcularCambio(100000, 100000)).toBe(0)
    expect(calcularCambio(0, 100000)).toBe(0)
  })
})
```

- [ ] **Step 2: Correr los tests para verlos fallar**

Run: `npm test -- carrito`
Expected: FAIL (`Cannot find module './carrito'`).

- [ ] **Step 3: Implementar `lib/carrito.ts`**

Crea `lib/carrito.ts` con EXACTAMENTE:

```ts
export type TipoProducto = 'calzado' | 'varios'
export type MetodoPago = 'efectivo' | 'nequi' | 'daviplata'

export interface ProductoVendible {
  tipo: TipoProducto
  id: string
  titulo: string
  detalle: string
  precio: number
  stock: number
  unidad?: string
}

export interface ItemCarrito {
  producto: ProductoVendible
  cantidad: number
  subtotal: number
}

export interface PagoInput {
  metodo: MetodoPago
  monto: number
}

export type AccionCarrito =
  | { tipo: 'agregar'; producto: ProductoVendible }
  | { tipo: 'cambiarCantidad'; id: string; cantidad: number }
  | { tipo: 'quitar'; id: string }
  | { tipo: 'limpiar' }

export const redondear = (n: number): number => Math.round(n * 100) / 100

function conCantidad(producto: ProductoVendible, cantidad: number): ItemCarrito {
  let c = Math.min(cantidad, producto.stock)
  if (producto.tipo === 'calzado') c = Math.floor(c)
  c = Math.max(0, c)
  return { producto, cantidad: c, subtotal: redondear(producto.precio * c) }
}

export function carritoReducer(items: ItemCarrito[], accion: AccionCarrito): ItemCarrito[] {
  switch (accion.tipo) {
    case 'agregar': {
      const existente = items.find(i => i.producto.id === accion.producto.id)
      if (existente) {
        return items.map(i =>
          i.producto.id === accion.producto.id ? conCantidad(i.producto, i.cantidad + 1) : i,
        )
      }
      const nuevo = conCantidad(accion.producto, 1)
      return nuevo.cantidad > 0 ? [...items, nuevo] : items
    }
    case 'cambiarCantidad':
      return items
        .map(i => (i.producto.id === accion.id ? conCantidad(i.producto, accion.cantidad) : i))
        .filter(i => i.cantidad > 0)
    case 'quitar':
      return items.filter(i => i.producto.id !== accion.id)
    case 'limpiar':
      return []
  }
}

export const totalCarrito = (items: ItemCarrito[]): number =>
  redondear(items.reduce((s, i) => s + i.subtotal, 0))

export const sumaPagos = (pagos: PagoInput[]): number =>
  redondear(pagos.reduce((s, p) => s + p.monto, 0))

export const pagosCuadran = (pagos: PagoInput[], total: number): boolean =>
  pagos.length > 0 && pagos.every(p => p.monto > 0) && sumaPagos(pagos) === total

export const montoEfectivo = (pagos: PagoInput[]): number =>
  redondear(pagos.filter(p => p.metodo === 'efectivo').reduce((s, p) => s + p.monto, 0))

export const calcularCambio = (efectivoRecibido: number, efectivoMonto: number): number =>
  redondear(Math.max(0, efectivoRecibido - efectivoMonto))
```

- [ ] **Step 4: Correr los tests para verlos pasar**

Run: `npm test -- carrito`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add lib/carrito.ts lib/carrito.test.ts
git commit -m "feat: reducer puro del carrito y helpers de pago"
```

---

## Task 5: `lib/ventas.ts` — acceso a datos

**Files:**
- Create: `lib/ventas.ts`

- [ ] **Step 1: Implementar `lib/ventas.ts`**

Crea `lib/ventas.ts` con EXACTAMENTE:

```ts
import { supabase } from './supabase'
import type { ItemCarrito, PagoInput, ProductoVendible } from './carrito'

export interface VentaResumen {
  id: string
  numero: number
  total: number
  hora: string
  metodos: string
}

// Medianoche de hoy en Bogotá (UTC-5, sin horario de verano) como ISO UTC.
function inicioDeHoyBogota(): string {
  const offsetMs = 5 * 60 * 60 * 1000
  const bog = new Date(Date.now() - offsetMs)
  const medianoche = Date.UTC(bog.getUTCFullYear(), bog.getUTCMonth(), bog.getUTCDate())
  return new Date(medianoche + offsetMs).toISOString()
}

export async function buscarProductos(q: string): Promise<ProductoVendible[]> {
  const termino = q.trim()
  const like = `%${termino}%`

  let calzadoQ = supabase
    .from('productos_calzado')
    .select('id, descripcion, referencia, talla, color, precio_venta, stock_actual')
    .eq('activo', true)
    .gt('stock_actual', 0)
    .limit(20)
  if (termino) {
    calzadoQ = calzadoQ.or(
      `descripcion.ilike.${like},referencia.ilike.${like},talla.ilike.${like},color.ilike.${like}`,
    )
  }

  let variosQ = supabase
    .from('productos_varios')
    .select('id, nombre, unidad_medida, precio_venta, stock_actual')
    .eq('activo', true)
    .gt('stock_actual', 0)
    .limit(20)
  if (termino) variosQ = variosQ.ilike('nombre', like)

  const [calzado, varios] = await Promise.all([calzadoQ, variosQ])
  if (calzado.error) throw calzado.error
  if (varios.error) throw varios.error

  const deCalzado: ProductoVendible[] = (calzado.data ?? []).map(c => ({
    tipo: 'calzado',
    id: c.id,
    titulo: c.descripcion,
    detalle: [c.talla ? `Talla ${c.talla}` : null, c.color].filter(Boolean).join(' · '),
    precio: Number(c.precio_venta),
    stock: Number(c.stock_actual),
  }))
  const deVarios: ProductoVendible[] = (varios.data ?? []).map(v => ({
    tipo: 'varios',
    id: v.id,
    titulo: v.nombre,
    detalle: `por ${v.unidad_medida}`,
    precio: Number(v.precio_venta),
    stock: Number(v.stock_actual),
    unidad: v.unidad_medida,
  }))
  return [...deCalzado, ...deVarios].slice(0, 20)
}

export interface RegistrarVentaInput {
  items: ItemCarrito[]
  pagos: PagoInput[]
  efectivoRecibido: number | null
  cliente?: { nombre?: string; apellido?: string; telefono?: string }
}

export async function registrarVenta(input: RegistrarVentaInput): Promise<{ numero: number }> {
  const { data, error } = await supabase.rpc('registrar_venta', {
    p_items: input.items.map(i => ({
      tipo: i.producto.tipo,
      producto_id: i.producto.id,
      cantidad: i.cantidad,
    })),
    p_pagos: input.pagos.map(p => ({ metodo: p.metodo, monto: p.monto })),
    p_efectivo_recibido: input.efectivoRecibido,
    p_cliente_nombre: input.cliente?.nombre ?? null,
    p_cliente_apellido: input.cliente?.apellido ?? null,
    p_cliente_telefono: input.cliente?.telefono ?? null,
  })
  if (error) throw new Error(traducirError(error.message))
  const res = data as { numero: number }
  return { numero: res.numero }
}

function traducirError(msg: string): string {
  if (msg.includes('Stock insuficiente')) {
    const prod = msg.split('Stock insuficiente para ')[1] ?? 'un producto'
    return `Ya no hay suficiente stock de ${prod}. Actualiza el carrito.`
  }
  if (msg.includes('pagos no suman')) return 'Los pagos no suman el total.'
  if (msg.includes('efectivo recibido')) return 'El efectivo recibido es menor al pago en efectivo.'
  if (/network|fetch|failed to fetch|timeout|conexión|conexion/i.test(msg)) {
    return 'Sin conexión. La venta no se guardó. Intenta de nuevo.'
  }
  return 'No se pudo registrar la venta. Intenta de nuevo.'
}

export async function resumenHoy(): Promise<{ cantidad: number; total: number }> {
  const { data, error } = await supabase
    .from('ventas')
    .select('total')
    .eq('estado', 'completada')
    .gte('created_at', inicioDeHoyBogota())
  if (error) throw error
  const filas = data ?? []
  return { cantidad: filas.length, total: filas.reduce((s, v) => s + Number(v.total), 0) }
}

export async function listarVentasHoy(): Promise<VentaResumen[]> {
  const { data, error } = await supabase
    .from('ventas')
    .select('id, numero, total, created_at, metodos_pago_venta(metodo)')
    .eq('estado', 'completada')
    .gte('created_at', inicioDeHoyBogota())
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(v => ({
    id: v.id,
    numero: v.numero,
    total: Number(v.total),
    hora: new Date(v.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }),
    metodos: (v.metodos_pago_venta ?? []).map(m => m.metodo).join(', '),
  }))
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores. (Si `supabase.rpc('registrar_venta', …)` da error de tipo, los tipos del Task 3 no se regeneraron — vuelve a ese task.)

- [ ] **Step 3: Commit**

```bash
git add lib/ventas.ts
git commit -m "feat: capa de datos de ventas (buscar, registrar, resumen de hoy)"
```

---

## Task 6: Ruta del módulo `ventas` en el mapa de permisos

**Files:**
- Modify: `lib/permisos.ts`
- Modify: `lib/permisos.test.ts`
- Modify: `app/(app)/index.tsx`

- [ ] **Step 1: Agregar test de la ruta**

En `lib/permisos.test.ts`, agrega este test dentro del `describe('permisos', …)` (después del test `no hay ids de módulo duplicados`):

```ts
  test('el módulo ventas apunta a su ruta dedicada', () => {
    expect(MODULOS.find(m => m.id === 'ventas')?.ruta).toBe('/ventas')
  })
```

- [ ] **Step 2: Correr el test para verlo fallar**

Run: `npm test -- permisos`
Expected: FAIL (el test nuevo falla; `ruta` no existe).

- [ ] **Step 3: Agregar el campo `ruta` y la ruta de ventas**

En `lib/permisos.ts`:

Reemplaza la interfaz `Modulo` por:

```ts
export interface Modulo {
  id: string
  titulo: string
  icono: string
  roles: Rol[]
  ruta?: string
}
```

Y reemplaza la línea del módulo `ventas` por:

```ts
  { id: 'ventas',             titulo: 'Ventas',             icono: '🛒', roles: ['dueno', 'empleado'], ruta: '/ventas' },
```

- [ ] **Step 4: Usar `ruta` en la grilla del home**

En `app/(app)/index.tsx`, reemplaza la línea del `Pressable` del tile (la que hace `router.push(\`/modulo/${m.id}\`)`):

```tsx
          <Pressable key={m.id} style={styles.tile} onPress={() => router.push(m.ruta ?? `/modulo/${m.id}`)}>
```

- [ ] **Step 5: Correr tests y typecheck**

Run: `npm test -- permisos && npx tsc --noEmit`
Expected: PASS y sin errores de tipo.

- [ ] **Step 6: Commit**

```bash
git add lib/permisos.ts lib/permisos.test.ts "app/(app)/index.tsx"
git commit -m "feat: enrutar el módulo Ventas a /ventas desde el home"
```

---

## Task 7: Hub de Ventas — `app/(app)/ventas/index.tsx`

**Files:**
- Create: `app/(app)/ventas/index.tsx`

- [ ] **Step 1: Implementar el hub**

Crea `app/(app)/ventas/index.tsx` con EXACTAMENTE:

```tsx
import { useCallback, useState } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useFocusEffect, useRouter } from 'expo-router'
import { useRequireModulo } from '../../../lib/auth'
import { listarVentasHoy, resumenHoy, type VentaResumen } from '../../../lib/ventas'

const pesos = (n: number) => '$' + n.toLocaleString('es-CO')

export default function VentasHub() {
  const redir = useRequireModulo('ventas')
  const router = useRouter()
  const [resumen, setResumen] = useState({ cantidad: 0, total: 0 })
  const [ventas, setVentas] = useState<VentaResumen[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const [r, v] = await Promise.all([resumenHoy(), listarVentasHoy()])
      setResumen(r)
      setVentas(v)
    } catch {
      setError('No se pudieron cargar las ventas de hoy.')
    } finally {
      setCargando(false)
    }
  }, [])

  useFocusEffect(useCallback(() => { cargar() }, [cargar]))

  if (redir) return redir

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={16}>
          <Text style={styles.volver}>← Inicio</Text>
        </Pressable>
        <Text style={styles.titulo}>Ventas</Text>
        <View style={{ width: 60 }} />
      </View>

      <View style={styles.resumen}>
        <Text style={styles.resumenMonto}>{pesos(resumen.total)}</Text>
        <Text style={styles.resumenSub}>Hoy · {resumen.cantidad} ventas</Text>
      </View>

      <Pressable style={styles.nuevaBtn} onPress={() => router.push('/ventas/nueva')}>
        <Text style={styles.nuevaBtnText}>+ Nueva venta</Text>
      </Pressable>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <ScrollView style={styles.lista} contentContainerStyle={{ paddingBottom: 24 }}>
        {cargando ? (
          <ActivityIndicator style={{ marginTop: 24 }} />
        ) : ventas.length === 0 ? (
          <Text style={styles.vacio}>Aún no hay ventas hoy.</Text>
        ) : (
          ventas.map(v => (
            <View key={v.id} style={styles.fila}>
              <View>
                <Text style={styles.filaTotal}>{pesos(v.total)}</Text>
                <Text style={styles.filaSub}>#{v.numero} · {v.metodos}</Text>
              </View>
              <Text style={styles.filaHora}>{v.hora}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 56 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20 },
  volver: { fontSize: 16, color: '#1E66F5', fontWeight: '600' },
  titulo: { fontSize: 20, fontWeight: '700' },
  resumen: { alignItems: 'center', paddingVertical: 24 },
  resumenMonto: { fontSize: 40, fontWeight: '800' },
  resumenSub: { fontSize: 16, color: '#666', marginTop: 4 },
  nuevaBtn: { backgroundColor: '#1E66F5', marginHorizontal: 20, borderRadius: 20, paddingVertical: 22, alignItems: 'center' },
  nuevaBtnText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  error: { color: '#D20F39', textAlign: 'center', marginTop: 16, fontSize: 15 },
  lista: { flex: 1, marginTop: 24, paddingHorizontal: 20 },
  vacio: { textAlign: 'center', color: '#999', marginTop: 24, fontSize: 16 },
  fila: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EEE' },
  filaTotal: { fontSize: 18, fontWeight: '700' },
  filaSub: { fontSize: 13, color: '#888', marginTop: 2 },
  filaHora: { fontSize: 14, color: '#666' },
})
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/ventas/index.tsx"
git commit -m "feat: hub de Ventas con resumen y lista de hoy"
```

---

## Task 8: Flujo de Nueva Venta — `app/(app)/ventas/nueva.tsx`

**Files:**
- Create: `app/(app)/ventas/nueva.tsx`

**Gotcha de hooks:** TODOS los hooks (`useState`/`useReducer`/`useRef`/`useCallback`) deben ejecutarse antes del `if (redir) return redir`. No pongas el guard arriba.

- [ ] **Step 1: Implementar la pantalla del flujo**

Crea `app/(app)/ventas/nueva.tsx` con EXACTAMENTE:

```tsx
import { useCallback, useReducer, useRef, useState } from 'react'
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { useRequireModulo } from '../../../lib/auth'
import {
  calcularCambio, carritoReducer, montoEfectivo, pagosCuadran, totalCarrito,
  type MetodoPago, type PagoInput, type ProductoVendible,
} from '../../../lib/carrito'
import { buscarProductos, registrarVenta } from '../../../lib/ventas'

type Etapa = 'carrito' | 'cobrar' | 'confirmacion'
const METODOS: MetodoPago[] = ['efectivo', 'nequi', 'daviplata']
const ETIQUETA: Record<MetodoPago, string> = { efectivo: 'Efectivo', nequi: 'Nequi', daviplata: 'Daviplata' }
const pesos = (n: number) => '$' + n.toLocaleString('es-CO')

export default function NuevaVenta() {
  const redir = useRequireModulo('ventas')
  const router = useRouter()

  const [etapa, setEtapa] = useState<Etapa>('carrito')
  const [items, dispatch] = useReducer(carritoReducer, [])
  const [query, setQuery] = useState('')
  const [resultados, setResultados] = useState<ProductoVendible[]>([])
  const [buscando, setBuscando] = useState(false)
  const [errorBusqueda, setErrorBusqueda] = useState<string | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [metodos, setMetodos] = useState<MetodoPago[]>([])
  const [montos, setMontos] = useState<Record<MetodoPago, string>>({ efectivo: '', nequi: '', daviplata: '' })
  const [recibido, setRecibido] = useState('')
  const [cliente, setCliente] = useState({ nombre: '', apellido: '', telefono: '' })
  const [guardando, setGuardando] = useState(false)
  const [numeroVenta, setNumeroVenta] = useState<number | null>(null)

  const buscar = useCallback((texto: string) => {
    setQuery(texto)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      setBuscando(true)
      setErrorBusqueda(null)
      try {
        setResultados(await buscarProductos(texto))
      } catch {
        setErrorBusqueda('No se pudo buscar. Revisa tu conexión.')
      } finally {
        setBuscando(false)
      }
    }, 300)
  }, [])

  if (redir) return redir

  const total = totalCarrito(items)
  const pagos: PagoInput[] = metodos.map(m => ({ metodo: m, monto: Number(montos[m]) || 0 }))
  const efectivoMonto = montoEfectivo(pagos)
  const recibidoNum = Number(recibido) || 0
  const cambio = calcularCambio(recibidoNum, efectivoMonto)
  const puedeConfirmar = pagosCuadran(pagos, total) && (efectivoMonto === 0 || recibidoNum >= efectivoMonto)

  function toggleMetodo(m: MetodoPago) {
    setMetodos(prev => {
      const next = prev.includes(m) ? prev.filter(x => x !== m) : [...prev, m]
      if (next.length === 1) setMontos(mm => ({ ...mm, [next[0]]: String(total) }))
      return next
    })
  }

  async function confirmar() {
    setGuardando(true)
    try {
      const { numero } = await registrarVenta({
        items,
        pagos,
        efectivoRecibido: efectivoMonto > 0 ? recibidoNum : null,
        cliente: {
          nombre: cliente.nombre || undefined,
          apellido: cliente.apellido || undefined,
          telefono: cliente.telefono || undefined,
        },
      })
      setNumeroVenta(numero)
      setEtapa('confirmacion')
    } catch (e) {
      Alert.alert('No se registró', e instanceof Error ? e.message : 'Intenta de nuevo.')
    } finally {
      setGuardando(false)
    }
  }

  function salirDelFlujo() {
    if (items.length > 0) {
      Alert.alert('¿Descartar la venta?', 'Perderás el carrito actual.', [
        { text: 'Seguir', style: 'cancel' },
        { text: 'Descartar', style: 'destructive', onPress: () => router.replace('/ventas') },
      ])
    } else {
      router.replace('/ventas')
    }
  }

  function nuevaVenta() {
    dispatch({ tipo: 'limpiar' })
    setMetodos([])
    setMontos({ efectivo: '', nequi: '', daviplata: '' })
    setRecibido('')
    setCliente({ nombre: '', apellido: '', telefono: '' })
    setNumeroVenta(null)
    setQuery('')
    setResultados([])
    setEtapa('carrito')
  }

  if (etapa === 'confirmacion') {
    return (
      <View style={[styles.container, styles.centro]}>
        <Text style={styles.check}>✓</Text>
        <Text style={styles.okTitulo}>Venta #{numeroVenta} registrada</Text>
        <Pressable style={styles.primario} onPress={nuevaVenta}>
          <Text style={styles.primarioText}>Nueva venta</Text>
        </Pressable>
        <Pressable style={styles.secundario} onPress={() => router.replace('/ventas')}>
          <Text style={styles.secundarioText}>Listo</Text>
        </Pressable>
      </View>
    )
  }

  if (etapa === 'cobrar') {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 20, paddingTop: 56, gap: 16 }}>
        <Pressable onPress={() => setEtapa('carrito')} hitSlop={16}>
          <Text style={styles.volver}>← Carrito</Text>
        </Pressable>
        <Text style={styles.totalGrande}>{pesos(total)}</Text>

        <Text style={styles.label}>Método de pago</Text>
        <View style={styles.chips}>
          {METODOS.map(m => (
            <Pressable
              key={m}
              style={[styles.chip, metodos.includes(m) && styles.chipOn]}
              onPress={() => toggleMetodo(m)}
            >
              <Text style={[styles.chipText, metodos.includes(m) && styles.chipTextOn]}>{ETIQUETA[m]}</Text>
            </Pressable>
          ))}
        </View>

        {metodos.map(m => (
          <View key={m}>
            <Text style={styles.label}>{ETIQUETA[m]}</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={montos[m]}
              onChangeText={t => setMontos(mm => ({ ...mm, [m]: t.replace(/[^0-9]/g, '') }))}
              placeholder="0"
            />
          </View>
        ))}

        {efectivoMonto > 0 ? (
          <View>
            <Text style={styles.label}>Efectivo recibido</Text>
            <TextInput
              style={styles.input}
              keyboardType="number-pad"
              value={recibido}
              onChangeText={t => setRecibido(t.replace(/[^0-9]/g, ''))}
              placeholder="¿Con cuánto paga?"
            />
            <Text style={styles.cambio}>Cambio: {pesos(cambio)}</Text>
          </View>
        ) : null}

        <Text style={styles.label}>Datos del cliente (opcional)</Text>
        <TextInput style={styles.input} placeholder="Nombre" value={cliente.nombre}
          onChangeText={t => setCliente(c => ({ ...c, nombre: t }))} />
        <TextInput style={styles.input} placeholder="Apellido" value={cliente.apellido}
          onChangeText={t => setCliente(c => ({ ...c, apellido: t }))} />
        <TextInput style={styles.input} placeholder="Teléfono" keyboardType="phone-pad" value={cliente.telefono}
          onChangeText={t => setCliente(c => ({ ...c, telefono: t }))} />

        <Pressable
          style={[styles.primario, (!puedeConfirmar || guardando) && styles.deshab]}
          onPress={confirmar}
          disabled={!puedeConfirmar || guardando}
        >
          {guardando ? <ActivityIndicator color="#fff" /> : <Text style={styles.primarioText}>Confirmar venta</Text>}
        </Pressable>
      </ScrollView>
    )
  }

  // etapa === 'carrito'
  return (
    <View style={styles.container}>
      <View style={styles.barra}>
        <Pressable onPress={salirDelFlujo} hitSlop={16}>
          <Text style={styles.volver}>← Salir</Text>
        </Pressable>
        <Text style={styles.titulo}>Nueva venta</Text>
        <View style={{ width: 60 }} />
      </View>

      <TextInput
        style={styles.buscador}
        placeholder="Buscar producto"
        value={query}
        onChangeText={buscar}
        autoFocus
      />
      {buscando ? <ActivityIndicator style={{ marginVertical: 8 }} /> : null}
      {errorBusqueda ? <Text style={styles.error}>{errorBusqueda}</Text> : null}

      <ScrollView style={styles.resultados} keyboardShouldPersistTaps="handled">
        {resultados.map(p => (
          <Pressable key={`${p.tipo}-${p.id}`} style={styles.resultado}
            onPress={() => dispatch({ tipo: 'agregar', producto: p })}>
            <View style={{ flex: 1 }}>
              <Text style={styles.resultadoTitulo}>{p.titulo}</Text>
              <Text style={styles.resultadoSub}>{p.detalle} · Stock: {p.stock}</Text>
            </View>
            <Text style={styles.resultadoPrecio}>{pesos(p.precio)}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={styles.carrito}>
        {items.map(i => (
          <View key={`${i.producto.tipo}-${i.producto.id}`} style={styles.itemCarrito}>
            <View style={{ flex: 1 }}>
              <Text style={styles.itemTitulo}>{i.producto.titulo}</Text>
              <Text style={styles.itemSub}>{pesos(i.subtotal)}</Text>
            </View>
            <Pressable hitSlop={12} style={styles.step}
              onPress={() => dispatch({ tipo: 'cambiarCantidad', id: i.producto.id, cantidad: i.cantidad - 1 })}>
              <Text style={styles.stepText}>−</Text>
            </Pressable>
            <Text style={styles.cantidad}>{i.cantidad}</Text>
            <Pressable hitSlop={12} style={styles.step}
              onPress={() => dispatch({ tipo: 'agregar', producto: i.producto })}>
              <Text style={styles.stepText}>+</Text>
            </Pressable>
          </View>
        ))}

        <Pressable
          style={[styles.primario, items.length === 0 && styles.deshab]}
          disabled={items.length === 0}
          onPress={() => setEtapa('cobrar')}
        >
          <Text style={styles.primarioText}>Cobrar {total > 0 ? pesos(total) : ''}</Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centro: { alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  barra: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingTop: 56, marginBottom: 12 },
  titulo: { fontSize: 20, fontWeight: '700' },
  volver: { fontSize: 16, color: '#1E66F5', fontWeight: '600' },
  buscador: { marginHorizontal: 20, borderWidth: 2, borderColor: '#1E66F5', borderRadius: 16, paddingVertical: 14, paddingHorizontal: 16, fontSize: 18 },
  resultados: { flex: 1, marginTop: 8, paddingHorizontal: 20 },
  resultado: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EEE', gap: 12 },
  resultadoTitulo: { fontSize: 17, fontWeight: '600' },
  resultadoSub: { fontSize: 13, color: '#888', marginTop: 2 },
  resultadoPrecio: { fontSize: 16, fontWeight: '700' },
  carrito: { borderTopWidth: 1, borderTopColor: '#DDD', padding: 20, gap: 10 },
  itemCarrito: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  itemTitulo: { fontSize: 16, fontWeight: '600' },
  itemSub: { fontSize: 13, color: '#666', marginTop: 2 },
  step: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF5FF', alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 24, fontWeight: '700', color: '#1E66F5' },
  cantidad: { fontSize: 18, fontWeight: '700', minWidth: 36, textAlign: 'center' },
  totalGrande: { fontSize: 40, fontWeight: '800', textAlign: 'center' },
  label: { fontSize: 15, fontWeight: '600', color: '#444' },
  chips: { flexDirection: 'row', gap: 10 },
  chip: { flex: 1, borderWidth: 2, borderColor: '#1E66F5', borderRadius: 14, paddingVertical: 14, alignItems: 'center' },
  chipOn: { backgroundColor: '#1E66F5' },
  chipText: { color: '#1E66F5', fontSize: 16, fontWeight: '600' },
  chipTextOn: { color: '#fff' },
  input: { borderWidth: 1, borderColor: '#CCC', borderRadius: 12, paddingVertical: 14, paddingHorizontal: 14, fontSize: 18, marginTop: 6 },
  cambio: { fontSize: 18, fontWeight: '700', marginTop: 8, color: '#1E7A34' },
  primario: { backgroundColor: '#1E66F5', borderRadius: 16, paddingVertical: 20, alignItems: 'center', marginTop: 8 },
  primarioText: { color: '#fff', fontSize: 20, fontWeight: '700' },
  secundario: { paddingVertical: 16, alignItems: 'center' },
  secundarioText: { color: '#1E66F5', fontSize: 18, fontWeight: '600' },
  deshab: { opacity: 0.4 },
  error: { color: '#D20F39', textAlign: 'center', fontSize: 15, marginVertical: 4 },
  check: { fontSize: 80, color: '#1E7A34' },
  okTitulo: { fontSize: 26, fontWeight: '800', textAlign: 'center' },
})
```

- [ ] **Step 2: Typecheck y tests completos**

Run: `npx tsc --noEmit && npm test`
Expected: sin errores de tipo; todos los tests pasan.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/ventas/nueva.tsx"
git commit -m "feat: flujo de nueva venta (carrito, cobro mixto, confirmación)"
```

---

## Task 9: Verificación manual en dispositivo (Expo Go)

**Files:** ninguno (verificación E2E).

- [ ] **Step 1: Levantar el server**

```bash
npx expo start
```
Conectar desde Expo Go: `exp://<IP-LAN>:8081`.

- [ ] **Step 2: Checklist E2E**

Inicia sesión como empleado (Camilo / Beatriz) y verifica:

- [ ] Toca el tile "Ventas" → abre el hub (`/ventas`), muestra "Hoy · 0 ventas".
- [ ] "+ Nueva venta" → buscar "Nike" → aparecen tallas 38/39/40 negro (la blanca agotada NO aparece).
- [ ] Agregar un par, stepper + / − funciona y respeta el stock.
- [ ] Buscar "Café" → agregar 0.5 (varios, decimal) → subtotal correcto.
- [ ] "Cobrar" → seleccionar Nequi → monto autocompleta al total → "Confirmar venta" → ✓ "Venta #N registrada".
- [ ] Volver al hub: la venta aparece en la lista y el total de hoy subió.
- [ ] Nueva venta con **Efectivo**: ingresar "recibido" mayor → ver "Cambio".
- [ ] Nueva venta con **pago mixto** (efectivo + Nequi que sumen el total) → confirma.
- [ ] Intentar confirmar con pagos que NO suman el total → botón deshabilitado.
- [ ] En Supabase, verificar que `stock_actual` bajó y que `efectivo_recibido`/`cambio` quedaron guardados:

```sql
select numero, total, efectivo_recibido, cambio, estado from public.ventas order by numero desc limit 5;
```

- [ ] **Step 3: Limpiar ventas de prueba (opcional)**

Si quieres dejar la DB limpia tras probar, vía MCP `supabase.execute_sql` (corre como service role, ignora RLS):

```sql
delete from public.ventas where vendedor_id in (select id from public.users where rol='empleado');
-- (borra en cascada venta_items y metodos_pago_venta por las FKs)
-- luego re-aplica supabase/seeds/demo_inventario.sql para restaurar stock.
```

---

## Cierre

- [ ] Todos los tasks completos, `npm test` y `npx tsc --noEmit` verdes.
- [ ] Solicitar code review del branch (skill `requesting-code-review`) antes del merge.
- [ ] Decidir merge a `main` con el usuario.
