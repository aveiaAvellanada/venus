# SP-2 — Granja sin stock + precio mín/máx — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Llevar el modelo de precios de la venta a v4.0: calzado con precio mín/máx (regateo, rango informativo) y Granja sin stock con precio ingresado al vender, guardando el precio final + snapshot del rango para auditoría.

**Architecture:** Dos migraciones Postgres (esquema → RPC), más cambios de TypeScript en `lib/carrito.ts` (lógica pura, TDD), `lib/ventas.ts` (acceso a datos) y la pantalla `app/(app)/ventas/nueva.tsx`. El precio por item lo fija el cliente; el servidor lo registra (sin rechazo por rango). RLS/auditoría de SP-1 siguen vigentes.

**Tech Stack:** Supabase (PostgreSQL 17, RLS), Expo SDK 54 / React Native / TypeScript, jest.

**Spec:** `docs/superpowers/specs/2026-06-15-sp2-granja-precio-min-max-design.md`
**Project ref Supabase:** `xqspsaghukeynlizbjvc`

**Notas para quien ejecute:**
- En cada smoke test SQL, un error final `*_OK_ROLLBACK` es ÉXITO (fuerza rollback). Cualquier `FALLO ...` es un bug.
- Cada migración: escribir el archivo en `supabase/migrations/<YYYYMMDDHHMMSS>_<nombre>.sql` con timestamp creciente (el último de SP-1 es `20260615200000`) Y aplicarla con MCP `supabase.apply_migration` (mismo SQL). Las tools MCP de Supabase son deferred: cargar con `ToolSearch` `select:apply_migration,execute_sql` antes de usarlas.
- `tsc` limpio = exit 0 (el repo tiene el shim `env.d.ts`). No reintroducir errores.
- Entre T1 y T2 la venta queda temporalmente rota (la RPC vieja lee columnas que T1 elimina). Es esperado; T2 la repara.

---

## Setup (antes de la Tarea 1)

- [ ] Crear rama desde `main`:
```bash
cd /home/aveia/Development/work/Venus
git checkout main && git pull --ff-only
git checkout -b feat/sp2-precio-min-max
```

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/<ts>_sp2_precio_min_max_granja.sql` | Esquema: calzado mín/máx + backfill; Granja sin stock + `precio_sugerido`; `venta_items` snapshot |
| `supabase/migrations/<ts>_sp2_registrar_venta_precio.sql` | RPC `registrar_venta` acepta `precio` por item |
| `lib/carrito.ts` + `lib/carrito.test.ts` | Precio elegido por línea, `cambiarPrecio`, `bajoMinimo`, Granja sin stock |
| `lib/ventas.ts` | `buscarProductos` (nuevas columnas) + envío de `precio` a la RPC |
| `app/(app)/ventas/nueva.tsx` | Regateo de calzado y precio de Granja al vender |
| `lib/database.types.ts` | Regenerado |

---

## Task 1: Migración — esquema (calzado mín/máx, Granja sin stock, snapshot)

**Files:** Create `supabase/migrations/<ts>_sp2_precio_min_max_granja.sql`

- [ ] **Step 1: Escribir la migración** con EXACTAMENTE:
```sql
-- SP-2 esquema: calzado precio mín/máx; Granja sin stock + precio_sugerido; venta_items snapshot.

-- productos_calzado: añadir mín/máx, backfill desde precio_venta, constraint de rango, drop precio_venta
alter table public.productos_calzado add column if not exists precio_minimo numeric(12,2) not null default 0 check (precio_minimo >= 0);
alter table public.productos_calzado add column if not exists precio_maximo numeric(12,2) not null default 0 check (precio_maximo >= 0);
update public.productos_calzado set precio_minimo = precio_venta, precio_maximo = precio_venta;
alter table public.productos_calzado drop constraint if exists productos_calzado_rango_precio;
alter table public.productos_calzado add constraint productos_calzado_rango_precio check (precio_maximo >= precio_minimo);
alter table public.productos_calzado drop column if exists precio_venta;

-- productos_varios (Granja): reemplazar precio_venta por precio_sugerido (nullable), quitar stock
alter table public.productos_varios add column if not exists precio_sugerido numeric(12,2) check (precio_sugerido >= 0);
update public.productos_varios set precio_sugerido = precio_venta;
alter table public.productos_varios drop column if exists precio_venta;
alter table public.productos_varios drop column if exists stock_actual;
alter table public.productos_varios drop column if exists stock_minimo;

-- venta_items: snapshot del rango de calzado vigente al vender (null en Granja)
alter table public.venta_items add column if not exists precio_minimo_snapshot numeric(12,2);
alter table public.venta_items add column if not exists precio_maximo_snapshot numeric(12,2);
```

- [ ] **Step 2: Aplicar** vía MCP `supabase.apply_migration` (`project_id: "xqspsaghukeynlizbjvc"`, `name: "sp2_precio_min_max_granja"`, `query` = el SQL). Expected: sin error.

- [ ] **Step 3: Smoke test** vía MCP `supabase.execute_sql`:
```sql
do $$
declare v_n int;
begin
  -- columnas nuevas presentes / viejas ausentes
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='productos_calzado' and column_name='precio_venta') then
    raise exception 'FALLO: productos_calzado.precio_venta no fue eliminada'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='productos_calzado' and column_name='precio_minimo') then
    raise exception 'FALLO: falta productos_calzado.precio_minimo'; end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='productos_varios' and column_name='stock_actual') then
    raise exception 'FALLO: productos_varios.stock_actual no fue eliminada'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='productos_varios' and column_name='precio_sugerido') then
    raise exception 'FALLO: falta productos_varios.precio_sugerido'; end if;
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='venta_items' and column_name='precio_minimo_snapshot') then
    raise exception 'FALLO: falta venta_items.precio_minimo_snapshot'; end if;
  -- backfill: tras la migración (sin ediciones) min=max en todo el calzado
  select count(*) into v_n from public.productos_calzado where precio_minimo <> precio_maximo;
  if v_n <> 0 then raise exception 'FALLO: % filas de calzado con min<>max tras backfill', v_n; end if;
  raise exception 'T1_OK_ROLLBACK';
end $$;
```
Expected: termina con `T1_OK_ROLLBACK`.

- [ ] **Step 4: Commit**
```bash
git add supabase/migrations/
git commit -m "feat(db): calzado mín/máx, Granja sin stock, venta_items snapshot"
```

---

## Task 2: Migración — RPC `registrar_venta` con precio por item

**Files:** Create `supabase/migrations/<ts>_sp2_registrar_venta_precio.sql`

- [ ] **Step 1: Escribir la migración** con EXACTAMENTE:
```sql
-- SP-2: registrar_venta acepta `precio` por item (regateo calzado / precio Granja).
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
  v_pago jsonb;
  v_monto numeric(12,2);
  v_tipo text;
  v_pid uuid;
  v_cant numeric(12,3);
  v_precio numeric(12,2);
  v_desc text;
  v_talla text;
  v_color text;
  v_stock numeric(12,3);
  v_min numeric(12,2);
  v_max numeric(12,2);
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
    order by value->>'producto_id'
  loop
    v_tipo := it->>'tipo';
    if it->>'producto_id' is null then
      raise exception 'Item sin producto_id';
    end if;
    v_pid  := (it->>'producto_id')::uuid;
    v_cant := (it->>'cantidad')::numeric;
    if v_cant is null or v_cant <= 0 then
      raise exception 'Cantidad inválida';
    end if;
    if it->>'precio' is null then
      raise exception 'Item sin precio';
    end if;
    v_precio := round((it->>'precio')::numeric, 2);
    if v_precio <= 0 then
      raise exception 'Precio inválido';
    end if;
    if v_tipo = 'calzado' and v_cant <> trunc(v_cant) then
      raise exception 'La cantidad de calzado debe ser entera';
    end if;

    v_min := null;
    v_max := null;
    if v_tipo = 'calzado' then
      select descripcion, talla, color, stock_actual, precio_minimo, precio_maximo
        into v_desc, v_talla, v_color, v_stock, v_min, v_max
        from public.productos_calzado
        where id = v_pid and activo
        for update;
      if v_desc is null then
        raise exception 'Producto no disponible';
      end if;
      if v_stock < v_cant then
        raise exception 'Stock insuficiente para %', v_desc;
      end if;
      update public.productos_calzado set stock_actual = stock_actual - v_cant where id = v_pid;
    elsif v_tipo = 'varios' then
      select nombre into v_desc
        from public.productos_varios
        where id = v_pid and activo;
      if v_desc is null then
        raise exception 'Producto no disponible';
      end if;
      v_talla := null;
      v_color := null;
    else
      raise exception 'Tipo de producto inválido: %', v_tipo;
    end if;

    insert into public.venta_items (venta_id, tipo_producto,
        producto_calzado_id, producto_varios_id,
        descripcion_snapshot, talla, color, cantidad, precio_unitario, subtotal,
        precio_minimo_snapshot, precio_maximo_snapshot)
      values (v_venta_id, v_tipo,
        case when v_tipo = 'calzado' then v_pid end,
        case when v_tipo = 'varios'  then v_pid end,
        v_desc, v_talla, v_color, v_cant, v_precio, round(v_precio * v_cant, 2),
        v_min, v_max);

    v_total := v_total + round(v_precio * v_cant, 2);
  end loop;

  for v_pago in select value from jsonb_array_elements(p_pagos)
  loop
    if (v_pago->>'metodo') not in ('efectivo','nequi','daviplata') then
      raise exception 'Método de pago inválido';
    end if;
    v_monto := round((v_pago->>'monto')::numeric, 2);
    if v_monto <= 0 then
      raise exception 'Monto de pago inválido';
    end if;
    v_total_pagos := v_total_pagos + v_monto;
    if (v_pago->>'metodo') = 'efectivo' then
      v_efectivo_monto := v_efectivo_monto + v_monto;
    end if;
    insert into public.metodos_pago_venta (venta_id, metodo, monto, es_anticipo)
      values (v_venta_id, v_pago->>'metodo', v_monto, false);
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

- [ ] **Step 2: Aplicar** vía MCP `supabase.apply_migration` (`name: "sp2_registrar_venta_precio"`). Expected: sin error.

- [ ] **Step 3: Smoke test (camino feliz + bajo el mínimo + Granja)** vía MCP `supabase.execute_sql`:
```sql
do $$
declare
  v_uid uuid; v_cid uuid; v_gid uuid; v_res jsonb; v_vid uuid;
  v_pu numeric; v_min numeric; v_max numeric; v_sub numeric; v_stock_after numeric;
begin
  select id into v_uid from public.users where rol='dueno' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role','authenticated')::text, true);

  insert into public.productos_calzado (categoria, descripcion, precio_minimo, precio_maximo, stock_actual)
    values ('Tennis','SP2 CALZADO', 5000, 10000, 5) returning id into v_cid;
  insert into public.productos_varios (nombre, unidad_medida, precio_sugerido)
    values ('SP2 GRANJA','kg', 4000) returning id into v_gid;

  -- calzado BAJO el mínimo (3000 < 5000, aceptado) + Granja 2.5kg a 4000/u
  v_res := public.registrar_venta(
    jsonb_build_array(
      jsonb_build_object('tipo','calzado','producto_id',v_cid,'cantidad',1,'precio',3000),
      jsonb_build_object('tipo','varios','producto_id',v_gid,'cantidad',2.5,'precio',4000)
    ),
    jsonb_build_array(jsonb_build_object('metodo','efectivo','monto', 13000)),
    13000, null, null, null
  );
  v_vid := (v_res->>'venta_id')::uuid;

  select precio_unitario, precio_minimo_snapshot, precio_maximo_snapshot
    into v_pu, v_min, v_max
    from public.venta_items where venta_id=v_vid and tipo_producto='calzado';
  if v_pu <> 3000 then raise exception 'FALLO precio calzado: %', v_pu; end if;
  if v_min <> 5000 or v_max <> 10000 then raise exception 'FALLO snapshot: %/%', v_min, v_max; end if;

  select stock_actual into v_stock_after from public.productos_calzado where id=v_cid;
  if v_stock_after <> 4 then raise exception 'FALLO stock calzado: %', v_stock_after; end if;

  select subtotal, precio_minimo_snapshot into v_sub, v_min
    from public.venta_items where venta_id=v_vid and tipo_producto='varios';
  if v_sub <> 10000 then raise exception 'FALLO subtotal granja: %', v_sub; end if;
  if v_min is not null then raise exception 'FALLO granja snapshot debería ser null'; end if;

  raise exception 'T2_OK_ROLLBACK';
end $$;
```
Expected: termina con `T2_OK_ROLLBACK`.

- [ ] **Step 4: Smoke test (precio inválido rechazado)** vía MCP `supabase.execute_sql`:
```sql
do $$
declare v_uid uuid; v_gid uuid;
begin
  select id into v_uid from public.users where rol='dueno' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role','authenticated')::text, true);
  insert into public.productos_varios (nombre, unidad_medida) values ('SP2 G2','kg') returning id into v_gid;
  begin
    perform public.registrar_venta(
      jsonb_build_array(jsonb_build_object('tipo','varios','producto_id',v_gid,'cantidad',1,'precio',0)),
      jsonb_build_array(jsonb_build_object('metodo','efectivo','monto',1)),
      1, null, null, null);
    raise exception 'FALLO: precio 0 no fue rechazado';
  exception when others then
    if sqlerrm not like '%Precio inválido%' then raise; end if;
  end;
  raise exception 'T2B_OK_ROLLBACK';
end $$;
```
Expected: termina con `T2B_OK_ROLLBACK`.

- [ ] **Step 5: Commit**
```bash
git add supabase/migrations/
git commit -m "feat(db): registrar_venta acepta precio por item (regateo/Granja)"
```

---

## Task 3: `lib/carrito.ts` — precio por línea, `cambiarPrecio`, `bajoMinimo` (TDD)

**Files:** Modify `lib/carrito.ts`, `lib/carrito.test.ts`

- [ ] **Step 1a: Añadir `bajoMinimo` al import existente** en la cabecera de `lib/carrito.test.ts` (el import ya trae `carritoReducer`, `type ItemCarrito`, `type ProductoVendible`; solo agregar `bajoMinimo`):
```ts
import {
  carritoReducer, bajoMinimo, totalCarrito, pagosCuadran, montoEfectivo, calcularCambio,
  type ItemCarrito, type ProductoVendible,
} from './carrito'
```

- [ ] **Step 1b: Añadir los tests SP-2** al final de `lib/carrito.test.ts` (no borrar los tests existentes; NO repetir imports — `ProductoVendible` y `bajoMinimo` ya quedaron importados arriba):
```ts
const calzado = (over: Partial<ProductoVendible> = {}): ProductoVendible => ({
  tipo: 'calzado', id: 'c1', titulo: 'Tenis', detalle: '', precio: 10000,
  stock: 3, precioMin: 5000, precioMax: 10000, ...over,
})
const granja = (over: Partial<ProductoVendible> = {}): ProductoVendible => ({
  tipo: 'varios', id: 'g1', titulo: 'Maíz', detalle: 'por kg', precio: 4000,
  stock: Number.POSITIVE_INFINITY, unidad: 'kg', ...over,
})

describe('carrito SP-2 — precio por línea', () => {
  test('calzado: el precio de la línea inicia en el máximo', () => {
    const items = carritoReducer([], { tipo: 'agregar', producto: calzado() })
    expect(items[0].precio).toBe(10000)
    expect(items[0].subtotal).toBe(10000)
  })

  test('cambiarPrecio permite bajar del mínimo (rango informativo, sin recorte)', () => {
    let items = carritoReducer([], { tipo: 'agregar', producto: calzado() })
    items = carritoReducer(items, { tipo: 'cambiarPrecio', id: 'c1', precio: 3000 })
    expect(items[0].precio).toBe(3000)
    expect(items[0].subtotal).toBe(3000)
    expect(bajoMinimo(items[0])).toBe(true)
  })

  test('bajoMinimo es false dentro del rango y para Granja', () => {
    let items = carritoReducer([], { tipo: 'agregar', producto: calzado() })
    items = carritoReducer(items, { tipo: 'cambiarPrecio', id: 'c1', precio: 7000 })
    expect(bajoMinimo(items[0])).toBe(false)
    const g = carritoReducer([], { tipo: 'agregar', producto: granja() })
    expect(bajoMinimo(g[0])).toBe(false)
  })

  test('Granja: cantidad decimal sin recorte por stock; subtotal = precio × cantidad', () => {
    let items = carritoReducer([], { tipo: 'agregar', producto: granja() })
    items = carritoReducer(items, { tipo: 'cambiarCantidad', id: 'g1', cantidad: 2.5 })
    expect(items[0].cantidad).toBe(2.5)
    expect(items[0].subtotal).toBe(10000)
  })

  test('Granja: cambiarPrecio recalcula el subtotal', () => {
    let items = carritoReducer([], { tipo: 'agregar', producto: granja() })
    items = carritoReducer(items, { tipo: 'cambiarCantidad', id: 'g1', cantidad: 2 })
    items = carritoReducer(items, { tipo: 'cambiarPrecio', id: 'g1', precio: 5000 })
    expect(items[0].subtotal).toBe(10000)
  })

  test('calzado: la cantidad sigue recortada por stock y a entero', () => {
    let items = carritoReducer([], { tipo: 'agregar', producto: calzado({ stock: 2 }) })
    items = carritoReducer(items, { tipo: 'cambiarCantidad', id: 'c1', cantidad: 9 })
    expect(items[0].cantidad).toBe(2)
  })
})
```

- [ ] **Step 2: Correr el test para verlo fallar**
Run: `npm test -- carrito`
Expected: FAIL (no existen `cambiarPrecio`/`bajoMinimo` ni `precio` por línea).

- [ ] **Step 3: Reescribir** `lib/carrito.ts` con EXACTAMENTE:
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
  precioMin?: number
  precioMax?: number
}

export interface ItemCarrito {
  producto: ProductoVendible
  cantidad: number
  precio: number
  subtotal: number
}

export interface PagoInput {
  metodo: MetodoPago
  monto: number
}

export type AccionCarrito =
  | { tipo: 'agregar'; producto: ProductoVendible }
  | { tipo: 'cambiarCantidad'; id: string; cantidad: number }
  | { tipo: 'cambiarPrecio'; id: string; precio: number }
  | { tipo: 'quitar'; id: string }
  | { tipo: 'limpiar' }

export const redondear = (n: number): number => Math.round(n * 100) / 100

function precioInicial(producto: ProductoVendible): number {
  if (producto.tipo === 'calzado') return producto.precioMax ?? producto.precio
  return producto.precio
}

function linea(producto: ProductoVendible, cantidad: number, precio: number): ItemCarrito {
  let c = Math.min(cantidad, producto.stock)
  if (producto.tipo === 'calzado') c = Math.floor(c)
  c = Math.max(0, c)
  const p = Math.max(0, precio)
  return { producto, cantidad: c, precio: p, subtotal: redondear(p * c) }
}

export function carritoReducer(items: ItemCarrito[], accion: AccionCarrito): ItemCarrito[] {
  switch (accion.tipo) {
    case 'agregar': {
      const existente = items.find(i => i.producto.id === accion.producto.id)
      if (existente) {
        return items.map(i =>
          i.producto.id === accion.producto.id ? linea(i.producto, i.cantidad + 1, i.precio) : i,
        )
      }
      const nuevo = linea(accion.producto, 1, precioInicial(accion.producto))
      return nuevo.cantidad > 0 ? [...items, nuevo] : items
    }
    case 'cambiarCantidad':
      return items
        .map(i => (i.producto.id === accion.id ? linea(i.producto, accion.cantidad, i.precio) : i))
        .filter(i => i.cantidad > 0)
    case 'cambiarPrecio':
      return items.map(i =>
        i.producto.id === accion.id ? linea(i.producto, i.cantidad, accion.precio) : i,
      )
    case 'quitar':
      return items.filter(i => i.producto.id !== accion.id)
    case 'limpiar':
      return []
  }
}

export const bajoMinimo = (item: ItemCarrito): boolean =>
  item.producto.tipo === 'calzado' &&
  item.producto.precioMin != null &&
  item.precio < item.producto.precioMin

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

- [ ] **Step 4: Correr tests y typecheck**
Run: `npm test -- carrito && npx tsc --noEmit`
Expected: PASS (tests viejos + nuevos) y tsc exit 0.

- [ ] **Step 5: Commit**
```bash
git add lib/carrito.ts lib/carrito.test.ts
git commit -m "feat: precio por línea en carrito (regateo, Granja sin stock)"
```

---

## Task 4: `lib/ventas.ts` — buscar con nuevas columnas + enviar precio

**Files:** Modify `lib/ventas.ts`

- [ ] **Step 1: Reemplazar la función `buscarProductos`** (líneas ~20-66) por EXACTAMENTE:
```ts
export async function buscarProductos(q: string): Promise<ProductoVendible[]> {
  const termino = q.trim()
  const like = `%${termino}%`

  let calzadoQ = supabase
    .from('productos_calzado')
    .select('id, descripcion, referencia, talla, color, precio_minimo, precio_maximo, stock_actual')
    .eq('activo', true)
    .gt('stock_actual', 0)
    .limit(10)
  if (termino) {
    calzadoQ = calzadoQ.or(
      `descripcion.ilike.${like},referencia.ilike.${like},talla.ilike.${like},color.ilike.${like}`,
    )
  }

  let variosQ = supabase
    .from('productos_varios')
    .select('id, nombre, unidad_medida, precio_sugerido')
    .eq('activo', true)
    .limit(10)
  if (termino) variosQ = variosQ.ilike('nombre', like)

  const [calzado, varios] = await Promise.all([calzadoQ, variosQ])
  if (calzado.error) throw calzado.error
  if (varios.error) throw varios.error

  const deCalzado: ProductoVendible[] = (calzado.data ?? []).map(c => ({
    tipo: 'calzado',
    id: c.id,
    titulo: c.descripcion,
    detalle: [c.talla ? `Talla ${c.talla}` : null, c.color].filter(Boolean).join(' · '),
    precio: Number(c.precio_maximo),
    precioMin: Number(c.precio_minimo),
    precioMax: Number(c.precio_maximo),
    stock: Number(c.stock_actual),
  }))
  const deVarios: ProductoVendible[] = (varios.data ?? []).map(v => ({
    tipo: 'varios',
    id: v.id,
    titulo: v.nombre,
    detalle: `por ${v.unidad_medida}`,
    precio: v.precio_sugerido == null ? 0 : Number(v.precio_sugerido),
    stock: Number.POSITIVE_INFINITY,
    unidad: v.unidad_medida,
  }))
  return [...deCalzado, ...deVarios].slice(0, 20)
}
```

- [ ] **Step 2: Enviar el precio por item** — en `registrarVenta`, dentro de `p_items: input.items.map(...)`, añadir el campo `precio`:
```ts
    p_items: input.items.map(i => ({
      tipo: i.producto.tipo,
      producto_id: i.producto.id,
      cantidad: i.cantidad,
      precio: i.precio,
    })),
```

- [ ] **Step 3: Añadir traducción del error de precio** — en `traducirError`, antes del `return` final, añadir:
```ts
  if (msg.includes('Precio inválido')) return 'El precio debe ser mayor a cero.'
```

- [ ] **Step 4: Typecheck**
Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 5: Commit**
```bash
git add lib/ventas.ts
git commit -m "feat: buscarProductos con mín/máx y precio_sugerido; enviar precio a la RPC"
```

---

## Task 5: Pantalla Nueva Venta — regateo de calzado y precio de Granja

**Files:** Modify `app/(app)/ventas/nueva.tsx`

- [ ] **Step 1: Actualizar el import de `../../../lib/carrito`** — reemplazar ese bloque de import por (añade `bajoMinimo`, `type ItemCarrito` y `type AccionCarrito`; el import de `react` con `useState` ya existe y no cambia):
```ts
import {
  bajoMinimo, calcularCambio, carritoReducer, montoEfectivo, pagosCuadran, totalCarrito,
  type AccionCarrito, type ItemCarrito, type MetodoPago, type PagoInput, type ProductoVendible,
} from '../../../lib/carrito'
```

- [ ] **Step 2: Añadir helpers de input** justo después de la línea `const pesos = ...` (línea ~16):
```ts
const soloEntero = (t: string) => t.replace(/[^0-9]/g, '')
const soloDecimal = (t: string) => {
  const limpio = t.replace(/[^0-9.]/g, '')
  const partes = limpio.split('.')
  return partes.length <= 1 ? limpio : partes[0] + '.' + partes.slice(1).join('')
}
```

- [ ] **Step 3: Añadir el componente `LineaCarrito`** justo antes de `export default function NuevaVenta()`:
```tsx
function LineaCarrito({
  item, dispatch,
}: {
  item: ItemCarrito
  dispatch: (a: AccionCarrito) => void
}) {
  const esCalzado = item.producto.tipo === 'calzado'
  const [precioTxt, setPrecioTxt] = useState(String(item.precio))
  const [cantTxt, setCantTxt] = useState(String(item.cantidad))
  const bajo = bajoMinimo(item)

  function commitPrecio() {
    dispatch({ tipo: 'cambiarPrecio', id: item.producto.id, precio: Number(soloEntero(precioTxt)) || 0 })
  }
  function commitCantidad() {
    dispatch({ tipo: 'cambiarCantidad', id: item.producto.id, cantidad: Number(soloDecimal(cantTxt)) || 0 })
  }

  return (
    <View style={styles.itemCarrito}>
      <View style={{ flex: 1 }}>
        <Text style={styles.itemTitulo}>{item.producto.titulo}</Text>
        {esCalzado ? (
          <>
            <View style={styles.precioFila}>
              <Text style={styles.itemSub}>Precio c/u </Text>
              <TextInput
                style={[styles.precioInput, bajo && styles.precioInputAlerta]}
                keyboardType="number-pad"
                value={precioTxt}
                onChangeText={t => setPrecioTxt(soloEntero(t))}
                onEndEditing={commitPrecio}
              />
            </View>
            <Text style={[styles.rango, bajo && styles.rangoAlerta]}>
              Rango {pesos(item.producto.precioMin ?? 0)}–{pesos(item.producto.precioMax ?? 0)}
              {bajo ? ' · bajo el mínimo' : ''}
            </Text>
          </>
        ) : (
          <View style={styles.precioFila}>
            <TextInput
              style={styles.precioInput}
              keyboardType="decimal-pad"
              value={cantTxt}
              onChangeText={t => setCantTxt(soloDecimal(t))}
              onEndEditing={commitCantidad}
            />
            <Text style={styles.itemSub}> {item.producto.unidad} × </Text>
            <TextInput
              style={styles.precioInput}
              keyboardType="number-pad"
              value={precioTxt}
              onChangeText={t => setPrecioTxt(soloEntero(t))}
              onEndEditing={commitPrecio}
            />
          </View>
        )}
        <Text style={styles.itemSub}>Subtotal {pesos(item.subtotal)}</Text>
      </View>
      {esCalzado ? (
        <>
          <Pressable hitSlop={12} style={styles.step}
            onPress={() => dispatch({ tipo: 'cambiarCantidad', id: item.producto.id, cantidad: item.cantidad - 1 })}>
            <Text style={styles.stepText}>−</Text>
          </Pressable>
          <Text style={styles.cantidad}>{item.cantidad}</Text>
          <Pressable hitSlop={12} style={styles.step}
            onPress={() => dispatch({ tipo: 'agregar', producto: item.producto })}>
            <Text style={styles.stepText}>+</Text>
          </Pressable>
        </>
      ) : (
        <Pressable hitSlop={12} style={styles.step}
          onPress={() => dispatch({ tipo: 'quitar', id: item.producto.id })}>
          <Text style={styles.stepText}>×</Text>
        </Pressable>
      )}
    </View>
  )
}
```

- [ ] **Step 4: Usar `LineaCarrito` en la lista del carrito** — reemplazar el bloque `{items.map(i => ( ... ))}` (líneas ~241-257, el `<View style={styles.itemCarrito}>...</View>` por item) por:
```tsx
          {items.map(i => (
            <LineaCarrito key={`${i.producto.tipo}-${i.producto.id}`} item={i} dispatch={dispatch} />
          ))}
```

- [ ] **Step 5: No mostrar stock de Granja en resultados** — reemplazar la línea del subtítulo del resultado (`<Text style={styles.resultadoSub}>{p.detalle} · Stock: {p.stock}</Text>`) por:
```tsx
              <Text style={styles.resultadoSub}>
                {p.detalle}{p.tipo === 'calzado' ? ` · Stock: ${p.stock}` : ''}
              </Text>
```

- [ ] **Step 6: Añadir estilos nuevos** — dentro de `StyleSheet.create({ ... })`, añadir estas entradas (junto a las existentes):
```ts
  precioFila: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  precioInput: { borderWidth: 1, borderColor: '#CCC', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10, fontSize: 16, minWidth: 80 },
  precioInputAlerta: { borderColor: '#D20F39' },
  rango: { fontSize: 12, color: '#888', marginTop: 4 },
  rangoAlerta: { color: '#D20F39' },
```

- [ ] **Step 7: Typecheck**
Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 8: Commit**
```bash
git add app/\(app\)/ventas/nueva.tsx
git commit -m "feat: Nueva Venta con regateo de calzado y precio de Granja"
```

---

## Task 6: Regenerar `lib/database.types.ts`

**Files:** Modify `lib/database.types.ts`

- [ ] **Step 1: Generar tipos** con MCP `supabase.generate_typescript_types` (`project_id: "xqspsaghukeynlizbjvc"`) y sobrescribir `lib/database.types.ts` con el resultado completo.

- [ ] **Step 2: Verificar columnas** Run: `grep -n "precio_minimo\|precio_sugerido\|precio_minimo_snapshot" lib/database.types.ts | head`
Expected: aparecen `precio_minimo`/`precio_maximo` (calzado), `precio_sugerido` (varios) y `precio_minimo_snapshot` (venta_items); ya NO aparece `precio_venta`.

- [ ] **Step 3: Typecheck** Run: `npx tsc --noEmit`
Expected: exit 0.

- [ ] **Step 4: Commit**
```bash
git add lib/database.types.ts
git commit -m "chore(types): regenerar tras esquema de precios SP-2"
```

---

## Task 7: Verificación final + cierre

**Files:** ninguno (verificación).

- [ ] **Step 1: Suite completa**
Run: `npx tsc --noEmit && npm test`
Expected: tsc exit 0; todos los tests pasan (`carrito` + `permisos`).

- [ ] **Step 2: Recap RPC** vía MCP `supabase.execute_sql` (calzado dentro de rango + Granja, sanidad combinada):
```sql
do $$
declare v_uid uuid; v_cid uuid; v_gid uuid; v_res jsonb; v_vid uuid; v_total numeric;
begin
  select id into v_uid from public.users where rol='dueno' limit 1;
  perform set_config('request.jwt.claims', json_build_object('sub', v_uid, 'role','authenticated')::text, true);
  insert into public.productos_calzado (categoria, descripcion, precio_minimo, precio_maximo, stock_actual)
    values ('Tennis','SP2 CHK', 5000, 10000, 2) returning id into v_cid;
  insert into public.productos_varios (nombre, unidad_medida) values ('SP2 CHK G','kg') returning id into v_gid;
  v_res := public.registrar_venta(
    jsonb_build_array(
      jsonb_build_object('tipo','calzado','producto_id',v_cid,'cantidad',1,'precio',8000),
      jsonb_build_object('tipo','varios','producto_id',v_gid,'cantidad',3,'precio',2000)
    ),
    jsonb_build_array(jsonb_build_object('metodo','nequi','monto',14000)),
    null, null, null, null);
  v_vid := (v_res->>'venta_id')::uuid;
  select total into v_total from public.ventas where id=v_vid;
  if v_total <> 14000 then raise exception 'FALLO total: %', v_total; end if;
  raise exception 'T7_OK_ROLLBACK';
end $$;
```
Expected: termina con `T7_OK_ROLLBACK`.

- [ ] **Step 3: Verificación manual en Expo Go (opcional)** — agregar un calzado al carrito, bajar el precio por debajo del mínimo (debe permitirlo y avisar en rojo "bajo el mínimo"); agregar un producto de Granja, ingresar cantidad decimal (ej. 2.5) y precio por unidad, ver subtotal; cobrar y confirmar.

- [ ] **Step 4: Solicitar code review** del branch (skill `requesting-code-review`) y decidir merge a `main` con el usuario.

---

## Cierre
- [ ] Todos los tasks completos; `tsc` y `npm test` verdes; smoke tests RPC en verde.
- [ ] SP-2 mergeado. Continúa **SP-3** (detalle de venta + Devoluciones) con su propio spec → plan.
