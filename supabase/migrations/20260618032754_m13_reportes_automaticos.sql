-- M13 Reportes Automáticos: config + log de envíos + RPC del reporte diario. v1.

-- Helper de formato COP (determinista: ',' es separador de grupo literal en to_char)
create or replace function private.fmt_cop(p numeric)
returns text language sql immutable set search_path = '' as $$
  select '$' || replace(to_char(round(coalesce(p,0)), 'FM999,999,999'), ',', '.')
$$;

-- Config (singleton, solo dueño)
create table if not exists public.reporte_config (
  id            uuid primary key default gen_random_uuid(),
  whatsapp_on   boolean not null default true,
  correo_on     boolean not null default false,
  correo_destino text,
  hora_envio    time,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  created_by    uuid references public.users(id) on delete set null,
  updated_by    uuid references public.users(id) on delete set null
);

-- Log de envíos (dedupe)
create table if not exists public.reporte_envios (
  id          uuid primary key default gen_random_uuid(),
  fecha       date not null,
  canal       text not null check (canal in ('correo','whatsapp')),
  enviado_at  timestamptz not null default now(),
  ok          boolean not null,
  detalle     text
);
-- Solo un envío EXITOSO por (fecha, canal); los fallos se pueden reintentar
create unique index if not exists reporte_envios_unico_ok on public.reporte_envios (fecha, canal) where ok;

-- Auditoría en config
drop trigger if exists trg_reporte_config_audit on public.reporte_config;
create trigger trg_reporte_config_audit before insert or update on public.reporte_config
  for each row execute function private.set_audit_fields();
drop trigger if exists trg_reporte_config_updated_at on public.reporte_config;
create trigger trg_reporte_config_updated_at before update on public.reporte_config
  for each row execute function private.set_updated_at();

-- RLS
alter table public.reporte_config enable row level security;
alter table public.reporte_envios enable row level security;

create policy reporte_config_sel on public.reporte_config for select to authenticated using (private.is_owner());
create policy reporte_config_upd on public.reporte_config for update to authenticated using (private.is_owner()) with check (private.is_owner());
create policy reporte_envios_sel on public.reporte_envios for select to authenticated using (private.is_owner());

revoke insert, update, delete on public.reporte_config from authenticated;
revoke insert, update, delete on public.reporte_envios from authenticated;
grant select on public.reporte_config to authenticated;
grant update on public.reporte_config to authenticated;
grant select on public.reporte_envios to authenticated;
grant select, insert, update, delete on public.reporte_config to service_role;
grant select, insert, update, delete on public.reporte_envios to service_role;

-- Sembrar la fila única de config
insert into public.reporte_config (whatsapp_on, correo_on) values (true, false);

-- RPC del reporte diario
create or replace function public.obtener_reporte_diario(p_fecha date)
returns json language plpgsql security definer set search_path = '' as $$
declare
  v_estados text[] := array['completada','devuelta_parcial','devuelta_total','cambiada_parcial','cambiada_total'];
  v_ef numeric := 0; v_ne numeric := 0; v_da numeric := 0; v_num int := 0; v_total numeric;
  v_mas_vendido text; v_stock text[]; v_stock_txt text;
  v_dif numeric; v_cuadro boolean; v_caja_existe boolean;
  v_caja_linea text; v_mensaje text;
begin
  select coalesce(sum(case when m.metodo='efectivo' then m.monto else 0 end),0),
         coalesce(sum(case when m.metodo='nequi' then m.monto else 0 end),0),
         coalesce(sum(case when m.metodo='daviplata' then m.monto else 0 end),0)
  into v_ef, v_ne, v_da
  from public.metodos_pago_venta m join public.ventas v on v.id=m.venta_id
  where v.estado=any(v_estados) and (v.created_at at time zone 'America/Bogota')::date = p_fecha;

  select v_ef - coalesce(sum(case when metodo_reembolso='efectivo' then monto_devuelto else 0 end),0) + coalesce(sum(case when metodo_cobro='efectivo' then monto_cobrado else 0 end),0),
         v_ne - coalesce(sum(case when metodo_reembolso='nequi' then monto_devuelto else 0 end),0) + coalesce(sum(case when metodo_cobro='nequi' then monto_cobrado else 0 end),0),
         v_da - coalesce(sum(case when metodo_reembolso='daviplata' then monto_devuelto else 0 end),0) + coalesce(sum(case when metodo_cobro='daviplata' then monto_cobrado else 0 end),0)
  into v_ef, v_ne, v_da
  from public.devoluciones d join public.ventas v on v.id=d.venta_id
  where (v.created_at at time zone 'America/Bogota')::date = p_fecha;

  v_total := v_ef + v_ne + v_da;

  select count(*) into v_num from public.ventas v
  where v.estado=any(v_estados) and (v.created_at at time zone 'America/Bogota')::date = p_fecha;

  select vi.descripcion_snapshot into v_mas_vendido
  from public.venta_items vi join public.ventas v on v.id=vi.venta_id
  where v.estado=any(v_estados) and (v.created_at at time zone 'America/Bogota')::date = p_fecha
  group by vi.descripcion_snapshot order by sum(vi.cantidad) desc limit 1;

  select array_agg(t.txt) into v_stock from (
    select pc.descripcion || coalesce(' · talla ' || pc.talla, '') as txt
    from public.productos_calzado pc
    where pc.activo = true and pc.stock_actual <= pc.stock_minimo
    order by pc.descripcion limit 5
  ) t;
  v_stock := coalesce(v_stock, array[]::text[]);
  v_stock_txt := case when array_length(v_stock,1) is null then 'ninguno' else array_to_string(v_stock, ', ') end;

  select (c.diferencia = 0), c.diferencia, true into v_cuadro, v_dif, v_caja_existe
  from public.cierres_caja c where c.fecha = p_fecha order by c.cierre_at desc nulls last limit 1;
  if v_caja_existe is null then
    v_caja_existe := false; v_caja_linea := '🔓 Caja sin cerrar';
  elsif v_cuadro then
    v_caja_linea := '✅ Caja cuadró';
  else
    v_caja_linea := '⚠️ Diferencia de ' || private.fmt_cop(v_dif);
  end if;

  v_mensaje :=
    '📊 Venus — Resumen del día' || E'\n' ||
    '📅 ' || to_char(p_fecha, 'YYYY-MM-DD') || E'\n\n' ||
    '💰 Total vendido: ' || private.fmt_cop(v_total) || E'\n' ||
    '🛍️ Ventas: ' || v_num || E'\n' ||
    '💵 Efectivo: ' || private.fmt_cop(v_ef) || E'\n' ||
    '📱 Nequi: ' || private.fmt_cop(v_ne) || E'\n' ||
    '📱 Daviplata: ' || private.fmt_cop(v_da) || E'\n\n' ||
    '👟 Más vendido: ' || coalesce(v_mas_vendido, 'ninguno') || E'\n' ||
    '⚠️ Stock bajo: ' || v_stock_txt || E'\n\n' ||
    v_caja_linea;

  return json_build_object(
    'fecha', to_char(p_fecha,'YYYY-MM-DD'),
    'total_vendido', v_total, 'num_ventas', v_num,
    'efectivo', v_ef, 'nequi', v_ne, 'daviplata', v_da,
    'mas_vendido', v_mas_vendido,
    'stock_bajo', to_json(v_stock),
    'caja_cuadro', case when v_caja_existe then v_cuadro else null end,
    'diferencia', case when v_caja_existe then v_dif else null end,
    'mensaje', v_mensaje
  );
end;
$$;

revoke all on function public.obtener_reporte_diario(date) from public;
grant execute on function public.obtener_reporte_diario(date) to authenticated;
