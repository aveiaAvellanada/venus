-- Caja: base inicial y gastos pagados con plata del cajón en el arqueo.
--
-- El efectivo esperado del cierre era solo el efectivo de las ventas. La
-- tienda abre con una base de sencillo y algunos gastos salen del cajón, así
-- que el cierre siempre "descuadraba". Ahora:
--   efectivo esperado = base inicial + efectivo de ventas − gastos del cajón
-- y el cierre guarda la base y los gastos del cajón (también al reabrir).
--
-- - caja_config.base_predeterminada (la fija Andrés) se propone al abrir y la
--   toma sola la apertura automática del caja-scheduler (trigger, sin tocar la
--   Edge Function).
-- - gastos_variables.pagado_de_caja marca los gastos que salieron del cajón.
--   Solo se registran, corrigen o borran con la caja del día abierta y con la
--   fecha de hoy, para que el cierre guardado no quede desactualizado.

-- 1. Base de caja
alter table public.caja_config
  add column if not exists base_predeterminada numeric(12,2) not null default 0
    check (base_predeterminada >= 0);

alter table public.cierres_caja
  add column if not exists base_inicial numeric(12,2) not null default 0 check (base_inicial >= 0),
  add column if not exists gastos_caja numeric(12,2) not null default 0 check (gastos_caja >= 0);
-- Sin default: si quien inserta no la indica, el trigger pone la predeterminada.
alter table public.cierres_caja alter column base_inicial drop default;

alter table public.cierres_caja_reaperturas
  add column if not exists base_inicial numeric(12,2) not null default 0,
  add column if not exists gastos_caja numeric(12,2) not null default 0;

create or replace function private.cierre_base_predeterminada()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.base_inicial is null then
    new.base_inicial := coalesce(
      (select base_predeterminada from public.caja_config order by created_at limit 1), 0);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cierres_base_inicial on public.cierres_caja;
create trigger trg_cierres_base_inicial before insert on public.cierres_caja
  for each row execute function private.cierre_base_predeterminada();

-- 2. Gastos del cajón
alter table public.gastos_variables
  add column if not exists pagado_de_caja boolean not null default false;
comment on column public.gastos_variables.pagado_de_caja is
  'true = se pagó con efectivo del cajón: se resta del efectivo esperado en el cierre del día.';

create or replace function private.gasto_del_cajon_exige_caja_abierta()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_hoy   date := private.hoy_bogota();
  v_nuevo boolean := false;  -- la fila nueva saca plata del cajón hoy
  v_viejo boolean := false;  -- la fila anterior la sacaba
begin
  if tg_op = 'UPDATE'
     and (old.pagado_de_caja, old.fecha, old.monto) is not distinct from (new.pagado_de_caja, new.fecha, new.monto) then
    return new;  -- no cambia nada del arqueo
  end if;

  if tg_op in ('INSERT', 'UPDATE') and new.pagado_de_caja then
    if new.fecha <> v_hoy then
      raise exception 'Un gasto pagado con plata del cajón debe tener la fecha de hoy.';
    end if;
    v_nuevo := true;
  end if;
  if tg_op in ('UPDATE', 'DELETE') then
    v_viejo := old.pagado_de_caja and old.fecha = v_hoy;
  end if;

  if v_nuevo or v_viejo then
    -- FOR SHARE: igual que ventas, un cierre en curso espera a este gasto.
    perform 1 from public.cierres_caja
      where fecha = v_hoy and estado = 'abierta'
      for share;
    if not found then
      raise exception 'La caja de hoy no está abierta: no se puede mover un gasto pagado con plata del cajón.';
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_gastos_variables_caja on public.gastos_variables;
create trigger trg_gastos_variables_caja before insert or update or delete on public.gastos_variables
  for each row execute function private.gasto_del_cajon_exige_caja_abierta();

-- 3. Arqueo: una sola fórmula para la pantalla de cierre y para cerrar_caja
create or replace function private.arqueo_caja(p_fecha date)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_base   numeric(12,2);
  v_ventas numeric(12,2);
  v_gastos numeric(12,2);
begin
  select base_inicial into v_base from public.cierres_caja where fecha = p_fecha;
  v_base := coalesce(v_base, 0);
  v_ventas := (public.obtener_resumen_dia(p_fecha)->>'total_efectivo')::numeric;
  select coalesce(sum(monto), 0) into v_gastos
    from public.gastos_variables
    where fecha = p_fecha and pagado_de_caja;
  return json_build_object(
    'base_inicial', v_base,
    'efectivo_ventas', v_ventas,
    'gastos_caja', v_gastos,
    'efectivo_esperado', v_base + v_ventas - v_gastos);
end;
$$;

create or replace function public.obtener_arqueo_caja()
returns json language plpgsql security definer set search_path = '' as $$
begin
  if private.user_role() is null then
    raise exception 'No autorizado';
  end if;
  return private.arqueo_caja(private.hoy_bogota());
end;
$$;

-- Todos los roles abren caja y necesitan la base propuesta (caja_config es solo-dueño).
create or replace function public.obtener_base_predeterminada()
returns numeric language sql security definer set search_path = '' stable as $$
  select coalesce((select base_predeterminada from public.caja_config order by created_at limit 1), 0)
$$;

-- 4. abrir_caja recibe la base (opcional: sin ella, la predeterminada)
drop function if exists public.abrir_caja();
create function public.abrir_caja(p_base_inicial numeric default null)
returns public.cierres_caja
language plpgsql security definer set search_path = ''
as $$
declare
  v_hoy  date := private.hoy_bogota();
  v_caja public.cierres_caja;
begin
  if private.user_role() is null then
    raise exception 'No autorizado';
  end if;
  if p_base_inicial < 0 then
    raise exception 'La base de caja no puede ser negativa.';
  end if;

  select * into v_caja from public.cierres_caja where fecha = v_hoy for update;
  if found then
    if v_caja.estado = 'cerrada' then
      raise exception 'La caja de hoy ya se cerró. Usa "Abrir caja de nuevo".';
    end if;
    return v_caja;
  end if;

  -- base_inicial null => trg_cierres_base_inicial pone la predeterminada.
  insert into public.cierres_caja (fecha, estado, modo, apertura_at, base_inicial)
    values (v_hoy, 'abierta', 'manual', now(), round(p_base_inicial, 2))
    on conflict (fecha) do nothing
    returning * into v_caja;
  if v_caja.id is null then
    -- Otro teléfono la abrió en el mismo instante.
    select * into v_caja from public.cierres_caja where fecha = v_hoy;
  end if;
  return v_caja;
end;
$$;

-- 5. cerrar_caja: diferencia contra el arqueo completo
create or replace function public.cerrar_caja(
  p_efectivo_contado numeric default null,
  p_nota text default null
)
returns public.cierres_caja
language plpgsql security definer set search_path = ''
as $$
declare
  v_hoy        date := private.hoy_bogota();
  v_caja       public.cierres_caja;
  v_modo       text;
  v_res        json;
  v_arqueo     json;
  v_contado    numeric(12,2) := round(p_efectivo_contado, 2);
  v_diferencia numeric(12,2);
  v_nota       text := nullif(btrim(coalesce(p_nota, '')), '');
begin
  if private.user_role() is null then
    raise exception 'No autorizado';
  end if;

  select * into v_caja from public.cierres_caja where fecha = v_hoy for update;
  if not found then
    raise exception 'No hay caja abierta para cerrar hoy.';
  end if;
  if v_caja.estado = 'cerrada' then
    raise exception 'La caja de hoy ya se cerró.';
  end if;

  v_modo := public.obtener_modo_cierre();
  if v_contado is null and v_modo = 'con_diferencia' then
    raise exception 'Debes contar el efectivo para cerrar la caja.';
  end if;
  if v_contado < 0 then
    raise exception 'El efectivo contado no puede ser negativo.';
  end if;

  v_res := public.obtener_resumen_dia(v_hoy);
  v_arqueo := private.arqueo_caja(v_hoy);

  if v_contado is not null then
    v_diferencia := v_contado - (v_arqueo->>'efectivo_esperado')::numeric;
    if v_diferencia <> 0 and v_nota is null then
      raise exception 'Como hay diferencia, debes ingresar una justificación.';
    end if;
  end if;

  update public.cierres_caja set
    estado           = 'cerrada',
    cierre_at        = now(),
    total_ventas     = (v_res->>'total_ventas')::int,
    total_general    = (v_res->>'total_general')::numeric,
    total_efectivo   = (v_res->>'total_efectivo')::numeric,
    total_nequi      = (v_res->>'total_nequi')::numeric,
    total_bre_b      = (v_res->>'total_bre_b')::numeric,
    total_otro       = (v_res->>'total_otro')::numeric,
    gastos_caja      = (v_arqueo->>'gastos_caja')::numeric,
    efectivo_contado = v_contado,
    diferencia       = v_diferencia,
    diferencia_nota  = case when v_diferencia <> 0 then v_nota end
  where id = v_caja.id
  returning * into v_caja;
  -- cerrado_por lo fija el trigger trg_cierres_set_cerrado_por (auth.uid()).
  return v_caja;
end;
$$;

-- 6. reabrir_caja: el snapshot incluye base y gastos del cajón
create or replace function public.reabrir_caja()
returns public.cierres_caja
language plpgsql security definer set search_path = ''
as $$
declare
  v_hoy  date := private.hoy_bogota();
  v_caja public.cierres_caja;
begin
  if private.user_role() is null then
    raise exception 'No autorizado';
  end if;

  select * into v_caja from public.cierres_caja where fecha = v_hoy for update;
  if not found then
    raise exception 'No hay caja de hoy para reabrir.';
  end if;
  if v_caja.estado = 'abierta' then
    return v_caja;
  end if;

  insert into public.cierres_caja_reaperturas (
    cierre_id, fecha, modo, cierre_at, cerrado_por,
    total_ventas, total_general, total_efectivo, total_nequi, total_bre_b, total_otro,
    base_inicial, gastos_caja,
    efectivo_contado, diferencia, diferencia_nota, reabierta_por)
  values (
    v_caja.id, v_caja.fecha, v_caja.modo, v_caja.cierre_at, v_caja.cerrado_por,
    v_caja.total_ventas, v_caja.total_general, v_caja.total_efectivo, v_caja.total_nequi,
    v_caja.total_bre_b, v_caja.total_otro,
    v_caja.base_inicial, v_caja.gastos_caja,
    v_caja.efectivo_contado, v_caja.diferencia, v_caja.diferencia_nota, auth.uid());

  update public.cierres_caja set
    estado           = 'abierta',
    cierre_at        = null,
    cerrado_por      = null,
    gastos_caja      = 0,
    efectivo_contado = null,
    diferencia       = null,
    diferencia_nota  = null
  where id = v_caja.id
  returning * into v_caja;
  return v_caja;
end;
$$;

-- 7. Permisos (las funciones nuevas no nacen ejecutables: 20261009120300)
revoke all on function public.abrir_caja(numeric) from public, anon;
revoke all on function public.obtener_arqueo_caja() from public, anon;
revoke all on function public.obtener_base_predeterminada() from public, anon;
grant execute on function public.abrir_caja(numeric) to authenticated;
grant execute on function public.obtener_arqueo_caja() to authenticated;
grant execute on function public.obtener_base_predeterminada() to authenticated;
