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
