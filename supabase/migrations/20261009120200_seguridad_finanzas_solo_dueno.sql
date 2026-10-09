-- Seguridad 3/4: costos de compra, deudas y pagos a proveedores solo para el dueño.
--
-- PRD v4.0 §2: Sandra (admin) NO ve costos ni deudas con proveedores. La UI lo
-- ocultaba, pero la RLS le daba SELECT completo a compras (total, saldo),
-- compra_items (costo_unitario) y compra_pagos, y obtener_deuda_proveedor
-- aceptaba is_staff_admin(). RLS es la frontera real: se cierra aquí.
--
-- Lo operativo no cambia: admin y empleados registran llegadas físicas (sin
-- costos) y admin ve todas las llegadas pendientes de revisión. Las filas
-- pendientes no llevan datos financieros (el insert lo exige).

-- compras
drop policy if exists compras_select on public.compras;
drop policy if exists compras_insert on public.compras;
drop policy if exists compras_update on public.compras;
drop policy if exists compras_delete on public.compras;

create policy compras_select on public.compras for select to authenticated
  using ((select private.is_owner())
    or (estado = 'pendiente_revision' and total is null
        and ((select private.is_admin()) or registrada_por = (select auth.uid()))));

create policy compras_insert on public.compras for insert to authenticated
  with check ((select private.is_owner())
    or (estado = 'pendiente_revision'
        and registrada_por = (select auth.uid())
        and total is null and condicion_pago is null
        and monto_pagado = 0 and saldo_pendiente = 0));

create policy compras_update on public.compras for update to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

-- El no-dueño solo puede deshacer su propia llegada mientras no tenga ítems
-- (rollback de la app si falla el insert de ítems); la mercancía recibida no se borra.
-- SECURITY DEFINER: cuenta también ítems que la RLS le oculta a quien borra.
create or replace function private.compra_tiene_items(p_compra_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.compra_items where compra_id = p_compra_id)
$$;
grant execute on function private.compra_tiene_items(uuid) to authenticated, service_role;

create policy compras_delete on public.compras for delete to authenticated
  using ((select private.is_owner())
    or (estado = 'pendiente_revision' and registrada_por = (select auth.uid())
        and not private.compra_tiene_items(id)));

-- compra_items
drop policy if exists compra_items_select on public.compra_items;
drop policy if exists compra_items_insert on public.compra_items;
drop policy if exists compra_items_update on public.compra_items;
drop policy if exists compra_items_delete on public.compra_items;

create policy compra_items_select on public.compra_items for select to authenticated
  using ((select private.is_owner())
    or (costo_unitario is null and subtotal is null
        and exists (select 1 from public.compras c where c.id = compra_id
          and c.estado = 'pendiente_revision'
          and ((select private.is_admin()) or c.registrada_por = (select auth.uid())))));

create policy compra_items_insert on public.compra_items for insert to authenticated
  with check ((select private.is_owner())
    or (costo_unitario is null and subtotal is null
        and exists (select 1 from public.compras c where c.id = compra_id
          and c.estado = 'pendiente_revision' and c.registrada_por = (select auth.uid()))));

create policy compra_items_update on public.compra_items for update to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));
create policy compra_items_delete on public.compra_items for delete to authenticated
  using ((select private.is_owner()));

-- compra_pagos (abonos = deuda): solo dueño
drop policy if exists compra_pagos_admin on public.compra_pagos;
drop policy if exists compra_pagos_owner on public.compra_pagos;
create policy compra_pagos_owner on public.compra_pagos for all to authenticated
  using ((select private.is_owner())) with check ((select private.is_owner()));

-- Deuda consolidada por proveedor: solo dueño
create or replace function public.obtener_deuda_proveedor(p_id uuid)
returns numeric language plpgsql security definer set search_path = '' as $$
declare
  v_deuda numeric(12,2);
begin
  if not private.is_owner() then
    raise exception 'Acceso denegado: solo el dueño ve la deuda con proveedores';
  end if;

  select coalesce(sum(saldo_pendiente), 0.00) into v_deuda
  from public.compras
  where proveedor_id = p_id
    and condicion_pago = 'credito'
    and estado = 'completada';

  return v_deuda;
end;
$$;
