-- M8 Gestión de Empleados: auditoría de registrado_por + RPC de días trabajados.
-- NO recrea empleado_config/empleado_dias_trabajados/empleado_pagos (ya existen con RLS owner-only).

-- 1. Auditoría inviolable de registrado_por (las tablas hoy solo tienen trigger updated_at)
create or replace function private.set_registrado_por()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.registrado_por := auth.uid();
  return new;
end;
$$;

drop trigger if exists trg_empleado_pagos_registrado_por on public.empleado_pagos;
create trigger trg_empleado_pagos_registrado_por
  before insert on public.empleado_pagos
  for each row execute function private.set_registrado_por();

drop trigger if exists trg_empleado_dias_registrado_por on public.empleado_dias_trabajados;
create trigger trg_empleado_dias_registrado_por
  before insert on public.empleado_dias_trabajados
  for each row execute function private.set_registrado_por();

-- 2. RPC: días trabajados del mes (ventas ∪ cierres ∪ manuales 'trabajado') − 'ausente'
create or replace function public.obtener_dias_trabajados(
  p_empleado_id uuid, p_anio int, p_mes int
) returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count int;
begin
  if not private.is_owner() then
    raise exception 'Solo el dueño puede consultar días trabajados';
  end if;

  with dias as (
    select distinct (v.created_at at time zone 'America/Bogota')::date as d
    from public.ventas v
    where v.created_by = p_empleado_id
      and extract(year  from (v.created_at at time zone 'America/Bogota'))::int = p_anio
      and extract(month from (v.created_at at time zone 'America/Bogota'))::int = p_mes
    union
    select distinct c.fecha
    from public.cierres_caja c
    where (c.created_by = p_empleado_id or c.cerrado_por = p_empleado_id)
      and extract(year from c.fecha)::int = p_anio
      and extract(month from c.fecha)::int = p_mes
    union
    select distinct m.fecha
    from public.empleado_dias_trabajados m
    where m.empleado_id = p_empleado_id and m.tipo = 'trabajado'
      and extract(year from m.fecha)::int = p_anio
      and extract(month from m.fecha)::int = p_mes
  ),
  ausentes as (
    select distinct m.fecha as d
    from public.empleado_dias_trabajados m
    where m.empleado_id = p_empleado_id and m.tipo = 'ausente'
      and extract(year from m.fecha)::int = p_anio
      and extract(month from m.fecha)::int = p_mes
  )
  select count(*) into v_count from dias where d not in (select d from ausentes);

  return coalesce(v_count, 0);
end;
$$;

revoke all on function public.obtener_dias_trabajados(uuid, int, int) from public;
grant execute on function public.obtener_dias_trabajados(uuid, int, int) to authenticated;
