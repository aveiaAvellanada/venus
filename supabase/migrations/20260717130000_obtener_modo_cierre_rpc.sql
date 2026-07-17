-- caja_config tiene RLS de SELECT solo-dueño (private.is_owner()), pero TODOS
-- los roles cierran caja a diario y necesitan saber el modo de cierre
-- configurado. Sin esto, obtenerModoCierre() falla por RLS para admin/empleado
-- y "cerrar según el modo configurado" cae siempre al conteo manual para
-- justamente quienes cierran la caja.
--
-- Expone SOLO el campo modo_cierre (no sensible) vía una función
-- SECURITY DEFINER, sin abrir el resto de caja_config a otros roles.
create or replace function public.obtener_modo_cierre()
returns text
language sql
security definer
set search_path = ''
stable
as $$
  select coalesce(
    (select modo_cierre from public.caja_config order by created_at limit 1),
    'con_diferencia'
  );
$$;

revoke all on function public.obtener_modo_cierre() from public;
grant execute on function public.obtener_modo_cierre() to authenticated;
