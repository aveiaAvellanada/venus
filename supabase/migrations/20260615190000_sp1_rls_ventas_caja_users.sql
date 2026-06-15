-- SP-1 RLS: ventas/items/pagos y caja suman admin; users ve lista para admin.

-- ventas: admin ve todo; empleado hoy + separadas
drop policy if exists ventas_select on public.ventas;
drop policy if exists ventas_insert on public.ventas;
drop policy if exists ventas_update on public.ventas;
create policy ventas_select on public.ventas for select to authenticated
  using ((select private.is_staff_admin())
    or estado = 'separada'
    or (created_at at time zone 'America/Bogota')::date = private.hoy_bogota());
create policy ventas_insert on public.ventas for insert to authenticated
  with check ((select private.is_staff_admin()) or vendedor_id = (select auth.uid()));
create policy ventas_update on public.ventas for update to authenticated
  using ((select private.is_staff_admin())
    or ((select private.is_employee())
        and (estado = 'separada'
             or (created_at at time zone 'America/Bogota')::date = private.hoy_bogota())))
  with check ((select private.is_staff_admin())
    or ((select private.is_employee()) and corregida = false));

-- venta_items: SELECT suma admin; INSERT igual con is_staff_admin; UPDATE/DELETE quedan solo dueño
drop policy if exists venta_items_select on public.venta_items;
drop policy if exists venta_items_insert on public.venta_items;
create policy venta_items_select on public.venta_items for select to authenticated
  using ((select private.is_staff_admin())
    or exists (select 1 from public.ventas v where v.id = venta_id
      and (v.estado = 'separada'
           or (v.created_at at time zone 'America/Bogota')::date = private.hoy_bogota())));
create policy venta_items_insert on public.venta_items for insert to authenticated
  with check ((select private.is_staff_admin())
    or exists (select 1 from public.ventas v where v.id = venta_id
      and v.vendedor_id = (select auth.uid())
      and (v.estado = 'separada'
           or (v.created_at at time zone 'America/Bogota')::date = private.hoy_bogota())));

-- metodos_pago_venta: SELECT/INSERT suman admin; UPDATE/DELETE quedan solo dueño
drop policy if exists metodos_pago_select on public.metodos_pago_venta;
drop policy if exists metodos_pago_insert on public.metodos_pago_venta;
create policy metodos_pago_select on public.metodos_pago_venta for select to authenticated
  using ((select private.is_staff_admin())
    or exists (select 1 from public.ventas v where v.id = venta_id
      and (v.estado = 'separada'
           or (v.created_at at time zone 'America/Bogota')::date = private.hoy_bogota())));
create policy metodos_pago_insert on public.metodos_pago_venta for insert to authenticated
  with check ((select private.is_staff_admin())
    or exists (select 1 from public.ventas v where v.id = venta_id
      and (v.estado = 'separada'
           or (v.created_at at time zone 'America/Bogota')::date = private.hoy_bogota())));

-- cierres_caja: admin ve histórico; todos abren/cierran y ven hoy
drop policy if exists cierres_select on public.cierres_caja;
drop policy if exists cierres_insert on public.cierres_caja;
drop policy if exists cierres_update on public.cierres_caja;
drop policy if exists cierres_delete_owner on public.cierres_caja;
create policy cierres_select on public.cierres_caja for select to authenticated
  using ((select private.is_staff_admin()) or fecha = private.hoy_bogota());
create policy cierres_insert on public.cierres_caja for insert to authenticated
  with check ((select private.is_staff_admin()) or fecha = private.hoy_bogota());
create policy cierres_update on public.cierres_caja for update to authenticated
  using ((select private.is_staff_admin()) or fecha = private.hoy_bogota())
  with check ((select private.is_staff_admin()) or fecha = private.hoy_bogota());
create policy cierres_delete on public.cierres_caja for delete to authenticated
  using ((select private.is_staff_admin()));

-- users: cada quien se ve; admin+dueño ven la lista. Escritura sigue solo dueño.
drop policy if exists users_select on public.users;
create policy users_select on public.users for select to authenticated
  using (id = (select auth.uid()) or (select private.is_staff_admin()));
