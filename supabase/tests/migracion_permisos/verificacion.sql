-- Verifica cómo 20261009150000_permisos_por_usuario convierte las cuentas
-- existentes (cargadas con semilla.sql antes de esa migración).
-- Éxito = termina con el error MIGRACION_PERMISOS_OK_ROLLBACK.

begin;

do $$
declare
  v_operativo text[] := array['ventas','devoluciones','inventario','recibir_mercancia','caja','gastos'];
  v_admin text[] := v_operativo || array['proveedores','gastos_fijos','reportes','carga_inicial'];
  v_txt text; v_n bigint;
begin
  select string_agg(usuario, ',' order by id) into v_txt from public.users;
  if v_txt <> 'andres,sandra,camilo,beatriz,nono,camilo2' then
    raise exception 'FALLO: usuarios derivados del nombre: %', v_txt;
  end if;

  if (select rol from public.users where usuario = 'andres') <> 'dueno' then
    raise exception 'FALLO: Andrés dejó de ser el dueño';
  end if;
  if (select rol from public.users where usuario = 'sandra') <> 'empleado'
     or not ((select permisos from public.users where usuario = 'sandra') @> v_admin
             and (select permisos from public.users where usuario = 'sandra') <@ v_admin) then
    raise exception 'FALLO: Sandra (admin) no quedó con la plantilla administrativa';
  end if;
  select count(*) into v_n from public.users
    where usuario in ('camilo','beatriz','nono','camilo2') and rol = 'empleado'
      and permisos @> v_operativo and permisos <@ v_operativo;
  if v_n <> 4 then
    raise exception 'FALLO: los empleados no quedaron con la plantilla operativa';
  end if;
  if exists (select 1 from public.users where not debe_cambiar_pin) then
    raise exception 'FALLO: todas las cuentas (PIN de 4) deben crear un PIN de 6 al entrar';
  end if;

  select count(*) into v_n from auth.users a join public.users u on u.id = a.id
    where a.email = u.usuario || '@venus.invalid' and u.email = a.email
      and a.confirmation_token = '' and a.recovery_token = ''
      and a.email_change_token_new = '' and a.email_change = '';
  if v_n <> 6 then
    raise exception 'FALLO: correos de Auth o tokens sin migrar (% de 6)', v_n;
  end if;
  select count(*) into v_n from auth.identities i join public.users u on u.id = i.user_id
    where i.identity_data->>'email' = u.usuario || '@venus.invalid';
  if v_n <> 6 then
    raise exception 'FALLO: identities con el correo viejo';
  end if;
  if not exists (select 1 from auth.users where email = 'andres@venus.invalid'
                   and encrypted_password = extensions.crypt('1111', encrypted_password)) then
    raise exception 'FALLO: el PIN actual dejó de funcionar (debe servir hasta que cree el nuevo)';
  end if;

  -- Los permisos se aplican: Sandra gestiona proveedores pero no ve costos.
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a2', true);
  if not private.tiene_permiso('proveedores') or private.tiene_permiso('costos') or private.es_dueno() then
    raise exception 'FALLO: permisos de Sandra mal aplicados';
  end if;
  perform set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000a1', true);
  if not (private.tiene_permiso('costos') and private.tiene_permiso('balance') and private.es_dueno()) then
    raise exception 'FALLO: el dueño perdió permisos';
  end if;

  raise exception 'MIGRACION_PERMISOS_OK_ROLLBACK';
end $$;

rollback;
