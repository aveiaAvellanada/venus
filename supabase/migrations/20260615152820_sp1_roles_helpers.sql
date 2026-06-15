-- SP-1: tercer rol 'admin' + helpers de nivel administrativo.

alter table public.users drop constraint if exists users_rol_check;
alter table public.users add constraint users_rol_check check (rol in ('dueno','admin','empleado'));

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.user_role() = 'admin', false)
$$;

create or replace function private.is_staff_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.user_role() in ('dueno','admin'), false)
$$;

grant execute on function private.is_admin(), private.is_staff_admin() to authenticated, service_role;
