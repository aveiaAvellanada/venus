-- OBSOLETO desde 20261009150000_permisos_por_usuario.sql.
--
-- Este seed creaba la cuenta de Sandra con rol 'admin' buscándola por su correo
-- real. Ahora el dueño crea las cuentas desde la app (Empleados > Nuevo
-- empleado) con usuario, PIN de 6 dígitos y permisos, el correo de Auth es
-- usuario@venus.invalid y el rol 'admin' ya no existe. Re-ejecutar la versión
-- anterior DUPLICARÍA la cuenta (ya no la encontraría por el correo viejo).
do $$
begin
  raise exception 'sandra_admin.sql está obsoleto: crea las cuentas desde la app (Empleados > Nuevo empleado).';
end $$;
