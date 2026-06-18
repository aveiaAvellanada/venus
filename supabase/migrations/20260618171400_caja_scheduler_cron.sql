-- Agenda el caja-scheduler cada 15 min. La key de autorización se lee de Vault
-- (secreto 'caja_cron_key'); no se hardcodea en la migración.
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Limpia un agendado previo con el mismo nombre (idempotente al reaplicar).
select cron.unschedule('caja-scheduler-15m')
where exists (select 1 from cron.job where jobname = 'caja-scheduler-15m');

select cron.schedule(
  'caja-scheduler-15m',
  '*/15 * * * *',
  $$
  select net.http_post(
    url := 'https://xqspsaghukeynlizbjvc.supabase.co/functions/v1/caja-scheduler',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'caja_cron_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
