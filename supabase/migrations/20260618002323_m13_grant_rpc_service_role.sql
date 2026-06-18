-- M13 fix: la Edge Function enviar-reporte-diario corre como service_role y necesita
-- ejecutar el RPC del reporte (antes solo estaba concedido a authenticated → 500).
grant execute on function public.obtener_reporte_diario(date) to service_role;
