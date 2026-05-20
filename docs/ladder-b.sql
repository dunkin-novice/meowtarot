-- MeowTarot — Ladder B schema
-- Lifetime engagement counter. Trigger: user opened app today (any session).
-- Never resets. Advances once per calendar day (user's local date).
-- 14-day cycles: cycle_position 0–13. At 14, cycle completes and resets to 0.

CREATE TABLE IF NOT EXISTS public.ladder_b (
  id            bigserial    PRIMARY KEY,
  user_id       uuid         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lifetime_count integer     NOT NULL DEFAULT 0,
  cycle_position integer     NOT NULL DEFAULT 0
                             CHECK (cycle_position >= 0 AND cycle_position <= 13),
  cycles_completed integer   NOT NULL DEFAULT 0,
  last_open_date date,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

-- One row per user
CREATE UNIQUE INDEX IF NOT EXISTS uniq_ladder_b_user ON public.ladder_b (user_id);

-- RLS
ALTER TABLE public.ladder_b ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ladder_b_owner_select" ON public.ladder_b
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "ladder_b_owner_insert" ON public.ladder_b
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ladder_b_owner_update" ON public.ladder_b
  FOR UPDATE USING (auth.uid() = user_id);
