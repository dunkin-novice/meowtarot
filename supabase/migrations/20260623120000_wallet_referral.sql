-- MeowTarot — server-side Meow Coin wallet + referral system (founder 2026-06-23)
-- ===========================================================================
-- Deploy:  supabase db push          (project dzgjjvuiliickdgzshjr — already linked)
-- Rollback notes at the bottom.
--
-- WHY server-side: the referral anti-abuse the founder asked for (no self-referral, one
-- redemption per user, code auto-disabled after 9 uses) cannot be trusted to the client. The
-- wallet becomes authoritative for SIGNED-IN users; all credits/debits go through the
-- SECURITY DEFINER functions below (clients get SELECT-own only via RLS — never direct writes).
-- Referral ladder (no spare deck yet → cap at 9): friends 1-5 → +5 each, friends 6-9 → +10 each.
-- Referee (the friend entering a code) → +5.
-- ===========================================================================

-- ----------------------------- WALLET --------------------------------------
create table if not exists public.wallets (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  balance    integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

-- Idempotent ledger: a (user, key) pair can only be credited ONCE (mirrors the client wallet's
-- per-day / per-period keys). Spends are rows with a unique generated key + negative amount.
create table if not exists public.wallet_grants (
  id              bigint generated always as identity primary key,
  user_id         uuid not null references auth.users(id) on delete cascade,
  idempotency_key text not null,
  amount          integer not null,
  reason          text,
  created_at      timestamptz not null default now(),
  unique (user_id, idempotency_key)
);
create index if not exists wallet_grants_user_idx on public.wallet_grants(user_id);

alter table public.wallets enable row level security;
alter table public.wallet_grants enable row level security;
-- Read-own only. There are deliberately NO insert/update policies: every write goes through the
-- SECURITY DEFINER RPCs, so a client can never mint or alter coins directly.
drop policy if exists wallet_own_select on public.wallets;
create policy wallet_own_select on public.wallets for select using (auth.uid() = user_id);
drop policy if exists wallet_grants_own_select on public.wallet_grants;
create policy wallet_grants_own_select on public.wallet_grants for select using (auth.uid() = user_id);

-- Internal: credit a SPECIFIC user's wallet idempotently. Not exposed to clients.
create or replace function public._wallet_credit(p_user uuid, p_key text, p_amount integer, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_amount is null or p_amount = 0 then return; end if;
  insert into public.wallet_grants(user_id, idempotency_key, amount, reason)
    values (p_user, p_key, p_amount, p_reason)
    on conflict (user_id, idempotency_key) do nothing;
  if found then
    insert into public.wallets(user_id, balance) values (p_user, greatest(p_amount, 0))
      on conflict (user_id) do update set balance = public.wallets.balance + excluded.balance, updated_at = now();
  end if;
end; $$;

create or replace function public.wallet_balance()
returns integer language sql security definer set search_path = public as $$
  select coalesce((select balance from public.wallets where user_id = auth.uid()), 0);
$$;

-- Idempotent grant to the CURRENT user (daily/weekly/monthly/etc. earns + the local-merge).
create or replace function public.wallet_grant(p_key text, p_amount integer, p_reason text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  perform public._wallet_credit(v_uid, p_key, greatest(coalesce(p_amount,0),0), p_reason);
  return coalesce((select balance from public.wallets where user_id = v_uid), 0);
end; $$;

-- Spend from the CURRENT user. Returns the new balance, or -1 if the balance is too low.
create or replace function public.wallet_spend(p_amount integer, p_reason text default null)
returns integer language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_bal integer;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if p_amount is null or p_amount <= 0 then return public.wallet_balance(); end if;
  update public.wallets set balance = balance - p_amount, updated_at = now()
    where user_id = v_uid and balance >= p_amount
    returning balance into v_bal;
  if not found then return -1; end if;
  insert into public.wallet_grants(user_id, idempotency_key, amount, reason)
    values (v_uid, 'spend-' || gen_random_uuid()::text, -p_amount, p_reason);
  return v_bal;
end; $$;

-- ----------------------------- REFERRAL ------------------------------------
create table if not exists public.referral_codes (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  code       text not null unique,
  uses       integer not null default 0,
  created_at timestamptz not null default now()
);
create table if not exists public.referrals (
  id          bigint generated always as identity primary key,
  referrer_id uuid not null references auth.users(id) on delete cascade,
  referee_id  uuid not null unique references auth.users(id) on delete cascade, -- referred AT MOST once, ever
  code        text not null,
  reward      integer not null,
  created_at  timestamptz not null default now()
);
create index if not exists referrals_referrer_idx on public.referrals(referrer_id);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
drop policy if exists rc_own_select on public.referral_codes;
create policy rc_own_select on public.referral_codes for select using (auth.uid() = user_id);
drop policy if exists ref_related_select on public.referrals;
create policy ref_related_select on public.referrals for select using (auth.uid() = referrer_id or auth.uid() = referee_id);

-- Get (or lazily create) my referral code + my current uses.
create or replace function public.referral_my_code()
returns table(code text, uses integer) language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_code text;
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  select rc.code into v_code from public.referral_codes rc where rc.user_id = v_uid;
  if v_code is null then
    loop
      v_code := upper(substr(md5(gen_random_uuid()::text), 1, 7)); -- short, human-ish code
      begin
        insert into public.referral_codes(user_id, code) values (v_uid, v_code);
        exit;
      exception when unique_violation then -- code collided: retry
      end;
    end loop;
  end if;
  return query select rc.code, rc.uses from public.referral_codes rc where rc.user_id = v_uid;
end; $$;

-- Redeem a friend's code (caller = the referee). All anti-abuse is enforced here, atomically.
create or replace function public.referral_redeem(p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_referrer uuid; v_uses integer; v_reward integer; v_referee_reward integer := 5;
  v_norm text := upper(trim(coalesce(p_code, '')));
begin
  if v_uid is null then raise exception 'not authenticated'; end if;
  if v_norm = '' then return jsonb_build_object('ok', false, 'error', 'invalid_code'); end if;
  select user_id, uses into v_referrer, v_uses from public.referral_codes where code = v_norm;
  if v_referrer is null then return jsonb_build_object('ok', false, 'error', 'invalid_code'); end if;
  if v_referrer = v_uid then return jsonb_build_object('ok', false, 'error', 'self_referral'); end if;
  if v_uses >= 9 then return jsonb_build_object('ok', false, 'error', 'code_disabled'); end if;
  if exists (select 1 from public.referrals where referee_id = v_uid) then
    return jsonb_build_object('ok', false, 'error', 'already_referred');
  end if;
  v_reward := case when (v_uses + 1) <= 5 then 5 else 10 end; -- friends 1-5 → 5, 6-9 → 10
  begin
    insert into public.referrals(referrer_id, referee_id, code, reward)
      values (v_referrer, v_uid, v_norm, v_reward);
  exception when unique_violation then  -- race: someone redeemed for this referee already
    return jsonb_build_object('ok', false, 'error', 'already_referred');
  end;
  update public.referral_codes set uses = uses + 1 where user_id = v_referrer;
  perform public._wallet_credit(v_referrer, 'referral-' || v_uid::text, v_reward, 'referral_referrer');
  perform public._wallet_credit(v_uid, 'referral-redeem', v_referee_reward, 'referral_referee');
  return jsonb_build_object('ok', true, 'referee_reward', v_referee_reward, 'referrer_reward', v_reward);
end; $$;

-- ----------------------------- GRANTS --------------------------------------
revoke execute on function public._wallet_credit(uuid, text, integer, text) from public, anon, authenticated;
grant execute on function
  public.wallet_balance(),
  public.wallet_grant(text, integer, text),
  public.wallet_spend(integer, text),
  public.referral_my_code(),
  public.referral_redeem(text)
to authenticated;

-- ----------------------------- ROLLBACK ------------------------------------
-- drop function if exists public.referral_redeem(text), public.referral_my_code(),
--   public.wallet_spend(integer,text), public.wallet_grant(text,integer,text),
--   public.wallet_balance(), public._wallet_credit(uuid,text,integer,text);
-- drop table if exists public.referrals, public.referral_codes, public.wallet_grants, public.wallets;
