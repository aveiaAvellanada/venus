-- Una sola referencia por zapato y la foto del color en sus tallas nuevas.
--
-- 1. En la carga inicial dos filas con la misma descripción y marca (dos
--    colores escritos aparte, sin "Otro color") apartaron cada una su código
--    para nombrar la foto (ESC-VERL-004 y ESC-VERL-005) y quedaron como dos
--    zapatos. Ahora, al crear una talla con una referencia que todavía no usa
--    nadie, si ya hay un zapato con esa descripción y marca toma la de él: el
--    mismo zapato tiene un solo código, sin importar el orden en que lleguen
--    las filas. Cambiar la referencia de lo que ya existe sigue igual (solo el
--    dueño).
-- 2. Una talla nueva sin foto toma la que ya tiene su referencia en ese color
--    (antes, comprar la talla 41 de un color con foto la dejaba sin ella).

create or replace function private.calzado_asignar_referencia()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_modelo text;
begin
  if nullif(btrim(new.referencia), '') is not null then
    -- auth.uid() nulo: migraciones y tareas del sistema.
    if tg_op = 'UPDATE' and nullif(btrim(old.referencia), '') is not null
       and lower(btrim(old.referencia)) <> lower(btrim(new.referencia))
       and auth.uid() is not null and not private.es_dueno() then
      raise exception 'Solo el dueño puede cambiar la referencia de un zapato.';
    end if;
    -- Un código nuevo (apartado para la foto) para un zapato que ya existe con
    -- otro código: se queda con el del zapato.
    if tg_op = 'INSERT'
       and not exists (select 1 from public.productos_calzado
                       where private.clave_referencia(referencia) = private.clave_referencia(new.referencia)) then
      v_modelo := private.referencia_de_modelo(new.descripcion, new.marca);
      if v_modelo is not null then
        new.referencia := v_modelo;
      end if;
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

-- Igual que en 20261017043632, más la foto del color.
create or replace function private.calzado_heredar_de_referencia()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_clave text := private.clave_referencia(new.referencia);
  v_g     integer;
  v_tr    record;
begin
  if v_clave is null then
    return new;
  end if;
  if new.garantia_dias is null then
    select garantia_dias into v_g
      from public.productos_calzado
      where private.clave_referencia(referencia) = v_clave and garantia_dias is not null
      limit 1;
    new.garantia_dias := v_g;
  end if;
  if nullif(btrim(new.foto_url), '') is null then
    select foto_url into new.foto_url
      from public.productos_calzado
      where private.clave_referencia(referencia) = v_clave
        and lower(coalesce(btrim(color), '')) = lower(coalesce(btrim(new.color), ''))
        and nullif(btrim(foto_url), '') is not null
      order by activo desc, created_at
      limit 1;
  end if;
  select tr.precio_minimo, tr.precio_maximo into v_tr
    from public.calzado_tramos_precio tr
    where tr.referencia_clave = v_clave
      and private.talla_numerica(new.talla) between tr.talla_desde and tr.talla_hasta
    limit 1;
  if found then
    new.precio_minimo := v_tr.precio_minimo;
    new.precio_maximo := v_tr.precio_maximo;
  end if;
  return new;
end;
$$;

revoke all on function private.calzado_asignar_referencia(), private.calzado_heredar_de_referencia() from public, anon, authenticated;
