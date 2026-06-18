-- El caja-scheduler (Edge Function con service_role) abre/cierra cierres_caja.
-- service_role bypassa RLS, pero necesita el privilegio de tabla, que faltaba.
grant select, insert, update, delete on public.cierres_caja to service_role;
