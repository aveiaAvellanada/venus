-- Panel web, fase 1, entrega 3 (Compras y recepción; docs/panel-web-fase1.md, A1):
--
-- registrar_compra(p_compra jsonb, p_clave_idempotencia uuid): una factura
-- completa del proveedor en una sola transacción:
--   - cabecera: proveedor, número y fecha de factura (opcionales), contado o
--     crédito (crédito exige vencimiento), notas;
--   - ítems: una fila por talla con cantidad, costo y precio mín/máx. La
--     misma referencia puede llevar precios distintos según el rango de
--     tallas: cada talla trae el suyo. Si la talla ya existe (producto_id, o
--     misma referencia + color + talla) se usa esa y, si el precio cambió, se
--     actualiza; si no existe, se crea en el mismo paso;
--   - el stock sube con el trigger de siempre al insertar compra_items; el
--     costo y los precios quedan en historial_precios_calzado; la auditoría
--     registra compra, ítems, productos nuevos y cambios de precio.
-- Permisos: `recibir_mercancia` y `costos` (la factura lleva costos; sin
-- `costos` se sigue usando la llegada física de la app, sin costos). Cambiar
-- el precio de un producto existente pide además `inventario`.
-- Idempotente con p_clave_idempotencia, como registrar_venta: reintentar tras
-- un corte de red devuelve la misma compra sin duplicar stock.

alter table public.compras add column if not exists numero_factura text;
alter table public.compras add column if not exists fecha_factura date;
alter table public.compras add column if not exists clave_idempotencia uuid;
create unique index if not exists compras_clave_idempotencia_key
  on public.compras (clave_idempotencia) where clave_idempotencia is not null;
comment on column public.compras.numero_factura is 'Número de la factura del proveedor (opcional; útil para la facturación futura).';
comment on column public.compras.fecha_factura is 'Fecha de la factura del proveedor.';

create or replace function public.registrar_compra(p_compra jsonb, p_clave_idempotencia uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_proveedor  uuid;
  v_condicion  text := p_compra ->> 'condicion_pago';
  v_vence      date;
  v_fecha      date;
  v_factura    text := nullif(btrim(p_compra ->> 'numero_factura'), '');
  v_notas      text := nullif(btrim(p_compra ->> 'notas'), '');
  v_motivo     text;
  v_compra     uuid;
  v_total      numeric(12,2) := 0;
  v_unidades   int := 0;
  v_nuevos     int := 0;
  v_cambiados  int := 0;
  it           jsonb;
  v_pid        uuid;
  v_ref        text;
  v_desc       text;
  v_color      text;
  v_talla      text;
  v_cant       numeric;
  v_costo      numeric(12,2);
  v_min        numeric(12,2);
  v_max        numeric(12,2);
  v_min_ant    numeric(12,2);
  v_max_ant    numeric(12,2);
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if not (private.tiene_permiso('recibir_mercancia') and private.tiene_permiso('costos')) then
    raise exception 'No tienes permiso para registrar facturas de compra con costos.';
  end if;

  -- Reintento de una compra que ya se guardó: la misma, sin tocar el stock otra vez.
  if p_clave_idempotencia is not null then
    select id into v_compra from public.compras where clave_idempotencia = p_clave_idempotencia;
    if found then
      return jsonb_build_object('compra_id', v_compra, 'repetida', true);
    end if;
  end if;

  v_proveedor := (p_compra ->> 'proveedor_id')::uuid;
  if v_proveedor is null or not exists (select 1 from public.proveedores where id = v_proveedor) then
    raise exception 'Elige el proveedor de la factura.';
  end if;
  if v_condicion is null or v_condicion not in ('contado', 'credito') then
    raise exception 'Indica si la compra es de contado o a crédito.';
  end if;
  v_fecha := coalesce((p_compra ->> 'fecha_factura')::date, private.hoy_bogota());
  if v_fecha > private.hoy_bogota() then
    raise exception 'La fecha de la factura no puede ser futura.';
  end if;
  v_vence := (p_compra ->> 'fecha_vencimiento')::date;
  if v_condicion = 'credito' and v_vence is null then
    raise exception 'Una compra a crédito necesita la fecha de vencimiento.';
  end if;
  if v_vence is not null and v_vence < v_fecha then
    raise exception 'El vencimiento no puede ser anterior a la fecha de la factura.';
  end if;
  if jsonb_typeof(p_compra -> 'items') is distinct from 'array' or jsonb_array_length(p_compra -> 'items') = 0 then
    raise exception 'La factura no tiene productos.';
  end if;
  if jsonb_array_length(p_compra -> 'items') > 2000 then
    raise exception 'Máximo 2000 tallas por factura.';
  end if;
  v_motivo := 'Compra' || coalesce(' factura ' || v_factura, '');

  insert into public.compras (
    proveedor_id, estado, registrada_por, revisada_por, condicion_pago, fecha_vencimiento,
    notas, total, monto_pagado, numero_factura, fecha_factura, clave_idempotencia
  ) values (
    v_proveedor, 'completada', v_uid, v_uid, v_condicion, v_vence,
    v_notas, 0, 0, v_factura, v_fecha, p_clave_idempotencia
  )
  on conflict (clave_idempotencia) where clave_idempotencia is not null do nothing
  returning id into v_compra;
  if v_compra is null then
    -- Un reintento simultáneo con la misma clave ganó la carrera.
    select id into v_compra from public.compras where clave_idempotencia = p_clave_idempotencia;
    return jsonb_build_object('compra_id', v_compra, 'repetida', true);
  end if;

  for it in select value from jsonb_array_elements(p_compra -> 'items') loop
    v_cant  := (it ->> 'cantidad')::numeric;
    v_costo := round((it ->> 'costo_unitario')::numeric, 2);
    v_min   := round((it ->> 'precio_minimo')::numeric, 2);
    v_max   := round((it ->> 'precio_maximo')::numeric, 2);
    v_ref   := nullif(btrim(it ->> 'referencia'), '');
    v_color := nullif(btrim(it ->> 'color'), '');
    v_talla := nullif(btrim(it ->> 'talla'), '');
    v_desc  := nullif(btrim(it ->> 'descripcion'), '');

    if v_cant is null or v_cant <= 0 or v_cant <> trunc(v_cant) then
      raise exception 'Cada talla necesita una cantidad entera mayor a cero.';
    end if;
    if v_costo is null or v_costo < 0 then
      raise exception 'El costo de % no puede faltar ni ser negativo.', coalesce(v_ref, v_desc, 'un producto');
    end if;
    if v_min is null or v_max is null or v_min <= 0 or v_min > v_max then
      raise exception 'Revisa los precios de % talla %: el mínimo debe ser mayor a cero y no pasar del máximo.',
        coalesce(v_ref, v_desc, 'un producto'), coalesce(v_talla, '—');
    end if;

    -- ¿Ya existe esta talla? Por id, o por referencia + color + talla.
    v_pid := (it ->> 'producto_id')::uuid;
    if v_pid is null and v_ref is not null and v_talla is not null then
      select id into v_pid from public.productos_calzado
        where lower(btrim(referencia)) = lower(v_ref)
          and lower(coalesce(btrim(color), '')) = lower(coalesce(v_color, ''))
          and btrim(talla) = v_talla
        order by activo desc, created_at
        limit 1;
    end if;

    if v_pid is not null then
      select precio_minimo, precio_maximo, descripcion, referencia, color, talla
        into v_min_ant, v_max_ant, v_desc, v_ref, v_color, v_talla
        from public.productos_calzado where id = v_pid for update;
      if not found then
        raise exception 'Un producto de la factura ya no existe. Recarga y vuelve a intentar.';
      end if;
      if v_min is distinct from v_min_ant or v_max is distinct from v_max_ant then
        if not private.tiene_permiso('inventario') then
          raise exception 'No tienes permiso para cambiar precios.';
        end if;
        update public.productos_calzado
          set precio_minimo = v_min, precio_maximo = v_max, activo = true
          where id = v_pid;
        v_cambiados := v_cambiados + 1;
      else
        update public.productos_calzado set activo = true where id = v_pid and not activo;
      end if;
    else
      if v_desc is null then
        raise exception 'Falta la descripción de % talla %.', coalesce(v_ref, 'un producto nuevo'), coalesce(v_talla, '—');
      end if;
      if v_talla is null then
        raise exception 'Falta la talla de %.', coalesce(v_ref, v_desc);
      end if;
      insert into public.productos_calzado (
        referencia, descripcion, marca, categoria, color, talla,
        precio_minimo, precio_maximo, stock_actual, stock_minimo, proveedor_id, activo
      ) values (
        v_ref, v_desc, nullif(btrim(it ->> 'marca'), ''), it ->> 'categoria', v_color, v_talla,
        v_min, v_max, 0, coalesce((it ->> 'stock_minimo')::int, 1), v_proveedor, true
      ) returning id into v_pid;
      v_nuevos := v_nuevos + 1;
    end if;

    insert into public.historial_precios_calzado (producto_id, precio_minimo, precio_maximo, costo_compra, motivo, registrado_por)
      values (v_pid, v_min, v_max, v_costo, v_motivo, v_uid);

    -- El trigger trg_compra_items_stock_increment sube el stock.
    insert into public.compra_items (compra_id, producto_calzado_id, descripcion, referencia, color, talla,
                                     cantidad, costo_unitario, subtotal)
      values (v_compra, v_pid, v_desc, v_ref, v_color, v_talla, v_cant, v_costo, round(v_costo * v_cant, 2));

    v_total := v_total + round(v_costo * v_cant, 2);
    v_unidades := v_unidades + v_cant::int;
  end loop;

  update public.compras
    set total = v_total, monto_pagado = case when v_condicion = 'contado' then v_total else 0 end
    where id = v_compra;

  return jsonb_build_object(
    'compra_id', v_compra, 'repetida', false, 'total', v_total, 'unidades', v_unidades,
    'productos_nuevos', v_nuevos, 'precios_cambiados', v_cambiados
  );
end;
$$;

revoke all on function public.registrar_compra(jsonb, uuid) from public, anon;
grant execute on function public.registrar_compra(jsonb, uuid) to authenticated;
