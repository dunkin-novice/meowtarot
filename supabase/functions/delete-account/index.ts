// MeowTarot — delete-account Edge Function
//
// Permanently deletes the calling user's account and all of their synced data.
// Required by App Store Guideline 5.1.1(v) (in-app account deletion).
//
// The caller is identified from their JWT (sent as the Authorization header).
// A service-role client then removes their rows from every user-owned table and
// finally deletes the auth user itself.
//
// Deploy:   supabase functions deploy delete-account
// Invoke:   supabase.functions.invoke('delete-account', { method: 'POST' })
//
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY are injected by
// the Supabase platform — no manual secrets needed.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const authHeader = req.headers.get('Authorization') ?? '';
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Identify the caller from their JWT.
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: 'Not authenticated' }, 401);

    const uid = user.id;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // reading_cards are keyed by reading_id → delete them via the user's readings first.
    const { data: readings } = await admin.from('readings').select('id').eq('user_id', uid);
    const readingIds = (readings ?? []).map((r: { id: string }) => r.id);
    if (readingIds.length) {
      await admin.from('reading_cards').delete().in('reading_id', readingIds);
    }
    await admin.from('readings').delete().eq('user_id', uid);

    // Remaining user-owned tables. Errors here (e.g. a table that doesn't exist yet)
    // are logged but do not block the auth-user deletion below.
    for (const op of [
      admin.from('user_progress').delete().eq('user_id', uid),
      admin.from('ladder_b').delete().eq('user_id', uid),
      admin.from('users').delete().eq('id', uid),
    ]) {
      const { error } = await op;
      if (error) console.error('row cleanup error:', error.message);
    }

    // Finally, delete the auth user. This is the authoritative removal.
    const { error: delErr } = await admin.auth.admin.deleteUser(uid);
    if (delErr) return json({ error: delErr.message }, 500);

    return json({ success: true }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
