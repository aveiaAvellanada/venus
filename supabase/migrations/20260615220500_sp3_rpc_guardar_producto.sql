-- Actualizar esquema del historial para soportar min/max
alter table public.historial_precios_calzado 
  rename column precio_venta to precio_minimo;

alter table public.historial_precios_calzado
  add column precio_maximo numeric(10,2);

-- Crear función RPC para guardar producto calzado
create or replace function public.guardar_producto_calzado(
  p_id uuid, -- Si es null, es insert
  p_categoria text,
  p_descripcion text,
  p_referencia text,
  p_talla text,
  p_color text,
  p_precio_minimo numeric,
  p_precio_maximo numeric,
  p_costo_compra numeric, -- Opcional, solo lo vería el dueño
  p_stock_actual numeric,
  p_stock_minimo numeric,
  p_proveedor_id uuid,
  p_foto_url text,
  p_activo boolean
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  v_id uuid;
  v_old_min numeric;
  v_old_max numeric;
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  
  if p_id is null then
    -- Insert
    insert into public.productos_calzado (
      categoria, descripcion, referencia, talla, color, 
      precio_minimo, precio_maximo, stock_actual, stock_minimo, 
      proveedor_id, foto_url, activo
    ) values (
      p_categoria, p_descripcion, p_referencia, p_talla, p_color,
      p_precio_minimo, p_precio_maximo, p_stock_actual, p_stock_minimo,
      p_proveedor_id, p_foto_url, coalesce(p_activo, true)
    ) returning id into v_id;

    -- Registrar en historial el costo inicial si se proveyó
    if p_costo_compra is not null then
      insert into public.historial_precios_calzado (
        producto_id, precio_minimo, precio_maximo, costo_compra, registrado_por, motivo
      ) values (
        v_id, p_precio_minimo, p_precio_maximo, p_costo_compra, v_user_id, 'Creación inicial'
      );
    end if;
  else
    -- Update
    v_id := p_id;
    
    -- Obtener valores actuales 
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

    -- Si cambió precio o hay un nuevo costo, registrar en historial
    if (v_old_min is distinct from p_precio_minimo) or 
       (v_old_max is distinct from p_precio_maximo) or 
       (p_costo_compra is not null) then
      insert into public.historial_precios_calzado (
        producto_id, precio_minimo, precio_maximo, costo_compra, registrado_por, motivo
      ) values (
        v_id, p_precio_minimo, p_precio_maximo, p_costo_compra, v_user_id, 'Actualización manual'
      );
    end if;
  end if;

  return v_id;
end;
$$;
