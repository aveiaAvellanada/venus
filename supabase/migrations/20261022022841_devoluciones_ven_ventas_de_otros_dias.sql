-- Devoluciones y cambios de ventas de otros días.
--
-- Antes solo "reportes" veía ventas de días anteriores; el resto, las de hoy y
-- las separadas. Así un empleado con "devoluciones" no encontraba la venta de
-- un zapato que vuelve por garantía o cambio (casi siempre de otro día): la
-- pantalla Nueva devolución decía "Venta no encontrada".
--
-- Ahora quien tiene "devoluciones" también ve las ventas de cualquier día, con
-- sus productos y medios de pago, para buscarlas en Movimientos y procesar la
-- devolución. tiene_permiso() exige la cuenta activa, como antes.

drop policy if exists ventas_select on public.ventas;
create policy ventas_select on public.ventas for select to authenticated
  using ((select private.tiene_permiso('reportes'))
    or (select private.tiene_permiso('devoluciones'))
    or ((select private.activo())
        and (estado = 'separada' or (created_at at time zone 'America/Bogota')::date = private.hoy_bogota())));

drop policy if exists venta_items_select on public.venta_items;
create policy venta_items_select on public.venta_items for select to authenticated
  using ((select private.tiene_permiso('reportes'))
    or (select private.tiene_permiso('devoluciones'))
    or ((select private.activo()) and exists (select 1 from public.ventas v where v.id = venta_id
      and (v.estado = 'separada' or (v.created_at at time zone 'America/Bogota')::date = private.hoy_bogota()))));

drop policy if exists metodos_pago_select on public.metodos_pago_venta;
create policy metodos_pago_select on public.metodos_pago_venta for select to authenticated
  using ((select private.tiene_permiso('reportes'))
    or (select private.tiene_permiso('devoluciones'))
    or ((select private.activo()) and exists (select 1 from public.ventas v where v.id = venta_id
      and (v.estado = 'separada' or (v.created_at at time zone 'America/Bogota')::date = private.hoy_bogota()))));
