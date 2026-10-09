-- Cuentas como las de producción ANTES de 20261009150000_permisos_por_usuario:
-- correos reales, rol 'admin', PIN de 4 dígitos, tokens de Auth en NULL (seeds
-- por SQL), un nombre con tilde/ñ y un primer nombre repetido.
-- Uso:
--   SEMILLA=supabase/tests/migracion_permisos/semilla.sql SEMILLA_ANTES_DE=20261009150000 \
--     supabase/tests/local/run.sh supabase/tests/migracion_permisos/verificacion.sql

do $$
declare
  c record;
begin
  for c in select * from (values
    ('00000000-0000-0000-0000-0000000000a1'::uuid, 'Andrés Artunduaga', 'dueno',    'venusdelcaqueta@gmail.com'),
    ('00000000-0000-0000-0000-0000000000a2'::uuid, 'Sandra Cardona',    'admin',    'sandra@example.com'),
    ('00000000-0000-0000-0000-0000000000a3'::uuid, 'Camilo Artunduaga', 'empleado', 'camilo@example.com'),
    ('00000000-0000-0000-0000-0000000000a4'::uuid, 'Beatriz Bueno',     'empleado', 'beatriz@example.com'),
    ('00000000-0000-0000-0000-0000000000a5'::uuid, 'Ñoño Pérez',        'empleado', 'nono@example.com'),
    ('00000000-0000-0000-0000-0000000000a6'::uuid, 'Camilo Rojas',      'empleado', 'camilo.r@example.com')
  ) as t(id, nombre, rol, email)
  loop
    insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                            created_at, updated_at, raw_app_meta_data, raw_user_meta_data)
      values (c.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', c.email,
              extensions.crypt('1111', extensions.gen_salt('bf')), now(),
              now() + (right(c.id::text, 1)::int * interval '1 second'), now(),
              '{"provider":"email","providers":["email"]}', '{}');
    insert into auth.identities (id, user_id, provider, provider_id, identity_data, created_at, updated_at, last_sign_in_at)
      values (gen_random_uuid(), c.id, 'email', c.id::text,
              jsonb_build_object('sub', c.id::text, 'email', c.email, 'email_verified', true), now(), now(), now());
    insert into public.users (id, nombre, rol, email, activo, created_at)
      values (c.id, c.nombre, c.rol, c.email, true, now() + (right(c.id::text, 1)::int * interval '1 second'));
  end loop;
end $$;
