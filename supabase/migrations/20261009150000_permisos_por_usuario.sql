-- Usuarios dinámicos y permisos por persona (reemplaza los roles fijos).
--
-- Antes: tres roles fijos (dueno/admin/empleado) y personas fijas en el
-- código. Ahora el dueño crea cada empleado (nombre, usuario y PIN) y decide
-- qué permisos le entrega. Los permisos son las filas del cuadro del PRD v4.0
-- §2; las plantillas Operativo/Administrativo solo los preseleccionan.
--
--   users.rol       'dueno' (todo, incluido gestionar empleados) | 'empleado'
--   users.permisos  text[] de private.permisos_validos()
--   users.usuario   con lo que entra; el correo de Auth es usuario@venus.invalid
--
-- No delegable (solo dueño): empleados, permisos, sueldos/pagos a empleados,
-- configuración de caja y de reportes, dashboard del dueño.
-- Toda la RLS y las RPC pasan de "rol" a private.tiene_permiso(...), que además
-- exige la cuenta activa: una cuenta desactivada ya no lee ni escribe nada aunque
-- conserve un token vigente.

-- ===== 0. Columnas nuevas (las funciones SQL de abajo las referencian) =====
alter table public.users
  add column if not exists usuario text,
  add column if not exists permisos text[] not null default '{}',
  add column if not exists debe_cambiar_pin boolean not null default false;

-- ===== 1. Catálogo y ayudantes =====
create or replace function private.permisos_validos()
returns text[] language sql immutable set search_path = '' as $$
  select array[
    'ventas','devoluciones','inventario','recibir_mercancia','caja','gastos',
    'proveedores','gastos_fijos','reportes','carga_inicial',
    'costos','deudas','balance'
  ]::text[]
$$;

-- user_role / is_owner ahora exigen la cuenta activa.
create or replace function private.user_role()
returns text language sql stable security definer set search_path = '' as $$
  select u.rol from public.users u where u.id = (select auth.uid()) and u.activo
$$;

create or replace function private.activo()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.users u where u.id = (select auth.uid()) and u.activo)
$$;

create or replace function private.es_dueno()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.user_role() = 'dueno', false)
$$;

create or replace function private.tiene_permiso(p_permiso text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.users u
    where u.id = (select auth.uid()) and u.activo
      and (u.rol = 'dueno' or p_permiso = any(u.permisos)))
$$;

grant execute on function private.permisos_validos(), private.activo(), private.es_dueno(),
  private.tiene_permiso(text) to authenticated, service_role;

-- ===== 2. users: usuario, permisos, cambio de PIN pendiente =====
-- usuario de las cuentas existentes: primer nombre sin tildes, en minúscula.
with base as (
  select id, created_at,
    nullif(regexp_replace(lower(translate(split_part(btrim(nombre), ' ', 1),
      'ÁÉÍÓÚÜÑáéíóúüñ', 'AEIOUUNaeiouun')), '[^a-z0-9]', '', 'g'), '') as b
  from public.users where usuario is null
), numerado as (
  -- mínimo 3 caracteres (rpad también trunca: solo se aplica a los cortos)
  select id,
    case when b is null then 'usuario' when length(b) < 3 then rpad(b, 3, '0') else b end as b,
    row_number() over (
      partition by case when b is null then 'usuario' when length(b) < 3 then rpad(b, 3, '0') else b end
      order by created_at, id) as n
  from base
)
update public.users u
  set usuario = left(numerado.b, 18) || case when numerado.n > 1 then numerado.n::text else '' end
  from numerado where u.id = numerado.id;

-- Inserciones directas (seeds, tests) sin usuario reciben uno aleatorio.
alter table public.users
  alter column usuario set default 'u' || left(replace(gen_random_uuid()::text, '-', ''), 10),
  alter column usuario set not null;
alter table public.users drop constraint if exists users_usuario_formato;
alter table public.users add constraint users_usuario_formato
  check (usuario ~ '^[a-z0-9][a-z0-9._-]{2,19}$');
create unique index if not exists users_usuario_key on public.users(usuario);
alter table public.users drop constraint if exists users_permisos_validos;
alter table public.users add constraint users_permisos_validos
  check (permisos <@ private.permisos_validos());

-- Roles fijos → permisos. Sandra (admin) queda con la plantilla administrativa.
update public.users set permisos = array['ventas','devoluciones','inventario','recibir_mercancia','caja','gastos','proveedores','gastos_fijos','reportes','carga_inicial']::text[]
  where rol = 'admin' and permisos = '{}';
update public.users set permisos = array['ventas','devoluciones','inventario','recibir_mercancia','caja','gastos']::text[]
  where rol = 'empleado' and permisos = '{}';
alter table public.users drop constraint if exists users_rol_check;
update public.users set rol = 'empleado' where rol = 'admin';
alter table public.users add constraint users_rol_check check (rol in ('dueno','empleado'));
comment on column public.users.rol is 'dueno (todo, gestiona empleados) | empleado (lo que diga permisos)';
comment on column public.users.permisos is 'Permisos que el dueño entregó (catálogo: private.permisos_validos()).';

-- Los PIN actuales son de 4 dígitos: cada cuenta crea uno de 6 al entrar.
update public.users set debe_cambiar_pin = true;

-- ===== 3. Auth: el login es usuario + PIN =====
-- El correo de Auth se deriva del usuario (dominio reservado .invalid: nunca
-- recibe correo). Así la app no lleva correos reales ni lista de personas.
update auth.users a set email = u.usuario || '@venus.invalid', updated_at = now()
  from public.users u where u.id = a.id;
update auth.identities i
  set identity_data = i.identity_data || jsonb_build_object('email', u.usuario || '@venus.invalid'),
      updated_at = now()
  from public.users u where i.user_id = u.id and i.provider = 'email';
update public.users set email = usuario || '@venus.invalid';
-- Cuentas creadas por SQL (seeds) con estos campos en NULL fallan al iniciar
-- sesión en Supabase Auth ("Database error querying schema").
update auth.users set
  confirmation_token     = coalesce(confirmation_token, ''),
  recovery_token         = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change           = coalesce(email_change, '')
  where id in (select id from public.users);

-- ===== 4. Políticas: de rol a permiso =====
-- (caja_config, clima_registro, empleado_*, reporte_* y escrituras de users
--  siguen con is_owner(), que ahora exige la cuenta activa.)

drop policy if exists cierres_select on public.cierres_caja;
create policy cierres_select on public.cierres_caja for select to authenticated
  using ((select private.tiene_permiso('reportes'))
    or ((select private.activo()) and fecha = private.hoy_bogota()));

drop policy if exists cierres_reaperturas_select on public.cierres_caja_reaperturas;
create policy cierres_reaperturas_select on public.cierres_caja_reaperturas for select to authenticated
  using ((select private.tiene_permiso('reportes')));

drop policy if exists compra_docs_admin on public.compra_documentos;
drop policy if exists compra_docs_proveedores on public.compra_documentos;
create policy compra_docs_proveedores on public.compra_documentos for all to authenticated
  using ((select private.tiene_permiso('proveedores')))
  with check ((select private.tiene_permiso('proveedores')));

-- compras: completas (total, saldo) para costos o deudas; llegadas pendientes
-- (sin datos financieros) para quien gestiona proveedores o para quien la registró.
drop policy if exists compras_select on public.compras;
drop policy if exists compras_insert on public.compras;
drop policy if exists compras_update on public.compras;
drop policy if exists compras_delete on public.compras;
create policy compras_select on public.compras for select to authenticated
  using ((select private.tiene_permiso('costos')) or (select private.tiene_permiso('deudas'))
    or (estado = 'pendiente_revision' and total is null
        and ((select private.tiene_permiso('proveedores'))
             or ((select private.tiene_permiso('recibir_mercancia')) and registrada_por = (select auth.uid())))));
create policy compras_insert on public.compras for insert to authenticated
  with check ((select private.tiene_permiso('costos'))
    or ((select private.tiene_permiso('recibir_mercancia'))
        and estado = 'pendiente_revision' and registrada_por = (select auth.uid())
        and total is null and condicion_pago is null
        and monto_pagado = 0 and saldo_pendiente = 0));
create policy compras_update on public.compras for update to authenticated
  using ((select private.tiene_permiso('costos'))) with check ((select private.tiene_permiso('costos')));
create policy compras_delete on public.compras for delete to authenticated
  using ((select private.tiene_permiso('costos'))
    or (estado = 'pendiente_revision' and registrada_por = (select auth.uid())
        and not private.compra_tiene_items(id)));

drop policy if exists compra_items_select on public.compra_items;
drop policy if exists compra_items_insert on public.compra_items;
drop policy if exists compra_items_update on public.compra_items;
drop policy if exists compra_items_delete on public.compra_items;
create policy compra_items_select on public.compra_items for select to authenticated
  using ((select private.tiene_permiso('costos'))
    or (costo_unitario is null and subtotal is null
        and exists (select 1 from public.compras c where c.id = compra_id
          and c.estado = 'pendiente_revision'
          and ((select private.tiene_permiso('proveedores'))
               or ((select private.tiene_permiso('recibir_mercancia')) and c.registrada_por = (select auth.uid()))))));
create policy compra_items_insert on public.compra_items for insert to authenticated
  with check ((select private.tiene_permiso('costos'))
    or ((select private.tiene_permiso('recibir_mercancia'))
        and costo_unitario is null and subtotal is null
        and exists (select 1 from public.compras c where c.id = compra_id
          and c.estado = 'pendiente_revision' and c.registrada_por = (select auth.uid()))));
create policy compra_items_update on public.compra_items for update to authenticated
  using ((select private.tiene_permiso('costos'))) with check ((select private.tiene_permiso('costos')));
create policy compra_items_delete on public.compra_items for delete to authenticated
  using ((select private.tiene_permiso('costos')));

drop policy if exists compra_pagos_owner on public.compra_pagos;
drop policy if exists compra_pagos_deudas on public.compra_pagos;
create policy compra_pagos_deudas on public.compra_pagos for all to authenticated
  using ((select private.tiene_permiso('deudas'))) with check ((select private.tiene_permiso('deudas')));

drop policy if exists devoluciones_select_authenticated on public.devoluciones;
create policy devoluciones_select_authenticated on public.devoluciones for select to authenticated
  using ((select private.activo()));
drop policy if exists devolucion_items_select_authenticated on public.devolucion_items;
create policy devolucion_items_select_authenticated on public.devolucion_items for select to authenticated
  using ((select private.activo()));

drop policy if exists gastos_fijos_admin on public.gastos_fijos;
drop policy if exists gastos_fijos_permiso on public.gastos_fijos;
create policy gastos_fijos_permiso on public.gastos_fijos for all to authenticated
  using ((select private.tiene_permiso('gastos_fijos'))) with check ((select private.tiene_permiso('gastos_fijos')));
drop policy if exists gastos_fijos_pagos_admin on public.gastos_fijos_pagos;
drop policy if exists gastos_fijos_pagos_permiso on public.gastos_fijos_pagos;
create policy gastos_fijos_pagos_permiso on public.gastos_fijos_pagos for all to authenticated
  using ((select private.tiene_permiso('gastos_fijos'))) with check ((select private.tiene_permiso('gastos_fijos')));

-- gastos variables: quien tiene "gastos" registra y ve los suyos; "gastos_fijos" ve y corrige todos.
drop policy if exists gastos_var_select on public.gastos_variables;
drop policy if exists gastos_var_insert on public.gastos_variables;
drop policy if exists gastos_var_update on public.gastos_variables;
drop policy if exists gastos_var_delete on public.gastos_variables;
create policy gastos_var_select on public.gastos_variables for select to authenticated
  using ((select private.tiene_permiso('gastos_fijos'))
    or ((select private.activo()) and created_by = (select auth.uid())));
create policy gastos_var_insert on public.gastos_variables for insert to authenticated
  with check ((select private.tiene_permiso('gastos_fijos'))
    or ((select private.tiene_permiso('gastos')) and created_by = (select auth.uid())));
create policy gastos_var_update on public.gastos_variables for update to authenticated
  using ((select private.tiene_permiso('gastos_fijos'))) with check ((select private.tiene_permiso('gastos_fijos')));
create policy gastos_var_delete on public.gastos_variables for delete to authenticated
  using ((select private.tiene_permiso('gastos_fijos')));

drop policy if exists hist_calzado_owner on public.historial_precios_calzado;
drop policy if exists hist_calzado_costos on public.historial_precios_calzado;
create policy hist_calzado_costos on public.historial_precios_calzado for all to authenticated
  using ((select private.tiene_permiso('costos'))) with check ((select private.tiene_permiso('costos')));
drop policy if exists hist_varios_owner on public.historial_precios_varios;
drop policy if exists hist_varios_costos on public.historial_precios_varios;
create policy hist_varios_costos on public.historial_precios_varios for all to authenticated
  using ((select private.tiene_permiso('costos'))) with check ((select private.tiene_permiso('costos')));

-- Ventas: el historial completo es "reportes"; el resto ve las del día y separadas.
drop policy if exists ventas_select on public.ventas;
create policy ventas_select on public.ventas for select to authenticated
  using ((select private.tiene_permiso('reportes'))
    or ((select private.activo())
        and (estado = 'separada' or (created_at at time zone 'America/Bogota')::date = private.hoy_bogota())));
drop policy if exists venta_items_select on public.venta_items;
create policy venta_items_select on public.venta_items for select to authenticated
  using ((select private.tiene_permiso('reportes'))
    or ((select private.activo()) and exists (select 1 from public.ventas v where v.id = venta_id
      and (v.estado = 'separada' or (v.created_at at time zone 'America/Bogota')::date = private.hoy_bogota()))));
drop policy if exists metodos_pago_select on public.metodos_pago_venta;
create policy metodos_pago_select on public.metodos_pago_venta for select to authenticated
  using ((select private.tiene_permiso('reportes'))
    or ((select private.activo()) and exists (select 1 from public.ventas v where v.id = venta_id
      and (v.estado = 'separada' or (v.created_at at time zone 'America/Bogota')::date = private.hoy_bogota()))));

-- Productos: todos los activos los ven (para vender); "inventario" los edita;
-- "recibir_mercancia" puede crear calzado nuevo desde la recepción.
drop policy if exists calzado_select on public.productos_calzado;
drop policy if exists calzado_insert on public.productos_calzado;
drop policy if exists calzado_update on public.productos_calzado;
drop policy if exists calzado_delete on public.productos_calzado;
create policy calzado_select on public.productos_calzado for select to authenticated
  using ((select private.activo()));
create policy calzado_insert on public.productos_calzado for insert to authenticated
  with check ((select private.tiene_permiso('inventario')) or (select private.tiene_permiso('recibir_mercancia')));
create policy calzado_update on public.productos_calzado for update to authenticated
  using ((select private.tiene_permiso('inventario'))) with check ((select private.tiene_permiso('inventario')));
create policy calzado_delete on public.productos_calzado for delete to authenticated
  using ((select private.tiene_permiso('inventario')));
drop policy if exists varios_select on public.productos_varios;
drop policy if exists varios_insert on public.productos_varios;
drop policy if exists varios_update on public.productos_varios;
drop policy if exists varios_delete on public.productos_varios;
create policy varios_select on public.productos_varios for select to authenticated
  using ((select private.activo()));
create policy varios_insert on public.productos_varios for insert to authenticated
  with check ((select private.tiene_permiso('inventario')));
create policy varios_update on public.productos_varios for update to authenticated
  using ((select private.tiene_permiso('inventario'))) with check ((select private.tiene_permiso('inventario')));
create policy varios_delete on public.productos_varios for delete to authenticated
  using ((select private.tiene_permiso('inventario')));

drop policy if exists prov_cuentas_admin on public.proveedor_cuentas_bancarias;
drop policy if exists prov_cuentas_permiso on public.proveedor_cuentas_bancarias;
create policy prov_cuentas_permiso on public.proveedor_cuentas_bancarias for all to authenticated
  using ((select private.tiene_permiso('proveedores'))) with check ((select private.tiene_permiso('proveedores')));
drop policy if exists proveedores_select on public.proveedores;
drop policy if exists proveedores_insert on public.proveedores;
drop policy if exists proveedores_update on public.proveedores;
drop policy if exists proveedores_delete on public.proveedores;
create policy proveedores_select on public.proveedores for select to authenticated
  using ((select private.activo()));
create policy proveedores_insert on public.proveedores for insert to authenticated
  with check ((select private.tiene_permiso('proveedores')));
create policy proveedores_update on public.proveedores for update to authenticated
  using ((select private.tiene_permiso('proveedores'))) with check ((select private.tiene_permiso('proveedores')));
create policy proveedores_delete on public.proveedores for delete to authenticated
  using ((select private.tiene_permiso('proveedores')));

-- users: cada quien su perfil (aunque esté inactivo, para que la app lo detecte);
-- el dueño y quienes ven historial o proveedores, la lista de nombres del equipo.
drop policy if exists users_select on public.users;
create policy users_select on public.users for select to authenticated
  using (id = (select auth.uid())
    or (select private.es_dueno())
    or (select private.tiene_permiso('reportes'))
    or (select private.tiene_permiso('proveedores')));

-- ===== 5. RPC: de rol a permiso (definiciones vigentes, solo cambia el gate) =====

CREATE OR REPLACE FUNCTION public.abrir_caja(p_base_inicial numeric DEFAULT NULL::numeric)
 RETURNS cierres_caja
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_hoy  date := private.hoy_bogota();
  v_caja public.cierres_caja;
begin
  if not private.tiene_permiso('caja') then
    raise exception 'No tienes permiso para manejar la caja.';
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
$function$;

CREATE OR REPLACE FUNCTION public.cerrar_caja(p_efectivo_contado numeric DEFAULT NULL::numeric, p_nota text DEFAULT NULL::text)
 RETURNS cierres_caja
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  if not private.tiene_permiso('caja') then
    raise exception 'No tienes permiso para manejar la caja.';
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
$function$;

CREATE OR REPLACE FUNCTION public.reabrir_caja()
 RETURNS cierres_caja
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_hoy  date := private.hoy_bogota();
  v_caja public.cierres_caja;
begin
  if not private.tiene_permiso('caja') then
    raise exception 'No tienes permiso para manejar la caja.';
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
$function$;

CREATE OR REPLACE FUNCTION public.obtener_arqueo_caja()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.tiene_permiso('caja') then
    raise exception 'No tienes permiso para manejar la caja.';
  end if;
  return private.arqueo_caja(private.hoy_bogota());
end;
$function$;

CREATE OR REPLACE FUNCTION public.guardar_producto_calzado(p_id uuid, p_categoria text, p_descripcion text, p_referencia text, p_talla text, p_color text, p_precio_minimo numeric, p_precio_maximo numeric, p_costo_compra numeric, p_stock_actual numeric, p_stock_minimo numeric, p_proveedor_id uuid, p_foto_url text, p_activo boolean, p_marca text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_id uuid;
  v_old_min numeric;
  v_old_max numeric;
  v_user_id uuid := auth.uid();
  v_costo numeric;
begin
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;
  -- Recibir mercancía crea calzado nuevo sin salir del flujo (PRD módulo 5).
  if not (private.tiene_permiso('inventario') or private.tiene_permiso('recibir_mercancia')) then
    raise exception 'No tienes permiso para editar el inventario.';
  end if;

  -- Solo quien tiene el permiso de costos registra costo_compra. Para el resto se ignora.
  v_costo := case when private.tiene_permiso('costos') then p_costo_compra else null end;

  if p_id is null then
    insert into public.productos_calzado (
      categoria, descripcion, marca, referencia, talla, color,
      precio_minimo, precio_maximo, stock_actual, stock_minimo,
      proveedor_id, foto_url, activo
    ) values (
      p_categoria, p_descripcion, p_marca, p_referencia, p_talla, p_color,
      p_precio_minimo, p_precio_maximo, p_stock_actual, p_stock_minimo,
      p_proveedor_id, p_foto_url, coalesce(p_activo, true)
    ) returning id into v_id;

    if v_costo is not null then
      insert into public.historial_precios_calzado (
        producto_id, precio_minimo, precio_maximo, costo_compra, registrado_por, motivo
      ) values (
        v_id, p_precio_minimo, p_precio_maximo, v_costo, v_user_id, 'Creación inicial'
      );
    end if;
  else
    v_id := p_id;

    select precio_minimo, precio_maximo into v_old_min, v_old_max
    from public.productos_calzado where id = v_id;

    update public.productos_calzado set
      categoria = p_categoria,
      descripcion = p_descripcion,
      marca = p_marca,
      referencia = p_referencia,
      talla = p_talla,
      color = p_color,
      precio_minimo = p_precio_minimo,
      precio_maximo = p_precio_maximo,
      stock_actual = p_stock_actual,
      stock_minimo = p_stock_minimo,
      proveedor_id = p_proveedor_id,
      foto_url = coalesce(p_foto_url, foto_url),
      activo = coalesce(p_activo, activo),
      updated_at = now()
    where id = v_id;

    if (v_old_min is distinct from p_precio_minimo) or
       (v_old_max is distinct from p_precio_maximo) or
       (v_costo is not null) then
      insert into public.historial_precios_calzado (
        producto_id, precio_minimo, precio_maximo, costo_compra, registrado_por, motivo
      ) values (
        v_id, p_precio_minimo, p_precio_maximo, v_costo, v_user_id, 'Actualización manual'
      );
    end if;
  end if;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.obtener_balance(p_desde date, p_hasta date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_ef numeric := 0; v_ne numeric := 0; v_br numeric := 0; v_ot numeric := 0;
  v_reemb numeric := 0; v_cobros numeric := 0;
  v_gf numeric := 0; v_gv numeric := 0; v_prov numeric := 0; v_sueldos numeric := 0;
  v_ing_neto numeric; v_egr numeric;
  v_estados text[] := array['completada','devuelta_parcial','devuelta_total','cambiada_parcial','cambiada_total'];
begin
  if not private.tiene_permiso('balance') then
    raise exception 'No tienes permiso para ver el balance';
  end if;

  select
    coalesce(sum(case when m.metodo='efectivo' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='nequi' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='bre_b' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='otro' then m.monto else 0 end),0)
  into v_ef, v_ne, v_br, v_ot
  from public.metodos_pago_venta m
  join public.ventas v on v.id = m.venta_id
  where v.estado = any(v_estados)
    and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta;

  select coalesce(sum(d.monto_devuelto),0), coalesce(sum(d.monto_cobrado),0)
  into v_reemb, v_cobros
  from public.devoluciones d
  where (d.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta;

  select coalesce(sum(monto_pagado),0) into v_gf
  from public.gastos_fijos_pagos where fecha_pago between p_desde and p_hasta;

  select coalesce(sum(monto),0) into v_gv
  from public.gastos_variables where fecha between p_desde and p_hasta;

  select coalesce(sum(monto),0) into v_prov
  from public.compra_pagos where fecha between p_desde and p_hasta;

  select coalesce(sum(monto),0) into v_sueldos
  from public.empleado_pagos where fecha_pago between p_desde and p_hasta;

  v_ing_neto := v_ef + v_ne + v_br + v_ot - v_reemb + v_cobros;
  v_egr := v_gf + v_gv + v_prov + v_sueldos;

  return json_build_object(
    'ingresos', json_build_object(
      'efectivo', v_ef, 'nequi', v_ne, 'bre_b', v_br, 'otro', v_ot,
      'reembolsos', v_reemb, 'cobros_cambios', v_cobros, 'total_neto', v_ing_neto),
    'egresos', json_build_object(
      'gastos_fijos', v_gf, 'gastos_variables', v_gv,
      'pagos_proveedores', v_prov, 'sueldos', v_sueldos, 'total', v_egr),
    'balance', v_ing_neto - v_egr
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.obtener_deuda_proveedor(p_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_deuda numeric(12,2);
begin
  if not private.tiene_permiso('deudas') then
    raise exception 'Acceso denegado: no tienes permiso para ver deudas con proveedores';
  end if;

  select coalesce(sum(saldo_pendiente), 0.00) into v_deuda
  from public.compras
  where proveedor_id = p_id
    and condicion_pago = 'credito'
    and estado = 'completada';

  return v_deuda;
end;
$function$;

CREATE OR REPLACE FUNCTION public.obtener_gastos_periodo(p_desde date, p_hasta date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_gastos json;
  v_total numeric;
begin
  if not private.tiene_permiso('gastos_fijos') then
    raise exception 'No autorizado para ver gastos';
  end if;

  with todos as (
    select
      'fijo'::text as tipo,
      gf.nombre as nombre,
      gfp.periodo as detalle,
      gfp.monto_pagado as monto,
      gfp.fecha_pago as fecha
    from public.gastos_fijos_pagos gfp
    join public.gastos_fijos gf on gf.id = gfp.gasto_fijo_id
    where gfp.fecha_pago between p_desde and p_hasta
    union all
    select
      'variable'::text as tipo,
      gv.descripcion as nombre,
      gv.categoria as detalle,
      gv.monto as monto,
      gv.fecha as fecha
    from public.gastos_variables gv
    where gv.fecha between p_desde and p_hasta
  )
  select
    coalesce(json_agg(json_build_object(
      'tipo', t.tipo,
      'nombre', t.nombre,
      'detalle', t.detalle,
      'monto', t.monto,
      'fecha', t.fecha
    ) order by t.fecha desc, t.nombre), '[]'::json),
    coalesce(sum(t.monto), 0)
  into v_gastos, v_total
  from todos t;

  return json_build_object('total', v_total, 'gastos', v_gastos);
end;
$function$;

CREATE OR REPLACE FUNCTION public.obtener_reporte_periodo(p_desde date, p_hasta date)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_estados text[] := array['completada','devuelta_parcial','devuelta_total','cambiada_parcial','cambiada_total'];
  v_largo int := (p_hasta - p_desde) + 1;
  v_prev_desde date := p_desde - v_largo;
  v_prev_hasta date := p_desde - 1;
  v_ef numeric := 0; v_ne numeric := 0; v_br numeric := 0; v_ot numeric := 0;
  v_num int := 0;
  v_total numeric; v_total_ant numeric;
  v_dia_top json; v_top json; v_sinmov json;
begin
  if not private.tiene_permiso('reportes') then
    raise exception 'No autorizado para ver reportes';
  end if;

  select
    coalesce(sum(case when m.metodo='efectivo' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='nequi' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='bre_b' then m.monto else 0 end),0),
    coalesce(sum(case when m.metodo='otro' then m.monto else 0 end),0)
  into v_ef, v_ne, v_br, v_ot
  from public.metodos_pago_venta m
  join public.ventas v on v.id = m.venta_id
  where v.estado = any(v_estados)
    and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta;

  select
    v_ef - coalesce(sum(case when metodo_reembolso='efectivo'  then monto_devuelto else 0 end),0)
         + coalesce(sum(case when metodo_cobro='efectivo'      then monto_cobrado  else 0 end),0),
    v_ne - coalesce(sum(case when metodo_reembolso='nequi'     then monto_devuelto else 0 end),0)
         + coalesce(sum(case when metodo_cobro='nequi'         then monto_cobrado  else 0 end),0),
    v_br - coalesce(sum(case when metodo_reembolso='bre_b'     then monto_devuelto else 0 end),0)
         + coalesce(sum(case when metodo_cobro='bre_b'         then monto_cobrado  else 0 end),0),
    v_ot - coalesce(sum(case when metodo_reembolso='otro'      then monto_devuelto else 0 end),0)
         + coalesce(sum(case when metodo_cobro='otro'          then monto_cobrado  else 0 end),0)
  into v_ef, v_ne, v_br, v_ot
  from public.devoluciones d
  where (d.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta;

  v_total := v_ef + v_ne + v_br + v_ot;

  select count(*) into v_num
  from public.ventas v
  where v.estado = any(v_estados)
    and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta;

  with pagos as (
    select coalesce(sum(m.monto),0) as g
    from public.metodos_pago_venta m
    join public.ventas v on v.id = m.venta_id
    where v.estado = any(v_estados)
      and (v.created_at at time zone 'America/Bogota')::date between v_prev_desde and v_prev_hasta
  ), devs as (
    select coalesce(sum(d.monto_devuelto),0) as r, coalesce(sum(d.monto_cobrado),0) as c
    from public.devoluciones d
    where (d.created_at at time zone 'America/Bogota')::date between v_prev_desde and v_prev_hasta
  )
  select (pagos.g - devs.r + devs.c) into v_total_ant from pagos, devs;

  with dia_pagos as (
    select (v.created_at at time zone 'America/Bogota')::date as d, sum(m.monto) as g
    from public.metodos_pago_venta m
    join public.ventas v on v.id = m.venta_id
    where v.estado = any(v_estados)
      and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta
    group by 1
  ), dia_devs as (
    select (d2.created_at at time zone 'America/Bogota')::date as d,
           sum(d2.monto_devuelto) as r, sum(d2.monto_cobrado) as c
    from public.devoluciones d2
    where (d2.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta
    group by 1
  )
  select json_build_object('fecha', x.d, 'monto', x.neto) into v_dia_top
  from (
    select p.d, (p.g - coalesce(dd.r,0) + coalesce(dd.c,0)) as neto
    from dia_pagos p
    left join dia_devs dd on dd.d = p.d
    order by neto desc, p.d desc
    limit 1
  ) x;

  select coalesce(json_agg(t order by t.unidades desc), '[]'::json) into v_top
  from (
    select vi.descripcion_snapshot as producto,
           sum(vi.cantidad) as unidades,
           sum(vi.subtotal) as monto
    from public.venta_items vi
    join public.ventas v on v.id = vi.venta_id
    where v.estado = any(v_estados)
      and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta
    group by vi.descripcion_snapshot
    order by unidades desc
    limit 10
  ) t;

  select coalesce(
           json_agg(json_build_object(
             'id', pc.id,
             'producto', pc.descripcion || coalesce(' · talla ' || pc.talla, ''))
             order by pc.descripcion),
           '[]'::json) into v_sinmov
  from public.productos_calzado pc
  where pc.activo = true
    and not exists (
      select 1 from public.venta_items vi
      join public.ventas v on v.id = vi.venta_id
      where vi.producto_calzado_id = pc.id
        and v.estado = any(v_estados)
        and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta
    );

  return json_build_object(
    'total_vendido', v_total,
    'total_anterior', v_total_ant,
    'num_ventas', v_num,
    'efectivo', v_ef, 'nequi', v_ne, 'bre_b', v_br, 'otro', v_ot,
    'dia_top', v_dia_top,
    'top_productos', v_top,
    'sin_movimiento', v_sinmov
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.obtener_ventas_por_subperiodo(p_desde date, p_hasta date, p_granularidad text)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_estados text[] := array['completada','devuelta_parcial','devuelta_total','cambiada_parcial','cambiada_total'];
  v_paso interval;
  v_resultado json;
begin
  if not private.tiene_permiso('reportes') then
    raise exception 'No autorizado para ver reportes';
  end if;

  if p_granularidad not in ('dia','semana','mes') then
    raise exception 'Granularidad inválida: %. Usa dia, semana o mes.', p_granularidad;
  end if;

  v_paso := case p_granularidad
    when 'dia' then interval '1 day'
    when 'semana' then interval '1 week'
    else interval '1 month'
  end;

  with buckets as (
    select g::date as inicio
    from generate_series(
      case p_granularidad
        when 'dia' then p_desde::timestamp
        when 'semana' then date_trunc('week', p_desde::timestamp)
        else date_trunc('month', p_desde::timestamp)
      end,
      p_hasta::timestamp,
      v_paso
    ) g
  ),
  pagos as (
    select
      case p_granularidad
        when 'dia' then (v.created_at at time zone 'America/Bogota')::date
        when 'semana' then date_trunc('week', (v.created_at at time zone 'America/Bogota'))::date
        else date_trunc('month', (v.created_at at time zone 'America/Bogota'))::date
      end as inicio,
      sum(m.monto) as bruto,
      count(distinct v.id) as num_ventas
    from public.metodos_pago_venta m
    join public.ventas v on v.id = m.venta_id
    where v.estado = any(v_estados)
      and (v.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta
    group by 1
  ),
  devs as (
    select
      case p_granularidad
        when 'dia' then (d.created_at at time zone 'America/Bogota')::date
        when 'semana' then date_trunc('week', (d.created_at at time zone 'America/Bogota'))::date
        else date_trunc('month', (d.created_at at time zone 'America/Bogota'))::date
      end as inicio,
      sum(d.monto_devuelto) as devuelto,
      sum(d.monto_cobrado) as cobrado
    from public.devoluciones d
    where (d.created_at at time zone 'America/Bogota')::date between p_desde and p_hasta
    group by 1
  )
  select coalesce(json_agg(json_build_object(
           'inicio', b.inicio,
           'total', coalesce(p.bruto, 0) - coalesce(d.devuelto, 0) + coalesce(d.cobrado, 0),
           'num_ventas', coalesce(p.num_ventas, 0)
         ) order by b.inicio), '[]'::json)
  into v_resultado
  from buckets b
  left join pagos p on p.inicio = b.inicio
  left join devs d on d.inicio = b.inicio;

  return v_resultado;
end;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_devolucion(p_venta_id uuid, p_motivo text, p_tipo_devolucion text, p_metodo_reembolso text, p_metodo_cobro text, p_monto_devuelto numeric, p_monto_cobrado numeric, p_items jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := auth.uid();
  v_devolucion_id uuid;
  v_estado text;
  v_item jsonb;
  v_vi_id uuid;
  v_cant numeric(12,3);
  v_reempl_id uuid;
  v_precio_reempl numeric(12,2);
  v_tipo_prod text;
  v_calzado_id uuid;
  v_varios_id uuid;
  v_cant_vendida numeric(12,3);
  v_precio_unit numeric(12,2);
  v_ya_devuelto numeric(12,3);
  v_subtotal numeric(12,2);
  v_orig_ref text; v_orig_desc text;
  v_r_ref text; v_r_desc text; v_r_pmin numeric(12,2); v_r_pmax numeric(12,2);
  v_r_stock numeric; v_r_activo boolean;
  v_refund_total numeric(12,2) := 0.00;
  v_diff_total numeric(12,2) := 0.00;
  v_exp_devuelto numeric(12,2);
  v_exp_cobrado numeric(12,2);
  v_vendido numeric(12,3);
  v_movido numeric(12,3);
  v_todas_cambio boolean;
begin
  if v_uid is null then raise exception 'No autenticado'; end if;
  if not private.tiene_permiso('devoluciones') then
    raise exception 'No tienes permiso para registrar devoluciones.'; end if;
  if p_motivo is null or trim(p_motivo) = '' then raise exception 'El motivo es requerido'; end if;
  if p_tipo_devolucion not in ('total','parcial','cambio') then
    raise exception 'Tipo de devolución inválido: %', p_tipo_devolucion; end if;
  if coalesce(p_monto_devuelto,0) < 0 or coalesce(p_monto_cobrado,0) < 0 then
    raise exception 'Montos inválidos'; end if;
  if coalesce(p_monto_devuelto,0) > 0 and coalesce(p_monto_cobrado,0) > 0 then
    raise exception 'Una devolución no puede cobrar y reembolsar a la vez'; end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La devolución debe contener al menos un producto'; end if;

  select estado into v_estado from public.ventas where id = p_venta_id for update;
  if v_estado is null then raise exception 'Venta no encontrada'; end if;
  if v_estado not in ('completada','devuelta_parcial','cambiada_parcial') then
    raise exception 'La venta no admite devoluciones en su estado actual (%).', v_estado; end if;

  insert into public.devoluciones (
    venta_id, motivo, tipo_devolucion, monto_devuelto, metodo_reembolso, monto_cobrado, metodo_cobro
  ) values (
    p_venta_id, p_motivo, p_tipo_devolucion,
    coalesce(p_monto_devuelto,0.00), p_metodo_reembolso,
    coalesce(p_monto_cobrado,0.00), p_metodo_cobro
  ) returning id into v_devolucion_id;

  for v_item in select jsonb_array_elements(p_items) loop
    v_vi_id := (v_item->>'venta_item_id')::uuid;
    v_cant := (v_item->>'cantidad')::numeric;
    v_reempl_id := nullif(v_item->>'cambio_talla_color_id','')::uuid;
    v_precio_reempl := nullif(v_item->>'precio_reemplazo','')::numeric;

    if v_vi_id is null then raise exception 'venta_item_id es requerido'; end if;
    if v_cant is null or v_cant <= 0 then raise exception 'La cantidad debe ser mayor a 0'; end if;

    select tipo_producto, producto_calzado_id, producto_varios_id, cantidad, precio_unitario
      into v_tipo_prod, v_calzado_id, v_varios_id, v_cant_vendida, v_precio_unit
      from public.venta_items where id = v_vi_id and venta_id = p_venta_id for update;
    if v_cant_vendida is null then raise exception 'Item no pertenece a esta venta'; end if;

    select coalesce(sum(di.cantidad),0.000) into v_ya_devuelto
      from public.devolucion_items di
      where di.venta_item_id = v_vi_id and di.devolucion_id <> v_devolucion_id;
    if v_cant + v_ya_devuelto > v_cant_vendida then
      raise exception 'La cantidad devuelta supera la cantidad vendida'; end if;

    if p_tipo_devolucion = 'cambio' then
      if v_tipo_prod <> 'calzado' then raise exception 'Granja no admite cambios'; end if;
      if v_cant <> trunc(v_cant) then raise exception 'La cantidad de calzado debe ser entera'; end if;
      if v_reempl_id is null then raise exception 'Falta el zapato de reemplazo'; end if;
      if v_precio_reempl is null then raise exception 'Falta el precio del reemplazo'; end if;

      select referencia, descripcion, precio_minimo, precio_maximo, stock_actual, activo
        into v_r_ref, v_r_desc, v_r_pmin, v_r_pmax, v_r_stock, v_r_activo
        from public.productos_calzado where id = v_reempl_id for update;
      if v_r_desc is null then raise exception 'El reemplazo no existe'; end if;
      if not v_r_activo then raise exception 'El reemplazo no está activo'; end if;

      select referencia, descripcion into v_orig_ref, v_orig_desc
        from public.productos_calzado where id = v_calzado_id;
      if coalesce(v_orig_ref,'') <> coalesce(v_r_ref,'') or v_orig_desc <> v_r_desc then
        raise exception 'El reemplazo debe ser del mismo modelo (referencia y descripción)'; end if;

      if v_reempl_id <> v_calzado_id then
        if v_r_stock < v_cant then raise exception 'Stock insuficiente del reemplazo'; end if;
        update public.productos_calzado set stock_actual = stock_actual + v_cant where id = v_calzado_id;
        update public.productos_calzado set stock_actual = stock_actual - v_cant where id = v_reempl_id;
      end if;

      v_diff_total := v_diff_total + round((v_precio_reempl - v_precio_unit) * v_cant, 2);
      v_subtotal := 0.00;

      insert into public.devolucion_items (
        devolucion_id, venta_item_id, producto_calzado_id, producto_varios_id,
        cantidad, precio_unitario, subtotal, cambio_talla_color_id,
        precio_reemplazo, precio_minimo_snapshot, precio_maximo_snapshot
      ) values (
        v_devolucion_id, v_vi_id, v_calzado_id, null,
        v_cant, v_precio_unit, v_subtotal, v_reempl_id,
        v_precio_reempl, v_r_pmin, v_r_pmax
      );
    else
      if v_reempl_id is not null or v_precio_reempl is not null then
        raise exception 'No se permite reemplazo en una devolución que no es cambio'; end if;
      if v_tipo_prod = 'calzado' then
        if v_cant <> trunc(v_cant) then raise exception 'La cantidad de calzado debe ser entera'; end if;
        update public.productos_calzado set stock_actual = stock_actual + v_cant where id = v_calzado_id;
      elsif v_tipo_prod <> 'varios' then
        raise exception 'Tipo de producto inválido';
      end if;
      v_subtotal := round(v_precio_unit * v_cant, 2);
      v_refund_total := v_refund_total + v_subtotal;

      insert into public.devolucion_items (
        devolucion_id, venta_item_id, producto_calzado_id, producto_varios_id,
        cantidad, precio_unitario, subtotal, cambio_talla_color_id,
        precio_reemplazo, precio_minimo_snapshot, precio_maximo_snapshot
      ) values (
        v_devolucion_id, v_vi_id, v_calzado_id, v_varios_id,
        v_cant, v_precio_unit, v_subtotal, null, null, null, null
      );
    end if;
  end loop;

  if p_tipo_devolucion = 'cambio' then
    if v_diff_total > 0 then v_exp_cobrado := v_diff_total; v_exp_devuelto := 0.00;
    elsif v_diff_total < 0 then v_exp_devuelto := -v_diff_total; v_exp_cobrado := 0.00;
    else v_exp_devuelto := 0.00; v_exp_cobrado := 0.00; end if;
  else
    v_exp_devuelto := v_refund_total; v_exp_cobrado := 0.00;
  end if;

  if coalesce(p_monto_devuelto,0.00) <> v_exp_devuelto then
    raise exception 'Monto a reembolsar (%) no coincide con lo esperado (%)', p_monto_devuelto, v_exp_devuelto; end if;
  if coalesce(p_monto_cobrado,0.00) <> v_exp_cobrado then
    raise exception 'Monto a cobrar (%) no coincide con lo esperado (%)', p_monto_cobrado, v_exp_cobrado; end if;
  if v_exp_devuelto > 0 and (p_metodo_reembolso is null or p_metodo_reembolso not in ('efectivo','nequi','bre_b','otro')) then
    raise exception 'Falta método de reembolso'; end if;
  if v_exp_cobrado > 0 and (p_metodo_cobro is null or p_metodo_cobro not in ('efectivo','nequi','bre_b','otro')) then
    raise exception 'Falta método de cobro'; end if;

  select coalesce(sum(cantidad),0.000) into v_vendido
    from public.venta_items where venta_id = p_venta_id;
  select coalesce(sum(di.cantidad),0.000) into v_movido
    from public.devolucion_items di join public.devoluciones d on d.id = di.devolucion_id
    where d.venta_id = p_venta_id;
  select count(*) = 0 into v_todas_cambio
    from public.devoluciones where venta_id = p_venta_id and tipo_devolucion <> 'cambio';

  if v_movido >= v_vendido then
    update public.ventas set estado = case when v_todas_cambio then 'cambiada_total' else 'devuelta_total' end
      where id = p_venta_id;
  else
    update public.ventas set estado = case when v_todas_cambio then 'cambiada_parcial' else 'devuelta_parcial' end
      where id = p_venta_id;
  end if;

  return jsonb_build_object('devolucion_id', v_devolucion_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.registrar_venta(p_items jsonb, p_pagos jsonb, p_efectivo_recibido numeric DEFAULT NULL::numeric, p_cliente_nombre text DEFAULT NULL::text, p_cliente_apellido text DEFAULT NULL::text, p_cliente_telefono text DEFAULT NULL::text, p_clave_idempotencia uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_venta_id uuid;
  v_numero bigint;
  v_total numeric(12,2) := 0;
  v_total_pagos numeric(12,2) := 0;
  v_efectivo_monto numeric(12,2) := 0;
  v_efectivo_recibido numeric(12,2);
  v_cambio numeric(12,2) := 0;
  it jsonb;
  v_pago jsonb;
  v_monto numeric(12,2);
  v_tipo text;
  v_pid uuid;
  v_cant numeric(12,3);
  v_precio numeric(12,2);
  v_desc text;
  v_talla text;
  v_color text;
  v_stock numeric(12,3);
  v_min numeric(12,2);
  v_max numeric(12,2);
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if not private.tiene_permiso('ventas') then
    raise exception 'No tienes permiso para vender.';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;
  if p_pagos is null or jsonb_array_length(p_pagos) = 0 then
    raise exception 'La venta no tiene pagos';
  end if;

  -- Reintento de una venta que ya se guardó (la respuesta se perdió por la red):
  -- se devuelve la misma venta, sin volver a descontar stock ni registrar pagos.
  if p_clave_idempotencia is not null then
    select id, numero into v_venta_id, v_numero
      from public.ventas
      where clave_idempotencia = p_clave_idempotencia and vendedor_id = v_uid;
    if found then
      return jsonb_build_object('venta_id', v_venta_id, 'numero', v_numero, 'repetida', true);
    end if;
  end if;

  -- El trigger trg_ventas_caja_abierta exige la caja del día abierta.
  insert into public.ventas (vendedor_id, total, monto_pagado, saldo_pendiente, estado,
                             cliente_nombre, cliente_apellido, cliente_telefono,
                             clave_idempotencia)
    values (v_uid, 0, 0, 0, 'completada',
            p_cliente_nombre, p_cliente_apellido, p_cliente_telefono,
            p_clave_idempotencia)
    on conflict (clave_idempotencia) do nothing
    returning id, numero into v_venta_id, v_numero;

  if v_venta_id is null then
    -- Un reintento simultáneo con la misma clave ganó la carrera y ya se confirmó.
    select id, numero into v_venta_id, v_numero
      from public.ventas
      where clave_idempotencia = p_clave_idempotencia and vendedor_id = v_uid;
    if not found then
      raise exception 'Clave de venta inválida';
    end if;
    return jsonb_build_object('venta_id', v_venta_id, 'numero', v_numero, 'repetida', true);
  end if;

  for it in
    select value from jsonb_array_elements(p_items)
    order by value->>'producto_id'
  loop
    v_tipo := it->>'tipo';
    if it->>'producto_id' is null then
      raise exception 'Item sin producto_id';
    end if;
    v_pid  := (it->>'producto_id')::uuid;
    v_cant := (it->>'cantidad')::numeric;
    if v_cant is null or v_cant <= 0 then
      raise exception 'Cantidad inválida';
    end if;
    if it->>'precio' is null then
      raise exception 'Item sin precio';
    end if;
    v_precio := round((it->>'precio')::numeric, 2);
    if v_precio <= 0 then
      raise exception 'Precio inválido';
    end if;
    if v_tipo = 'calzado' and v_cant <> trunc(v_cant) then
      raise exception 'La cantidad de calzado debe ser entera';
    end if;

    v_min := null;
    v_max := null;
    if v_tipo = 'calzado' then
      select descripcion, talla, color, stock_actual, precio_minimo, precio_maximo
        into v_desc, v_talla, v_color, v_stock, v_min, v_max
        from public.productos_calzado
        where id = v_pid and activo
        for update;
      if v_desc is null then
        raise exception 'Producto no disponible';
      end if;
      if v_stock < v_cant then
        raise exception 'Stock insuficiente para %', v_desc;
      end if;
      -- PRD §3.1.1: el mínimo y el máximo son topes reales del regateo.
      if v_precio < v_min or v_precio > v_max then
        raise exception 'El precio de % debe estar entre % y %. Ajusta el carrito.',
          v_desc, private.fmt_cop(v_min), private.fmt_cop(v_max);
      end if;
      update public.productos_calzado set stock_actual = stock_actual - v_cant where id = v_pid;
    elsif v_tipo = 'varios' then
      select nombre into v_desc
        from public.productos_varios
        where id = v_pid and activo;
      if v_desc is null then
        raise exception 'Producto no disponible';
      end if;
      v_talla := null;
      v_color := null;
    else
      raise exception 'Tipo de producto inválido: %', v_tipo;
    end if;

    insert into public.venta_items (venta_id, tipo_producto,
        producto_calzado_id, producto_varios_id,
        descripcion_snapshot, talla, color, cantidad, precio_unitario, subtotal,
        precio_minimo_snapshot, precio_maximo_snapshot)
      values (v_venta_id, v_tipo,
        case when v_tipo = 'calzado' then v_pid end,
        case when v_tipo = 'varios'  then v_pid end,
        v_desc, v_talla, v_color, v_cant, v_precio, round(v_precio * v_cant, 2),
        v_min, v_max);

    v_total := v_total + round(v_precio * v_cant, 2);
  end loop;

  for v_pago in select value from jsonb_array_elements(p_pagos)
  loop
    if (v_pago->>'metodo') not in ('efectivo','nequi','bre_b','otro') then
      raise exception 'Método de pago inválido';
    end if;
    v_monto := round((v_pago->>'monto')::numeric, 2);
    if v_monto <= 0 then
      raise exception 'Monto de pago inválido';
    end if;
    v_total_pagos := v_total_pagos + v_monto;
    if (v_pago->>'metodo') = 'efectivo' then
      v_efectivo_monto := v_efectivo_monto + v_monto;
    end if;
    insert into public.metodos_pago_venta (venta_id, metodo, monto, es_anticipo)
      values (v_venta_id, v_pago->>'metodo', v_monto, false);
  end loop;

  if v_total_pagos <> v_total then
    raise exception 'Los pagos no suman el total';
  end if;

  if v_efectivo_monto > 0 then
    v_efectivo_recibido := coalesce(p_efectivo_recibido, v_efectivo_monto);
    if v_efectivo_recibido < v_efectivo_monto then
      raise exception 'El efectivo recibido es menor al pago en efectivo';
    end if;
    v_cambio := v_efectivo_recibido - v_efectivo_monto;
  else
    v_efectivo_recibido := null;
    v_cambio := 0;
  end if;

  update public.ventas
    set total = v_total, monto_pagado = v_total, saldo_pendiente = 0,
        efectivo_recibido = v_efectivo_recibido, cambio = v_cambio
        where id = v_venta_id;

  return jsonb_build_object('venta_id', v_venta_id, 'numero', v_numero, 'repetida', false);
end;
$function$;

-- ===== 6. Los ayudantes de roles fijos ya no se usan =====
-- (si quedara alguna política o función que los use, el drop falla y la
--  migración se revierte entera)
drop function private.is_staff_admin();
drop function private.is_admin();
drop function private.is_employee();
