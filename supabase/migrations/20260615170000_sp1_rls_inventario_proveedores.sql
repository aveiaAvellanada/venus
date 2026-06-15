-- SP-1 RLS: inventario editable por todo el staff; proveedores admin+dueño.

-- productos_calzado: SELECT abierto (sin cambio); INSERT/UPDATE todo el staff; DELETE admin/dueño
drop policy if exists calzado_insert on public.productos_calzado;
drop policy if exists calzado_update on public.productos_calzado;
drop policy if exists calzado_delete on public.productos_calzado;
create policy calzado_insert on public.productos_calzado for insert to authenticated with check (true);
create policy calzado_update on public.productos_calzado for update to authenticated using (true) with check (true);
create policy calzado_delete on public.productos_calzado for delete to authenticated using ((select private.is_staff_admin()));

-- productos_varios: igual
drop policy if exists varios_insert on public.productos_varios;
drop policy if exists varios_update on public.productos_varios;
drop policy if exists varios_delete on public.productos_varios;
create policy varios_insert on public.productos_varios for insert to authenticated with check (true);
create policy varios_update on public.productos_varios for update to authenticated using (true) with check (true);
create policy varios_delete on public.productos_varios for delete to authenticated using ((select private.is_staff_admin()));

-- historial_precios (costos): sin cambio (solo dueño). Se dejan tal cual.

-- proveedores: SELECT abierto (para elegir al recibir mercancía); escritura admin+dueño
drop policy if exists proveedores_insert on public.proveedores;
drop policy if exists proveedores_update on public.proveedores;
drop policy if exists proveedores_delete on public.proveedores;
create policy proveedores_insert on public.proveedores for insert to authenticated with check ((select private.is_staff_admin()));
create policy proveedores_update on public.proveedores for update to authenticated using ((select private.is_staff_admin())) with check ((select private.is_staff_admin()));
create policy proveedores_delete on public.proveedores for delete to authenticated using ((select private.is_staff_admin()));

-- proveedor_cuentas_bancarias: admin+dueño (antes solo dueño)
drop policy if exists prov_cuentas_owner on public.proveedor_cuentas_bancarias;
create policy prov_cuentas_admin on public.proveedor_cuentas_bancarias for all to authenticated
  using ((select private.is_staff_admin())) with check ((select private.is_staff_admin()));
