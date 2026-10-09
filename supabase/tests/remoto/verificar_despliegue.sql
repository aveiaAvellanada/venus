-- Verificación después de desplegar las migraciones (SOLO LECTURA).
--
-- Los *_test.sql NO se corren contra producción: aunque terminan en rollback,
-- consumen números de venta (ventas.numero es identity) y dejarían huecos.
-- Este archivo solo consulta: confirma que el esquema quedó como la app espera
-- y que cada cuenta existente podrá iniciar sesión con usuario + PIN.
--
-- Producción:  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/remoto/verificar_despliegue.sql
-- Local / CI:  SEMILLA=supabase/tests/migracion_permisos/semilla.sql SEMILLA_ANTES_DE=20261009150000 \
--                supabase/tests/local/run.sh supabase/tests/remoto/verificar_despliegue.sql
--
-- Éxito = termina con el error DESPLIEGUE_OK_ROLLBACK. Si algo falla, el error
-- dice qué y no se toca nada.

begin;
set transaction read only;

do $$
declare
  v text;
  n int;
  -- RPC que la app llama (grep "\.rpc(" en lib/ y app/). Si se agrega una, va aquí.
  rpc_app text[] := array[
    'abrir_caja', 'actualizar_empleado', 'cambiar_estado_empleado', 'cambiar_mi_pin', 'cerrar_caja',
    'crear_empleado', 'guardar_producto_calzado', 'obtener_arqueo_caja', 'obtener_balance',
    'obtener_base_predeterminada', 'obtener_dashboard_dueno', 'obtener_deuda_proveedor',
    'obtener_dias_trabajados', 'obtener_gastos_periodo', 'obtener_modo_cierre', 'obtener_reporte_diario',
    'obtener_reporte_periodo', 'obtener_resumen_dia', 'obtener_ventas_por_subperiodo', 'reabrir_caja',
    'registrar_devolucion', 'registrar_venta', 'restablecer_pin_empleado'
  ];
begin
  -- 1. RLS activado en todas las tablas de public.
  select string_agg(c.relname, ', ') into v
  from pg_class c join pg_namespace s on s.oid = c.relnamespace
  where s.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity;
  if v is not null then raise exception 'Tablas sin RLS: %', v; end if;

  -- 2. Nada de public se ejecuta sin iniciar sesión (anon = solo la clave del APK).
  select string_agg(p.oid::regprocedure::text, ', ') into v
  from pg_proc p join pg_namespace s on s.oid = p.pronamespace
  where s.nspname = 'public'
    and has_function_privilege('anon', p.oid, 'execute')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e');
  if v is not null then raise exception 'Funciones ejecutables sin sesión (anon): %', v; end if;

  -- 3. Cada RPC que usa la app existe y una sesión iniciada puede llamarla
  --    (crear_empleado, cambiar_mi_pin… solo existen con las migraciones nuevas).
  select string_agg(r, ', ') into v
  from unnest(rpc_app) r
  where not exists (
    select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public' and p.proname = r and has_function_privilege('authenticated', p.oid, 'execute')
  );
  if v is not null then raise exception 'RPC de la app que no existen o authenticated no puede ejecutar: %', v; end if;

  -- 4. La clave de idempotencia de ventas (evita cobrar dos veces) está en su sitio.
  if not exists (
    select 1 from pg_proc p join pg_namespace s on s.oid = p.pronamespace
    where s.nspname = 'public' and p.proname = 'registrar_venta'
      and 'p_clave_idempotencia' = any (p.proargnames)
  ) then
    raise exception 'registrar_venta no tiene p_clave_idempotencia: la app nueva no podrá vender.';
  end if;
  select count(*) into n from pg_proc p join pg_namespace s on s.oid = p.pronamespace
  where s.nspname = 'public' and p.proname = 'registrar_venta';
  if n <> 1 then raise exception 'Hay % versiones de registrar_venta (debe quedar una).', n; end if;

  -- 5. Alguien puede administrar.
  select count(*) into n from public.users where rol = 'dueno' and activo;
  if n = 0 then raise exception 'No hay ningún dueño activo: nadie podría crear empleados ni dar permisos.'; end if;

  -- 6. Cada cuenta de la app podrá entrar con usuario + PIN: correo derivado del
  --    usuario en Auth y en su identidad, y tokens en '' (con NULL, GoTrue falla
  --    al iniciar sesión en cuentas creadas por SQL).
  select string_agg(coalesce(u.usuario, u.nombre), ', ') into v
  from public.users u
  left join auth.users a on a.id = u.id
  where u.usuario is null
     or a.id is null
     or a.email is distinct from u.usuario || '@venus.invalid'
     or a.encrypted_password is null
     or a.confirmation_token is null or a.recovery_token is null
     or a.email_change_token_new is null or a.email_change is null
     or not exists (
       select 1 from auth.identities i
       where i.user_id = u.id and i.provider = 'email'
         and i.identity_data ->> 'email' = u.usuario || '@venus.invalid'
     );
  if v is not null then raise exception 'Cuentas que no podrán iniciar sesión: %', v; end if;

  -- 7. Historial de acciones activo en todas las tablas del negocio (mismas
  --    excluidas que auditoria_test.sql).
  if to_regclass('public.auditoria') is null then
    raise exception 'Falta el historial de acciones (migración 20261009160000_auditoria).';
  end if;
  select string_agg(c.relname, ', ' order by c.relname) into v
  from pg_class c
  where c.relnamespace = 'public'::regnamespace and c.relkind in ('r', 'p')
    and c.relname <> all (array['auditoria', 'historial_precios_calzado', 'historial_precios_varios',
                                'cierres_caja_reaperturas', 'reporte_envios', 'clima_registro'])
    and not exists (select 1 from pg_trigger t
                    where t.tgrelid = c.oid and t.tgname = 'trg_' || c.relname || '_auditoria');
  if v is not null then raise exception 'Tablas sin historial de acciones: %', v; end if;

  -- Informativo: con quién entra cada persona y quién debe crear PIN nuevo.
  for v in
    select format('%s → usuario "%s"%s%s', u.nombre, u.usuario,
                  case when u.rol = 'dueno' then ' (dueño)' else '' end,
                  case when u.debe_cambiar_pin then ', crea PIN de 6 al entrar' else '' end)
    from public.users u where u.activo order by u.rol, u.nombre
  loop
    raise notice '%', v;
  end loop;

  raise exception 'DESPLIEGUE_OK_ROLLBACK';
end;
$$;
