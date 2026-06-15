-- Seed Sandra Cardona como admin. Idempotente. Mismo patrón usado para los otros usuarios.
-- auth.identities.email es columna generada: NO insertarla.
do $$
declare v_uid uuid;
begin
  select id into v_uid from auth.users where email = 'sandracardona.venus2026@gmail.com';
  if v_uid is null then
    v_uid := gen_random_uuid();
    insert into auth.users (
      id, instance_id, aud, role, email, encrypted_password,
      email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data
    ) values (
      v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
      'sandracardona.venus2026@gmail.com', extensions.crypt('4321', extensions.gen_salt('bf')),
      now(), now(), now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb
    );
    insert into auth.identities (
      id, user_id, provider, provider_id, identity_data, created_at, updated_at, last_sign_in_at
    ) values (
      gen_random_uuid(), v_uid, 'email', v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', 'sandracardona.venus2026@gmail.com', 'email_verified', true),
      now(), now(), now()
    );
  end if;
  insert into public.users (id, nombre, rol, email, activo)
    values (v_uid, 'Sandra Cardona', 'admin', 'sandracardona.venus2026@gmail.com', true)
    on conflict (id) do update set rol = 'admin', activo = true, nombre = 'Sandra Cardona';
end $$;
