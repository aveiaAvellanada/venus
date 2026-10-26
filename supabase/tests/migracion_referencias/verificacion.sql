-- Verifica cómo 20261026120000_referencia_automatica_categorias deja los
-- zapatos cargados con semilla.sql antes de esa migración.
-- Éxito = termina con el error MIGRACION_REFERENCIAS_OK_ROLLBACK.

begin;

do $$
declare
  v_txt text;
  v_n   bigint;
begin
  select count(*) into v_n from public.productos_calzado where nullif(btrim(referencia), '') is null;
  if v_n <> 0 then raise exception 'FALLO: quedaron % zapatos sin referencia', v_n; end if;

  -- Un código por descripción + marca, en el orden en que se crearon.
  select string_agg(distinct referencia, ',') into v_txt from public.productos_calzado where lower(btrim(descripcion)) = 'tennis zeus' and lower(btrim(marca)) = 'nike';
  if v_txt is distinct from 'TEN-NIKE-001' then raise exception 'FALLO: Tennis Zeus Nike quedó con %', v_txt; end if;
  select string_agg(referencia, ',') into v_txt from public.productos_calzado where descripcion = 'Tennis Zeus' and marca = 'Adidas';
  if v_txt is distinct from 'TEN-ADID-001' then raise exception 'FALLO: Tennis Zeus Adidas quedó con %', v_txt; end if;
  select referencia into v_txt from public.productos_calzado where descripcion = 'Bota llanera';
  if v_txt is distinct from 'BCA-SM-001' then raise exception 'FALLO: la bota sin marca quedó con %', v_txt; end if;

  -- Deportivo desapareció.
  select string_agg(categoria || ':' || referencia, ',' order by created_at) into v_txt
    from public.productos_calzado where descripcion in ('Guayos Predator', 'Tenis niño luces', 'Running Revolution');
  if v_txt is distinct from 'Futbol:FUT-ADID-001,Infantil:INF-BUBB-001,Tennis:TEN-NIKE-002' then
    raise exception 'FALLO: lo que era Deportivo quedó así: %', v_txt;
  end if;
  if exists (select 1 from public.productos_calzado where categoria = 'Deportivo') then
    raise exception 'FALLO: quedó calzado en Deportivo';
  end if;

  -- La referencia del proveedor se conserva y la otra talla toma esa misma.
  select string_agg(referencia, ',' order by talla) into v_txt from public.productos_calzado where descripcion = 'Clásico cuero';
  if v_txt is distinct from 'VR-77,VR-77' then raise exception 'FALLO: el clásico quedó con %', v_txt; end if;

  -- El siguiente Tennis Nike nuevo sigue la cuenta.
  insert into public.productos_calzado (descripcion, marca, categoria, talla, color, precio_minimo, stock_actual, stock_minimo)
    values ('Air Force', 'Nike', 'Tennis', '40', 'Blanco', 200000, 1, 1);
  select referencia into v_txt from public.productos_calzado where descripcion = 'Air Force';
  if v_txt is distinct from 'TEN-NIKE-003' then raise exception 'FALLO: el siguiente Tennis Nike quedó con %', v_txt; end if;

  raise exception 'MIGRACION_REFERENCIAS_OK_ROLLBACK';
end $$;
