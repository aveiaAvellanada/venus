-- Historial de acciones (PRD §2: "TODA acción queda registrada con quién la
-- hizo, cuándo, y qué cambió"; el dueño ve el historial de cada empleado).
--
-- Hasta ahora solo había created_by/updated_by: quién creó y quién editó por
-- última vez, sin los cambios intermedios ni el valor anterior. Ahora cada
-- crear/editar/borrar de las tablas del negocio deja una fila en
-- public.auditoria, escrita por un trigger (nadie la escribe ni la corrige a
-- mano) y legible solo por el dueño. Es la base del "Historial de acciones" del
-- panel web (docs/panel-web.md, C2).
--
-- - editar guarda solo las columnas que cambiaron (antes y después); crear y
--   borrar guardan la fila completa. updated_at/updated_by no cuentan como
--   cambio: un UPDATE que solo los toca no deja rastro.
-- - usuario_id = auth.uid(); NULL = el sistema (Edge Functions, cron).
-- - Sin FK a users a propósito: el registro nunca debe impedir una venta.
-- - Tabla nueva del negocio = agregarle el trigger aquí o en su migración (el
--   test auditoria_test.sql falla si una tabla de public no lo tiene y no está
--   en la lista de excluidas).

create table if not exists public.auditoria (
  id          bigint generated always as identity primary key,
  creado_at   timestamptz not null default now(),
  usuario_id  uuid,
  tabla       text not null,
  registro_id text,
  accion      text not null check (accion in ('crear', 'editar', 'borrar')),
  antes       jsonb,
  despues     jsonb
);
comment on table public.auditoria is
  'Historial de acciones: quién (usuario_id, NULL = sistema), cuándo, qué tabla/registro y qué cambió. Solo lo escribe private.registrar_auditoria().';

create index if not exists auditoria_creado_at_idx on public.auditoria (creado_at desc);
create index if not exists auditoria_usuario_idx on public.auditoria (usuario_id, creado_at desc);
create index if not exists auditoria_registro_idx on public.auditoria (tabla, registro_id);

alter table public.auditoria enable row level security;
drop policy if exists auditoria_select_dueno on public.auditoria;
create policy auditoria_select_dueno on public.auditoria
  for select to authenticated using ((select private.es_dueno()));
revoke all on public.auditoria from anon, authenticated;
grant select on public.auditoria to authenticated;

create or replace function private.registrar_auditoria()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_ignorar constant text[] := array['updated_at', 'updated_by'];
  v_antes   jsonb;
  v_despues jsonb;
begin
  if tg_op = 'INSERT' then
    v_despues := to_jsonb(new) - v_ignorar;
  elsif tg_op = 'DELETE' then
    v_antes := to_jsonb(old) - v_ignorar;
  else
    select jsonb_object_agg(n.key, o.value), jsonb_object_agg(n.key, n.value)
      into v_antes, v_despues
      from jsonb_each(to_jsonb(new)) n
      join jsonb_each(to_jsonb(old)) o on o.key = n.key
      where n.value is distinct from o.value and n.key <> all (v_ignorar);
    if v_despues is null then
      return null;
    end if;
  end if;

  insert into public.auditoria (usuario_id, tabla, registro_id, accion, antes, despues)
  values (
    auth.uid(),
    tg_table_name,
    coalesce(to_jsonb(new) ->> 'id', to_jsonb(old) ->> 'id'),
    case tg_op when 'INSERT' then 'crear' when 'UPDATE' then 'editar' else 'borrar' end,
    v_antes,
    v_despues
  );
  return null;
end;
$$;

-- Tablas del negocio. Fuera a propósito: auditoria (ella misma),
-- historial_precios_* y cierres_caja_reaperturas (ya son historiales, y su
-- origen —el producto o el cierre— se audita), reporte_envios y clima_registro
-- (registros del sistema).
do $$
declare t text;
begin
  foreach t in array array[
    'users', 'empleado_config', 'empleado_dias_trabajados', 'empleado_pagos',
    'productos_calzado', 'productos_varios',
    'proveedores', 'proveedor_cuentas_bancarias',
    'compras', 'compra_items', 'compra_pagos', 'compra_documentos',
    'gastos_fijos', 'gastos_fijos_pagos', 'gastos_variables',
    'ventas', 'venta_items', 'metodos_pago_venta', 'devoluciones', 'devolucion_items',
    'cierres_caja', 'caja_config', 'reporte_config'
  ] loop
    execute format('drop trigger if exists trg_%1$s_auditoria on public.%1$I', t);
    execute format(
      'create trigger trg_%1$s_auditoria after insert or update or delete on public.%1$I
         for each row execute function private.registrar_auditoria()', t);
  end loop;
end $$;
