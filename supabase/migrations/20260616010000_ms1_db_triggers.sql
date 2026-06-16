-- Migration: 20260616010000_ms1_db_triggers.sql
-- Description: Create compra_pagos table, indices, RLS policies, trigger functions for payments, stock increment, and saldo recalculation.

drop table if exists public.compra_pagos cascade;

-- 1. Create public.compra_pagos table
create table public.compra_pagos (
  id              uuid primary key default gen_random_uuid(),
  compra_id       uuid not null references public.compras(id) on delete cascade,
  monto           numeric(12,2) not null check (monto > 0),
  fecha           date not null default current_date,
  notas           text,
  registrado_por  uuid references public.users(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  created_by      uuid references public.users(id) on delete set null,
  updated_by      uuid references public.users(id) on delete set null
);

-- Comment on table and columns
comment on table public.compra_pagos is 'Pagos realizados a compras de proveedores.';

-- 2. Foreign key indices for compra_id and registrado_por
create index if not exists idx_compra_pagos_compra_id on public.compra_pagos(compra_id);
create index if not exists idx_compra_pagos_registrado_por on public.compra_pagos(registrado_por);

-- 3. Grant privileges on public.compra_pagos
grant select, insert, update, delete on public.compra_pagos to authenticated, service_role;

-- 4. Enable Row Level Security (RLS) on compra_pagos
alter table public.compra_pagos enable row level security;

-- 5. Row-level security (RLS) policies allowing only STAFF_ADMIN to read/write
drop policy if exists compra_pagos_admin on public.compra_pagos;
create policy compra_pagos_admin on public.compra_pagos for all to authenticated
  using ((select private.is_staff_admin()))
  with check ((select private.is_staff_admin()));

-- 6. Trigger to automatically assign registrado_por := auth.uid() on INSERT if it is null
-- and prevent spoofing/modification on UPDATE
create or replace function private.compra_pagos_set_registrado_por()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.registrado_por is null then
      new.registrado_por := auth.uid();
    end if;
  elsif tg_op = 'UPDATE' then
    if new.registrado_por is distinct from old.registrado_por then
      raise exception 'No se permite modificar el campo registrado_por';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_compra_pagos_registrado_por on public.compra_pagos;
create trigger trg_compra_pagos_registrado_por
  before insert or update on public.compra_pagos
  for each row execute function private.compra_pagos_set_registrado_por();

-- 7. Setup updated_at trigger on compra_pagos
drop trigger if exists trg_compra_pagos_updated_at on public.compra_pagos;
create trigger trg_compra_pagos_updated_at
  before update on public.compra_pagos
  for each row execute function private.set_updated_at();

-- 8. Setup audit trigger on compra_pagos (set_audit_fields)
drop trigger if exists trg_compra_pagos_audit on public.compra_pagos;
create trigger trg_compra_pagos_audit
  before insert or update on public.compra_pagos
  for each row execute function private.set_audit_fields();

-- 9. Trigger function to automatically increment product stock by cantidad (if purchase state is NOT 'cancelada')
create or replace function private.compra_items_stock_increment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_estado text;
begin
  select estado into v_estado
  from public.compras
  where id = new.compra_id;

  if v_estado is distinct from 'cancelada' and new.producto_calzado_id is not null then
    update public.productos_calzado
    set stock_actual = stock_actual + new.cantidad
    where id = new.producto_calzado_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_compra_items_stock_increment on public.compra_items;
create trigger trg_compra_items_stock_increment
  after insert on public.compra_items
  for each row execute function private.compra_items_stock_increment();

-- Helper Trigger for stock adjustments on compra_items UPDATE or DELETE
create or replace function private.compra_items_stock_adjustment()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_compra_id uuid;
  v_estado text;
begin
  if tg_op = 'DELETE' then
    v_compra_id := old.compra_id;
  else
    v_compra_id := new.compra_id;
  end if;

  select estado into v_estado
  from public.compras
  where id = v_compra_id;

  if v_estado is distinct from 'cancelada' then
    if tg_op = 'UPDATE' then
      if old.producto_calzado_id is distinct from new.producto_calzado_id then
        if old.producto_calzado_id is not null then
          update public.productos_calzado
          set stock_actual = stock_actual - old.cantidad
          where id = old.producto_calzado_id;
        end if;
        if new.producto_calzado_id is not null then
          update public.productos_calzado
          set stock_actual = stock_actual + new.cantidad
          where id = new.producto_calzado_id;
        end if;
      elsif new.producto_calzado_id is not null and old.cantidad is distinct from new.cantidad then
        update public.productos_calzado
        set stock_actual = stock_actual + (new.cantidad - old.cantidad)
        where id = new.producto_calzado_id;
      end if;
    elsif tg_op = 'DELETE' then
      if old.producto_calzado_id is not null then
        update public.productos_calzado
        set stock_actual = stock_actual - old.cantidad
        where id = old.producto_calzado_id;
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

drop trigger if exists trg_compra_items_stock_adjustment on public.compra_items;
create trigger trg_compra_items_stock_adjustment
  after update or delete on public.compra_items
  for each row execute function private.compra_items_stock_adjustment();

-- 10. Trigger function to automatically handle stock adjustments on compras (status updates and deletion)
create or replace function private.compras_stock_adjustment()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'UPDATE' then
    if old.estado is distinct from new.estado then
      -- Transition to active from 'cancelada'
      if old.estado = 'cancelada' and new.estado is distinct from 'cancelada' then
        update public.productos_calzado pc
        set stock_actual = pc.stock_actual + ci.cantidad
        from public.compra_items ci
        where ci.compra_id = new.id
          and ci.producto_calzado_id = pc.id;
      -- Transition to 'cancelada' from active
      elsif old.estado is distinct from 'cancelada' and new.estado = 'cancelada' then
        update public.productos_calzado pc
        set stock_actual = pc.stock_actual - ci.cantidad
        from public.compra_items ci
        where ci.compra_id = new.id
          and ci.producto_calzado_id = pc.id;
      end if;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.estado is distinct from 'cancelada' then
      update public.productos_calzado pc
      set stock_actual = pc.stock_actual - ci.cantidad
      from public.compra_items ci
      where ci.compra_id = old.id
        and ci.producto_calzado_id = pc.id;
    end if;
    return old;
  end if;
end;
$$;

drop trigger if exists trg_compras_stock_adjustment_update on public.compras;
create trigger trg_compras_stock_adjustment_update
  after update on public.compras
  for each row execute function private.compras_stock_adjustment();

drop trigger if exists trg_compras_stock_adjustment_delete on public.compras;
create trigger trg_compras_stock_adjustment_delete
  before delete on public.compras
  for each row execute function private.compras_stock_adjustment();

-- 11. Trigger function to automatically calculate saldo_pendiente := greatest(0.00, coalesce(total, 0.00) - monto_pagado)
create or replace function private.compras_recalculate_saldo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.saldo_pendiente := greatest(0.00, coalesce(new.total, 0.00) - coalesce(new.monto_pagado, 0.00));
  return new;
end;
$$;

drop trigger if exists trg_compras_recalculate_saldo on public.compras;
create trigger trg_compras_recalculate_saldo
  before insert or update on public.compras
  for each row execute function private.compras_recalculate_saldo();

-- 12. Trigger function to validate payment constraints
create or replace function private.compra_pagos_validate()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_estado text;
  v_condicion_pago text;
begin
  select estado, condicion_pago into v_estado, v_condicion_pago
  from public.compras
  where id = new.compra_id;

  if v_estado is distinct from 'completada' then
    raise exception 'Solo se pueden registrar pagos a compras completadas.';
  end if;

  if v_condicion_pago is distinct from 'credito' then
    raise exception 'Solo se pueden registrar pagos a compras a crédito.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_compra_pagos_validate on public.compra_pagos;
create trigger trg_compra_pagos_validate
  before insert or update on public.compra_pagos
  for each row execute function private.compra_pagos_validate();

-- 13. Trigger function to sum monto of payments for the purchase and update compras.monto_pagado
create or replace function private.compra_pagos_update_totals()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_compra_id uuid;
  v_total_pagos numeric(12,2);
begin
  if tg_op = 'DELETE' then
    v_compra_id := old.compra_id;
  else
    v_compra_id := new.compra_id;
  end if;

  -- Calculate sum of payments for this purchase
  select coalesce(sum(monto), 0.00) into v_total_pagos
  from public.compra_pagos
  where compra_id = v_compra_id;

  -- Update compras.monto_pagado
  update public.compras
  set monto_pagado = v_total_pagos
  where id = v_compra_id;

  -- Handle change of compra_id in UPDATE
  if tg_op = 'UPDATE' and old.compra_id is distinct from new.compra_id then
    select coalesce(sum(monto), 0.00) into v_total_pagos
    from public.compra_pagos
    where compra_id = old.compra_id;

    update public.compras
    set monto_pagado = v_total_pagos
    where id = old.compra_id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  else
    return new;
  end if;
end;
$$;

drop trigger if exists trg_compra_pagos_update_totals on public.compra_pagos;
create trigger trg_compra_pagos_update_totals
  after insert or update or delete on public.compra_pagos
  for each row execute function private.compra_pagos_update_totals();

-- 14. Helper function public.obtener_deuda_proveedor(p_id uuid) returns numeric
create or replace function public.obtener_deuda_proveedor(p_id uuid)
returns numeric language plpgsql security definer set search_path = '' as $$
declare
  v_deuda numeric(12,2);
begin
  -- check if is staff admin
  if not private.is_staff_admin() then
    raise exception 'Acceso denegado: se requieren permisos de administrador';
  end if;

  select coalesce(sum(saldo_pendiente), 0.00) into v_deuda
  from public.compras
  where proveedor_id = p_id
    and condicion_pago = 'credito'
    and estado = 'completada';

  return v_deuda;
end;
$$;

-- 15. Grants and privilege adjustments
grant execute on function public.obtener_deuda_proveedor(uuid) to authenticated, service_role;
grant execute on function private.compra_pagos_set_registrado_por() to authenticated, service_role;
grant execute on function private.compra_items_stock_increment() to authenticated, service_role;
grant execute on function private.compra_items_stock_adjustment() to authenticated, service_role;
grant execute on function private.compras_stock_adjustment() to authenticated, service_role;
grant execute on function private.compras_recalculate_saldo() to authenticated, service_role;
grant execute on function private.compra_pagos_validate() to authenticated, service_role;
grant execute on function private.compra_pagos_update_totals() to authenticated, service_role;
