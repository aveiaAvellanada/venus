-- Audita quién cerró la caja. Manual: auth.uid(); automático (service_role): null = "sistema".
create or replace function private.set_cerrado_por()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.estado = 'cerrada' and old.estado is distinct from 'cerrada'
     and new.cerrado_por is null then
    new.cerrado_por := auth.uid();
  end if;
  return new;
end $$;

drop trigger if exists trg_cierres_set_cerrado_por on public.cierres_caja;
create trigger trg_cierres_set_cerrado_por before update on public.cierres_caja
  for each row execute function private.set_cerrado_por();
