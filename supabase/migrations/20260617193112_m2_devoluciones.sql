-- M2 Devoluciones: tablas, RLS, RPC registrar_devolucion (con diferencia de precio
-- en cambios) y ajuste de obtener_resumen_dia. Reemplaza 20260617163622_m2_devoluciones_db.sql.

-- 1. Ampliar el check de ventas.estado
alter table public.ventas drop constraint if exists ventas_estado_check;
alter table public.ventas add constraint ventas_estado_check
  check (estado in ('completada','separada','cancelada',
                    'devuelta_parcial','devuelta_total',
                    'cambiada_parcial','cambiada_total'));

-- 2. Idempotencia (drop table ... cascade elimina también sus triggers; no usar
--    "drop trigger ... on <tabla>" antes de crear la tabla: falla si la tabla no existe)
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
