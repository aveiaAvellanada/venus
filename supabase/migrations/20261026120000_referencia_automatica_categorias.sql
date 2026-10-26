-- Referencia automática y categorías nuevas del calzado.
--
-- 1. Categorías: se agregan "Botas material", "Futbol" e "Infantil" y sale
--    "Deportivo". Lo que era Deportivo pasa a Futbol si la descripción habla
--    de fútbol (guayos, futsal…), a Infantil si es de niño, y si no a Tennis.
-- 2. Referencia: es el código que une todas las tallas y colores de un mismo
--    zapato (precios por rango, garantía, foto, reconocerlo al comprar). Casi
--    nadie la escribe, así que ahora la pone la base:
--      <CATEGORÍA>-<MARCA>-<NÚMERO>, p. ej. TEN-NIKE-012
--    categoría en 3 letras, las primeras 4 letras de la marca (SM sin marca) y
--    un consecutivo por esa combinación. No lleva color ni talla (es de todo
--    el modelo) y no cambia aunque después se corrija la marca o la categoría.
--    - Al crear un zapato sin referencia: si ya hay uno con la misma
--      descripción y marca, se le pone ese mismo código (es otra talla u otro
--      color del modelo); si no, uno nuevo.
--    - Una referencia ya puesta no se borra, y cambiarla es solo del dueño.
--    - Los zapatos que ya existen sin referencia reciben la suya, agrupados por
--      descripción y marca. Las referencias que ya estaban no se tocan.
--    - referencia_para_modelo(): el código que tendrá un zapato antes de
--      guardarlo (para nombrar su foto).
-- 3. registrar_compra y cargar_inventario: una talla que llega sin referencia
--    se reconoce por descripción + marca + color + talla (antes solo entre los
--    zapatos sin referencia, que ya no hay). Ahora además registrar_compra
--    guarda en compra_items la referencia que quedó.

-- ===== 1. Categorías =====

-- El CHECK de la categoría, se llame como se llame.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.productos_calzado'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%categoria%'
  loop
    execute format('alter table public.productos_calzado drop constraint %I', c.conname);
  end loop;
end $$;

update public.productos_calzado
  set categoria = case
    when descripcion ~* '(guayo|f[uú]tbol|futsal|microf)' then 'Futbol'
    when descripcion ~* '(niñ|infantil|beb[eé])' then 'Infantil'
    else 'Tennis'
  end
  where categoria = 'Deportivo';

alter table public.productos_calzado add constraint productos_calzado_categoria_check
  check (categoria in ('Chanclas','Escolar','Botas caucho','Botas material','Futbol','Infantil','Tennis','Clasico','Otros'));

-- ===== 2. Referencia automática =====

-- Consecutivo por prefijo (TEN-NIKE → 12). Fila bloqueada al subirlo: dos
-- teléfonos a la vez nunca sacan el mismo número.
create table if not exists private.referencia_consecutivos (
  prefijo text primary key,
  ultimo  integer not null check (ultimo > 0)
);

create or replace function private.prefijo_categoria(p_categoria text)
returns text language sql immutable set search_path = '' as $$
  select case p_categoria
    when 'Chanclas' then 'CHA'
    when 'Escolar' then 'ESC'
    when 'Botas caucho' then 'BCA'
    when 'Botas material' then 'BMA'
    when 'Futbol' then 'FUT'
    when 'Infantil' then 'INF'
    when 'Tennis' then 'TEN'
    when 'Clasico' then 'CLA'
    else 'OTR'
  end
$$;

-- "Bosi Ñandú" → "BOSI"; sin marca → "SM".
create or replace function private.prefijo_marca(p_marca text)
returns text language sql immutable set search_path = '' as $$
  select coalesce(nullif(left(regexp_replace(
    upper(translate(coalesce(p_marca, ''), 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunAEIOUUN')), '[^A-Z0-9]', '', 'g'), 4), ''), 'SM')
$$;

-- Un código nuevo que no use ningún zapato ni ningún precio por rango.
create or replace function private.nueva_referencia(p_categoria text, p_marca text)
returns text language plpgsql security definer set search_path = '' as $$
declare
  v_prefijo text := private.prefijo_categoria(p_categoria) || '-' || private.prefijo_marca(p_marca);
  v_n       integer;
  v_ref     text;
begin
  loop
    insert into private.referencia_consecutivos (prefijo, ultimo) values (v_prefijo, 1)
      on conflict (prefijo) do update set ultimo = private.referencia_consecutivos.ultimo + 1
      returning ultimo into v_n;
    v_ref := v_prefijo || '-' || lpad(v_n::text, 3, '0');
    exit when not exists (select 1 from public.productos_calzado where private.clave_referencia(referencia) = lower(v_ref))
          and not exists (select 1 from public.calzado_tramos_precio where referencia_clave = lower(v_ref));
  end loop;
  return v_ref;
end;
$$;

-- El código del zapato con esa descripción y marca, si ya existe.
create or replace function private.referencia_de_modelo(p_descripcion text, p_marca text)
returns text language sql stable security definer set search_path = '' as $$
  select btrim(referencia) from public.productos_calzado
    where lower(btrim(descripcion)) = lower(btrim(p_descripcion))
      and lower(coalesce(btrim(marca), '')) = lower(coalesce(btrim(p_marca), ''))
      and nullif(btrim(referencia), '') is not null
    order by activo desc, created_at
    limit 1
$$;

create index if not exists idx_calzado_descripcion_marca
  on public.productos_calzado (lower(btrim(descripcion)), lower(coalesce(btrim(marca), '')));

-- Antes de trg_calzado_heredar_referencia (los triggers van en orden
-- alfabético): la talla nueva ya llega con su referencia y hereda garantía y
-- precios por rango del modelo.
create or replace function private.calzado_asignar_referencia()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if nullif(btrim(new.referencia), '') is not null then
    -- auth.uid() nulo: migraciones y tareas del sistema.
    if tg_op = 'UPDATE' and nullif(btrim(old.referencia), '') is not null
       and lower(btrim(old.referencia)) <> lower(btrim(new.referencia))
       and auth.uid() is not null and not private.es_dueno() then
      raise exception 'Solo el dueño puede cambiar la referencia de un zapato.';
    end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and nullif(btrim(old.referencia), '') is not null then
    new.referencia := old.referencia;
    return new;
  end if;
  new.referencia := coalesce(
    private.referencia_de_modelo(new.descripcion, new.marca),
    private.nueva_referencia(new.categoria, new.marca)
  );
  return new;
end;
$$;
drop trigger if exists trg_calzado_asignar_referencia on public.productos_calzado;
create trigger trg_calzado_asignar_referencia before insert or update of referencia on public.productos_calzado
  for each row execute function private.calzado_asignar_referencia();

-- Los que ya existen: un código por descripción + marca, en el orden en que
-- se crearon (los más viejos, números más bajos). La categoría del código es
-- la que más tienen sus tallas.
do $$
declare
  g     record;
  v_ref text;
begin
  for g in
    select lower(btrim(descripcion)) as d, lower(coalesce(btrim(marca), '')) as m,
           min(btrim(descripcion)) as descripcion, min(btrim(marca)) as marca,
           mode() within group (order by categoria) as categoria, min(created_at) as primero
      from public.productos_calzado
      where nullif(btrim(referencia), '') is null
      group by 1, 2
      order by primero
  loop
    v_ref := coalesce(private.referencia_de_modelo(g.descripcion, g.marca), private.nueva_referencia(g.categoria, g.marca));
    update public.productos_calzado
      set referencia = v_ref
      where nullif(btrim(referencia), '') is null
        and lower(btrim(descripcion)) = g.d
        and lower(coalesce(btrim(marca), '')) = g.m;
  end loop;
end $$;

-- El código que tendrá un zapato antes de guardarlo: el de su modelo si ya
-- existe o uno nuevo (que queda apartado aunque al final no se guarde).
create or replace function public.referencia_para_modelo(p_descripcion text, p_marca text, p_categoria text)
returns text language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if not (private.tiene_permiso('inventario') or private.tiene_permiso('recibir_mercancia') or private.tiene_permiso('carga_inicial')) then
    raise exception 'No tienes permiso para crear zapatos.';
  end if;
  if nullif(btrim(p_descripcion), '') is null then
    raise exception 'Escribe la descripción del zapato.';
  end if;
  return coalesce(private.referencia_de_modelo(p_descripcion, p_marca), private.nueva_referencia(p_categoria, p_marca));
end;
$$;

revoke all on function public.referencia_para_modelo(text, text, text) from public, anon;
grant execute on function public.referencia_para_modelo(text, text, text) to authenticated;
revoke all on function private.nueva_referencia(text, text), private.referencia_de_modelo(text, text),
  private.calzado_asignar_referencia() from public, anon, authenticated;

-- ===== 3a. registrar_compra =====
-- Igual que en 20261023120000, salvo el reconocimiento sin referencia
-- (descripción + marca + color + talla, entre todos) y la referencia que queda
-- en compra_items.

create or replace function public.registrar_compra(p_compra jsonb, p_clave_idempotencia uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := auth.uid();
  v_proveedor  uuid;
  v_condicion  text := p_compra ->> 'condicion_pago';
  v_vence      date;
  v_fecha      date;
  v_factura    text := nullif(btrim(p_compra ->> 'numero_factura'), '');
  v_notas      text := nullif(btrim(p_compra ->> 'notas'), '');
  v_motivo     text;
  v_compra     uuid;
  v_total      numeric(12,2) := 0;
  v_unidades   int := 0;
  v_nuevos     int := 0;
  v_cambiados  int := 0;
  it           jsonb;
  v_pid        uuid;
  v_ref        text;
  v_desc       text;
  v_marca      text;
  v_color      text;
  v_talla      text;
  v_cant       numeric;
  v_costo      numeric(12,2);
  v_min        numeric(12,2);
  v_max        numeric(12,2);
  v_min_ant    numeric(12,2);
  v_max_ant    numeric(12,2);
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if not (private.tiene_permiso('recibir_mercancia') and private.tiene_permiso('costos')) then
    raise exception 'No tienes permiso para registrar facturas de compra con costos.';
  end if;

  -- Reintento de una compra que ya se guardó: la misma, sin tocar el stock otra vez.
  if p_clave_idempotencia is not null then
    select id into v_compra from public.compras where clave_idempotencia = p_clave_idempotencia;
    if found then
      return jsonb_build_object('compra_id', v_compra, 'repetida', true);
    end if;
  end if;

  v_proveedor := (p_compra ->> 'proveedor_id')::uuid;
  if v_proveedor is null or not exists (select 1 from public.proveedores where id = v_proveedor) then
    raise exception 'Elige el proveedor de la factura.';
  end if;
  if v_condicion is null or v_condicion not in ('contado', 'credito') then
    raise exception 'Indica si la compra es de contado o a crédito.';
  end if;
  v_fecha := coalesce((p_compra ->> 'fecha_factura')::date, private.hoy_bogota());
  if v_fecha > private.hoy_bogota() then
    raise exception 'La fecha de la factura no puede ser futura.';
  end if;
  v_vence := (p_compra ->> 'fecha_vencimiento')::date;
  if v_condicion = 'credito' and v_vence is null then
    raise exception 'Una compra a crédito necesita la fecha de vencimiento.';
  end if;
  if v_vence is not null and v_vence < v_fecha then
    raise exception 'El vencimiento no puede ser anterior a la fecha de la factura.';
  end if;
  if jsonb_typeof(p_compra -> 'items') is distinct from 'array' or jsonb_array_length(p_compra -> 'items') = 0 then
    raise exception 'La factura no tiene productos.';
  end if;
  if jsonb_array_length(p_compra -> 'items') > 2000 then
    raise exception 'Máximo 2000 tallas por factura.';
  end if;
  v_motivo := 'Compra' || coalesce(' factura ' || v_factura, '');

  insert into public.compras (
    proveedor_id, estado, registrada_por, revisada_por, condicion_pago, fecha_vencimiento,
    notas, total, monto_pagado, numero_factura, fecha_factura, clave_idempotencia
  ) values (
    v_proveedor, 'completada', v_uid, v_uid, v_condicion, v_vence,
    v_notas, 0, 0, v_factura, v_fecha, p_clave_idempotencia
  )
  on conflict (clave_idempotencia) where clave_idempotencia is not null do nothing
  returning id into v_compra;
  if v_compra is null then
    -- Un reintento simultáneo con la misma clave ganó la carrera.
    select id into v_compra from public.compras where clave_idempotencia = p_clave_idempotencia;
    return jsonb_build_object('compra_id', v_compra, 'repetida', true);
  end if;

  for it in select value from jsonb_array_elements(p_compra -> 'items') loop
    v_cant  := (it ->> 'cantidad')::numeric;
    v_costo := round((it ->> 'costo_unitario')::numeric, 2);
    v_min   := round((it ->> 'precio_minimo')::numeric, 2);
    v_max   := round(nullif(it ->> 'precio_maximo', '')::numeric, 2);
    v_ref   := nullif(btrim(it ->> 'referencia'), '');
    v_color := nullif(btrim(it ->> 'color'), '');
    v_talla := nullif(btrim(it ->> 'talla'), '');
    v_desc  := nullif(btrim(it ->> 'descripcion'), '');
    v_marca := nullif(btrim(it ->> 'marca'), '');

    if v_cant is null or v_cant <= 0 or v_cant <> trunc(v_cant) then
      raise exception 'Cada talla necesita una cantidad entera mayor a cero.';
    end if;
    if v_costo is null or v_costo < 0 then
      raise exception 'El costo de % no puede faltar ni ser negativo.', coalesce(v_ref, v_desc, 'un producto');
    end if;
    if v_min is null or v_min <= 0 or (v_max is not null and v_min > v_max) then
      raise exception 'Revisa los precios de % talla %: el mínimo debe ser mayor a cero y no pasar del máximo.',
        coalesce(v_ref, v_desc, 'un producto'), coalesce(v_talla, '—');
    end if;

    -- ¿Ya existe esta talla? Por id, o por referencia + color + talla, o, sin
    -- referencia, por descripción + marca + color + talla.
    v_pid := (it ->> 'producto_id')::uuid;
    if v_pid is null and v_talla is not null and (v_ref is not null or v_desc is not null) then
      select id into v_pid from public.productos_calzado
        where case
                when v_ref is not null then lower(btrim(referencia)) = lower(v_ref)
                else lower(btrim(descripcion)) = lower(v_desc)
                     and lower(coalesce(btrim(marca), '')) = lower(coalesce(v_marca, ''))
              end
          and lower(coalesce(btrim(color), '')) = lower(coalesce(v_color, ''))
          and btrim(talla) = v_talla
        order by activo desc, created_at
        limit 1;
    end if;

    if v_pid is not null then
      select precio_minimo, precio_maximo, descripcion, referencia, color, talla
        into v_min_ant, v_max_ant, v_desc, v_ref, v_color, v_talla
        from public.productos_calzado where id = v_pid for update;
      if not found then
        raise exception 'Un producto de la factura ya no existe. Recarga y vuelve a intentar.';
      end if;
      if v_min is distinct from v_min_ant or v_max is distinct from v_max_ant then
        if not private.tiene_permiso('inventario') then
          raise exception 'No tienes permiso para cambiar precios.';
        end if;
        update public.productos_calzado
          set precio_minimo = v_min, precio_maximo = v_max, activo = true
          where id = v_pid;
        v_cambiados := v_cambiados + 1;
      else
        update public.productos_calzado set activo = true where id = v_pid and not activo;
      end if;
    else
      if v_desc is null then
        raise exception 'Falta la descripción de % talla %.', coalesce(v_ref, 'un producto nuevo'), coalesce(v_talla, '—');
      end if;
      if v_talla is null then
        raise exception 'Falta la talla de %.', coalesce(v_ref, v_desc);
      end if;
      -- Sin referencia, trg_calzado_asignar_referencia le pone la de su modelo o una nueva.
      insert into public.productos_calzado (
        referencia, descripcion, marca, categoria, color, talla,
        precio_minimo, precio_maximo, stock_actual, stock_minimo, proveedor_id, activo
      ) values (
        v_ref, v_desc, v_marca, it ->> 'categoria', v_color, v_talla,
        v_min, v_max, 0, coalesce((it ->> 'stock_minimo')::int, 1), v_proveedor, true
      ) returning id, referencia into v_pid, v_ref;
      v_nuevos := v_nuevos + 1;
    end if;

    insert into public.historial_precios_calzado (producto_id, precio_minimo, precio_maximo, costo_compra, motivo, registrado_por)
      values (v_pid, v_min, v_max, v_costo, v_motivo, v_uid);

    -- El trigger trg_compra_items_stock_increment sube el stock.
    insert into public.compra_items (compra_id, producto_calzado_id, descripcion, referencia, color, talla,
                                     cantidad, costo_unitario, subtotal)
      values (v_compra, v_pid, v_desc, v_ref, v_color, v_talla, v_cant, v_costo, round(v_costo * v_cant, 2));

    v_total := v_total + round(v_costo * v_cant, 2);
    v_unidades := v_unidades + v_cant::int;
  end loop;

  update public.compras
    set total = v_total, monto_pagado = case when v_condicion = 'contado' then v_total else 0 end
    where id = v_compra;

  return jsonb_build_object(
    'compra_id', v_compra, 'repetida', false, 'total', v_total, 'unidades', v_unidades,
    'productos_nuevos', v_nuevos, 'precios_cambiados', v_cambiados
  );
end;
$$;

revoke all on function public.registrar_compra(jsonb, uuid) from public, anon;
grant execute on function public.registrar_compra(jsonb, uuid) to authenticated;

-- ===== 3b. cargar_inventario =====
-- Igual que en 20261026001601, salvo las categorías y el reconocimiento sin
-- referencia (descripción + marca + color + talla, entre todos).

create or replace function public.cargar_inventario(p_filas jsonb, p_proveedor_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_con_costos  boolean;
  v_creados     int := 0;
  v_actualizados int := 0;
  v_iguales     int := 0;
  v_claves      text[] := '{}';
  it            jsonb;
  v_n           int;
  v_fila        text;
  v_cat         text;
  v_desc        text;
  v_marca       text;
  v_ref         text;
  v_talla       text;
  v_color       text;
  v_foto        text;
  v_min         numeric(12,2);
  v_max         numeric(12,2);
  v_costo       numeric(12,2);
  v_stock       numeric;
  v_clave       text;
  v_pid         uuid;
  v_actual      record;
begin
  if v_uid is null then
    raise exception 'No autenticado';
  end if;
  if not private.tiene_permiso('carga_inicial') then
    raise exception 'No tienes permiso para la carga masiva de inventario.';
  end if;
  if jsonb_typeof(p_filas) is distinct from 'array' or jsonb_array_length(p_filas) = 0 then
    raise exception 'El archivo no tiene filas.';
  end if;
  if jsonb_array_length(p_filas) > 5000 then
    raise exception 'Máximo 5000 filas por carga. Divide el archivo.';
  end if;
  if p_proveedor_id is not null and not exists (select 1 from public.proveedores where id = p_proveedor_id) then
    raise exception 'El proveedor elegido no existe.';
  end if;
  v_con_costos := private.tiene_permiso('costos');

  v_n := 0;
  for it in select value from jsonb_array_elements(p_filas) loop
    v_n := v_n + 1;
    v_fila  := coalesce(it ->> 'fila', v_n::text);
    v_cat   := it ->> 'categoria';
    v_desc  := nullif(btrim(it ->> 'descripcion'), '');
    v_marca := nullif(btrim(it ->> 'marca'), '');
    v_ref   := nullif(btrim(it ->> 'referencia'), '');
    v_talla := nullif(btrim(it ->> 'talla'), '');
    v_color := nullif(btrim(it ->> 'color'), '');
    v_foto  := nullif(btrim(it ->> 'foto_url'), '');
    v_min   := round((it ->> 'precio_minimo')::numeric, 2);
    v_max   := round((it ->> 'precio_maximo')::numeric, 2);
    v_costo := round((it ->> 'costo')::numeric, 2);
    v_stock := (it ->> 'stock')::numeric;

    if v_cat is null or v_cat not in ('Chanclas','Escolar','Botas caucho','Botas material','Futbol','Infantil','Tennis','Clasico','Otros') then
      raise exception 'Fila %: categoría inválida.', v_fila;
    end if;
    if v_desc is null then
      raise exception 'Fila %: falta la descripción.', v_fila;
    end if;
    -- El máximo es opcional; si viene, no puede ser menor que el mínimo.
    if v_min is null or v_min < 0 or (v_max is not null and v_max < v_min) then
      raise exception 'Fila %: revisa los precios (el mínimo no puede pasar del máximo).', v_fila;
    end if;
    if v_costo is not null and v_costo < 0 then
      raise exception 'Fila %: el costo no puede ser negativo.', v_fila;
    end if;
    if v_stock is null or v_stock < 0 or v_stock <> trunc(v_stock) then
      raise exception 'Fila %: el stock debe ser un número entero, 0 o más.', v_fila;
    end if;
    if v_foto is not null and v_foto !~ '^https?://' then
      raise exception 'Fila %: la foto no es una dirección válida.', v_fila;
    end if;

    -- La misma llave con que se busca abajo: referencia, o descripción y marca si no tiene.
    v_clave := case when v_ref is not null then 'r|' || lower(v_ref) else 'd|' || lower(v_desc) || '|' || lower(coalesce(v_marca, '')) end
               || '|' || lower(coalesce(v_color, '')) || '|' || lower(coalesce(v_talla, ''));
    if v_clave = any (v_claves) then
      raise exception 'Fila %: esa talla ya viene en otra fila del archivo (% %, talla %).',
        v_fila, coalesce(v_ref, v_desc), coalesce(v_color, ''), coalesce(v_talla, 'única');
    end if;
    v_claves := v_claves || v_clave;

    select id, descripcion, marca, categoria, precio_minimo, precio_maximo, foto_url into v_actual
      from public.productos_calzado
      where case
              when v_ref is not null then lower(btrim(referencia)) = lower(v_ref)
              else lower(btrim(descripcion)) = lower(v_desc)
                   and lower(coalesce(btrim(marca), '')) = lower(coalesce(v_marca, ''))
            end
        and lower(coalesce(btrim(color), '')) = lower(coalesce(v_color, ''))
        and lower(coalesce(btrim(talla), '')) = lower(coalesce(v_talla, ''))
      order by activo desc, created_at
      limit 1
      for update;

    if found then
      v_pid := v_actual.id;
      if v_actual.precio_minimo is distinct from v_min or v_actual.precio_maximo is distinct from v_max then
        if not private.tiene_permiso('inventario') then
          raise exception 'Fila %: no tienes permiso para cambiar precios.', v_fila;
        end if;
        insert into public.historial_precios_calzado (producto_id, precio_minimo, precio_maximo, motivo, registrado_por)
          values (v_pid, v_min, v_max, 'Carga masiva', v_uid);
      end if;
      if v_actual.descripcion is distinct from v_desc or v_actual.marca is distinct from v_marca
         or v_actual.categoria is distinct from v_cat
         or v_actual.precio_minimo is distinct from v_min or v_actual.precio_maximo is distinct from v_max
         or (v_foto is not null and v_actual.foto_url is distinct from v_foto) then
        update public.productos_calzado
          set descripcion = v_desc, marca = v_marca, categoria = v_cat, precio_minimo = v_min, precio_maximo = v_max,
              foto_url = coalesce(v_foto, foto_url)
          where id = v_pid;
        v_actualizados := v_actualizados + 1;
      else
        v_iguales := v_iguales + 1;
      end if;
    else
      -- Sin referencia, trg_calzado_asignar_referencia le pone la de su modelo o una nueva.
      insert into public.productos_calzado (
        referencia, descripcion, marca, categoria, color, talla,
        precio_minimo, precio_maximo, stock_actual, stock_minimo, proveedor_id, foto_url, activo
      ) values (
        v_ref, v_desc, v_marca, v_cat, v_color, v_talla,
        v_min, v_max, v_stock::int, 0, p_proveedor_id, v_foto, true
      ) returning id into v_pid;
      insert into public.historial_precios_calzado (producto_id, precio_minimo, precio_maximo, costo_compra, motivo, registrado_por)
        values (v_pid, v_min, v_max, case when v_con_costos then v_costo end, 'Carga inicial', v_uid);
      v_creados := v_creados + 1;
    end if;
  end loop;

  return jsonb_build_object('creados', v_creados, 'actualizados', v_actualizados, 'sin_cambios', v_iguales);
end;
$$;

revoke all on function public.cargar_inventario(jsonb, uuid) from public, anon;
grant execute on function public.cargar_inventario(jsonb, uuid) to authenticated;
