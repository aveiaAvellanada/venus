-- Seguridad 4/4: ninguna función de public es ejecutable sin iniciar sesión.
--
-- Postgres concede EXECUTE a PUBLIC por defecto y Supabase además lo concede a
-- anon en public. `revoke ... from public` NO quita la concesión explícita a
-- anon, y obtener_resumen_dia nunca tuvo ni eso: con solo la clave pública del
-- APK se podían leer las ventas del día, el stock bajo y la diferencia de caja
-- (obtener_resumen_dia / obtener_reporte_diario no validan el rol).
--
-- La app no llama ninguna RPC antes del login (el selector de usuarios es una
-- lista fija), así que anon no necesita ninguna.

revoke execute on all functions in schema public from public, anon;

-- Las Edge Functions (service_role) usan estas dos; se concede explícito para no
-- depender de privilegios por defecto (la concesión de 20260618002323 no se
-- reproduce al reaplicar las migraciones desde cero).
grant execute on function public.obtener_resumen_dia(date) to service_role;
grant execute on function public.obtener_reporte_diario(date) to service_role;

-- Funciones futuras: que no nazcan ejecutables por anon ni por PUBLIC.
alter default privileges in schema public revoke execute on functions from anon;
alter default privileges revoke execute on functions from public;
