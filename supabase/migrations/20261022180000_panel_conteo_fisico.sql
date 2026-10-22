-- Panel web, fase 2, entrega 1 (Conteo físico; docs/panel-web-fase2.md, A4):
--
-- Toma de inventario: el dueño cuenta lo que hay en la tienda (por categoría,
-- marca o todo), el panel lo compara contra el sistema y, al confirmar, el
-- stock queda igual a lo contado. Cada diferencia lleva su motivo.
--
-- conteos_inventario: un conteo confirmado (alcance, nota, quién, cuándo y
--   totales). conteo_items: cada talla contada, con lo que decía el sistema,
--   lo contado y, si no coinciden, el motivo del ajuste. Las tallas que
--   coincidieron también quedan: así se sabe qué se contó. Las filas con
--   diferencia son los ajustes de inventario (el kardex los leerá de aquí).
--
-- registrar_conteo(p_conteo jsonb, p_clave_idempotencia uuid): todo o nada.
--   - items: [{producto_id, sistema, contado, motivo, nota}]. `sistema` es el
--     stock que la pantalla mostraba al contar. Si el stock cambió desde
--     entonces (una venta o devolución mientras se contaba), NO se guarda nada
--     y se devuelve la lista de tallas que cambiaron con su stock de ahora,
--     para volver a contarlas: así un ajuste nunca pisa una venta.
--   - Motivos: 'error' (error de registro), 'perdida' (pérdida o robo),
--     'dano' (daño o defecto) y 'otro' (con nota obligatoria). Pérdida y daño
--     solo explican faltantes.
--   - El stock nunca queda negativo: lo contado es un entero, 0 o más.
--   - Idempotente con p_clave_idempotencia: reintentar tras un corte de red
--     devuelve el mismo conteo sin ajustar dos veces.
-- Permiso: `inventario`. Las tablas solo se leen (con `inventario`); se
-- escriben únicamente con la RPC. Todo queda en el historial de acciones
-- (conteo, ítems y el cambio de stock de cada producto).

create table if not exists public.conteos_inventario (
  id                  uuid primary key default gen_random_uuid(),
  alcance             text not null,
  nota                text,
  tallas_contadas     int not null check (tallas_contadas > 0),
  tallas_ajustadas    int not null check (tallas_ajustadas >= 0),
  unidades_sobrantes  int not null default 0 check (unidades_sobrantes >= 0),
  unidades_faltantes  int not null default 0 check (unidades_faltantes >= 0),
  clave_idempotencia  uuid,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  created_by          uuid references public.users(id) on delete set null,
  updated_by          uuid references public.users(id) on delete set null
);
comment on table public.conteos_inventario is
  'Conteo físico confirmado (toma de inventario). Solo lo escribe registrar_conteo.';
create unique index if not exists conteos_inventario_clave_key
  on public.conteos_inventario (clave_idempotencia) where clave_idempotencia is not null;
create index if not exists conteos_inventario_created_at_idx on public.conteos_inventario (created_at desc);

create table if not exists public.conteo_items (
  id           uuid primary key default gen_random_uuid(),
  conteo_id    uuid not null references public.conteos_inventario(id) on delete restrict,
  producto_id  uuid not null references public.productos_calzado(id) on delete restrict,
  sistema      int not null check (sistema >= 0),
  contado      int not null check (contado >= 0),
  diferencia   int generated always as (contado - sistema) stored,
  motivo       text check (motivo in ('error', 'perdida', 'dano', 'otro')),
  nota         text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references public.users(id) on delete set null,
  updated_by   uuid references public.users(id) on delete set null,
  constraint conteo_items_un_producto unique (conteo_id, producto_id),
  constraint conteo_items_motivo_si_difiere check ((contado = sistema) = (motivo is null)),
  constraint conteo_items_motivo_de_faltante check (motivo not in ('perdida', 'dano') or contado < sistema),
  constraint conteo_items_otro_con_nota check (motivo is distinct from 'otro' or nullif(btrim(nota), '') is not null)
);
comment on table public.conteo_items is
  'Tallas de un conteo: stock del sistema, lo contado y el motivo si difieren (los ajustes de inventario).';
create index if not exists conteo_items_conteo_idx on public.conteo_items (conteo_id);
create index if not exists conteo_items_producto_idx on public.conteo_items (producto_id, created_at desc);

drop trigger if exists trg_conteos_inventario_audit on public.conteos_inventario;
create trigger trg_conteos_inventario_audit before insert or update on public.conteos_inventario
  for each row execute function private.set_audit_fields();
drop trigger if exists trg_conteos_inventario_updated_at on public.conteos_inventario;
create trigger trg_conteos_inventario_updated_at before update on public.conteos_inventario
  for each row execute function private.set_updated_at();
drop trigger if exists trg_conteo_items_audit on public.conteo_items;
create trigger trg_conteo_items_audit before insert or update on public.conteo_items
  for each row execute function private.set_audit_fields();
drop trigger if exists trg_conteo_items_updated_at on public.conteo_items;
create trigger trg_conteo_items_updated_at before update on public.conteo_items
  for each row execute function private.set_updated_at();

-- Historial de acciones.
drop trigger if exists trg_conteos_inventario_auditoria on public.conteos_inventario;
create trigger trg_conteos_inventario_auditoria after insert or update or delete on public.conteos_inventario
  for each row execute function private.registrar_auditoria();
drop trigger if exists trg_conteo_items_auditoria on public.conteo_items;
create trigger trg_conteo_items_auditoria after insert or update or delete on public.conteo_items
  for each row execute function private.registrar_auditoria();

-- RLS: se leen con `inventario`; nadie escribe directo (solo la RPC).
alter table public.conteos_inventario enable row level security;
alter table public.conteo_items enable row level security;
drop policy if exists conteos_inventario_select on public.conteos_inventario;
create policy conteos_inventario_select on public.conteos_inventario
  for select to authenticated using ((select private.tiene_permiso('inventario')));
drop policy if exists conteo_items_select on public.conteo_items;
create policy conteo_items_select on public.conteo_items
  for select to authenticated using ((select private.tiene_permiso('inventario')));
revoke all on public.conteos_inventario from anon, authenticated;
revoke all on public.conteo_items from anon, authenticated;
grant select on public.conteos_inventario to authenticated;
grant select on public.conteo_items to authenticated;

create or replace function public.registrar_conteo(p_conteo jsonb, p_clave_idempotencia uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_alcance    text := nullif(btrim(p_conteo ->> 'alcance'), '');
  v_nota       text := nullif(btrim(p_conteo ->> 'nota'), '');
  v_items      jsonb := p_conteo -> 'items';
  v_conteo     uuid;
  v_ids        uuid[] := '{}';
  v_cambiados  jsonb := '[]';
  v_ajustadas  int := 0;
  v_sobrantes  int := 0;
  v_faltantes  int := 0;
  it           jsonb;
  v_pid        uuid;
  v_sistema    numeric;
  v_contado    numeric;
  v_motivo     text;
  v_nota_item  text;
  v_nombre     text;
  v_actual     record;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if not private.tiene_permiso('inventario') then
    raise exception 'No tienes permiso para ajustar el inventario.';
  end if;

  -- Reintento de un conteo que ya se guardó: el mismo, sin ajustar otra vez.
  if p_clave_idempotencia is not null then
    select id into v_conteo from public.conteos_inventario where clave_idempotencia = p_clave_idempotencia;
    if found then
      return jsonb_build_object('aplicado', true, 'repetido', true, 'conteo_id', v_conteo);
    end if;
  end if;

  if jsonb_typeof(v_items) is distinct from 'array' or jsonb_array_length(v_items) = 0 then
    raise exception 'El conteo no tiene tallas contadas.';
  end if;
  if jsonb_array_length(v_items) > 5000 then
    raise exception 'Máximo 5000 tallas por conteo. Divídelo por categoría.';
  end if;

  -- Primera pasada: validar, bloquear cada talla y ver si su stock cambió.
  for it in select value from jsonb_array_elements(v_items) loop
    v_pid := (it ->> 'producto_id')::uuid;
    v_sistema := (it ->> 'sistema')::numeric;
    v_contado := (it ->> 'contado')::numeric;
    v_motivo := nullif(btrim(it ->> 'motivo'), '');
    v_nota_item := nullif(btrim(it ->> 'nota'), '');

    select id, referencia, descripcion, color, talla, stock_actual into v_actual
      from public.productos_calzado where id = v_pid for update;
    if not found then
      raise exception 'Una de las tallas contadas ya no existe. Recarga la página.';
    end if;
    v_nombre := concat_ws(' ', coalesce(v_actual.referencia, v_actual.descripcion), v_actual.color,
                          'talla ' || coalesce(v_actual.talla, 'única'));

    if v_pid = any (v_ids) then
      raise exception '% viene dos veces en el conteo.', v_nombre;
    end if;
    v_ids := v_ids || v_pid;
    if v_contado is null or v_contado < 0 or v_contado <> trunc(v_contado) then
      raise exception '%: lo contado debe ser un número entero, 0 o más.', v_nombre;
    end if;
    if v_sistema is null or v_sistema < 0 or v_sistema <> trunc(v_sistema) then
      raise exception '%: falta el stock que mostraba el sistema al contar.', v_nombre;
    end if;

    if v_contado = v_sistema then
      if v_motivo is not null then
        raise exception '%: no tiene diferencia, no lleva motivo.', v_nombre;
      end if;
    else
      if v_motivo is null or v_motivo not in ('error', 'perdida', 'dano', 'otro') then
        raise exception '%: elige el motivo de la diferencia.', v_nombre;
      end if;
      if v_motivo in ('perdida', 'dano') and v_contado > v_sistema then
        raise exception '%: sobran pares; pérdida o daño solo explican faltantes.', v_nombre;
      end if;
      if v_motivo = 'otro' and v_nota_item is null then
        raise exception '%: con el motivo "Otro" escribe una nota.', v_nombre;
      end if;
    end if;

    if v_actual.stock_actual <> v_sistema then
      v_cambiados := v_cambiados || jsonb_build_object(
        'producto_id', v_pid, 'sistema_antes', v_sistema::int, 'sistema_ahora', v_actual.stock_actual);
    end if;
  end loop;

  -- El stock se movió mientras se contaba: no se toca nada.
  if jsonb_array_length(v_cambiados) > 0 then
    return jsonb_build_object('aplicado', false, 'cambiados', v_cambiados);
  end if;

  insert into public.conteos_inventario (alcance, nota, tallas_contadas, tallas_ajustadas, clave_idempotencia)
    values (coalesce(v_alcance, 'Sin alcance'), v_nota, jsonb_array_length(v_items), 0, p_clave_idempotencia)
    returning id into v_conteo;

  for it in select value from jsonb_array_elements(v_items) loop
    v_pid := (it ->> 'producto_id')::uuid;
    v_sistema := (it ->> 'sistema')::numeric;
    v_contado := (it ->> 'contado')::numeric;
    v_motivo := nullif(btrim(it ->> 'motivo'), '');
    v_nota_item := nullif(btrim(it ->> 'nota'), '');

    insert into public.conteo_items (conteo_id, producto_id, sistema, contado, motivo, nota)
      values (v_conteo, v_pid, v_sistema::int, v_contado::int, v_motivo, v_nota_item);

    if v_contado <> v_sistema then
      update public.productos_calzado set stock_actual = v_contado::int where id = v_pid;
      v_ajustadas := v_ajustadas + 1;
      if v_contado > v_sistema then
        v_sobrantes := v_sobrantes + (v_contado - v_sistema)::int;
      else
        v_faltantes := v_faltantes + (v_sistema - v_contado)::int;
      end if;
    end if;
  end loop;

  update public.conteos_inventario
    set tallas_ajustadas = v_ajustadas, unidades_sobrantes = v_sobrantes, unidades_faltantes = v_faltantes
    where id = v_conteo;

  return jsonb_build_object(
    'aplicado', true, 'repetido', false, 'conteo_id', v_conteo,
    'tallas_contadas', jsonb_array_length(v_items), 'tallas_ajustadas', v_ajustadas,
    'unidades_sobrantes', v_sobrantes, 'unidades_faltantes', v_faltantes);
end;
$$;

revoke all on function public.registrar_conteo(jsonb, uuid) from public, anon;
grant execute on function public.registrar_conteo(jsonb, uuid) to authenticated;
