-- =====================================================================
-- Venus · Esquema inicial de base de datos
-- Tienda de calzado Venus (Florencia, Caquetá)
--
-- Refleja el estado aplicado al proyecto remoto `venus` (ref xqspsaghukeynlizbjvc).
-- Incluye: 21 tablas, helpers de rol en el esquema `private`, triggers de
-- updated_at e historial de precios, índices, RLS y políticas dueno/empleado.
--
-- Nota: la creación de los usuarios de Auth (auth.users) NO va en esta
-- migración de esquema; es data y se gestiona aparte.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Extensiones y esquema privado (helpers fuera de la Data API)
-- ---------------------------------------------------------------------
create extension if not exists pg_trgm with schema extensions;
create schema if not exists private;

create or replace function private.set_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- users (perfil ligado a auth.users; rol gobierna toda la RLS)
-- ---------------------------------------------------------------------
create table public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  nombre      text not null,
  rol         text not null check (rol in ('dueno','empleado')),
  email       text,
  telefono    text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
comment on table public.users is 'Perfil de usuario ligado a auth.users. rol = dueno | empleado';

-- Helpers de rol. SECURITY DEFINER -> evitan recursión de RLS sobre users.
create or replace function private.user_role()
returns text language sql stable security definer set search_path = '' as $$
  select u.rol from public.users u where u.id = (select auth.uid())
$$;

create or replace function private.is_owner()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.user_role() = 'dueno', false)
$$;

create or replace function private.is_employee()
returns boolean language sql stable security definer set search_path = '' as $$
  select coalesce(private.user_role() = 'empleado', false)
$$;

-- "Hoy" en Florencia (America/Bogota, UTC-5, sin DST)
create or replace function private.hoy_bogota()
returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Bogota')::date
$$;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
grant execute on function private.user_role(), private.is_owner(),
  private.is_employee(), private.hoy_bogota() to authenticated, service_role;

-- ---------------------------------------------------------------------
-- Proveedores
-- ---------------------------------------------------------------------
create table public.proveedores (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null,
  nit_cedula  text,
  telefono    text,
  ciudad      text,
  notas       text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table public.proveedor_cuentas_bancarias (
  id            uuid primary key default gen_random_uuid(),
  proveedor_id  uuid not null references public.proveedores(id) on delete cascade,
  banco         text not null,
  tipo_cuenta   text not null check (tipo_cuenta in ('ahorros','corriente','nequi','daviplata')),
  numero_cuenta text not null,
  titular       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Calzado (SIN costo_compra: el costo vive solo en tablas de dueño)
-- ---------------------------------------------------------------------
create table public.productos_calzado (
  id            uuid primary key default gen_random_uuid(),
  referencia    text,
  descripcion   text not null,
  categoria     text not null check (categoria in
                  ('Chanclas','Escolar','Botas caucho','Deportivo','Tennis','Clasico','Otros')),
  talla         text,
  color         text,
  precio_venta  numeric(12,2) not null check (precio_venta >= 0),
  stock_actual  integer not null default 0 check (stock_actual >= 0),
  stock_minimo  integer not null default 1 check (stock_minimo >= 0),
  foto_url      text,
  proveedor_id  uuid references public.proveedores(id) on delete set null,
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
comment on column public.productos_calzado.stock_actual is 'Regla: nunca negativo (CHECK >= 0)';

create table public.historial_precios_calzado (
  id              uuid primary key default gen_random_uuid(),
  producto_id     uuid not null references public.productos_calzado(id) on delete cascade,
  precio_venta    numeric(12,2),
  costo_compra    numeric(12,2),
  motivo          text,
  registrado_por  uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create table public.productos_varios (
  id            uuid primary key default gen_random_uuid(),
  nombre        text not null,
  unidad_medida text not null,
  precio_venta  numeric(12,2) not null check (precio_venta >= 0),
  stock_actual  numeric(12,3) not null default 0 check (stock_actual >= 0),
  stock_minimo  numeric(12,3) not null default 0 check (stock_minimo >= 0),
  foto_url      text,
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table public.historial_precios_varios (
  id              uuid primary key default gen_random_uuid(),
  producto_id     uuid not null references public.productos_varios(id) on delete cascade,
  precio_venta    numeric(12,2),
  costo_compra    numeric(12,2),
  motivo          text,
  registrado_por  uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Ventas
-- ---------------------------------------------------------------------
create table public.ventas (
  id                 uuid primary key default gen_random_uuid(),
  numero             bigint generated always as identity,
  estado             text not null default 'completada'
                       check (estado in ('completada','separada','cancelada')),
  total              numeric(12,2) not null check (total >= 0),
  monto_pagado       numeric(12,2) not null default 0 check (monto_pagado >= 0),
  saldo_pendiente    numeric(12,2) not null default 0 check (saldo_pendiente >= 0),
  cliente_nombre     text,
  cliente_apellido   text,
  cliente_telefono   text,
  vendedor_id        uuid references public.users(id) on delete set null,
  nota               text,
  corregida          boolean not null default false,
  correccion_motivo  text,
  corregida_por      uuid references public.users(id) on delete set null,
  correccion_at      timestamptz,
  cancelacion_motivo text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
comment on table public.ventas is 'Venta confirmada nunca se elimina; se corrige (dueno) o cancela via estado';

create table public.venta_items (
  id                   uuid primary key default gen_random_uuid(),
  venta_id             uuid not null references public.ventas(id) on delete cascade,
  tipo_producto        text not null check (tipo_producto in ('calzado','varios')),
  producto_calzado_id  uuid references public.productos_calzado(id) on delete restrict,
  producto_varios_id   uuid references public.productos_varios(id) on delete restrict,
  descripcion_snapshot text not null,
  talla                text,
  color                text,
  cantidad             numeric(12,3) not null check (cantidad > 0),
  precio_unitario      numeric(12,2) not null check (precio_unitario >= 0),
  subtotal             numeric(12,2) not null check (subtotal >= 0),
  created_at           timestamptz not null default now(),
  constraint venta_items_un_producto check (
    (tipo_producto = 'calzado' and producto_calzado_id is not null and producto_varios_id is null)
    or
    (tipo_producto = 'varios'  and producto_varios_id is not null and producto_calzado_id is null)
  )
);

create table public.metodos_pago_venta (
  id          uuid primary key default gen_random_uuid(),
  venta_id    uuid not null references public.ventas(id) on delete cascade,
  metodo      text not null check (metodo in ('efectivo','nequi','daviplata')),
  monto       numeric(12,2) not null check (monto > 0),
  es_anticipo boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Compras a proveedores
-- ---------------------------------------------------------------------
create table public.compras (
  id                 uuid primary key default gen_random_uuid(),
  proveedor_id       uuid not null references public.proveedores(id) on delete restrict,
  estado             text not null default 'pendiente_revision'
                       check (estado in ('pendiente_revision','completada','cancelada')),
  total              numeric(12,2) check (total >= 0),
  condicion_pago     text check (condicion_pago in ('contado','credito')),
  monto_pagado       numeric(12,2) not null default 0 check (monto_pagado >= 0),
  saldo_pendiente    numeric(12,2) not null default 0 check (saldo_pendiente >= 0),
  fecha_vencimiento  date,
  notas              text,
  registrada_por     uuid references public.users(id) on delete set null,
  revisada_por       uuid references public.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
comment on table public.compras is 'Costos/deudas solo visibles al dueno. Andres solo ve sus registros pendientes de revision.';

create table public.compra_items (
  id                   uuid primary key default gen_random_uuid(),
  compra_id            uuid not null references public.compras(id) on delete cascade,
  producto_calzado_id  uuid references public.productos_calzado(id) on delete set null,
  referencia           text,
  descripcion          text not null,
  talla                text,
  color                text,
  cantidad             integer not null check (cantidad > 0),
  costo_unitario       numeric(12,2) check (costo_unitario >= 0),
  subtotal             numeric(12,2) check (subtotal >= 0),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create table public.compra_documentos (
  id             uuid primary key default gen_random_uuid(),
  compra_id      uuid references public.compras(id) on delete cascade,
  proveedor_id   uuid references public.proveedores(id) on delete cascade,
  tipo           text not null check (tipo in ('pdf','imagen')),
  url            text not null,
  nombre_archivo text,
  subido_por     uuid references public.users(id) on delete set null,
  created_at     timestamptz not null default now(),
  constraint compra_documentos_destino check (compra_id is not null or proveedor_id is not null)
);

-- ---------------------------------------------------------------------
-- Gastos
-- ---------------------------------------------------------------------
create table public.gastos_fijos (
  id                 uuid primary key default gen_random_uuid(),
  nombre             text not null,
  monto_aproximado   numeric(12,2) not null check (monto_aproximado >= 0),
  dia_pago           integer check (dia_pago between 1 and 31),
  beneficiario       text,
  alerta_dias_antes  integer not null default 5 check (alerta_dias_antes >= 0),
  notas              text,
  activo             boolean not null default true,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table public.gastos_fijos_pagos (
  id              uuid primary key default gen_random_uuid(),
  gasto_fijo_id   uuid not null references public.gastos_fijos(id) on delete cascade,
  monto_pagado    numeric(12,2) not null check (monto_pagado >= 0),
  fecha_pago      date not null,
  periodo         text,
  comprobante_url text,
  registrado_por  uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table public.gastos_variables (
  id              uuid primary key default gen_random_uuid(),
  descripcion     text not null,
  monto           numeric(12,2) not null check (monto >= 0),
  categoria       text not null default 'otros'
                    check (categoria in ('transporte','reparaciones','insumos','otros')),
  fecha           date not null default current_date,
  comprobante_url text,
  registrado_por  uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Cierre de caja
-- ---------------------------------------------------------------------
create table public.cierres_caja (
  id               uuid primary key default gen_random_uuid(),
  fecha            date not null,
  modo             text not null default 'manual' check (modo in ('automatico','manual')),
  estado           text not null default 'abierta' check (estado in ('abierta','cerrada')),
  apertura_at      timestamptz,
  cierre_at        timestamptz,
  total_ventas     integer not null default 0,
  total_general    numeric(12,2) not null default 0,
  total_efectivo   numeric(12,2) not null default 0,
  total_nequi      numeric(12,2) not null default 0,
  total_daviplata  numeric(12,2) not null default 0,
  efectivo_contado numeric(12,2),
  diferencia       numeric(12,2),
  diferencia_nota  text,
  cerrado_por      uuid references public.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint cierres_caja_fecha_unica unique (fecha)
);

-- ---------------------------------------------------------------------
-- Empleado
-- ---------------------------------------------------------------------
create table public.empleado_config (
  id                  uuid primary key default gen_random_uuid(),
  empleado_id         uuid not null references public.users(id) on delete cascade,
  sueldo_mensual      numeric(12,2) not null check (sueldo_mensual >= 0),
  fecha_inicio        date,
  dias_trabajo_semana integer check (dias_trabajo_semana between 1 and 7),
  activo              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create table public.empleado_dias_trabajados (
  id              uuid primary key default gen_random_uuid(),
  empleado_id     uuid not null references public.users(id) on delete cascade,
  fecha           date not null,
  tipo            text not null default 'trabajado'
                    check (tipo in ('trabajado','ausencia','adicional')),
  automatico      boolean not null default true,
  nota            text,
  registrado_por  uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint empleado_dia_unico unique (empleado_id, fecha)
);

create table public.empleado_pagos (
  id              uuid primary key default gen_random_uuid(),
  empleado_id     uuid not null references public.users(id) on delete cascade,
  monto           numeric(12,2) not null check (monto >= 0),
  fecha_pago      date not null,
  periodo_inicio  date,
  periodo_fin     date,
  dias_trabajados integer,
  nota            text,
  registrado_por  uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Clima (insumo de análisis IA)
-- ---------------------------------------------------------------------
create table public.clima_registro (
  id               uuid primary key default gen_random_uuid(),
  fecha            date not null,
  temperatura_min  numeric(5,2),
  temperatura_max  numeric(5,2),
  llovio           boolean,
  precipitacion_mm numeric(6,2),
  humedad          numeric(5,2),
  descripcion      text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint clima_fecha_unica unique (fecha)
);

-- =====================================================================
-- Índices
-- =====================================================================
create index idx_users_rol on public.users(rol);

create index idx_prov_activo on public.proveedores(activo);
create index idx_prov_ciudad on public.proveedores(ciudad);
create index idx_prov_cuentas_prov on public.proveedor_cuentas_bancarias(proveedor_id);

create index idx_calzado_categoria on public.productos_calzado(categoria);
create index idx_calzado_activo on public.productos_calzado(activo);
create index idx_calzado_proveedor on public.productos_calzado(proveedor_id);
create index idx_calzado_referencia on public.productos_calzado(referencia);
create index idx_calzado_stock_bajo on public.productos_calzado(stock_actual);
create index idx_calzado_desc_trgm on public.productos_calzado using gin (descripcion extensions.gin_trgm_ops);
create index idx_hist_calzado_prod on public.historial_precios_calzado(producto_id, created_at desc);

create index idx_varios_activo on public.productos_varios(activo);
create index idx_varios_nombre_trgm on public.productos_varios using gin (nombre extensions.gin_trgm_ops);
create index idx_hist_varios_prod on public.historial_precios_varios(producto_id, created_at desc);

create index idx_ventas_created on public.ventas(created_at);
create index idx_ventas_estado on public.ventas(estado);
create index idx_ventas_vendedor on public.ventas(vendedor_id);
create index idx_ventas_cliente_tel on public.ventas(cliente_telefono);
create index idx_ventas_separadas on public.ventas(created_at) where estado = 'separada';
create index idx_venta_items_venta on public.venta_items(venta_id);
create index idx_venta_items_calzado on public.venta_items(producto_calzado_id);
create index idx_venta_items_varios on public.venta_items(producto_varios_id);
create index idx_metodos_pago_venta on public.metodos_pago_venta(venta_id);

create index idx_compras_proveedor on public.compras(proveedor_id);
create index idx_compras_estado on public.compras(estado);
create index idx_compras_vencimiento on public.compras(fecha_vencimiento) where saldo_pendiente > 0;
create index idx_compra_items_compra on public.compra_items(compra_id);
create index idx_compra_items_calzado on public.compra_items(producto_calzado_id);
create index idx_compra_docs_compra on public.compra_documentos(compra_id);
create index idx_compra_docs_prov on public.compra_documentos(proveedor_id);

create index idx_gfijos_activo on public.gastos_fijos(activo);
create index idx_gfijos_pagos_gasto on public.gastos_fijos_pagos(gasto_fijo_id);
create index idx_gfijos_pagos_periodo on public.gastos_fijos_pagos(periodo);
create index idx_gvar_fecha on public.gastos_variables(fecha);
create index idx_gvar_categoria on public.gastos_variables(categoria);

create index idx_cierres_fecha on public.cierres_caja(fecha desc);

create index idx_emp_config_empleado on public.empleado_config(empleado_id);
create index idx_emp_dias_empleado on public.empleado_dias_trabajados(empleado_id, fecha desc);
create index idx_emp_pagos_empleado on public.empleado_pagos(empleado_id, fecha_pago desc);

-- =====================================================================
-- Triggers: updated_at
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'users','proveedores','proveedor_cuentas_bancarias','productos_calzado',
    'productos_varios','ventas','compras','compra_items','gastos_fijos',
    'gastos_fijos_pagos','gastos_variables','cierres_caja','empleado_config',
    'empleado_dias_trabajados','empleado_pagos','clima_registro'
  ] loop
    execute format(
      'create trigger trg_%1$s_updated_at before update on public.%1$s
         for each row execute function private.set_updated_at()', t);
  end loop;
end $$;

-- =====================================================================
-- Triggers: historial de precios (registra cambios de precio_venta)
-- =====================================================================
create or replace function private.log_precio_calzado()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.precio_venta is distinct from old.precio_venta then
    insert into public.historial_precios_calzado
      (producto_id, precio_venta, motivo, registrado_por)
    values (new.id, new.precio_venta,
            case when tg_op = 'INSERT' then 'alta del producto' else 'cambio de precio' end,
            (select auth.uid()));
  end if;
  return new;
end;
$$;

create or replace function private.log_precio_varios()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' or new.precio_venta is distinct from old.precio_venta then
    insert into public.historial_precios_varios
      (producto_id, precio_venta, motivo, registrado_por)
    values (new.id, new.precio_venta,
            case when tg_op = 'INSERT' then 'alta del producto' else 'cambio de precio' end,
            (select auth.uid()));
  end if;
  return new;
end;
$$;

create trigger trg_calzado_precio_hist
  after insert or update of precio_venta on public.productos_calzado
  for each row execute function private.log_precio_calzado();

create trigger trg_varios_precio_hist
  after insert or update of precio_venta on public.productos_varios
  for each row execute function private.log_precio_varios();

-- =====================================================================
-- RLS: habilitar + grants a authenticated (anon no recibe nada)
-- =====================================================================
do $$
declare t text;
begin
  foreach t in array array[
    'users','proveedores','proveedor_cuentas_bancarias','productos_calzado',
    'historial_precios_calzado','productos_varios','historial_precios_varios',
    'ventas','venta_items','metodos_pago_venta','compras','compra_items',
    'compra_documentos','gastos_fijos','gastos_fijos_pagos','gastos_variables',
    'cierres_caja','empleado_config','empleado_dias_trabajados','empleado_pagos',
    'clima_registro'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
  end loop;
end $$;

-- =====================================================================
-- Políticas RLS
-- =====================================================================

-- users: cada quien ve su perfil; solo el dueño administra
create policy users_select on public.users for select to authenticated
  using (id = (select auth.uid()) or (select private.is_owner()));
create policy users_insert on public.users for insert to authenticated
  with check ((select private.is_owner()));
create policy users_update on public.users for update to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy users_delete on public.users for delete to authenticated
  using ((select private.is_owner()));

-- proveedores: ambos leen; solo el dueño escribe
create policy proveedores_select on public.proveedores for select to authenticated using (true);
create policy proveedores_insert on public.proveedores for insert to authenticated
  with check ((select private.is_owner()));
create policy proveedores_update on public.proveedores for update to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy proveedores_delete on public.proveedores for delete to authenticated
  using ((select private.is_owner()));

-- proveedor_cuentas_bancarias: solo dueño
create policy prov_cuentas_owner on public.proveedor_cuentas_bancarias for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

-- productos_calzado / productos_varios: ambos leen; solo el dueño escribe
create policy calzado_select on public.productos_calzado for select to authenticated using (true);
create policy calzado_insert on public.productos_calzado for insert to authenticated
  with check ((select private.is_owner()));
create policy calzado_update on public.productos_calzado for update to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy calzado_delete on public.productos_calzado for delete to authenticated
  using ((select private.is_owner()));

create policy varios_select on public.productos_varios for select to authenticated using (true);
create policy varios_insert on public.productos_varios for insert to authenticated
  with check ((select private.is_owner()));
create policy varios_update on public.productos_varios for update to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy varios_delete on public.productos_varios for delete to authenticated
  using ((select private.is_owner()));

-- historial de precios (incluye costo): solo dueño
create policy hist_calzado_owner on public.historial_precios_calzado for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy hist_varios_owner on public.historial_precios_varios for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

-- ventas: dueño todo; empleado ve el día en curso + separadas. Nadie hace DELETE.
create policy ventas_select on public.ventas for select to authenticated
  using (
    (select private.is_owner())
    or estado = 'separada'
    or (created_at at time zone 'America/Bogota')::date = private.hoy_bogota()
  );
create policy ventas_insert on public.ventas for insert to authenticated
  with check ((select private.is_owner()) or vendedor_id = (select auth.uid()));
create policy ventas_update on public.ventas for update to authenticated
  using (
    (select private.is_owner())
    or ((select private.is_employee())
        and (estado = 'separada'
             or (created_at at time zone 'America/Bogota')::date = private.hoy_bogota()))
  )
  with check (
    (select private.is_owner())
    or ((select private.is_employee()) and corregida = false)
  );

-- venta_items: visibilidad heredada de la venta
create policy venta_items_select on public.venta_items for select to authenticated
  using (
    (select private.is_owner())
    or exists (select 1 from public.ventas v where v.id = venta_id
      and (v.estado = 'separada'
           or (v.created_at at time zone 'America/Bogota')::date = private.hoy_bogota()))
  );
create policy venta_items_insert on public.venta_items for insert to authenticated
  with check (
    (select private.is_owner())
    or exists (select 1 from public.ventas v where v.id = venta_id
      and v.vendedor_id = (select auth.uid())
      and (v.estado = 'separada'
           or (v.created_at at time zone 'America/Bogota')::date = private.hoy_bogota()))
  );
create policy venta_items_update_owner on public.venta_items for update to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy venta_items_delete_owner on public.venta_items for delete to authenticated
  using ((select private.is_owner()));

-- metodos_pago_venta: pagos mixtos; hereda de la venta
create policy metodos_pago_select on public.metodos_pago_venta for select to authenticated
  using (
    (select private.is_owner())
    or exists (select 1 from public.ventas v where v.id = venta_id
      and (v.estado = 'separada'
           or (v.created_at at time zone 'America/Bogota')::date = private.hoy_bogota()))
  );
create policy metodos_pago_insert on public.metodos_pago_venta for insert to authenticated
  with check (
    (select private.is_owner())
    or exists (select 1 from public.ventas v where v.id = venta_id
      and (v.estado = 'separada'
           or (v.created_at at time zone 'America/Bogota')::date = private.hoy_bogota()))
  );
create policy metodos_pago_update_owner on public.metodos_pago_venta for update to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy metodos_pago_delete_owner on public.metodos_pago_venta for delete to authenticated
  using ((select private.is_owner()));

-- compras: empleado solo sus registros pendientes, sin costos
create policy compras_select on public.compras for select to authenticated
  using (
    (select private.is_owner())
    or (registrada_por = (select auth.uid()) and estado = 'pendiente_revision')
  );
create policy compras_insert on public.compras for insert to authenticated
  with check (
    (select private.is_owner())
    or ((select private.is_employee())
        and estado = 'pendiente_revision'
        and registrada_por = (select auth.uid())
        and total is null and condicion_pago is null
        and monto_pagado = 0 and saldo_pendiente = 0)
  );
create policy compras_update_owner on public.compras for update to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy compras_delete_owner on public.compras for delete to authenticated
  using ((select private.is_owner()));

create policy compra_items_select on public.compra_items for select to authenticated
  using (
    (select private.is_owner())
    or exists (select 1 from public.compras c where c.id = compra_id
      and c.registrada_por = (select auth.uid()) and c.estado = 'pendiente_revision')
  );
create policy compra_items_insert on public.compra_items for insert to authenticated
  with check (
    (select private.is_owner())
    or ((select private.is_employee())
        and costo_unitario is null and subtotal is null
        and exists (select 1 from public.compras c where c.id = compra_id
          and c.registrada_por = (select auth.uid()) and c.estado = 'pendiente_revision'))
  );
create policy compra_items_update_owner on public.compra_items for update to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy compra_items_delete_owner on public.compra_items for delete to authenticated
  using ((select private.is_owner()));

-- compra_documentos: solo dueño
create policy compra_docs_owner on public.compra_documentos for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

-- gastos: solo dueño
create policy gastos_fijos_owner on public.gastos_fijos for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy gastos_fijos_pagos_owner on public.gastos_fijos_pagos for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy gastos_variables_owner on public.gastos_variables for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

-- cierres_caja: empleado abre/cierra y ve solo el día de hoy; dueño ve histórico
create policy cierres_select on public.cierres_caja for select to authenticated
  using ((select private.is_owner()) or fecha = private.hoy_bogota());
create policy cierres_insert on public.cierres_caja for insert to authenticated
  with check ((select private.is_owner()) or fecha = private.hoy_bogota());
create policy cierres_update on public.cierres_caja for update to authenticated
  using ((select private.is_owner()) or fecha = private.hoy_bogota())
  with check ((select private.is_owner()) or fecha = private.hoy_bogota());
create policy cierres_delete_owner on public.cierres_caja for delete to authenticated
  using ((select private.is_owner()));

-- empleado (config, días, pagos): solo dueño
create policy emp_config_owner on public.empleado_config for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy emp_dias_owner on public.empleado_dias_trabajados for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy emp_pagos_owner on public.empleado_pagos for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

-- clima: lectura solo dueño (escritura por backend con service_role)
create policy clima_select_owner on public.clima_registro for select to authenticated
  using ((select private.is_owner()));
