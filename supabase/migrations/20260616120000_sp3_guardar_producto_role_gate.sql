-- SP-3 hardening: gate de rol en guardar_producto_calzado.
-- La versión original era SECURITY DEFINER sin ningún control de autorización,
-- lo que permitía a cualquier usuario autenticado (incl. empleado operativo)
-- escribir `costo_compra` (dato financiero que solo el dueño puede ver/registrar).
-- Fix: exigir autenticación y restringir la escritura de costo_compra al dueño.
-- Editar el producto sigue permitido a todo el staff (PRD: empleados editan inventario);
-- solo el campo financiero queda gateado.
create or replace function public.guardar_producto_calzado(
  p_id uuid,
  p_categoria text,
  p_descripcion text,
  p_referencia text,
  p_talla text,
  p_color text,
  p_precio_minimo numeric,
  p_precio_maximo numeric,
  p_costo_compra numeric,
  p_stock_actual numeric,
  p_stock_minimo numeric,
  p_proveedor_id uuid,
  p_foto_url text,
  p_activo boolean
) returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  v_id uuid;
  v_old_min numeric;
  v_old_max numeric;
  v_user_id uuid := auth.uid();
  v_costo numeric;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  -- Solo el dueño puede registrar costo_compra (finanzas). Para el resto se ignora.
  v_costo := case when private.is_owner() then p_costo_compra else null end;

  if p_id is null then
    insert into public.productos_calzado (
      categoria, descripcion, referencia, talla, color,
      precio_minimo, precio_maximo, stock_actual, stock_minimo,
      proveedor_id, foto_url, activo
    ) values (
      p_categoria, p_descripcion, p_referencia, p_talla, p_color,
      p_precio_minimo, p_precio_maximo, p_stock_actual, p_stock_minimo,
      p_proveedor_id, p_foto_url, coalesce(p_activo, true)
    ) returning id into v_id;

    if v_costo is not null then
      insert into public.historial_precios_calzado (
        producto_id, precio_minimo, precio_maximo, costo_compra, registrado_por, motivo
      ) values (
        v_id, p_precio_minimo, p_precio_maximo, v_costo, v_user_id, 'Creación inicial'
      );
    end if;
  else
    v_id := p_id;

    select precio_minimo, precio_maximo into v_old_min, v_old_max
    from public.productos_calzado where id = v_id;

    update public.productos_calzado set
      categoria = p_categoria,
      descripcion = p_descripcion,
      referencia = p_referencia,
      talla = p_talla,
      color = p_color,
      precio_minimo = p_precio_minimo,
      precio_maximo = p_precio_maximo,
      stock_actual = p_stock_actual,
      stock_minimo = p_stock_minimo,
      proveedor_id = p_proveedor_id,
      foto_url = coalesce(p_foto_url, foto_url),
      activo = coalesce(p_activo, activo),
      updated_at = now()
    where id = v_id;

    if (v_old_min is distinct from p_precio_minimo) or
       (v_old_max is distinct from p_precio_maximo) or
       (v_costo is not null) then
      insert into public.historial_precios_calzado (
        producto_id, precio_minimo, precio_maximo, costo_compra, registrado_por, motivo
      ) values (
        v_id, p_precio_minimo, p_precio_maximo, v_costo, v_user_id, 'Actualización manual'
      );
    end if;
  end if;

  return v_id;
end;
$$;

revoke all on function public.guardar_producto_calzado(uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, uuid, text, boolean) from public;
grant execute on function public.guardar_producto_calzado(uuid, text, text, text, text, text, numeric, numeric, numeric, numeric, numeric, uuid, text, boolean) to authenticated;