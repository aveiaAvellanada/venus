-- Ventas hechas sin conexión (modo offline de la app, 2026-10-29).
--
-- Si se va la luz o el internet, el teléfono guarda la venta y la manda cuando
-- vuelve la conexión, con la misma clave de intento (no se duplica) y la hora
-- en que se hizo. Decisiones del dueño:
--   - La venta cuenta en el día y la hora en que se hizo (created_at), aunque
--     llegue después; si la caja de ese día ya se cerró (o no se abrió) entra
--     igual y se avisa.
--   - Si al llegar falta stock (otro lo vendió, o se ajustó en el panel), se
--     guarda igual: el zapato ya salió. El stock queda en 0 (nunca negativo) y
--     se avisa para revisarlo en el conteo físico.
--
-- registrar_venta(..., p_vendida_en): con p_vendida_en es una venta hecha sin
-- conexión. Sin él funciona igual que antes (caja abierta y stock suficiente).
-- Devuelve además 'avisos' (también en un reintento). En la venta quedan
-- hecha_sin_conexion, recibida_at (cuándo llegó) y aviso_sincronizacion.

alter table public.ventas
  add column if not exists hecha_sin_conexion boolean not null default false,
  add column if not exists recibida_at timestamptz,
  add column if not exists aviso_sincronizacion text;

comment on column public.ventas.hecha_sin_conexion is
  'La venta se hizo sin internet y llegó después (recibida_at). created_at es la hora en que se hizo.';
comment on column public.ventas.aviso_sincronizacion is
  'Lo que se avisó al llegar una venta sin conexión (faltaba stock, la caja del día ya estaba cerrada…).';

-- La venta sin conexión ya ocurrió: no exige la caja de hoy abierta.
create or replace function private.exigir_caja_abierta_venta()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.hecha_sin_conexion then
    return new;
  end if;
  perform 1 from public.cierres_caja
    where fecha = private.hoy_bogota() and estado = 'abierta'
    for share;
  if not found then
    raise exception 'La caja de hoy no está abierta. Ábrela (o reábrela) para registrar ventas.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_ventas_caja_abierta on public.ventas;
create trigger trg_ventas_caja_abierta before insert on public.ventas
  for each row execute function private.exigir_caja_abierta_venta();

drop function if exists public.registrar_venta(jsonb, jsonb, numeric, text, text, text, uuid, text);

CREATE OR REPLACE FUNCTION public.registrar_venta(p_items jsonb, p_pagos jsonb, p_efectivo_recibido numeric DEFAULT NULL::numeric, p_cliente_nombre text DEFAULT NULL::text, p_cliente_apellido text DEFAULT NULL::text, p_cliente_telefono text DEFAULT NULL::text, p_clave_idempotencia uuid DEFAULT NULL::uuid, p_cliente_documento text DEFAULT NULL::text, p_vendida_en timestamp with time zone DEFAULT NULL::timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'private', 'extensions'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_venta_id uuid;
  v_numero bigint;
  v_total numeric(12,2) := 0;
  v_total_pagos numeric(12,2) := 0;
  v_efectivo_monto numeric(12,2) := 0;
  v_efectivo_recibido numeric(12,2);
  v_cambio numeric(12,2) := 0;
  it jsonb;
  v_pago jsonb;
  v_monto numeric(12,2);
  v_tipo text;
  v_pid uuid;
  v_cant numeric(12,3);
  v_precio numeric(12,2);
  v_desc text;
  v_talla text;
  v_color text;
  v_stock numeric(12,3);
  v_min numeric(12,2);
  v_max numeric(12,2);
  v_garantia integer;
  v_offline boolean := p_vendida_en is not null;
  v_avisos text[] := '{}';
  v_activo boolean;
  v_fecha date;
  v_caja text;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if not private.tiene_permiso('ventas') then
    raise exception 'No tienes permiso para vender.';
  end if;
  if p_items is null or jsonb_array_length(p_items) = 0 then
    raise exception 'La venta no tiene productos';
  end if;
  if p_pagos is null or jsonb_array_length(p_pagos) = 0 then
    raise exception 'La venta no tiene pagos';
  end if;

  -- Reintento de una venta que ya se guardó (la respuesta se perdió por la red):
  -- se devuelve la misma venta, sin volver a descontar stock ni registrar pagos.
  if p_clave_idempotencia is not null then
    select id, numero, aviso_sincronizacion into v_venta_id, v_numero, v_caja
      from public.ventas
      where clave_idempotencia = p_clave_idempotencia and vendedor_id = v_uid;
    if found then
      return jsonb_build_object('venta_id', v_venta_id, 'numero', v_numero, 'repetida', true,
                                'avisos', to_jsonb(coalesce(string_to_array(v_caja, E'\n'), '{}'::text[])));
    end if;
  end if;

  -- Venta hecha sin conexión: llega después con la hora en que se hizo (la del
  -- teléfono). Muy en el futuro o muy vieja es un reloj mal puesto.
  if v_offline and (p_vendida_en > now() + interval '10 minutes' or p_vendida_en < now() - interval '30 days') then
    raise exception 'La hora de la venta hecha sin conexión no es válida: revisa la fecha y la hora del teléfono.';
  end if;

  -- El trigger trg_ventas_caja_abierta exige la caja del día abierta, salvo
  -- en una venta hecha sin conexión: esa ya ocurrió y cuenta en su día.
  insert into public.ventas (vendedor_id, total, monto_pagado, saldo_pendiente, estado,
                             cliente_nombre, cliente_apellido, cliente_telefono,
                             cliente_documento, clave_idempotencia,
                             created_at, hecha_sin_conexion, recibida_at)
    values (v_uid, 0, 0, 0, 'completada',
            p_cliente_nombre, p_cliente_apellido, p_cliente_telefono,
            nullif(btrim(p_cliente_documento), ''), p_clave_idempotencia,
            coalesce(p_vendida_en, now()), v_offline, case when v_offline then now() end)
    on conflict (clave_idempotencia) do nothing
    returning id, numero into v_venta_id, v_numero;

  if v_venta_id is null then
    -- Un reintento simultáneo con la misma clave ganó la carrera y ya se confirmó.
    select id, numero into v_venta_id, v_numero
      from public.ventas
      where clave_idempotencia = p_clave_idempotencia and vendedor_id = v_uid;
    if not found then
      raise exception 'Clave de venta inválida';
    end if;
    return jsonb_build_object('venta_id', v_venta_id, 'numero', v_numero, 'repetida', true);
  end if;

  for it in
    select value from jsonb_array_elements(p_items)
    order by value->>'producto_id'
  loop
    v_tipo := it->>'tipo';
    if it->>'producto_id' is null then
      raise exception 'Item sin producto_id';
    end if;
    v_pid  := (it->>'producto_id')::uuid;
    v_cant := (it->>'cantidad')::numeric;
    if v_cant is null or v_cant <= 0 then
      raise exception 'Cantidad inválida';
    end if;
    if it->>'precio' is null then
      raise exception 'Item sin precio';
    end if;
    v_precio := round((it->>'precio')::numeric, 2);
    if v_precio <= 0 then
      raise exception 'Precio inválido';
    end if;
    if v_tipo = 'calzado' and v_cant <> trunc(v_cant) then
      raise exception 'La cantidad de calzado debe ser entera';
    end if;

    v_min := null;
    v_max := null;
    v_garantia := null;
    if v_tipo = 'calzado' then
      select descripcion, talla, color, stock_actual, precio_minimo, precio_maximo, garantia_dias, activo
        into v_desc, v_talla, v_color, v_stock, v_min, v_max, v_garantia, v_activo
        from public.productos_calzado
        where id = v_pid
        for update;
      -- Sin conexión el zapato ya salió de la tienda: se registra aunque lo
      -- hayan desactivado o falte stock (el stock queda en 0, nunca negativo) y
      -- se avisa para revisarlo en el conteo.
      if v_desc is null or (not v_activo and not v_offline) then
        raise exception 'Producto no disponible';
      end if;
      if v_stock < v_cant then
        if not v_offline then
          raise exception 'Stock insuficiente para %', v_desc;
        end if;
        v_avisos := v_avisos || format('Faltaba stock de %s talla %s%s: se vendieron %s y había %s. Revísalo en el conteo físico.',
          v_desc, coalesce(v_talla, 'única'), coalesce(' ' || v_color, ''), v_cant::int, greatest(v_stock, 0)::int);
      end if;
      if not v_activo then
        v_avisos := v_avisos || format('%s talla %s estaba desactivado y se vendió sin conexión.', v_desc, coalesce(v_talla, 'única'));
      end if;
      -- El mínimo y el máximo son precios RECOMENDADOS (PRD v4.0): el precio final
      -- de la venta es libre (regateo, varios pares, ofertas) y queda guardado
      -- por item junto con los recomendados de ese momento (snapshots).
      update public.productos_calzado set stock_actual = greatest(stock_actual - v_cant, 0) where id = v_pid;
    elsif v_tipo = 'varios' then
      select nombre into v_desc
        from public.productos_varios
        where id = v_pid and (activo or v_offline);
      if v_desc is null then
        raise exception 'Producto no disponible';
      end if;
      v_talla := null;
      v_color := null;
    else
      raise exception 'Tipo de producto inválido: %', v_tipo;
    end if;

    insert into public.venta_items (venta_id, tipo_producto,
        producto_calzado_id, producto_varios_id,
        descripcion_snapshot, talla, color, cantidad, precio_unitario, subtotal,
        precio_minimo_snapshot, precio_maximo_snapshot, garantia_dias_snapshot)
      values (v_venta_id, v_tipo,
        case when v_tipo = 'calzado' then v_pid end,
        case when v_tipo = 'varios'  then v_pid end,
        v_desc, v_talla, v_color, v_cant, v_precio, round(v_precio * v_cant, 2),
        v_min, v_max, v_garantia);

    v_total := v_total + round(v_precio * v_cant, 2);
  end loop;

  for v_pago in select value from jsonb_array_elements(p_pagos)
  loop
    if (v_pago->>'metodo') not in ('efectivo','nequi','bre_b','otro') then
      raise exception 'Método de pago inválido';
    end if;
    v_monto := round((v_pago->>'monto')::numeric, 2);
    if v_monto <= 0 then
      raise exception 'Monto de pago inválido';
    end if;
    v_total_pagos := v_total_pagos + v_monto;
    if (v_pago->>'metodo') = 'efectivo' then
      v_efectivo_monto := v_efectivo_monto + v_monto;
    end if;
    insert into public.metodos_pago_venta (venta_id, metodo, monto, es_anticipo)
      values (v_venta_id, v_pago->>'metodo', v_monto, false);
  end loop;

  if v_total_pagos <> v_total then
    raise exception 'Los pagos no suman el total';
  end if;

  if v_efectivo_monto > 0 then
    v_efectivo_recibido := coalesce(p_efectivo_recibido, v_efectivo_monto);
    if v_efectivo_recibido < v_efectivo_monto then
      raise exception 'El efectivo recibido es menor al pago en efectivo';
    end if;
    v_cambio := v_efectivo_recibido - v_efectivo_monto;
  else
    v_efectivo_recibido := null;
    v_cambio := 0;
  end if;

  -- La caja del día de una venta sin conexión ya cerrada (o que no se abrió):
  -- la venta cuenta en ese día pero no está en lo que se guardó al cerrar.
  if v_offline then
    v_fecha := (p_vendida_en at time zone 'America/Bogota')::date;
    select estado into v_caja from public.cierres_caja where fecha = v_fecha;
    if v_caja is null then
      v_avisos := v_avisos || format('La caja del %s no se había abierto: esta venta cuenta en ese día.', to_char(v_fecha, 'DD/MM/YYYY'));
    elsif v_caja <> 'abierta' then
      v_avisos := v_avisos || format('La caja del %s ya estaba cerrada: esta venta no está en ese cierre. Revisa la diferencia.', to_char(v_fecha, 'DD/MM/YYYY'));
    end if;
  end if;

  update public.ventas
    set total = v_total, monto_pagado = v_total, saldo_pendiente = 0,
        efectivo_recibido = v_efectivo_recibido, cambio = v_cambio,
        aviso_sincronizacion = nullif(array_to_string(v_avisos, E'\n'), '')
        where id = v_venta_id;

  return jsonb_build_object('venta_id', v_venta_id, 'numero', v_numero, 'repetida', false, 'avisos', to_jsonb(v_avisos));
end;
$function$;

revoke all on function public.registrar_venta(jsonb, jsonb, numeric, text, text, text, uuid, text, timestamptz) from public, anon;
grant execute on function public.registrar_venta(jsonb, jsonb, numeric, text, text, text, uuid, text, timestamptz) to authenticated;
