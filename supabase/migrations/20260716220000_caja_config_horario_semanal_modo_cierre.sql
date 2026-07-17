-- Caja: horario automático por día de la semana + modo de cierre configurable.
alter table public.caja_config
  add column if not exists horario_semanal jsonb not null default '{}'::jsonb,
  add column if not exists modo_cierre text not null default 'con_diferencia'
    check (modo_cierre in ('con_diferencia', 'sin_diferencia'));

-- Migra el horario plano existente (si estaba configurado) a los 7 días,
-- para no perder la configuración de quienes ya tenían modo automático.
update public.caja_config
set horario_semanal = (
  select jsonb_object_agg(dia, jsonb_build_object(
    'apertura', to_char(hora_apertura, 'HH24:MI'),
    'cierre', to_char(hora_cierre, 'HH24:MI')
  ))
  from unnest(array['lunes','martes','miercoles','jueves','viernes','sabado','domingo']) as dia
)
where hora_apertura is not null and hora_cierre is not null;

alter table public.caja_config
  drop column if exists hora_apertura,
  drop column if exists hora_cierre;
