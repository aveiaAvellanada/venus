-- Caja: configuración de horarios del modo automático (singleton, solo dueño).
create table if not exists public.caja_config (
  id              uuid primary key default gen_random_uuid(),
  modo_automatico boolean not null default false,
  hora_apertura   time,
  hora_cierre     time,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.users(id) on delete set null,
  updated_by      uuid references public.users(id) on delete set null
);

drop trigger if exists trg_caja_config_audit on public.caja_config;
create trigger trg_caja_config_audit before insert or update on public.caja_config
  for each row execute function private.set_audit_fields();
drop trigger if exists trg_caja_config_updated_at on public.caja_config;
create trigger trg_caja_config_updated_at before update on public.caja_config
  for each row execute function private.set_updated_at();

alter table public.caja_config enable row level security;
drop policy if exists caja_config_sel on public.caja_config;
drop policy if exists caja_config_upd on public.caja_config;
create policy caja_config_sel on public.caja_config for select to authenticated using (private.is_owner());
create policy caja_config_upd on public.caja_config for update to authenticated using (private.is_owner()) with check (private.is_owner());

revoke insert, update, delete on public.caja_config from authenticated;
grant select on public.caja_config to authenticated;
grant update on public.caja_config to authenticated;
grant select, insert, update, delete on public.caja_config to service_role;

insert into public.caja_config (modo_automatico) values (false);
