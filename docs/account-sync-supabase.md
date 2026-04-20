# Lightweight account + anonymous migration (Supabase)

## 1) Architecture summary
- Local progress in `js/progress.js` remains the source of truth for UI and daily flow.
- Accounts are an upgrade layer:
  - Anonymous ID is still created locally (`progress.user_id`).
  - Account ID comes from Supabase Auth.
- New modules:
  - `js/auth.js`: login/logout/current user handling (Google/Apple OAuth).
  - `js/sync.js`: local ↔ cloud sync + anonymous → account merge.
- Reading page flow:
  - On load: if logged in, migrate/merge progress and hydrate local.
  - On daily completion: write local first, then async sync to cloud.

## 2) Supabase setup steps
1. Create a Supabase project.
2. Enable OAuth providers in **Authentication → Providers**:
   - Google
   - Apple
3. Add redirect URLs:
   - `https://www.meowtarot.com/reading.html`
   - `https://www.meowtarot.com/th/reading.html`
   - `https://www.meowtarot.com/profile.html`
   - `https://www.meowtarot.com/th/profile.html`
   - localhost variants for development.
4. Run the SQL schema below in **SQL Editor**.
5. Provide frontend config before loading app JS (for Profile pages, `supabase.config.js` is loaded before `js/profile.js`):

```html
<script src="/supabase.config.js"></script>
<script>
  window.__MEOWTAROT_SUPABASE__ = {
    url: 'https://YOUR_PROJECT.supabase.co',
    anonKey: 'YOUR_SUPABASE_ANON_KEY'
  };
</script>
```

## 3) Table schema
```sql
create table if not exists public.users (
  id uuid primary key,
  created_at timestamptz not null default now(),
  provider text not null check (provider in ('google', 'apple')),
  anonymous_link_id text
);

create table if not exists public.user_progress (
  user_id uuid primary key references public.users(id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.users enable row level security;
alter table public.user_progress enable row level security;

create policy "users owner read/write"
on public.users
for all
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "progress owner read/write"
on public.user_progress
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);
```

## 4) Migration logic
`js/sync.js` implements:
- Load local progress first.
- Check `user_progress` for account user.
- First login (no cloud row): upload local progress.
- Existing account: safe merge with rules:
  - higher `streak_current`
  - higher `streak_best`
  - larger/union card collections
  - achievements OR merge
  - earliest `journey_started_at`
- Save merged to DB.
- Overwrite local with merged.
- Link anonymous ID in `users.anonymous_link_id`.

## 5) Sync flow
- App load + logged in:
  - Migrate (or hydrate from cloud fallback on partial failure).
- Daily completion:
  - `trackCompletedDailyReading()` updates local.
  - `syncLocalProgressIfLoggedIn()` pushes to DB asynchronously.
- Offline/network failure:
  - Local state remains untouched.
  - Sync failures are logged and can be retried on next app load/completion.

## 6) Example snippets
```js
// auth.js
await loginWithProvider('google');
const user = await getCurrentUser();
```

```js
// sync.js
const merged = mergeProgress(localProgress, remoteProgress);
await saveCloudProgress(user.id, merged);
setUserProgress(merged);
```

## 7) Assumptions
- Current rollout keeps local-first as primary UX behavior.
- Full server-side conflict history/versioning is intentionally out of scope.
- OAuth button display is conditional on Supabase config availability.
- A calm UX is preserved: logged-in users see a saved confirmation instead of aggressive CTA.
