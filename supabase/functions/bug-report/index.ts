// MeowTarot — bug-report Edge Function
//
// Receives an in-app bug report, verifies the Cloudflare Turnstile token
// server-side, then emails it to info@meowtarot.com via Resend (with the
// screenshot as an attachment + a diagnostics block).
//
// Callable by ANONYMOUS users (bugs hit logged-out people too) — the Turnstile
// check is the bot gate, not auth.
//
// Required env (set with: supabase secrets set KEY=value):
//   TURNSTILE_SECRET   — Cloudflare Turnstile secret key
//   RESEND_API_KEY     — Resend API key
//   BUG_REPORT_TO      — optional, defaults to info@meowtarot.com
//   BUG_REPORT_FROM    — optional, defaults to "MeowTarot Bugs <bugs@meowtarot.com>"
//                        (the from-domain must be verified in Resend)
//
// Deploy:  supabase functions deploy bug-report

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

function escapeHtml(s: string): string {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string
  ));
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const { note = '', diagnostics = {}, screenshot = null, turnstileToken = '' } = await req.json();

    // 1) Verify Turnstile (skip only if no secret configured — dev convenience).
    const secret = Deno.env.get('TURNSTILE_SECRET');
    if (secret) {
      const form = new FormData();
      form.append('secret', secret);
      form.append('response', String(turnstileToken || ''));
      const ip = req.headers.get('CF-Connecting-IP');
      if (ip) form.append('remoteip', ip);
      const vr = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form });
      const vj = await vr.json();
      if (!vj.success) return json({ error: 'Verification failed', detail: vj['error-codes'] }, 403);
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) return json({ error: 'Email not configured' }, 500);
    const to = Deno.env.get('BUG_REPORT_TO') || 'feedback@meowtarot.com';
    const from = Deno.env.get('BUG_REPORT_FROM') || 'MeowTarot Feedback <feedback@meowtarot.com>';

    // 2) Build the email.
    const d = diagnostics || {};
    const diagRows = Object.entries(d)
      .map(([k, v]) => `<tr><td style="padding:2px 10px 2px 0;color:#888;">${escapeHtml(k)}</td><td>${escapeHtml(typeof v === 'object' ? JSON.stringify(v) : String(v))}</td></tr>`)
      .join('');
    const html = `
      <h2 style="font-family:sans-serif;">🐛 MeowTarot bug report</h2>
      <p style="font-family:sans-serif;white-space:pre-wrap;font-size:15px;">${escapeHtml(note) || '<em>(no note)</em>'}</p>
      <h3 style="font-family:sans-serif;color:#666;">Diagnostics</h3>
      <table style="font-family:monospace;font-size:12px;border-collapse:collapse;">${diagRows}</table>
      ${screenshot ? '<p style="font-family:sans-serif;color:#888;">Screenshot attached.</p>' : '<p style="font-family:sans-serif;color:#888;">No screenshot.</p>'}
    `;

    const attachments: Array<{ filename: string; content: string }> = [];
    if (typeof screenshot === 'string' && screenshot.startsWith('data:image')) {
      const base64 = screenshot.split(',')[1] || '';
      if (base64) attachments.push({ filename: 'screenshot.jpg', content: base64 });
    }

    const payload: Record<string, unknown> = {
      from,
      to: [to],
      subject: `🐛 Bug report — ${String((d as Record<string, unknown>).url || 'MeowTarot').slice(0, 80)}`,
      html,
      reply_to: to,
    };
    if (attachments.length) payload.attachments = attachments;

    const er = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!er.ok) {
      const errText = await er.text();
      return json({ error: 'Send failed', detail: errText.slice(0, 300) }, 502);
    }

    return json({ success: true }, 200);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
