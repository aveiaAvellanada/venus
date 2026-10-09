-- Seguridad 1/4: las ventas solo se escriben vía RPC.
--
-- Antes, la política ventas_update dejaba a cualquier empleado cambiar CUALQUIER
-- columna de las ventas del día por la Data API (la clave pública va en el APK):
-- con estado = 'cancelada' una venta desaparecía de todos los reportes y del
-- cierre de caja, sin más rastro que updated_by. venta_items y
-- metodos_pago_venta también aceptaban INSERT directo.
--
-- registrar_venta y registrar_devolucion son SECURITY DEFINER y no dependen de
-- estos privilegios. Una corrección futura de ventas (nota/corrección del PRD)
-- debe ir por su propia RPC auditada, no por UPDATE directo.

drop policy if exists ventas_insert on public.ventas;
drop policy if exists ventas_update on public.ventas;
drop policy if exists venta_items_insert on public.venta_items;
drop policy if exists venta_items_update_owner on public.venta_items;
drop policy if exists venta_items_delete_owner on public.venta_items;
drop policy if exists metodos_pago_insert on public.metodos_pago_venta;
drop policy if exists metodos_pago_update_owner on public.metodos_pago_venta;
drop policy if exists metodos_pago_delete_owner on public.metodos_pago_venta;

revoke insert, update, delete on public.ventas, public.venta_items, public.metodos_pago_venta
  from anon, authenticated;
grant select on public.ventas, public.venta_items, public.metodos_pago_venta to authenticated;
