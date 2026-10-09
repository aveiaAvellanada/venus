-- Stub mínimo de Supabase para aplicar las migraciones de Venus en un Postgres
-- local y correr los tests SQL de RLS/RPC sin tocar el proyecto remoto.
--
-- Emula solo lo que las migraciones y los tests usan: roles de la Data API
-- (anon / authenticated / service_role), auth.uid()/auth.role()/auth.jwt(),
-- auth.users, el esquema extensions, storage.buckets/objects y vault, y los
-- privilegios por defecto que Supabase concede en el esquema public
-- (tablas, funciones y secuencias para anon, authenticated y service_role).
--
-- NO reemplaza el smoke test contra el remoto: es una red de seguridad para
-- validar migraciones antes de aplicarlas.

-- Roles de la Data API
create role anon nologin noinherit;
create role authenticated nologin noinherit;
create role service_role nologin noinherit bypassrls;
create role authenticator login noinherit;
grant anon, authenticated, service_role to authenticator;

-- Privilegios por defecto que trae un proyecto Supabase en public
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

-- extensions
create schema if not exists extensions;
grant usage on schema extensions to anon, authenticated, service_role;
create extension if not exists pgcrypto with schema extensions;

-- auth
create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table auth.users (
  id                     uuid primary key default gen_random_uuid(),
  instance_id            uuid,
  email                  text,
  encrypted_password     text,
  email_confirmed_at     timestamptz,
  banned_until           timestamptz,
  confirmation_token     text,
  recovery_token         text,
  email_change_token_new text,
  email_change           text,
  raw_app_meta_data      jsonb,
  raw_user_meta_data     jsonb,
  aud                    text,
  role                   text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz
);

create table auth.identities (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  provider        text not null,
  provider_id     text not null,
  identity_data   jsonb not null,
  email           text generated always as (lower(identity_data ->> 'email')) stored,
  created_at      timestamptz,
  updated_at      timestamptz,
  last_sign_in_at timestamptz
);

create table auth.sessions (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade
);

create table auth.refresh_tokens (
  id         bigserial primary key,
  token      text,
  user_id    varchar(255),
  session_id uuid references auth.sessions(id) on delete cascade
);

create or replace function auth.uid() returns uuid language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
  )::uuid
$$;

create or replace function auth.role() returns text language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role')
  )::text
$$;

create or replace function auth.jwt() returns jsonb language sql stable as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$$;

grant execute on all functions in schema auth to anon, authenticated, service_role;

-- storage (solo las columnas que usan las políticas de las migraciones)
create schema if not exists storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (
  id     text primary key,
  name   text not null,
  public boolean default false
);
create table storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name      text,
  owner     uuid
);
alter table storage.objects enable row level security;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;

-- vault (referenciado por el agendado de pg_cron, que el runner omite)
create schema if not exists vault;
create table vault.secrets (name text primary key, secret text);
create view vault.decrypted_secrets as select name, secret as decrypted_secret from vault.secrets;
