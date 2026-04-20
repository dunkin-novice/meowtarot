-- Phase 1 reading history persistence
-- Minimal schema only: users extension fields + readings + reading_cards

alter table public.users
  add column if not exists display_name text,
  add column if not exists avatar_url text,
  add column if not exists preferred_lang text check (preferred_lang in ('en', 'th'));

create table if not exists public.readings (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  mode text not null check (mode in ('daily', 'question', 'full')),
  spread text,
  topic text,
  lang text check (lang in ('en', 'th')),
  read_date date not null,
  created_at timestamptz not null default now()
);

create table if not exists public.reading_cards (
  id bigint generated always as identity primary key,
  reading_id bigint not null references public.readings(id) on delete cascade,
  card_id text not null,
  orientation text not null check (orientation in ('upright', 'reversed')),
  position text,
  sort_order int not null default 0
);

create index if not exists idx_readings_user_created_at
  on public.readings (user_id, created_at desc);

create index if not exists idx_reading_cards_reading_order
  on public.reading_cards (reading_id, sort_order asc);

alter table public.readings enable row level security;
alter table public.reading_cards enable row level security;

create policy "readings owner read/write"
on public.readings
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "reading_cards owner read/write"
on public.reading_cards
for all
using (
  exists (
    select 1
    from public.readings r
    where r.id = reading_id and r.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.readings r
    where r.id = reading_id and r.user_id = auth.uid()
  )
);
