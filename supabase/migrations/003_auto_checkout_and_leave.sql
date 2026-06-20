-- ── Migration 003: Auto-checkout pg_cron job + casual-only leave defaults ──────

-- 1. Enable pg_cron extension (if not already enabled)
--    Run this in Supabase Dashboard > Extensions and enable "pg_cron"
--    OR uncomment the line below:
-- create extension if not exists pg_cron;

-- 2. Enable pg_net extension (required for HTTP calls from pg_cron)
-- create extension if not exists pg_net;

-- 3. Schedule auto-checkout to run at 22:00 IST (16:30 UTC) every day
--    Replace <YOUR_PROJECT_REF> and <YOUR_SERVICE_ROLE_KEY> with real values.
--
-- select cron.schedule(
--   'auto-checkout-daily',
--   '30 16 * * *',
--   $$
--     select net.http_post(
--       url     := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/auto-checkout',
--       headers := jsonb_build_object('Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>')
--     );
--   $$
-- );

-- 4. Alternatively, run auto-checkout purely in SQL via pg_cron (no Edge Function needed):
-- select cron.schedule(
--   'auto-checkout-sql',
--   '30 16 * * *',
--   $$
--     update attendance
--     set
--       check_out_time   = '19:00:00',
--       worked_minutes   = greatest(0,
--         (19 * 60) - (
--           extract(hour from check_in_time::time)::int * 60
--           + extract(minute from check_in_time::time)::int
--         )
--       ),
--       overtime_minutes = greatest(0,
--         (19 * 60) - (
--           extract(hour from check_in_time::time)::int * 60
--           + extract(minute from check_in_time::time)::int
--         ) - 480
--       )
--     where
--       date            = (now() at time zone 'Asia/Kolkata')::date
--       and check_in_time  is not null
--       and check_out_time is null
--       and status         = 'present';
--   $$
-- );

-- 5. Update leave_balances default: only casual leaves (12/year)
--    Zero out other leave types for existing balances where they aren't needed.
--    (Leave existing data as-is; new rows will just use casual_total.)
alter table leave_balances
  alter column casual_total    set default 12;

-- Optional: set sick/emergency/paid to 0 for new rows if those columns exist
-- (safe to run even if columns don't exist — will just error silently)
do $$
begin
  begin
    alter table leave_balances alter column sick_total      set default 0;
  exception when undefined_column then null;
  end;
  begin
    alter table leave_balances alter column emergency_total set default 0;
  exception when undefined_column then null;
  end;
  begin
    alter table leave_balances alter column paid_total      set default 0;
  exception when undefined_column then null;
  end;
end $$;
