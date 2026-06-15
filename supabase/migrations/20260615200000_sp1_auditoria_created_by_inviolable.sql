-- SP-1: endurecer auditoría — created_by inviolable en INSERT.
-- Antes el trigger solo asignaba created_by "si venía null", lo que permitía a un
-- usuario autenticado falsificar la autoría (p. ej. en productos_calzado/ventas, cuyas
-- políticas de INSERT no validan created_by). Ahora el trigger SIEMPRE lo fija desde
-- auth.uid() en INSERT, garantizando "quién hizo la acción" (CLAUDE.md / PRD v4.0).
-- Ningún código de la app envía created_by explícitamente; la RPC registrar_venta
-- (SECURITY DEFINER) sigue resolviendo auth.uid() del JWT del vendedor real.

create or replace function private.set_audit_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.created_by := auth.uid();
  elsif tg_op = 'UPDATE' then
    new.updated_by := auth.uid();
  end if;
  return new;
end $$;
