-- Ola 2 de ajustes (docs/plan-ajustes-2026-10-16.md): precios por talla,
-- garantía por referencia, máximo opcional y precio de venta libre.
--
-- 1. productos_calzado.precio_maximo pasa a ser OPCIONAL (solo el mínimo es
--    obligatorio). productos_calzado.garantia_dias: días de garantía, por
--    referencia (null = sin garantía).
-- 2. calzado_tramos_precio: tramos de talla de una referencia con su mínimo
--    (obligatorio) y máximo (opcional). Aplica igual a todos los colores.
--    Cada variante (talla+color) conserva su mín/máx propio —lo que leen el
--    carrito y las ventas—; guardar_tramos_precio escribe esos valores en las
--    variantes de cada tramo y un trigger los aplica a las variantes nuevas.
-- 3. fijar_garantia_referencia: la garantía se fija para toda la referencia.
-- 4. registrar_venta: el mínimo y el máximo ya no son topes (el precio final es
--    libre); el precio pagado y los recomendados de ese momento quedan por item.
-- 5. registrar_devolucion: el reemplazo de un cambio puede ser de cualquier
--    modelo activo (la diferencia se cobra o se devuelve).
-- 6. actualizar_precios_lote entiende el máximo vacío.
--
-- Tablas del negocio: la nueva lleva el trigger de auditoría (auditoria_test.sql).

-- ===== 1. Columnas =====
alter table public.productos_calzado alter column precio_maximo drop not null;
alter table public.productos_calzado alter column precio_maximo drop default;
alter table public.productos_calzado
  add column if not exists garantia_dias integer check (garantia_dias is null or garantia_dias >= 0);
comment on column public.productos_calzado.precio_maximo is
  'Precio máximo recomendado (opcional). El precio final de venta es libre.';
comment on column public.productos_calzado.garantia_dias is
  'Días de garantía desde la venta; se fija por referencia (null = sin garantía).';

-- ===== Utilidades =====
create or replace function private.clave_referencia(p_ref text)
returns text language sql immutable set search_path = '' as $$
  select nullif(lower(btrim(p_ref)), '')
$$;

-- Talla como número ("38", "38,5"); null si no es numérica (p. ej. "Única").
create or replace function private.talla_numerica(p_talla text)
returns numeric language sql immutable set search_path = '' as $$
  select case when btrim(p_talla) ~ '^[0-9]+([.,][0-9]+)?$'
              then replace(btrim(p_talla), ',', '.')::numeric end
$$;

-- ===== 2. Tramos de precio por talla =====
create table if not exists public.calzado_tramos_precio (
  id               uuid primary key default gen_random_uuid(),
  referencia_clave text not null,
  talla_desde      numeric(5,1) not null,
  talla_hasta      numeric(5,1) not null,
  precio_minimo    numeric(12,2) not null check (precio_minimo > 0),
  precio_maximo    numeric(12,2),
  created_by       uuid references public.users(id) on delete set null default auth.uid(),
  created_at       timestamptz not null default now(),
  constraint calzado_tramos_rango_tallas check (talla_desde <= talla_hasta),
  constraint calzado_tramos_rango_precio check (precio_maximo is null or precio_maximo >= precio_minimo)
);
create index if not exists idx_calzado_tramos_ref on public.calzado_tramos_precio (referencia_clave);
comment on table public.calzado_tramos_precio is
  'Precios mínimo/máximo por rango de tallas de una referencia (igual para todos los colores). Solo se escribe con guardar_tramos_precio().';

alter table public.calzado_tramos_precio enable row level security;
revoke all on table public.calzado_tramos_precio from anon, authenticated;
grant select on table public.calzado_tramos_precio to authenticated;
drop policy if exists "Tramos de precio: ver" on public.calzado_tramos_precio;
create policy "Tramos de precio: ver" on public.calzado_tramos_precio
  for select to authenticated using (private.tiene_permiso('inventario'));

drop trigger if exists trg_calzado_tramos_precio_auditoria on public.calzado_tramos_precio;
create trigger trg_calzado_tramos_precio_auditoria after insert or update or delete on public.calzado_tramos_precio
  for each row execute function private.registrar_auditoria();

-- Guarda TODOS los tramos de una referencia (reemplaza los anteriores) y aplica
-- el precio de cada tramo a las variantes cuya talla numérica cae en él. Las que
-- no caen en ningún tramo conservan su precio. [] quita los tramos (las
-- variantes no cambian de precio).
-- p_tramos: [{"talla_desde": 30, "talla_hasta": 38, "precio_minimo": 55000, "precio_maximo": null}, …]
create or replace function public.guardar_tramos_precio(p_referencia text, p_tramos jsonb)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_clave  text := private.clave_referencia(p_referencia);
  t        jsonb;
  v_d      numeric;
  v_h      numeric;
  v_min    numeric;
  v_max    numeric;
  v_prev_h numeric;
  v_n      int := 0;
  v_cambiados int := 0;
  v_sin    int;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if not private.tiene_permiso('inventario') then
    raise exception 'No tienes permiso para cambiar precios.';
  end if;
  if v_clave is null then
    raise exception 'La referencia es obligatoria para fijar precios por talla.';
  end if;
  if p_tramos is null or jsonb_typeof(p_tramos) <> 'array' then
    raise exception 'Los tramos no son válidos.';
  end if;
  if not exists (select 1 from public.productos_calzado where private.clave_referencia(referencia) = v_clave) then
    raise exception 'No hay calzado con esa referencia.';
  end if;

  -- Validación en orden de talla: rangos bien formados y sin traslape.
  for t in select value from jsonb_array_elements(p_tramos) order by (value ->> 'talla_desde')::numeric
  loop
    v_d   := (t ->> 'talla_desde')::numeric;
    v_h   := (t ->> 'talla_hasta')::numeric;
    v_min := round((t ->> 'precio_minimo')::numeric, 2);
    v_max := round(nullif(t ->> 'precio_maximo', '')::numeric, 2);
    if v_d is null or v_h is null or v_min is null then
      raise exception 'Cada tramo necesita talla desde, talla hasta y precio mínimo.';
    end if;
    if v_d > v_h then
      raise exception 'En un tramo la talla inicial (%) es mayor que la final (%).', v_d, v_h;
    end if;
    if v_min <= 0 then
      raise exception 'El precio mínimo de cada tramo debe ser mayor que cero.';
    end if;
    if v_max is not null and v_max < v_min then
      raise exception 'En el tramo % a % el máximo es menor que el mínimo.', v_d, v_h;
    end if;
    if v_prev_h is not null and v_d <= v_prev_h then
      raise exception 'Los tramos se cruzan en la talla %.', v_d;
    end if;
    v_prev_h := v_h;
  end loop;

  delete from public.calzado_tramos_precio where referencia_clave = v_clave;
  insert into public.calzado_tramos_precio (referencia_clave, talla_desde, talla_hasta, precio_minimo, precio_maximo)
  select v_clave, (x ->> 'talla_desde')::numeric, (x ->> 'talla_hasta')::numeric,
         round((x ->> 'precio_minimo')::numeric, 2), round(nullif(x ->> 'precio_maximo', '')::numeric, 2)
  from jsonb_array_elements(p_tramos) x;
  get diagnostics v_n = row_count;

  with cambios as (
    select p.id, tr.precio_minimo as mn, tr.precio_maximo as mx
    from public.productos_calzado p
    join public.calzado_tramos_precio tr
      on tr.referencia_clave = v_clave
     and private.talla_numerica(p.talla) between tr.talla_desde and tr.talla_hasta
    where private.clave_referencia(p.referencia) = v_clave
      and (p.precio_minimo is distinct from tr.precio_minimo or p.precio_maximo is distinct from tr.precio_maximo)
  ), actualizados as (
    update public.productos_calzado p
      set precio_minimo = c.mn, precio_maximo = c.mx
      from cambios c
      where p.id = c.id
      returning p.id, c.mn, c.mx
  )
  insert into public.historial_precios_calzado (producto_id, precio_minimo, precio_maximo, motivo, registrado_por)
  select id, mn, mx, 'Precios por talla', auth.uid() from actualizados;
  get diagnostics v_cambiados = row_count;

  select count(*) into v_sin
  from public.productos_calzado p
  where private.clave_referencia(p.referencia) = v_clave and p.activo
    and not exists (
      select 1 from public.calzado_tramos_precio tr
      where tr.referencia_clave = v_clave
        and private.talla_numerica(p.talla) between tr.talla_desde and tr.talla_hasta);

  return jsonb_build_object('tramos', v_n, 'actualizados', v_cambiados, 'sin_tramo', v_sin);
end;
$$;

-- ===== 3. Garantía por referencia =====
create or replace function public.fijar_garantia_referencia(p_referencia text, p_dias integer)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_clave text := private.clave_referencia(p_referencia);
  v_n     integer;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if not private.tiene_permiso('inventario') then
    raise exception 'No tienes permiso para editar el inventario.';
  end if;
  if v_clave is null then
    raise exception 'La referencia es obligatoria para fijar la garantía.';
  end if;
  if p_dias is not null and p_dias < 0 then
    raise exception 'Los días de garantía no pueden ser negativos.';
  end if;
  update public.productos_calzado
    set garantia_dias = p_dias
    where private.clave_referencia(referencia) = v_clave
      and garantia_dias is distinct from p_dias;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Una variante nueva (nueva talla o color de una referencia) hereda la garantía
-- de su referencia y, si su talla cae en un tramo, el precio de ese tramo.
create or replace function private.calzado_heredar_de_referencia()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_clave text := private.clave_referencia(new.referencia);
  v_g     integer;
  v_tr    record;
begin
  if v_clave is null then
    return new;
  end if;
  if new.garantia_dias is null then
    select garantia_dias into v_g
      from public.productos_calzado
      where private.clave_referencia(referencia) = v_clave and garantia_dias is not null
      limit 1;
    new.garantia_dias := v_g;
  end if;
  select tr.precio_minimo, tr.precio_maximo into v_tr
    from public.calzado_tramos_precio tr
    where tr.referencia_clave = v_clave
      and private.talla_numerica(new.talla) between tr.talla_desde and tr.talla_hasta
    limit 1;
  if found then
    new.precio_minimo := v_tr.precio_minimo;
    new.precio_maximo := v_tr.precio_maximo;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_calzado_heredar_referencia on public.productos_calzado;
create trigger trg_calzado_heredar_referencia before insert on public.productos_calzado
  for each row execute function private.calzado_heredar_de_referencia();

revoke all on function public.guardar_tramos_precio(text, jsonb) from public, anon;
revoke all on function public.fijar_garantia_referencia(text, integer) from public, anon;
grant execute on function public.guardar_tramos_precio(text, jsonb) to authenticated;
grant execute on function public.fijar_garantia_referencia(text, integer) to authenticated;

-- ===== 4. registrar_venta: precio libre =====

CREATE OR REPLACE FUNCTION public.registrar_venta(p_items jsonb, p_pagos jsonb, p_efectivo_recibido numeric DEFAULT NULL::numeric, p_cliente_nombre text DEFAULT NULL::text, p_cliente_apellido text DEFAULT NULL::text, p_cliente_telefono text DEFAULT NULL::text, p_clave_idempotencia uuid DEFAULT NULL::uuid, p_cliente_documento text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
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
  if not private.tiene_permiso('ventas') then
    raise exception 'No tienes permiso para vender.';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;
  if p_pagos is null or jsonb_array_length(p_pagos) = 0 then
    raise exception 'La venta no tiene pagos';
  end if;

  -- Reintento de una venta que ya se guardó (la respuesta se perdió por la red):
  -- se devuelve la misma venta, sin volver a descontar stock ni registrar pagos.
  if p_clave_idempotencia is not null then
    select id, numero into v_venta_id, v_numero
      from public.ventas
      where clave_idempotencia = p_clave_idempotencia and vendedor_id = v_uid;
    if found then
      return jsonb_build_object('venta_id', v_venta_id, 'numero', v_numero, 'repetida', true);
    end if;
  end if;

  -- El trigger trg_ventas_caja_abierta exige la caja del día abierta.
  insert into public.ventas (vendedor_id, total, monto_pagado, saldo_pendiente, estado,
                             cliente_nombre, cliente_apellido, cliente_telefono,
                             cliente_documento, clave_idempotencia)
    values (v_uid, 0, 0, 0, 'completada',
            p_cliente_nombre, p_cliente_apellido, p_cliente_telefono,
            nullif(btrim(p_cliente_documento), ''), p_clave_idempotencia)
    on conflict (clave_idempotencia) do nothing
    returning id, numero into v_venta_id, v_numero;

  if v_venta_id is null then
    -- Un reintento simultáneo con la misma clave ganó la carrera y ya se confirmó.
    select id, numero into v_venta_id, v_numero
      from public.ventas
      where clave_idempotencia = p_clave_idempotencia and vendedor_id = v_uid;
    if not found then
      raise exception 'Clave de venta inválida';
    end if;
    return jsonb_build_object('venta_id', v_venta_id, 'numero', v_numero, 'repetida', true);
  end if;

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
      -- El mínimo y el máximo son precios RECOMENDADOS (PRD v4.0): el precio final
      -- de la venta es libre (regateo, varios pares, ofertas) y queda guardado
      -- por item junto con los recomendados de ese momento (snapshots).
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
    if (v_pago->>'metodo') not in ('efectivo','nequi','bre_b','otro') then
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

  return jsonb_build_object('venta_id', v_venta_id, 'numero', v_numero, 'repetida', false);
end;
$function$;
revoke all on function public.registrar_venta(jsonb, jsonb, numeric, text, text, text, uuid, text) from public, anon;
grant execute on function public.registrar_venta(jsonb, jsonb, numeric, text, text, text, uuid, text) to authenticated;

-- ===== 5. registrar_devolucion: reemplazo de cualquier modelo =====
CREATE OR REPLACE FUNCTION public.registrar_devolucion(p_venta_id uuid, p_motivo text, p_tipo_devolucion text, p_metodo_reembolso text, p_metodo_cobro text, p_monto_devuelto numeric, p_monto_cobrado numeric, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  v_refund_total numeric(12,2) := 0.00;
  v_diff_total numeric(12,2) := 0.00;
  v_exp_devuelto numeric(12,2);
  v_exp_cobrado numeric(12,2);
  v_vendido numeric(12,3);
  v_movido numeric(12,3);
  v_todas_cambio boolean;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not private.tiene_permiso('devoluciones') then
    raise exception 'No tienes permiso para registrar devoluciones.'; end if;
  if p_motivo is null or trim(p_motivo) = '' then raise exception 'El motivo es requerido'; end if;
  if p_tipo_devolucion not in ('total','parcial','cambio') then
    raise exception 'Tipo de devolución inválido: %', p_tipo_devolucion; end if;
  if coalesce(p_monto_devuelto,0) < 0 or coalesce(p_monto_cobrado,0) < 0 then
    raise exception 'Montos inválidos'; end if;
  if coalesce(p_monto_devuelto,0) > 0 and coalesce(p_monto_cobrado,0) > 0 then
    raise exception 'Una devolución no puede cobrar y reembolsar a la vez'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La devolución debe contener al menos un producto'; end if;

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

      -- El reemplazo puede ser de cualquier modelo activo: la diferencia de precio
      -- se cobra o se devuelve (más barato = excedente al cliente).
      if v_reempl_id <> v_calzado_id then
        if v_r_stock < v_cant then raise exception 'Stock insuficiente del reemplazo'; end if;
        update public.productos_calzado set stock_actual = stock_actual + v_cant where id = v_calzado_id;
        update public.productos_calzado set stock_actual = stock_actual - v_cant where id = v_reempl_id;
      end if;

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
  if v_exp_devuelto > 0 and (p_metodo_reembolso is null or p_metodo_reembolso not in ('efectivo','nequi','bre_b','otro')) then
    raise exception 'Falta método de reembolso'; end if;
  if v_exp_cobrado > 0 and (p_metodo_cobro is null or p_metodo_cobro not in ('efectivo','nequi','bre_b','otro')) then
    raise exception 'Falta método de cobro'; end if;

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
$function$;
-- ===== 6. actualizar_precios_lote con máximo vacío =====
create or replace function public.actualizar_precios_lote(
  p_ids uuid[],
  p_regla jsonb,
  p_aplicar boolean default false
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_tipo      text    := p_regla ->> 'tipo';                         -- porcentaje | suma | fijo
  v_campos    text    := coalesce(p_regla ->> 'campos', 'ambos');    -- ambos | minimo | maximo
  v_valor     numeric := (p_regla ->> 'valor')::numeric;
  v_min_fijo  numeric := (p_regla ->> 'minimo')::numeric;
  v_max_fijo  numeric := (p_regla ->> 'maximo')::numeric;
  v_redondeo  numeric := coalesce((p_regla ->> 'redondeo')::numeric, 0);
  v_motivo    text    := coalesce(nullif(btrim(p_regla ->> 'motivo'), ''), 'Cambio de precios en lote');
  v_filas     jsonb;
  v_total     int;
  v_invalidos int;
  v_cambiados int;
begin
  if not private.tiene_permiso('inventario') then
    raise exception 'No tienes permiso para cambiar precios.';
  end if;
  if p_ids is null or cardinality(p_ids) = 0 then
    raise exception 'Elige al menos un producto.';
  end if;
  if cardinality(p_ids) > 2000 then
    raise exception 'Máximo 2000 productos por cambio.';
  end if;
  if v_tipo is null or v_tipo not in ('porcentaje', 'suma', 'fijo') then
    raise exception 'Regla de precio no válida.';
  end if;
  if v_campos not in ('ambos', 'minimo', 'maximo') then
    raise exception 'Indica si cambias el mínimo, el máximo o ambos.';
  end if;
  if v_tipo in ('porcentaje', 'suma') and v_valor is null then
    raise exception 'Falta el valor de la regla.';
  end if;
  if v_tipo = 'porcentaje' and v_valor <= -100 then
    raise exception 'Un porcentaje de % dejaría los precios en cero o negativos.', v_valor;
  end if;
  if v_tipo = 'fijo' and ((v_campos in ('ambos', 'minimo') and v_min_fijo is null)
                       or (v_campos in ('ambos', 'maximo') and v_max_fijo is null)) then
    raise exception 'Falta el precio fijo.';
  end if;
  if v_redondeo < 0 then
    raise exception 'El redondeo no puede ser negativo.';
  end if;

  with actual as (
    select p.id, p.referencia, p.descripcion, p.talla, p.color,
           p.precio_minimo as min_antes, p.precio_maximo as max_antes
    from public.productos_calzado p
    where p.id = any (p_ids)
  ), calculado as (
    select a.*,
      case when v_campos = 'maximo' then a.min_antes
           else private.redondear_precio(case v_tipo
                  when 'porcentaje' then a.min_antes * (1 + v_valor / 100)
                  when 'suma' then a.min_antes + v_valor
                  else v_min_fijo end, v_redondeo)
      end as min_nuevo,
      case when v_campos = 'minimo' then a.max_antes
           else private.redondear_precio(case v_tipo
                  when 'porcentaje' then a.max_antes * (1 + v_valor / 100)
                  when 'suma' then a.max_antes + v_valor
                  else v_max_fijo end, v_redondeo)
      end as max_nuevo
    from actual a
  )
  select
    coalesce(jsonb_agg(jsonb_build_object(
      'id', id, 'referencia', referencia, 'descripcion', descripcion, 'talla', talla, 'color', color,
      'min_antes', min_antes, 'max_antes', max_antes, 'min_nuevo', min_nuevo, 'max_nuevo', max_nuevo,
      'valido', min_nuevo > 0 and (max_nuevo is null or (max_nuevo > 0 and min_nuevo <= max_nuevo))
    ) order by referencia, descripcion, talla), '[]'::jsonb),
    count(*),
    count(*) filter (where not (min_nuevo > 0 and (max_nuevo is null or (max_nuevo > 0 and min_nuevo <= max_nuevo))))
  into v_filas, v_total, v_invalidos
  from calculado;

  if v_total <> (select count(distinct x) from unnest(p_ids) x) then
    raise exception 'Algunos productos ya no existen. Recarga el inventario.';
  end if;

  if not coalesce(p_aplicar, false) then
    return jsonb_build_object('aplicado', false, 'filas', v_filas, 'invalidos', v_invalidos);
  end if;

  if v_invalidos > 0 then
    raise exception 'En % producto(s) el mínimo quedaría mayor que el máximo o en cero. Revisa la regla.', v_invalidos;
  end if;

  with cambios as (
    select (f ->> 'id')::uuid as id, (f ->> 'min_nuevo')::numeric as mn, (f ->> 'max_nuevo')::numeric as mx
    from jsonb_array_elements(v_filas) f
    where (f ->> 'min_nuevo')::numeric is distinct from (f ->> 'min_antes')::numeric
       or (f ->> 'max_nuevo')::numeric is distinct from (f ->> 'max_antes')::numeric
  ), actualizados as (
    update public.productos_calzado p
      set precio_minimo = c.mn, precio_maximo = c.mx
      from cambios c
      where p.id = c.id
      returning p.id, c.mn, c.mx
  )
  insert into public.historial_precios_calzado (producto_id, precio_minimo, precio_maximo, motivo, registrado_por)
  select id, mn, mx, v_motivo, auth.uid() from actualizados;
  get diagnostics v_cambiados = row_count;

  return jsonb_build_object('aplicado', true, 'cambiados', v_cambiados, 'filas', v_filas, 'invalidos', 0);
end;
$$;
