-- SP-1: auditoría base (created_by / updated_by) + trigger.

do $$
declare t text;
begin
  foreach t in array array[
    'productos_calzado','productos_varios','proveedores','proveedor_cuentas_bancarias',
    'compras','compra_items','gastos_fijos','gastos_fijos_pagos','gastos_variables',
    'cierres_caja','ventas','venta_items','metodos_pago_venta'
  ] loop
    execute format('alter table public.%1$s add column if not exists created_by uuid references public.users(id)', t);
    execute format('alter table public.%1$s add column if not exists updated_by uuid references public.users(id)', t);
  end loop;
end $$;

create or replace function private.set_audit_fields()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    if new.created_by is null then new.created_by := auth.uid(); end if;
  elsif tg_op = 'UPDATE' then
    new.updated_by := auth.uid();
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array[
    'productos_calzado','productos_varios','proveedores','proveedor_cuentas_bancarias',
    'compras','compra_items','gastos_fijos','gastos_fijos_pagos','gastos_variables',
    'cierres_caja','ventas','venta_items','metodos_pago_venta'
  ] loop
    execute format('drop trigger if exists trg_%1$s_audit on public.%1$s', t);
    execute format('create trigger trg_%1$s_audit before insert or update on public.%1$s
      for each row execute function private.set_audit_fields()', t);
  end loop;
end $$;
