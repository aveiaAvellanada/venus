-- Panel web, fase 1, entrega 1 (Inventario y precios; docs/panel-web-fase1.md):
--
-- 1. actualizar_precios_lote: cambia precio mín/máx de muchos productos con una
--    regla (porcentaje, suma o precio fijo, con redondeo). Con p_aplicar = false
--    solo devuelve la vista previa (antes/después), así la pantalla y la base
--    calculan con la misma fórmula. Al aplicar deja el cambio en el historial de
--    precios (y la auditoría lo registra por el trigger).
-- 2. obtener_costos_productos: último costo y costo promedio de cada producto,
--    solo para quien tiene el permiso `costos` (por defecto, el dueño).

create or replace function private.redondear_precio(p_precio numeric, p_multiplo numeric)
returns numeric language sql immutable set search_path = '' as $$
  select case
    when coalesce(p_multiplo, 0) <= 0 then round(p_precio, 0)
    else round(p_precio / p_multiplo) * p_multiplo
  end
$$;

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
      'valido', min_nuevo > 0 and max_nuevo > 0 and min_nuevo <= max_nuevo
    ) order by referencia, descripcion, talla), '[]'::jsonb),
    count(*),
    count(*) filter (where not (min_nuevo > 0 and max_nuevo > 0 and min_nuevo <= max_nuevo))
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

create or replace function public.obtener_costos_productos()
returns table (producto_id uuid, ultimo_costo numeric, costo_promedio numeric, unidades_compradas bigint)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not private.tiene_permiso('costos') then
    raise exception 'No tienes permiso para ver costos.';
  end if;
  return query
  with compradas as (
    select ci.producto_calzado_id as pid, ci.costo_unitario, ci.cantidad, ci.created_at
    from public.compra_items ci
    join public.compras c on c.id = ci.compra_id
    where c.estado <> 'cancelada' and ci.producto_calzado_id is not null and ci.costo_unitario is not null
  ), por_compras as (
    select pid,
           (array_agg(costo_unitario order by created_at desc))[1] as ultimo,
           round(sum(costo_unitario * cantidad) / nullif(sum(cantidad), 0), 2) as promedio,
           sum(cantidad)::bigint as unidades
    from compradas group by pid
  ), por_historial as (
    -- Productos creados con costo y sin compras registradas todavía.
    select distinct on (h.producto_id) h.producto_id as pid, h.costo_compra
    from public.historial_precios_calzado h
    where h.costo_compra is not null
    order by h.producto_id, h.created_at desc
  )
  select coalesce(pc.pid, ph.pid), coalesce(pc.ultimo, ph.costo_compra),
         coalesce(pc.promedio, ph.costo_compra), coalesce(pc.unidades, 0)
  from por_compras pc
  full join por_historial ph on ph.pid = pc.pid;
end;
$$;

revoke all on function public.actualizar_precios_lote(uuid[], jsonb, boolean) from public, anon;
revoke all on function public.obtener_costos_productos() from public, anon;
grant execute on function public.actualizar_precios_lote(uuid[], jsonb, boolean) to authenticated;
grant execute on function public.obtener_costos_productos() to authenticated;
