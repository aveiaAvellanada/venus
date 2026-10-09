-- Seguridad 2/4: la caja se abre, cierra y reabre solo vía RPC.
--
-- Antes, todos los roles podían hacer UPDATE directo sobre el cierre del día
-- (totales, diferencia, estado) y el teléfono calculaba y enviaba los totales;
-- la administrativa además podía borrar cierres. Reabrir la caja borraba el
-- conteo y la diferencia del cierre anterior sin dejar rastro, y no limpiaba
-- cerrado_por (el segundo cierre quedaba a nombre de quien cerró primero).
--
-- Ahora el servidor calcula totales y diferencia, exige justificación si hay
-- diferencia y guarda cada cierre deshecho en cierres_caja_reaperturas.
-- El caja-scheduler (Edge Function, service_role) sigue escribiendo directo.

-- 1. Historial de reaperturas (snapshot del cierre que se deshizo)
create table if not exists public.cierres_caja_reaperturas (
  id               uuid primary key default gen_random_uuid(),
  cierre_id        uuid not null references public.cierres_caja(id) on delete restrict,
  fecha            date not null,
  modo             text not null,
  cierre_at        timestamptz,
  cerrado_por      uuid references public.users(id) on delete set null,
  total_ventas     integer not null,
  total_general    numeric(12,2) not null,
  total_efectivo   numeric(12,2) not null,
  total_nequi      numeric(12,2) not null,
  total_bre_b      numeric(12,2) not null,
  total_otro       numeric(12,2) not null,
  efectivo_contado numeric(12,2),
  diferencia       numeric(12,2),
  diferencia_nota  text,
  reabierta_por    uuid references public.users(id) on delete set null,
  reabierta_at     timestamptz not null default now()
);
comment on table public.cierres_caja_reaperturas is
  'Cierres de caja deshechos al reabrir: conserva el conteo, la diferencia y quién reabrió.';
create index if not exists idx_cierres_reaperturas_cierre on public.cierres_caja_reaperturas(cierre_id);

alter table public.cierres_caja_reaperturas enable row level security;
drop policy if exists cierres_reaperturas_select on public.cierres_caja_reaperturas;
create policy cierres_reaperturas_select on public.cierres_caja_reaperturas for select to authenticated
  using ((select private.is_staff_admin()));
revoke all on public.cierres_caja_reaperturas from anon, authenticated;
grant select on public.cierres_caja_reaperturas to authenticated;
grant select, insert, update, delete on public.cierres_caja_reaperturas to service_role;

-- 2. cierres_caja: sin escritura directa desde la app
drop policy if exists cierres_insert on public.cierres_caja;
drop policy if exists cierres_update on public.cierres_caja;
drop policy if exists cierres_delete on public.cierres_caja;
drop policy if exists cierres_delete_owner on public.cierres_caja;
revoke insert, update, delete on public.cierres_caja from anon, authenticated;
grant select on public.cierres_caja to authenticated;

-- 3. RPCs
create or replace function public.abrir_caja()
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
  if found then
    if v_caja.estado = 'cerrada' then
      raise exception 'La caja de hoy ya se cerró. Usa "Abrir caja de nuevo".';
    end if;
    return v_caja;
  end if;

  insert into public.cierres_caja (fecha, estado, modo, apertura_at)
    values (v_hoy, 'abierta', 'manual', now())
    on conflict (fecha) do nothing
    returning * into v_caja;
  if v_caja.id is null then
    -- Otro teléfono la abrió en el mismo instante.
    select * into v_caja from public.cierres_caja where fecha = v_hoy;
  end if;
  return v_caja;
end;
$$;

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

  if v_contado is not null then
    v_diferencia := v_contado - (v_res->>'total_efectivo')::numeric;
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
    efectivo_contado = v_contado,
    diferencia       = v_diferencia,
    diferencia_nota  = case when v_diferencia <> 0 then v_nota end
  where id = v_caja.id
  returning * into v_caja;
  -- cerrado_por lo fija el trigger trg_cierres_set_cerrado_por (auth.uid()).
  return v_caja;
end;
$$;

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
    efectivo_contado, diferencia, diferencia_nota, reabierta_por)
  values (
    v_caja.id, v_caja.fecha, v_caja.modo, v_caja.cierre_at, v_caja.cerrado_por,
    v_caja.total_ventas, v_caja.total_general, v_caja.total_efectivo, v_caja.total_nequi,
    v_caja.total_bre_b, v_caja.total_otro,
    v_caja.efectivo_contado, v_caja.diferencia, v_caja.diferencia_nota, auth.uid());

  update public.cierres_caja set
    estado           = 'abierta',
    cierre_at        = null,
    cerrado_por      = null,
    efectivo_contado = null,
    diferencia       = null,
    diferencia_nota  = null
  where id = v_caja.id
  returning * into v_caja;
  return v_caja;
end;
$$;

revoke all on function public.abrir_caja() from public, anon;
revoke all on function public.cerrar_caja(numeric, text) from public, anon;
revoke all on function public.reabrir_caja() from public, anon;
grant execute on function public.abrir_caja() to authenticated;
grant execute on function public.cerrar_caja(numeric, text) to authenticated;
grant execute on function public.reabrir_caja() to authenticated;
