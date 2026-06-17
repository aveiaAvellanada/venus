# Devoluciones (M2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Construir el módulo Devoluciones (M2): devolución total/parcial/cambio de producto, con cambios que admiten diferencia de precio (cobro o reembolso) y estado de venta que distingue `cambiada_*` de `devuelta_*`, todo atómico y auditado.

**Architecture:** Capa BD primero y serial (migración reescrita + RPC `registrar_devolucion` + ajuste de `obtener_resumen_dia`, aplicada al remoto vía MCP). Encima, `lib/devoluciones.ts` (lógica pura testeable + acceso a datos) y la UI `app/(app)/devoluciones/`. Sigue el patrón del repo: RLS solo-SELECT, escritura vía RPC `SECURITY DEFINER`, gating `useRequireModulo`.

**Tech Stack:** Supabase (PostgreSQL 17, RLS, RPC plpgsql), React Native + Expo SDK 54 (expo-router), TypeScript estricto, jest.

**Spec:** `docs/superpowers/specs/2026-06-17-devoluciones-design.md`
**Rama:** `feat/m2-devoluciones` (ya creada; el spec ya está commiteado). **No mergear a `main` sin aprobación humana.**

---

## File Structure

| Archivo | Responsabilidad |
|---|---|
| `supabase/migrations/<ts>_m2_devoluciones.sql` (nuevo, reemplaza el de Antigravity) | Tablas `devoluciones`/`devolucion_items`, check de `ventas.estado`, RLS, triggers, RPC `registrar_devolucion`, ajuste de `obtener_resumen_dia` |
| `supabase/tests/smoke_test_devoluciones.sql` (reescribir; gitignored) | Smoke en transacción con `rollback` + asserts |
| `lib/database.types.ts` (regenerar vía MCP) | Tipos generados |
| `lib/devoluciones.ts` (nuevo) | Lógica pura (diferencia/neteo/validación) + acceso a datos (`buscarVentaParaDevolucion`, `registrarDevolucion`) |
| `lib/devoluciones.test.ts` (nuevo) | Tests jest de la lógica pura |
| `app/(app)/devoluciones/_layout.tsx` (nuevo) | Stack + gating |
| `app/(app)/devoluciones/index.tsx` (nuevo) | Buscar venta + lista de devoluciones recientes |
| `app/(app)/devoluciones/nueva.tsx` (nuevo) | Flujo de devolución/cambio |
| `lib/devoluciones_ui.test.tsx` (nuevo) | Tests jest de la UI |

**Limpieza:** en la Tarea 3 se eliminan `lib/empirical_db.test.ts`, `lib/sandbox.test.ts`, `progress.md`, el directorio `.supabase/` y el archivo de migración viejo `supabase/migrations/20260617163622_m2_devoluciones_db.sql` (scratch / a reescribir).

---

## Task 1: Reescribir la migración de la capa BD

**Files:**
- Create: `supabase/migrations/<ts>_m2_devoluciones.sql` (generar `<ts>` con `date +%Y%m%d%H%M%S`)
- Delete (al final, en Task 3): `supabase/migrations/20260617163622_m2_devoluciones_db.sql`

- [ ] **Step 1: Confirmar nombres de columnas contra el remoto (vía MCP execute_sql)**

Confirma que estas columnas existen antes de escribir el SQL (deben coincidir con el spec):
```sql
select table_name, column_name from information_schema.columns
where table_schema='public' and table_name in ('venta_items','productos_calzado','metodos_pago_venta')
order by table_name, ordinal_position;
```
Esperado: `venta_items(tipo_producto, producto_calzado_id, producto_varios_id, cantidad, precio_unitario)`, `productos_calzado(referencia, descripcion, precio_minimo, precio_maximo, stock_actual, activo)`, `metodos_pago_venta(venta_id, monto, metodo)`. Si algún nombre difiere, ajustar el SQL.

- [ ] **Step 2: Escribir la migración completa**

Crear `supabase/migrations/<ts>_m2_devoluciones.sql` con exactamente este contenido:

```sql
-- M2 Devoluciones: tablas, RLS, RPC registrar_devolucion (con diferencia de precio
-- en cambios) y ajuste de obtener_resumen_dia. Reemplaza 20260617163622_m2_devoluciones_db.sql.

-- 1. Ampliar el check de ventas.estado
alter table public.ventas drop constraint if exists ventas_estado_check;
alter table public.ventas add constraint ventas_estado_check
  check (estado in ('completada','separada','cancelada',
                    'devuelta_parcial','devuelta_total',
                    'cambiada_parcial','cambiada_total'));

-- 2. Idempotencia
drop trigger if exists trg_devoluciones_audit on public.devoluciones;
drop trigger if exists trg_devoluciones_updated_at on public.devoluciones;
drop trigger if exists trg_devolucion_items_audit on public.devolucion_items;
drop trigger if exists trg_devolucion_items_updated_at on public.devolucion_items;
drop table if exists public.devolucion_items cascade;
drop table if exists public.devoluciones cascade;

-- 3. devoluciones
create table public.devoluciones (
  id               uuid primary key default gen_random_uuid(),
  venta_id         uuid not null references public.ventas(id) on delete restrict,
  motivo           text not null,
  tipo_devolucion  text not null check (tipo_devolucion in ('total','parcial','cambio')),
  monto_devuelto   numeric(12,2) not null default 0.00 check (monto_devuelto >= 0.00),
  metodo_reembolso text check (metodo_reembolso in ('efectivo','nequi','daviplata','cambio')),
  monto_cobrado    numeric(12,2) not null default 0.00 check (monto_cobrado >= 0.00),
  metodo_cobro     text check (metodo_cobro in ('efectivo','nequi','daviplata')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  created_by       uuid references public.users(id) on delete set null,
  updated_by       uuid references public.users(id) on delete set null,
  constraint devoluciones_una_direccion check (monto_devuelto = 0.00 or monto_cobrado = 0.00)
);
comment on table public.devoluciones is 'Devoluciones de ventas: total, parcial o cambio (con diferencia de precio).';

-- 4. devolucion_items
create table public.devolucion_items (
  id                    uuid primary key default gen_random_uuid(),
  devolucion_id         uuid not null references public.devoluciones(id) on delete cascade,
  venta_item_id         uuid not null references public.venta_items(id) on delete restrict,
  producto_calzado_id   uuid references public.productos_calzado(id) on delete restrict,
  producto_varios_id    uuid references public.productos_varios(id) on delete restrict,
  cantidad              numeric(12,3) not null check (cantidad > 0.000),
  precio_unitario       numeric(12,2) not null check (precio_unitario >= 0.00),
  subtotal              numeric(12,2) not null check (subtotal >= 0.00),
  cambio_talla_color_id uuid references public.productos_calzado(id) on delete restrict,
  precio_reemplazo      numeric(12,2) check (precio_reemplazo >= 0.00),
  precio_minimo_snapshot numeric(12,2),
  precio_maximo_snapshot numeric(12,2),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  created_by            uuid references public.users(id) on delete set null,
  updated_by            uuid references public.users(id) on delete set null,
  constraint devolucion_items_un_producto check (
    (producto_calzado_id is not null and producto_varios_id is null)
    or (producto_varios_id is not null and producto_calzado_id is null)
  )
);
comment on table public.devolucion_items is 'Detalle de items por devolución; precio_reemplazo para cambios.';

-- 5. Triggers de auditoría
create trigger trg_devoluciones_audit before insert or update on public.devoluciones
  for each row execute function private.set_audit_fields();
create trigger trg_devoluciones_updated_at before update on public.devoluciones
  for each row execute function private.set_updated_at();
create trigger trg_devolucion_items_audit before insert or update on public.devolucion_items
  for each row execute function private.set_audit_fields();
create trigger trg_devolucion_items_updated_at before update on public.devolucion_items
  for each row execute function private.set_updated_at();

-- 6. Índices
create index if not exists idx_devoluciones_venta_id on public.devoluciones(venta_id);
create index if not exists idx_devolucion_items_devolucion_id on public.devolucion_items(devolucion_id);
create index if not exists idx_devolucion_items_venta_item_id on public.devolucion_items(venta_item_id);

-- 7. RLS: solo SELECT a authenticated; escritura solo vía RPC SECURITY DEFINER
alter table public.devoluciones enable row level security;
alter table public.devolucion_items enable row level security;
drop policy if exists devoluciones_select_authenticated on public.devoluciones;
create policy devoluciones_select_authenticated on public.devoluciones for select to authenticated using (true);
drop policy if exists devolucion_items_select_authenticated on public.devolucion_items;
create policy devolucion_items_select_authenticated on public.devolucion_items for select to authenticated using (true);
revoke insert, update, delete on public.devoluciones from authenticated;
revoke insert, update, delete on public.devolucion_items from authenticated;
grant select on public.devoluciones to authenticated;
grant select on public.devolucion_items to authenticated;
grant select, insert, update, delete on public.devoluciones to service_role;
grant select, insert, update, delete on public.devolucion_items to service_role;

-- 8. RPC registrar_devolucion
create or replace function public.registrar_devolucion(
  p_venta_id uuid,
  p_motivo text,
  p_tipo_devolucion text,
  p_metodo_reembolso text,
  p_metodo_cobro text,
  p_monto_devuelto numeric,
  p_monto_cobrado numeric,
  p_items jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_devolucion_id uuid;
  v_estado text;
  v_item jsonb;
  v_vi_id uuid;
  v_cant numeric(12,3);
  v_reempl_id uuid;
  v_precio_reempl numeric(12,2);
  v_tipo_prod text;
  v_calzado_id uuid;
  v_varios_id uuid;
  v_cant_vendida numeric(12,3);
  v_precio_unit numeric(12,2);
  v_ya_devuelto numeric(12,3);
  v_subtotal numeric(12,2);
  v_orig_ref text; v_orig_desc text;
  v_r_ref text; v_r_desc text; v_r_pmin numeric(12,2); v_r_pmax numeric(12,2);
  v_r_stock numeric; v_r_activo boolean;
  v_refund_total numeric(12,2) := 0.00;   -- suma de subtotales en devolución pura
  v_diff_total numeric(12,2) := 0.00;     -- suma de diferencias en cambios (firmada)
  v_exp_devuelto numeric(12,2);
  v_exp_cobrado numeric(12,2);
  v_vendido numeric(12,3);
  v_movido numeric(12,3);
  v_todas_cambio boolean;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if p_motivo is null or trim(p_motivo) = '' then raise exception 'El motivo es requerido'; end if;
  if p_tipo_devolucion not in ('total','parcial','cambio') then
    raise exception 'Tipo de devolución inválido: %', p_tipo_devolucion; end if;
  if coalesce(p_monto_devuelto,0) < 0 or coalesce(p_monto_cobrado,0) < 0 then
    raise exception 'Montos inválidos'; end if;
  if coalesce(p_monto_devuelto,0) > 0 and coalesce(p_monto_cobrado,0) > 0 then
    raise exception 'Una devolución no puede cobrar y reembolsar a la vez'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La devolución debe contener al menos un producto'; end if;

  -- Bloquear venta y validar estado
  select estado into v_estado from public.ventas where id = p_venta_id for update;
  if v_estado is null then raise exception 'Venta no encontrada'; end if;
  if v_estado not in ('completada','devuelta_parcial','cambiada_parcial') then
    raise exception 'La venta no admite devoluciones en su estado actual (%).', v_estado; end if;

  insert into public.devoluciones (
    venta_id, motivo, tipo_devolucion, monto_devuelto, metodo_reembolso, monto_cobrado, metodo_cobro
  ) values (
    p_venta_id, p_motivo, p_tipo_devolucion,
    coalesce(p_monto_devuelto,0.00), p_metodo_reembolso,
    coalesce(p_monto_cobrado,0.00), p_metodo_cobro
  ) returning id into v_devolucion_id;

  for v_item in select jsonb_array_elements(p_items) loop
    v_vi_id := (v_item->>'venta_item_id')::uuid;
    v_cant := (v_item->>'cantidad')::numeric;
    v_reempl_id := nullif(v_item->>'cambio_talla_color_id','')::uuid;
    v_precio_reempl := nullif(v_item->>'precio_reemplazo','')::numeric;

    if v_vi_id is null then raise exception 'venta_item_id es requerido'; end if;
    if v_cant is null or v_cant <= 0 then raise exception 'La cantidad debe ser mayor a 0'; end if;

    select tipo_producto, producto_calzado_id, producto_varios_id, cantidad, precio_unitario
      into v_tipo_prod, v_calzado_id, v_varios_id, v_cant_vendida, v_precio_unit
      from public.venta_items where id = v_vi_id and venta_id = p_venta_id for update;
    if v_cant_vendida is null then raise exception 'Item no pertenece a esta venta'; end if;

    select coalesce(sum(di.cantidad),0.000) into v_ya_devuelto
      from public.devolucion_items di
      where di.venta_item_id = v_vi_id and di.devolucion_id <> v_devolucion_id;
    if v_cant + v_ya_devuelto > v_cant_vendida then
      raise exception 'La cantidad devuelta supera la cantidad vendida'; end if;

    if p_tipo_devolucion = 'cambio' then
      if v_tipo_prod <> 'calzado' then raise exception 'Granja no admite cambios'; end if;
      if v_cant <> trunc(v_cant) then raise exception 'La cantidad de calzado debe ser entera'; end if;
      if v_reempl_id is null then raise exception 'Falta el zapato de reemplazo'; end if;
      if v_precio_reempl is null then raise exception 'Falta el precio del reemplazo'; end if;

      select referencia, descripcion, precio_minimo, precio_maximo, stock_actual, activo
        into v_r_ref, v_r_desc, v_r_pmin, v_r_pmax, v_r_stock, v_r_activo
        from public.productos_calzado where id = v_reempl_id for update;
      if v_r_desc is null then raise exception 'El reemplazo no existe'; end if;
      if not v_r_activo then raise exception 'El reemplazo no está activo'; end if;

      select referencia, descripcion into v_orig_ref, v_orig_desc
        from public.productos_calzado where id = v_calzado_id;
      if coalesce(v_orig_ref,'') <> coalesce(v_r_ref,'') or v_orig_desc <> v_r_desc then
        raise exception 'El reemplazo debe ser del mismo modelo (referencia y descripción)'; end if;

      if v_reempl_id <> v_calzado_id then
        if v_r_stock < v_cant then raise exception 'Stock insuficiente del reemplazo'; end if;
        update public.productos_calzado set stock_actual = stock_actual + v_cant where id = v_calzado_id;
        update public.productos_calzado set stock_actual = stock_actual - v_cant where id = v_reempl_id;
      end if;
      -- defecto (mismo id): sin ajuste de stock

      v_diff_total := v_diff_total + round((v_precio_reempl - v_precio_unit) * v_cant, 2);
      v_subtotal := 0.00;

      insert into public.devolucion_items (
        devolucion_id, venta_item_id, producto_calzado_id, producto_varios_id,
        cantidad, precio_unitario, subtotal, cambio_talla_color_id,
        precio_reemplazo, precio_minimo_snapshot, precio_maximo_snapshot
      ) values (
        v_devolucion_id, v_vi_id, v_calzado_id, null,
        v_cant, v_precio_unit, v_subtotal, v_reempl_id,
        v_precio_reempl, v_r_pmin, v_r_pmax
      );
    else
      -- total / parcial = reembolso
      if v_reempl_id is not null or v_precio_reempl is not null then
        raise exception 'No se permite reemplazo en una devolución que no es cambio'; end if;
      if v_tipo_prod = 'calzado' then
        if v_cant <> trunc(v_cant) then raise exception 'La cantidad de calzado debe ser entera'; end if;
        update public.productos_calzado set stock_actual = stock_actual + v_cant where id = v_calzado_id;
      elsif v_tipo_prod <> 'varios' then
        raise exception 'Tipo de producto inválido';
      end if;
      v_subtotal := round(v_precio_unit * v_cant, 2);
      v_refund_total := v_refund_total + v_subtotal;

      insert into public.devolucion_items (
        devolucion_id, venta_item_id, producto_calzado_id, producto_varios_id,
        cantidad, precio_unitario, subtotal, cambio_talla_color_id,
        precio_reemplazo, precio_minimo_snapshot, precio_maximo_snapshot
      ) values (
        v_devolucion_id, v_vi_id, v_calzado_id, v_varios_id,
        v_cant, v_precio_unit, v_subtotal, null, null, null, null
      );
    end if;
  end loop;

  -- Neto esperado
  if p_tipo_devolucion = 'cambio' then
    if v_diff_total > 0 then v_exp_cobrado := v_diff_total; v_exp_devuelto := 0.00;
    elsif v_diff_total < 0 then v_exp_devuelto := -v_diff_total; v_exp_cobrado := 0.00;
    else v_exp_devuelto := 0.00; v_exp_cobrado := 0.00; end if;
  else
    v_exp_devuelto := v_refund_total; v_exp_cobrado := 0.00;
  end if;

  if coalesce(p_monto_devuelto,0.00) <> v_exp_devuelto then
    raise exception 'Monto a reembolsar (%) no coincide con lo esperado (%)', p_monto_devuelto, v_exp_devuelto; end if;
  if coalesce(p_monto_cobrado,0.00) <> v_exp_cobrado then
    raise exception 'Monto a cobrar (%) no coincide con lo esperado (%)', p_monto_cobrado, v_exp_cobrado; end if;
  if v_exp_devuelto > 0 and (p_metodo_reembolso is null or p_metodo_reembolso not in ('efectivo','nequi','daviplata')) then
    raise exception 'Falta método de reembolso'; end if;
  if v_exp_cobrado > 0 and (p_metodo_cobro is null or p_metodo_cobro not in ('efectivo','nequi','daviplata')) then
    raise exception 'Falta método de cobro'; end if;

  -- Recalcular estado de la venta
  select coalesce(sum(cantidad),0.000) into v_vendido
    from public.venta_items where venta_id = p_venta_id;
  select coalesce(sum(di.cantidad),0.000) into v_movido
    from public.devolucion_items di join public.devoluciones d on d.id = di.devolucion_id
    where d.venta_id = p_venta_id;
  select count(*) = 0 into v_todas_cambio
    from public.devoluciones where venta_id = p_venta_id and tipo_devolucion <> 'cambio';

  if v_movido >= v_vendido then
    update public.ventas set estado = case when v_todas_cambio then 'cambiada_total' else 'devuelta_total' end
      where id = p_venta_id;
  else
    update public.ventas set estado = case when v_todas_cambio then 'cambiada_parcial' else 'devuelta_parcial' end
      where id = p_venta_id;
  end if;

  return jsonb_build_object('devolucion_id', v_devolucion_id);
end;
$$;

revoke all on function public.registrar_devolucion(uuid, text, text, text, text, numeric, numeric, jsonb) from public;
grant execute on function public.registrar_devolucion(uuid, text, text, text, text, numeric, numeric, jsonb) to authenticated;

-- 9. obtener_resumen_dia: resta reembolsos, suma cobros, incluye ventas devueltas/cambiadas
create or replace function public.obtener_resumen_dia(p_fecha date)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total_ventas int := 0;
  v_total_general numeric := 0;
  v_total_efectivo numeric := 0;
  v_total_nequi numeric := 0;
  v_total_daviplata numeric := 0;
  v_estados text[] := array['completada','devuelta_parcial','devuelta_total','cambiada_parcial','cambiada_total'];
begin
  select count(id), coalesce(sum(total),0) into v_total_ventas, v_total_general
  from public.ventas
  where estado = any(v_estados) and (created_at at time zone 'America/Bogota')::date = p_fecha;

  select
    coalesce(sum(case when m.metodo='efectivo' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='nequi' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='daviplata' then m.monto else 0 end),0)
  into v_total_efectivo, v_total_nequi, v_total_daviplata
  from public.metodos_pago_venta m join public.ventas v on v.id = m.venta_id
  where v.estado = any(v_estados) and (v.created_at at time zone 'America/Bogota')::date = p_fecha;

  -- Restar reembolsos y sumar cobros de las devoluciones del día
  select
    v_total_general
      - coalesce(sum(monto_devuelto),0) + coalesce(sum(monto_cobrado),0),
    v_total_efectivo
      - coalesce(sum(case when metodo_reembolso='efectivo' then monto_devuelto else 0 end),0)
      + coalesce(sum(case when metodo_cobro='efectivo' then monto_cobrado else 0 end),0),
    v_total_nequi
      - coalesce(sum(case when metodo_reembolso='nequi' then monto_devuelto else 0 end),0)
      + coalesce(sum(case when metodo_cobro='nequi' then monto_cobrado else 0 end),0),
    v_total_daviplata
      - coalesce(sum(case when metodo_reembolso='daviplata' then monto_devuelto else 0 end),0)
      + coalesce(sum(case when metodo_cobro='daviplata' then monto_cobrado else 0 end),0)
  into v_total_general, v_total_efectivo, v_total_nequi, v_total_daviplata
  from public.devoluciones
  where (created_at at time zone 'America/Bogota')::date = p_fecha;

  return json_build_object(
    'total_ventas', v_total_ventas,
    'total_general', v_total_general,
    'total_efectivo', v_total_efectivo,
    'total_nequi', v_total_nequi,
    'total_daviplata', v_total_daviplata
  );
end;
$$;

grant execute on function public.obtener_resumen_dia(date) to authenticated;
```

- [ ] **Step 3: Commit (solo el archivo de migración, aún sin aplicar)**

```bash
git add supabase/migrations/*_m2_devoluciones.sql
git commit -m "feat(m2): migración de devoluciones (tablas, RPC con diferencia de precio, resumen_dia)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Smoke test SQL y correrlo vía MCP

**Files:**
- Create/rewrite: `supabase/tests/smoke_test_devoluciones.sql` (gitignored — no se commitea)

- [ ] **Step 1: Escribir el smoke test**

Crear `supabase/tests/smoke_test_devoluciones.sql` envuelto en `begin; ... rollback;`, con helpers de assert y, al final, `raise notice 'DEVOLUCIONES_OK_ROLLBACK'`. Debe sembrar `auth.users` antes de `public.users` (ver memoria [[sp1-build-test-gotchas]]). Cubrir estos casos (un bloque `do $$ ... $$` por escenario, con `assert`):

1. Setup: crear usuario, proveedor, 2 productos_calzado del **mismo modelo** (misma `referencia`+`descripcion`, distinta talla: A stock 5, B stock 2), 1 producto_varios; crear una venta `completada` con `venta_items` (3 de calzado A @ 50000, 1 de varios @ 20000) y `metodos_pago_venta` efectivo.
2. **Exceso de cantidad:** `registrar_devolucion` devolviendo 4 de calzado A (vendidos 3) ⇒ debe fallar.
3. **Granja no restituye stock ni admite cambio:** devolución parcial del varios ⇒ OK, sin tabla de stock; intento de `cambio` sobre varios ⇒ falla.
4. **Devolución parcial de calzado:** devolver 1 de A (reembolso 50000 efectivo) ⇒ estado `devuelta_parcial`, stock A = 6.
5. **Cambio par:** cambiar 1 de A por B al mismo precio (precio_reemplazo=50000) ⇒ `monto_devuelto=0`, `monto_cobrado=0`, stock A=7, B=1, una devolución `tipo='cambio'`.
6. **Cambio con diferencia a favor del cliente:** reemplazo más barato (precio_reemplazo=40000) ⇒ `monto_devuelto=10000`, exige `metodo_reembolso`.
7. **Cambio con diferencia en contra:** reemplazo más caro (precio_reemplazo=60000) ⇒ `monto_cobrado=10000`, exige `metodo_cobro`.
8. **Validación de monto:** declarar un `monto_devuelto`/`monto_cobrado` que no cuadra ⇒ falla.
9. **Estado cambiada vs devuelta:** una venta con solo cambios hasta agotar ⇒ `cambiada_total`; una con un reembolso previo ⇒ `devuelta_*` (caso mixto gana devuelta).
10. **resumen_dia:** tras una venta efectivo 150000 + un reembolso 50000 + un cobro 10000 ⇒ `total_efectivo = 110000`.
11. **RLS:** `set local role authenticated`; `select` a `devoluciones` OK; `insert` directo a `devoluciones`/`devolucion_items` ⇒ bloqueado.

- [ ] **Step 2: Correr el smoke vía MCP**

Usar `mcp__plugin_supabase_supabase__execute_sql` con el contenido completo del archivo (incluye `begin; ... rollback;`). 
Esperado: termina con `DEVOLUCIONES_OK_ROLLBACK` y sin error. Si algún assert falla, corregir la **migración** (Task 1) o el smoke y repetir. **No avanzar a Task 3 hasta verde.**

---

## Task 3: Aplicar migración al remoto, regenerar tipos, limpiar scratch

**Files:**
- Modify (regenerar): `lib/database.types.ts`
- Delete: `supabase/migrations/20260617163622_m2_devoluciones_db.sql`, `lib/empirical_db.test.ts`, `lib/sandbox.test.ts`, `progress.md`, `.supabase/`

- [ ] **Step 1: Aplicar la migración al remoto vía MCP**

Usar `mcp__plugin_supabase_supabase__apply_migration` con `name='m2_devoluciones'` y el cuerpo de la migración (sin el `begin/rollback`; es DDL real).
Verificar con `mcp__plugin_supabase_supabase__list_migrations` que aparece, y:
```sql
select to_regclass('public.devoluciones'), to_regclass('public.devolucion_items');
```
Esperado: ambas no nulas.

- [ ] **Step 2: Regenerar tipos**

Usar `mcp__plugin_supabase_supabase__generate_typescript_types` y sobrescribir `lib/database.types.ts` con el resultado. **No editar a mano.**

- [ ] **Step 3: Verificar tsc**

Run: `npx tsc --noEmit`
Esperado: 0 errores.

- [ ] **Step 4: Eliminar scratch y la migración vieja**

```bash
git rm --cached -r .supabase 2>/dev/null; rm -rf .supabase
rm -f lib/empirical_db.test.ts lib/sandbox.test.ts progress.md
rm -f supabase/migrations/20260617163622_m2_devoluciones_db.sql
printf '\n.supabase/\n' >> .gitignore
```

- [ ] **Step 5: Commit BD + tipos + limpieza**

```bash
git add lib/database.types.ts .gitignore
git commit -m "feat(m2): aplicar migración de devoluciones al remoto + regenerar tipos; limpiar scratch

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: `lib/devoluciones.ts` — lógica pura (TDD)

**Files:**
- Create: `lib/devoluciones.ts`
- Test: `lib/devoluciones.test.ts`

- [ ] **Step 1: Escribir los tests que fallan**

Crear `lib/devoluciones.test.ts`:
```ts
import { calcularDiferenciaCambio, netearDevolucion, validarCantidades } from './devoluciones'

describe('calcularDiferenciaCambio', () => {
  it('cobra cuando el reemplazo es más caro', () => {
    expect(calcularDiferenciaCambio(50000, 60000, 1)).toBe(10000)
  })
  it('reembolsa (negativo) cuando es más barato', () => {
    expect(calcularDiferenciaCambio(50000, 40000, 2)).toBe(-20000)
  })
  it('es 0 en cambio par', () => {
    expect(calcularDiferenciaCambio(50000, 50000, 3)).toBe(0)
  })
})

describe('netearDevolucion', () => {
  it('reembolso puro suma subtotales', () => {
    expect(netearDevolucion('parcial', [{ diferencia: 0, subtotal: 50000 }, { diferencia: 0, subtotal: 20000 }]))
      .toEqual({ monto_devuelto: 70000, monto_cobrado: 0 })
  })
  it('cambio con diferencia positiva cobra', () => {
    expect(netearDevolucion('cambio', [{ diferencia: 10000, subtotal: 0 }]))
      .toEqual({ monto_devuelto: 0, monto_cobrado: 10000 })
  })
  it('cambio con diferencia negativa reembolsa', () => {
    expect(netearDevolucion('cambio', [{ diferencia: -15000, subtotal: 0 }]))
      .toEqual({ monto_devuelto: 15000, monto_cobrado: 0 })
  })
  it('cambio par no mueve dinero', () => {
    expect(netearDevolucion('cambio', [{ diferencia: 0, subtotal: 0 }]))
      .toEqual({ monto_devuelto: 0, monto_cobrado: 0 })
  })
})

describe('validarCantidades', () => {
  const vendido = { vi1: 3 }; const yaDev = { vi1: 1 }
  it('acepta dentro del disponible', () => {
    expect(validarCantidades([{ venta_item_id: 'vi1', cantidad: 2 }], vendido, yaDev)).toEqual([])
  })
  it('rechaza exceso', () => {
    expect(validarCantidades([{ venta_item_id: 'vi1', cantidad: 3 }], vendido, yaDev))
      .toContain('La cantidad a devolver de un producto supera lo disponible')
  })
  it('rechaza cantidad <= 0', () => {
    expect(validarCantidades([{ venta_item_id: 'vi1', cantidad: 0 }], vendido, yaDev))
      .toContain('La cantidad debe ser mayor a 0')
  })
})
```

- [ ] **Step 2: Run para ver fallar**

Run: `npx jest lib/devoluciones.test.ts`
Esperado: FAIL ("Cannot find module './devoluciones'" o funciones indefinidas).

- [ ] **Step 3: Implementar la lógica pura**

Crear `lib/devoluciones.ts` (solo la parte pura por ahora):
```ts
export type TipoDevolucion = 'total' | 'parcial' | 'cambio'
export type MetodoDinero = 'efectivo' | 'nequi' | 'daviplata'

export function calcularDiferenciaCambio(
  precioOriginal: number, precioReemplazo: number, cantidad: number
): number {
  return Math.round((precioReemplazo - precioOriginal) * cantidad)
}

export function netearDevolucion(
  tipo: TipoDevolucion,
  items: { diferencia: number; subtotal: number }[]
): { monto_devuelto: number; monto_cobrado: number } {
  if (tipo === 'cambio') {
    const diff = items.reduce((s, i) => s + i.diferencia, 0)
    if (diff > 0) return { monto_devuelto: 0, monto_cobrado: diff }
    if (diff < 0) return { monto_devuelto: -diff, monto_cobrado: 0 }
    return { monto_devuelto: 0, monto_cobrado: 0 }
  }
  const total = items.reduce((s, i) => s + i.subtotal, 0)
  return { monto_devuelto: total, monto_cobrado: 0 }
}

export function validarCantidades(
  items: { venta_item_id: string; cantidad: number }[],
  vendido: Record<string, number>,
  yaDevuelto: Record<string, number>
): string[] {
  const errores: string[] = []
  for (const it of items) {
    if (it.cantidad <= 0) { errores.push('La cantidad debe ser mayor a 0'); continue }
    const disponible = (vendido[it.venta_item_id] ?? 0) - (yaDevuelto[it.venta_item_id] ?? 0)
    if (it.cantidad > disponible) errores.push('La cantidad a devolver de un producto supera lo disponible')
  }
  return errores
}
```

- [ ] **Step 4: Run para ver pasar**

Run: `npx jest lib/devoluciones.test.ts`
Esperado: PASS (todos verdes).

- [ ] **Step 5: Commit**

```bash
git add lib/devoluciones.ts lib/devoluciones.test.ts
git commit -m "feat(m2): lógica pura de devoluciones (diferencia, neteo, validación) + tests

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: `lib/devoluciones.ts` — acceso a datos

**Files:**
- Modify: `lib/devoluciones.ts`

- [ ] **Step 1: Añadir los tipos y las funciones de datos**

Revisar primero `lib/ventas.ts` (`listarVentasHoy`) y `lib/supabase.ts` para reusar el cliente y el patrón de tipos. Añadir a `lib/devoluciones.ts`:

```ts
import { supabase } from './supabase'

export type VentaItemParaDevolucion = {
  venta_item_id: string
  tipo_producto: 'calzado' | 'varios'
  descripcion: string
  talla: string | null
  color: string | null
  cantidad_vendida: number
  cantidad_ya_devuelta: number
  precio_unitario: number
}

export type VentaParaDevolucion = {
  venta_id: string
  numero: number
  fecha: string
  cliente_nombre: string | null
  estado: string
  items: VentaItemParaDevolucion[]
}

export type ItemDevolucionInput = {
  venta_item_id: string
  cantidad: number
  cambio_talla_color_id?: string
  precio_reemplazo?: number
}

export type RegistrarDevolucionInput = {
  venta_id: string
  motivo: string
  tipo_devolucion: TipoDevolucion
  metodo_reembolso?: MetodoDinero
  metodo_cobro?: MetodoDinero
  monto_devuelto: number
  monto_cobrado: number
  items: ItemDevolucionInput[]
}

// Busca una venta por número (o id) con sus items y la cantidad ya devuelta por item.
export async function buscarVentaParaDevolucion(numero: number): Promise<VentaParaDevolucion | null> {
  const { data: venta, error } = await supabase
    .from('ventas')
    .select('id, numero, created_at, cliente_nombre, estado')
    .eq('numero', numero)
    .maybeSingle()
  if (error) throw error
  if (!venta) return null

  const { data: items, error: e2 } = await supabase
    .from('venta_items')
    .select('id, tipo_producto, descripcion_snapshot, talla, color, cantidad, precio_unitario')
    .eq('venta_id', venta.id)
  if (e2) throw e2

  const { data: devs, error: e3 } = await supabase
    .from('devolucion_items')
    .select('venta_item_id, cantidad, devolucion:devoluciones!inner(venta_id)')
    .eq('devolucion.venta_id', venta.id)
  if (e3) throw e3

  const yaDevuelto: Record<string, number> = {}
  for (const d of devs ?? []) {
    yaDevuelto[d.venta_item_id] = (yaDevuelto[d.venta_item_id] ?? 0) + Number(d.cantidad)
  }

  return {
    venta_id: venta.id,
    numero: venta.numero,
    fecha: venta.created_at,
    cliente_nombre: venta.cliente_nombre,
    estado: venta.estado,
    items: (items ?? []).map((i) => ({
      venta_item_id: i.id,
      tipo_producto: i.tipo_producto as 'calzado' | 'varios',
      descripcion: i.descripcion_snapshot,
      talla: i.talla,
      color: i.color,
      cantidad_vendida: Number(i.cantidad),
      cantidad_ya_devuelta: yaDevuelto[i.id] ?? 0,
      precio_unitario: Number(i.precio_unitario),
    })),
  }
}

export async function registrarDevolucion(input: RegistrarDevolucionInput): Promise<{ devolucion_id: string }> {
  const { data, error } = await supabase.rpc('registrar_devolucion', {
    p_venta_id: input.venta_id,
    p_motivo: input.motivo,
    p_tipo_devolucion: input.tipo_devolucion,
    p_metodo_reembolso: input.metodo_reembolso ?? null,
    p_metodo_cobro: input.metodo_cobro ?? null,
    p_monto_devuelto: input.monto_devuelto,
    p_monto_cobrado: input.monto_cobrado,
    p_items: input.items,
  })
  if (error) throw error
  return data as { devolucion_id: string }
}
```

> Nota: confirmar contra los tipos regenerados que `ventas` tiene `numero` y `cliente_nombre` (ver `lib/ventas.ts`); ajustar nombres de columnas si difieren. Confirmar que el embed `devoluciones!inner` compila con los tipos generados; si PostgREST se queja, hacer dos consultas (traer ids de devoluciones de la venta y luego sus items).

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit`
Esperado: 0 errores.

- [ ] **Step 3: Commit**

```bash
git add lib/devoluciones.ts
git commit -m "feat(m2): acceso a datos de devoluciones (buscarVentaParaDevolucion, registrarDevolucion)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: UI — layout e índice

**Files:**
- Create: `app/(app)/devoluciones/_layout.tsx`, `app/(app)/devoluciones/index.tsx`

- [ ] **Step 1: `_layout.tsx`** (copiar el patrón de `app/(app)/recibir-mercancia/_layout.tsx`)

```tsx
import { Stack } from 'expo-router'
import { useRequireModulo } from '../../../lib/auth'

export default function DevolucionesLayout() {
  const requireModulo = useRequireModulo('devoluciones')
  if (requireModulo) return requireModulo
  return (
    <Stack screenOptions={{
      headerStyle: { backgroundColor: '#ffffff' }, headerShadowVisible: false,
      headerTintColor: '#111827', headerTitleStyle: { fontWeight: '600' },
      contentStyle: { backgroundColor: '#f9fafb' }, headerTitleAlign: 'center',
    }}>
      <Stack.Screen name="index" options={{ title: 'Devoluciones' }} />
      <Stack.Screen name="nueva" options={{ title: 'Nueva Devolución' }} />
    </Stack>
  )
}
```

- [ ] **Step 2: `index.tsx`** — buscador de venta por número + navegación

Implementar una pantalla con: un `TextInput` numérico para el número de venta, un botón "Buscar", que llama `buscarVentaParaDevolucion(numero)`. Si encuentra la venta, navega a `nueva` pasando el `venta_id` por params (`router.push({ pathname: '/devoluciones/nueva', params: { venta: venta_id } })`); si no, muestra "Venta no encontrada". Seguir el estilo visual de `app/(app)/recibir-mercancia/index.tsx` (colores, espaciados, `SafeAreaView`/`ScrollView`). Manejar estado de carga y error con texto en español.

- [ ] **Step 3: Verificar tipos**

Run: `npx tsc --noEmit` → 0 errores.

- [ ] **Step 4: Commit**

```bash
git add "app/(app)/devoluciones/_layout.tsx" "app/(app)/devoluciones/index.tsx"
git commit -m "feat(m2): UI de devoluciones — layout con gating + búsqueda de venta

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: UI — flujo de devolución/cambio (`nueva.tsx`)

**Files:**
- Create: `app/(app)/devoluciones/nueva.tsx`

- [ ] **Step 1: Implementar la pantalla**

Lee `venta` de los params, carga la venta con `buscarVentaParaDevolucion`. Estructura:
1. Lista los items con `cantidad_vendida` y `cantidad_ya_devuelta` (disponible = vendida − ya devuelta).
2. Selector de **tipo** (`total` / `parcial` / `cambio`).
   - `total`: marca todos los items con su disponible; pide `metodo_reembolso`.
   - `parcial`: el usuario fija cantidad por item; pide `metodo_reembolso`.
   - `cambio` (solo items de calzado; ocultar la opción si el item es `varios`): por item, elegir reemplazo (buscar en catálogo por `buscarProductos`/`listarCalzado` filtrando mismo modelo) e ingresar `precio_reemplazo`. Mostrar la diferencia calculada con `calcularDiferenciaCambio`.
3. Campo obligatorio `motivo`.
4. Calcular el neto con `netearDevolucion`; según el signo mostrar y pedir `metodo_reembolso` (reembolso) o `metodo_cobro` (cobro). Validar cantidades con `validarCantidades` antes de habilitar "Confirmar".
5. "Confirmar" → `registrarDevolucion(input)`. Éxito → `router.back()` con feedback; error → mostrar `error.message` (los mensajes del RPC ya vienen en español).

Todo en español; estilo consistente con las pantallas existentes. Granja nunca muestra "cambio".

- [ ] **Step 2: Verificar tipos**

Run: `npx tsc --noEmit` → 0 errores.

- [ ] **Step 3: Commit**

```bash
git add "app/(app)/devoluciones/nueva.tsx"
git commit -m "feat(m2): UI flujo de devolución/cambio con diferencia de precio

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Tests de UI

**Files:**
- Create: `lib/devoluciones_ui.test.tsx` (seguir el patrón de `lib/recibir_mercancia_ui.test.tsx`, incluido el mock `useRequireModulo: jest.fn(() => null)`)

- [ ] **Step 1: Escribir los tests**

Cubrir, mockeando `lib/devoluciones` y `lib/auth`:
1. El layout aplica gating (que `useRequireModulo` se invoque con `'devoluciones'`).
2. En `nueva`, un item de Granja (`varios`) **no** ofrece la opción "cambio".
3. Un cambio con reemplazo más caro muestra/pide `metodo_cobro` (cobro) y no `metodo_reembolso`.
4. Confirmar invoca `registrarDevolucion` con el payload correcto (tipo, montos netos, items).

- [ ] **Step 2: Run**

Run: `npx jest lib/devoluciones_ui.test.tsx`
Esperado: PASS.

- [ ] **Step 3: Commit**

```bash
git add lib/devoluciones_ui.test.tsx
git commit -m "test(m2): tests de UI de devoluciones (gating, sin cambio en Granja, cobro, payload)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Verificación de regresión + Caja (M7)

- [ ] **Step 1: Suite completa**

Run: `npx tsc --noEmit && npm test`
Esperado: tsc 0 errores; todas las suites jest verdes.

- [ ] **Step 2: Verificar Caja (M7) tras el cambio de `obtener_resumen_dia`**

Revisar `lib/caja.ts` y `app/(app)/caja/` (o equivalente) para confirmar que solo consumen las 5 claves del JSON (`total_ventas`, `total_general`, `total_efectivo`, `total_nequi`, `total_daviplata`) y nada más. Correr cualquier test de caja existente. Si Caja asume que el resumen excluye devoluciones, documentar que ahora las netea (es el comportamiento deseado de M2).

- [ ] **Step 3: Smoke de regresión vía MCP**

Re-correr `supabase/tests/smoke_test_devoluciones.sql` vía MCP (en su transacción con rollback) y, si existe, `smoke_test_proveedores.sql`, para confirmar que el cambio de esquema no rompió nada. Esperado: ambos terminan con su centinela `*_OK_ROLLBACK`.

---

## Task 10: Code review y cierre de la rama

- [ ] **Step 1: Code review** (REQUIRED SUB-SKILL: superpowers:requesting-code-review)

Dispatch un code reviewer subagente sobre el diff `main..feat/m2-devoluciones`. Foco: atomicidad del RPC, que la frontera RLS no permita escritura directa, que la UI no muestre datos financieros prohibidos, y la corrección del neteo cobro/reembolso.

- [ ] **Step 2: Actualizar `tasks.json` y memoria**

Marcar SP-7 Devoluciones como construido en `openspec/changes/tasks.json` y actualizar la memoria [[m2-devoluciones-state]] al nuevo estado (BD aplicada + lib + UI listos en la rama).

- [ ] **Step 3: Presentar al humano para decisión de merge** (REQUIRED SUB-SKILL: superpowers:finishing-a-development-branch)

**No mergear a `main` automáticamente.** Presentar el resumen del diff, resultados de tsc/test/smoke y la verificación de Caja, y pedir aprobación humana del merge `--no-ff`.

---

## Self-Review (writing-plans)

- **Cobertura del spec:** §2 reglas → Task 1 (RPC) + Task 4 (lógica pura); §3 BD → Tasks 1-3; §4 lib → Tasks 4-5; §5 UI → Tasks 6-7; §6 pruebas → Tasks 2, 4, 8, 9. Sin huecos.
- **Sin placeholders de código** en BD ni lógica pura (código completo). Las pantallas UI describen comportamiento con snippets de patrón concretos (layout completo) + referencia a pantallas existentes; aceptable porque el estilo visual debe imitar el repo.
- **Consistencia de tipos:** firma del RPC (8 params) idéntica en migración, `registrarDevolucion` y grants; nombres `monto_devuelto`/`monto_cobrado`/`metodo_*` consistentes entre tabla, RPC, `resumen_dia` y lib. `TipoDevolucion`/`MetodoDinero` reusados.
- **Orden serial:** BD (1-3) antes que lib (4-5) antes que UI (6-8); verificación (9) antes que review/cierre (10). Coincide con AGENTS.md §5.1 (esquema primero, serial).
