-- M13 fix: la Edge Function enviar-reporte-diario corre como service_role y necesita
-- ejecutar el RPC del reporte (antes solo estaba concedido a authenticated → 500).
--
-- Guardado: el RPC se crea en 20260618032754 (timestamp posterior), así que al
-- reaplicar las migraciones desde cero esta concesión no tiene sobre qué actuar.
-- En el remoto se aplicó con la función ya creada. La concesión definitiva vive
-- en 20261009120300_seguridad_rpc_sin_anon.sql.
do $$
begin
  if to_regprocedure('public.obtener_reporte_diario(date)') is not null then
    grant execute on function public.obtener_reporte_diario(date) to service_role;
  end if;
end $$;
