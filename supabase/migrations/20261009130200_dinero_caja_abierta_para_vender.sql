-- Dinero 3/3: vender o devolver exige la caja del día abierta.
--
-- Solo la pantalla de Nueva Venta lo verificaba, y al cargar: otro teléfono
-- podía seguir vendiendo después del cierre, y esas ventas quedaban fuera de
-- los totales guardados en el cierre. Devoluciones no lo verificaba en ningún
-- lado, aunque mueven dinero de la caja.
--
-- El trigger toma un bloqueo compartido (FOR SHARE) sobre la fila de caja del
-- día: un cierre en curso (cerrar_caja hace FOR UPDATE) espera a que terminen
-- las ventas que ya empezaron, y las que llegan después ven la caja cerrada.

create or replace function private.exigir_caja_abierta()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.cierres_caja
    where fecha = private.hoy_bogota() and estado = 'abierta'
    for share;
  if not found then
    raise exception 'La caja de hoy no está abierta. Ábrela (o reábrela) para registrar %.',
      case tg_table_name when 'ventas' then 'ventas' else 'devoluciones' end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ventas_caja_abierta on public.ventas;
create trigger trg_ventas_caja_abierta before insert on public.ventas
  for each row execute function private.exigir_caja_abierta();

drop trigger if exists trg_devoluciones_caja_abierta on public.devoluciones;
create trigger trg_devoluciones_caja_abierta before insert on public.devoluciones
  for each row execute function private.exigir_caja_abierta();
