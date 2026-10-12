-- Panel web, fase 1, entrega 2 (Proveedores; docs/panel-web-fase1.md, A8):
--
-- 1. registrar_pago_proveedor: abono o pago total a una compra a crédito, en
--    una sola llamada que valida contra el saldo con la fila bloqueada. Hasta
--    ahora el tope "no pagar más que el saldo" lo revisaba solo la app; la
--    tabla lo aceptaba y el saldo quedaba en 0 escondiendo el sobrepago. Pide
--    el permiso `deudas` (por defecto, solo el dueño). El pago queda en
--    compra_pagos; los triggers de siempre recalculan monto_pagado y saldo, y
--    la auditoría registra el pago.
-- 2. Bucket privado `proveedores` en Storage para los documentos del
--    proveedor (RUT, cámara de comercio, facturas en PDF o foto). La fila va
--    en compra_documentos (con proveedor_id), cuya RLS ya pide el permiso
--    `proveedores`; los archivos piden el mismo permiso.

-- ===== 1. Pagos a proveedores =====
create or replace function public.registrar_pago_proveedor(
  p_compra_id uuid,
  p_monto numeric,
  p_fecha date default null,
  p_notas text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estado    text;
  v_condicion text;
  v_saldo     numeric(12,2);
  v_monto     numeric(12,2) := round(p_monto, 2);
  v_pago      uuid;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if not private.tiene_permiso('deudas') then
    raise exception 'No tienes permiso para registrar pagos a proveedores.';
  end if;

  select estado, condicion_pago, saldo_pendiente
    into v_estado, v_condicion, v_saldo
    from public.compras
    where id = p_compra_id
    for update;
  if not found then
    raise exception 'La compra no existe.';
  end if;
  if v_estado is distinct from 'completada' or v_condicion is distinct from 'credito' then
    raise exception 'Solo se registran pagos a compras completadas a crédito.';
  end if;
  if v_monto is null or v_monto <= 0 then
    raise exception 'El monto del pago debe ser mayor a cero.';
  end if;
  if v_monto > v_saldo then
    raise exception 'El pago de % supera el saldo pendiente de %.',
      private.fmt_cop(v_monto), private.fmt_cop(v_saldo);
  end if;
  if p_fecha is not null and p_fecha > private.hoy_bogota() then
    raise exception 'La fecha del pago no puede ser futura.';
  end if;

  insert into public.compra_pagos (compra_id, monto, fecha, registrado_por, notas)
    values (p_compra_id, v_monto, coalesce(p_fecha, private.hoy_bogota()), auth.uid(),
            nullif(btrim(p_notas), ''))
    returning id into v_pago;

  return jsonb_build_object(
    'pago_id', v_pago,
    'saldo_pendiente', (select saldo_pendiente from public.compras where id = p_compra_id)
  );
end;
$$;

revoke all on function public.registrar_pago_proveedor(uuid, numeric, date, text) from public, anon;
grant execute on function public.registrar_pago_proveedor(uuid, numeric, date, text) to authenticated;

-- ===== 2. Documentos del proveedor en Storage =====
insert into storage.buckets (id, name, public)
  values ('proveedores', 'proveedores', false)
  on conflict (id) do nothing;

drop policy if exists "Documentos de proveedores: ver" on storage.objects;
create policy "Documentos de proveedores: ver" on storage.objects for select to authenticated
  using (bucket_id = 'proveedores' and (select private.tiene_permiso('proveedores')));

drop policy if exists "Documentos de proveedores: subir" on storage.objects;
create policy "Documentos de proveedores: subir" on storage.objects for insert to authenticated
  with check (bucket_id = 'proveedores' and (select private.tiene_permiso('proveedores')));

drop policy if exists "Documentos de proveedores: borrar" on storage.objects;
create policy "Documentos de proveedores: borrar" on storage.objects for delete to authenticated
  using (bucket_id = 'proveedores' and (select private.tiene_permiso('proveedores')));
