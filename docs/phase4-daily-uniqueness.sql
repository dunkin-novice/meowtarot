-- Phase 4: enforce one daily reading per user per local day.
-- Locked 2026-05-09. Cleans up 11 known duplicate rows from a single test user
-- (53313d15-7b6e-43e2-9d36-8134b36b07a1, 4 dates) using keep-earliest by created_at.

-- Block 1: Backup (founder drops manually after verification)
create table if not exists public.readings_phase4_backup
  as select * from public.readings where mode = 'daily';

-- Block 2: Cleanup (keep-earliest by created_at, then id as tiebreaker)
with ranked as (
  select id,
         row_number() over (
           partition by user_id, read_date
           order by created_at asc, id asc
         ) as rn
  from public.readings
  where mode = 'daily'
)
delete from public.readings r
using ranked
where r.id = ranked.id
  and ranked.rn > 1;

-- Block 3: Partial unique index (daily-only — question/full legitimately allow multiples)
create unique index if not exists uniq_readings_user_daily_date
  on public.readings (user_id, read_date)
  where mode = 'daily';
