-- Gestión de empleados desde la app (solo el dueño) y cambio del PIN propio.
--
-- El dueño crea cada cuenta con nombre, usuario y PIN de 6 dígitos y le
-- entrega permisos; puede cambiarlos, restablecer el PIN y desactivar o
-- reactivar la cuenta. Desactivar bloquea el login (banned_until) y cierra las
-- sesiones abiertas; además tiene_permiso() ya exige la cuenta activa.
--
-- Las cuentas se escriben directo en auth.users/auth.identities, como los
-- seeds del proyecto: el PIN se guarda con bcrypt (extensions.crypt), que es
-- lo que Supabase Auth verifica al iniciar sesión.

-- 6 números y no trivial: un dígito repetido (000000), en orden (123456,
-- 987654) o un patrón que se repite (121212, 123123) es lo primero que se prueba.
-- Debe coincidir con pinDebil() en lib/usuarios.ts.
create or replace function private.validar_pin(p_pin text)
returns void language plpgsql immutable set search_path = '' as $$
begin
  if p_pin is null or p_pin !~ '^[0-9]{6}$' then
    raise exception 'El PIN debe tener exactamente 6 números.';
  end if;
  if p_pin ~ '^([0-9]{2})\1\1$' or p_pin ~ '^([0-9]{3})\1$'
     or position(p_pin in '0123456789') > 0 or position(p_pin in '9876543210') > 0 then
    raise exception 'Ese PIN es muy fácil de adivinar (repetido o en orden). Elige otro.';
  end if;
end;
$$;

create or replace function private.validar_permisos(p_permisos text[])
returns void language plpgsql immutable set search_path = '' as $$
begin
  if not (coalesce(p_permisos, '{}') <@ private.permisos_validos()) then
    raise exception 'Permiso desconocido: %',
      (select string_agg(p, ', ') from unnest(p_permisos) p where p <> all (private.permisos_validos()));
  end if;
end;
$$;

-- Empleado (no dueño) al que el dueño le va a cambiar algo.
create or replace function private.empleado_gestionable(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.es_dueno() then
    raise exception 'Solo el dueño gestiona empleados.';
  end if;
  if not exists (select 1 from public.users where id = p_id and rol = 'empleado') then
    raise exception 'Empleado no encontrado.';
  end if;
end;
$$;

create or replace function public.crear_empleado(
  p_nombre text,
  p_usuario text,
  p_pin text,
  p_permisos text[] default '{}'
)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_id      uuid := gen_random_uuid();
  v_nombre  text := btrim(coalesce(p_nombre, ''));
  v_usuario text := lower(btrim(coalesce(p_usuario, '')));
  v_email   text;
begin
  if not private.es_dueno() then
    raise exception 'Solo el dueño puede crear empleados.';
  end if;
  if v_nombre = '' then
    raise exception 'El nombre es obligatorio.';
  end if;
  if v_usuario !~ '^[a-z0-9][a-z0-9._-]{2,19}$' then
    raise exception 'El usuario debe tener de 3 a 20 letras o números, sin espacios ni tildes.';
  end if;
  perform private.validar_pin(p_pin);
  perform private.validar_permisos(p_permisos);

  v_email := v_usuario || '@venus.invalid';
  if exists (select 1 from public.users where usuario = v_usuario)
     or exists (select 1 from auth.users where email = v_email) then
    raise exception 'Ya existe el usuario "%". Elige otro.', v_usuario;
  end if;

  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    created_at, updated_at, raw_app_meta_data, raw_user_meta_data
  ) values (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', v_email,
    extensions.crypt(p_pin, extensions.gen_salt('bf')), now(),
    '', '', '', '',
    now(), now(), '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('nombre', v_nombre)
  );
  insert into auth.identities (
    id, user_id, provider, provider_id, identity_data, created_at, updated_at, last_sign_in_at
  ) values (
    gen_random_uuid(), v_id, 'email', v_id::text,
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    now(), now(), now()
  );
  insert into public.users (id, nombre, rol, email, usuario, permisos, activo)
    values (v_id, v_nombre, 'empleado', v_email, v_usuario, coalesce(p_permisos, '{}'), true);

  return v_id;
end;
$$;

-- null = no cambiar (el nombre y los permisos se editan por separado en la app).
create or replace function public.actualizar_empleado(
  p_id uuid,
  p_nombre text default null,
  p_permisos text[] default null
)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_nombre text := nullif(btrim(coalesce(p_nombre, '')), '');
begin
  perform private.empleado_gestionable(p_id);
  if p_nombre is not null and v_nombre is null then
    raise exception 'El nombre es obligatorio.';
  end if;
  if p_permisos is not null then
    perform private.validar_permisos(p_permisos);
  end if;
  update public.users
    set nombre = coalesce(v_nombre, nombre), permisos = coalesce(p_permisos, permisos)
    where id = p_id;
end;
$$;

create or replace function public.restablecer_pin_empleado(p_id uuid, p_pin text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.empleado_gestionable(p_id);
  perform private.validar_pin(p_pin);
  update auth.users
    set encrypted_password = extensions.crypt(p_pin, extensions.gen_salt('bf')), updated_at = now()
    where id = p_id;
  update public.users set debe_cambiar_pin = false where id = p_id;
end;
$$;

create or replace function public.cambiar_estado_empleado(p_id uuid, p_activo boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform private.empleado_gestionable(p_id);
  update public.users set activo = p_activo where id = p_id;
  update public.empleado_config set activo = p_activo where empleado_id = p_id;
  update auth.users
    set banned_until = case when p_activo then null else 'infinity'::timestamptz end, updated_at = now()
    where id = p_id;
  if not p_activo then
    -- Cierra las sesiones abiertas: el teléfono ya no puede renovar el token.
    delete from auth.refresh_tokens where user_id = p_id::text;
    delete from auth.sessions where user_id = p_id;
  end if;
end;
$$;

-- Cualquier cuenta activa cambia su propio PIN (obligatorio si debe_cambiar_pin).
create or replace function public.cambiar_mi_pin(p_pin_actual text, p_pin_nuevo text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if not private.activo() then
    raise exception 'No autorizado';
  end if;
  if not exists (
    select 1 from auth.users
    where id = v_uid and encrypted_password = extensions.crypt(coalesce(p_pin_actual, ''), encrypted_password)
  ) then
    raise exception 'El PIN actual no es correcto.';
  end if;
  perform private.validar_pin(p_pin_nuevo);
  update auth.users
    set encrypted_password = extensions.crypt(p_pin_nuevo, extensions.gen_salt('bf')), updated_at = now()
    where id = v_uid;
  update public.users set debe_cambiar_pin = false where id = v_uid;
end;
$$;

revoke all on function public.crear_empleado(text, text, text, text[]) from public, anon;
revoke all on function public.actualizar_empleado(uuid, text, text[]) from public, anon;
revoke all on function public.restablecer_pin_empleado(uuid, text) from public, anon;
revoke all on function public.cambiar_estado_empleado(uuid, boolean) from public, anon;
revoke all on function public.cambiar_mi_pin(text, text) from public, anon;
grant execute on function public.crear_empleado(text, text, text, text[]) to authenticated;
grant execute on function public.actualizar_empleado(uuid, text, text[]) to authenticated;
grant execute on function public.restablecer_pin_empleado(uuid, text) to authenticated;
grant execute on function public.cambiar_estado_empleado(uuid, boolean) to authenticated;
grant execute on function public.cambiar_mi_pin(text, text) to authenticated;
