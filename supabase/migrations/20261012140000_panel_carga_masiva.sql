-- Panel web, fase 1, entrega 4 (Carga masiva; docs/panel-web-fase1.md, A9):
--
-- cargar_inventario(p_filas jsonb, p_proveedor_id uuid): la plantilla de Excel
-- (plantilla_carga_inventario.md) en una sola transacción, todo o nada.
--   - Cada fila es una talla. Se reconoce por referencia (o descripción si no
--     tiene) + color + talla, sin importar mayúsculas ni espacios.
--   - Talla nueva: se crea con el stock y los precios del archivo (stock mínimo
--     0, como en la carga de la app); el costo queda en el historial de
--     precios (solo con permiso `costos`).
--   - Talla existente: se actualizan descripción, marca, categoría y precios
--     (el cambio de precio queda en el historial). El STOCK NO CAMBIA: el
--     stock de lo que ya existe solo se mueve con compras, ventas y
--     devoluciones (los ajustes llegan con el conteo físico, fase 2). Así se
--     puede exportar, corregir precios en Excel y volver a subir sin dañar
--     el stock.
--   - Una misma talla repetida en el archivo es un error.
-- Permiso: `carga_inicial` (con `inventario` para cambiar precios de lo existente).

create or replace function public.cargar_inventario(p_filas jsonb, p_proveedor_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_con_costos  boolean;
  v_creados     int := 0;
  v_actualizados int := 0;
  v_iguales     int := 0;
  v_claves      text[] := '{}';
  it            jsonb;
  v_n           int;
  v_fila        text;
  v_cat         text;
  v_desc        text;
  v_marca       text;
  v_ref         text;
  v_talla       text;
  v_color       text;
  v_min         numeric(12,2);
  v_max         numeric(12,2);
  v_costo       numeric(12,2);
  v_stock       numeric;
  v_clave       text;
  v_pid         uuid;
  v_actual      record;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if not private.tiene_permiso('carga_inicial') then
    raise exception 'No tienes permiso para la carga masiva de inventario.';
  end if;
  if jsonb_typeof(p_filas) is distinct from 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'El archivo no tiene filas.';
  end if;
  if jsonb_array_length(p_filas) > 5000 then
    raise exception 'Máximo 5000 filas por carga. Divide el archivo.';
  end if;
  if p_proveedor_id is not null and not exists (select 1 from public.proveedores where id = p_proveedor_id) then
    raise exception 'El proveedor elegido no existe.';
  end if;
  v_con_costos := private.tiene_permiso('costos');

  v_n := 0;
  for it in select value from jsonb_array_elements(p_filas) loop
    v_n := v_n + 1;
    v_fila  := coalesce(it ->> 'fila', v_n::text);
    v_cat   := it ->> 'categoria';
    v_desc  := nullif(btrim(it ->> 'descripcion'), '');
    v_marca := nullif(btrim(it ->> 'marca'), '');
    v_ref   := nullif(btrim(it ->> 'referencia'), '');
    v_talla := nullif(btrim(it ->> 'talla'), '');
    v_color := nullif(btrim(it ->> 'color'), '');
    v_min   := round((it ->> 'precio_minimo')::numeric, 2);
    v_max   := round((it ->> 'precio_maximo')::numeric, 2);
    v_costo := round((it ->> 'costo')::numeric, 2);
    v_stock := (it ->> 'stock')::numeric;

    if v_cat is null or v_cat not in ('Chanclas','Escolar','Botas caucho','Deportivo','Tennis','Clasico','Otros') then
      raise exception 'Fila %: categoría inválida.', v_fila;
    end if;
    if v_desc is null then
      raise exception 'Fila %: falta la descripción.', v_fila;
    end if;
    if v_min is null or v_max is null or v_min < 0 or v_max < v_min then
      raise exception 'Fila %: revisa los precios (el mínimo no puede pasar del máximo).', v_fila;
    end if;
    if v_costo is not null and v_costo < 0 then
      raise exception 'Fila %: el costo no puede ser negativo.', v_fila;
    end if;
    if v_stock is null or v_stock < 0 or v_stock <> trunc(v_stock) then
      raise exception 'Fila %: el stock debe ser un número entero, 0 o más.', v_fila;
    end if;

    -- La misma llave con que se busca abajo: referencia, o descripción si no tiene.
    v_clave := case when v_ref is not null then 'r|' || lower(v_ref) else 'd|' || lower(v_desc) end
               || '|' || lower(coalesce(v_color, '')) || '|' || lower(coalesce(v_talla, ''));
    if v_clave = any (v_claves) then
      raise exception 'Fila %: esa talla ya viene en otra fila del archivo (% %, talla %).',
        v_fila, coalesce(v_ref, v_desc), coalesce(v_color, ''), coalesce(v_talla, 'única');
    end if;
    v_claves := v_claves || v_clave;

    select id, descripcion, marca, categoria, precio_minimo, precio_maximo into v_actual
      from public.productos_calzado
      where case
              when v_ref is not null then lower(btrim(referencia)) = lower(v_ref)
              else nullif(btrim(referencia), '') is null and lower(btrim(descripcion)) = lower(v_desc)
            end
        and lower(coalesce(btrim(color), '')) = lower(coalesce(v_color, ''))
        and lower(coalesce(btrim(talla), '')) = lower(coalesce(v_talla, ''))
      order by activo desc, created_at
      limit 1
      for update;

    if found then
      v_pid := v_actual.id;
      if v_actual.precio_minimo is distinct from v_min or v_actual.precio_maximo is distinct from v_max then
        if not private.tiene_permiso('inventario') then
          raise exception 'Fila %: no tienes permiso para cambiar precios.', v_fila;
        end if;
        insert into public.historial_precios_calzado (producto_id, precio_minimo, precio_maximo, motivo, registrado_por)
          values (v_pid, v_min, v_max, 'Carga masiva', v_uid);
      end if;
      if v_actual.descripcion is distinct from v_desc or v_actual.marca is distinct from v_marca
         or v_actual.categoria is distinct from v_cat
         or v_actual.precio_minimo is distinct from v_min or v_actual.precio_maximo is distinct from v_max then
        update public.productos_calzado
          set descripcion = v_desc, marca = v_marca, categoria = v_cat, precio_minimo = v_min, precio_maximo = v_max
          where id = v_pid;
        v_actualizados := v_actualizados + 1;
      else
        v_iguales := v_iguales + 1;
      end if;
    else
      insert into public.productos_calzado (
        referencia, descripcion, marca, categoria, color, talla,
        precio_minimo, precio_maximo, stock_actual, stock_minimo, proveedor_id, activo
      ) values (
        v_ref, v_desc, v_marca, v_cat, v_color, v_talla,
        v_min, v_max, v_stock::int, 0, p_proveedor_id, true
      ) returning id into v_pid;
      insert into public.historial_precios_calzado (producto_id, precio_minimo, precio_maximo, costo_compra, motivo, registrado_por)
        values (v_pid, v_min, v_max, case when v_con_costos then v_costo end, 'Carga inicial', v_uid);
      v_creados := v_creados + 1;
    end if;
  end loop;

  return jsonb_build_object('creados', v_creados, 'actualizados', v_actualizados, 'sin_cambios', v_iguales);
end;
$$;

revoke all on function public.cargar_inventario(jsonb, uuid) from public, anon;
grant execute on function public.cargar_inventario(jsonb, uuid) to authenticated;
