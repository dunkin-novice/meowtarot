-- MeowTarot — server-authoritative deck ownership (founder 2026-06-26)
-- ===========================================================================
-- Replaces the client-side localStorage 'meowtarot_purchased_decks'.

create table if not exists public.purchased_decks (
  user_id    uuid not null references auth.users(id) on delete cascade,
  deck_id    text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, deck_id)
);

alter table public.purchased_decks enable row level security;
drop policy if exists purchased_decks_own_select on public.purchased_decks;
create policy purchased_decks_own_select on public.purchased_decks for select using (auth.uid() = user_id);

-- Secure RPC to spend coins and unlock a deck atomically
create or replace function public.shop_purchase_deck(p_deck_id text, p_cost integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_bal integer;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  
  -- already purchased?
  if exists (select 1 from public.purchased_decks where user_id = v_uid and deck_id = p_deck_id) then
    return true;
  end if;

  -- deduct coins
  v_bal := public.wallet_spend(p_cost, 'deck_purchase:' || p_deck_id);
  if v_bal < 0 then
    return false; -- insufficient funds
  end if;

  -- record purchase
  insert into public.purchased_decks(user_id, deck_id) values (v_uid, p_deck_id);
  return true;
end; $$;

-- Fetch all purchased decks for the current user
create or replace function public.shop_my_decks()
returns setof text language sql security definer set search_path = public as $$
  select deck_id from public.purchased_decks where user_id = auth.uid();
$$;
