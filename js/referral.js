// Referral frontend (Stage 3, founder 2026-06-23). Backend = deployed Supabase RPCs
// referral_my_code / referral_redeem + the server wallet. Ladder: friends 1–5 → +5 each, 6–9 →
// +10 each (cap 9, no spare deck yet); the friend who enters a code → +5. ALL anti-abuse is
// server-side (no self-referral, one redemption/user, code disabled at 9 uses). This file is the
// UI panel + the invite-link (?ref=CODE) capture → auto-redeem-after-sign-in.
import { getSupabaseClient, getCurrentUserSync, subscribeAuthState, loginWithProvider } from './auth.js';

const PENDING_REF_KEY = 'mt_pending_ref';
const SITE = 'https://www.meowtarot.com';

async function rpc(fn, args) {
  try {
    const client = await getSupabaseClient();
    if (!client) return null;
    const { data, error } = await client.rpc(fn, args || {});
    if (error) { console.warn('[referral]', fn, error.message); return null; }
    return data;
  } catch (_) { return null; }
}

export async function getMyReferral() {
  const rows = await rpc('referral_my_code', {});
  if (Array.isArray(rows)) return rows[0] || null; // table-returning RPC → array of one row
  return rows || null;
}
export async function redeemReferral(code) {
  return rpc('referral_redeem', { p_code: String(code || '').trim() });
}
export function referralLink(code) { return `${SITE}/?ref=${encodeURIComponent(code)}`; }

// Ladder rewards: friends 1–5 → 5 each, 6–9 → 10 each.
export function coinsForUses(uses) {
  const u = Math.max(0, Math.min(9, Number(uses) || 0));
  return Math.min(u, 5) * 5 + Math.max(0, u - 5) * 10;
}

function refErrorMsg(err, th) {
  const map = {
    invalid_code: th ? 'ไม่พบโค้ดนี้' : "That code isn't valid.",
    self_referral: th ? 'ใช้โค้ดของตัวเองไม่ได้นะ' : "You can't use your own code.",
    code_disabled: th ? 'โค้ดนี้ครบ 9 คนแล้ว' : 'That code has reached its 9-friend limit.',
    already_referred: th ? 'คุณใช้โค้ดเชิญไปแล้ว' : "You've already redeemed a friend's code.",
  };
  return map[err] || (th ? 'มีบางอย่างผิดพลาด ลองใหม่อีกครั้ง' : 'Something went wrong. Try again.');
}

// ---- redeem feedback toast (founder 2026-06-26) ------------------------------------------
// Self-contained top-centre popup for redeem success/failure (REQ-10). Kept local to the
// referral panel so it doesn't couple to the coin-popup module.
let _refToastStyled = false;
function ensureRefToastStyles() {
  if (_refToastStyled || typeof document === 'undefined') return;
  _refToastStyled = true;
  const s = document.createElement('style');
  s.textContent = `
  .mt-ref-toast{position:fixed;left:50%;top:22px;transform:translateX(-50%) translateY(-12px);z-index:10000;
    max-width:min(420px,calc(100vw - 32px));padding:13px 18px;border-radius:14px;text-align:center;
    font:600 14px/1.4 var(--mt-font-body,'DM Sans',system-ui,sans-serif);
    box-shadow:0 16px 40px -12px rgba(61,26,92,.45);opacity:0;transition:opacity .22s ease,transform .22s ease;}
  .mt-ref-toast.in{opacity:1;transform:translateX(-50%) translateY(0);}
  .mt-ref-toast.is-ok{background:linear-gradient(135deg,#2a8a5a,#3aa86a);color:#fff;}
  .mt-ref-toast.is-err{background:linear-gradient(135deg,#b3243f,#d1485f);color:#fff;}`;
  document.head.appendChild(s);
}
function showRefToast(message, ok) {
  if (typeof document === 'undefined' || !document.body || !message) return;
  ensureRefToastStyles();
  const existing = document.getElementById('mt-ref-toast');
  if (existing) existing.remove();
  const t = document.createElement('div');
  t.id = 'mt-ref-toast';
  t.className = 'mt-ref-toast ' + (ok ? 'is-ok' : 'is-err');
  t.setAttribute('role', 'status');
  t.textContent = message;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); setTimeout(() => t.remove(), 320); }, 2600);
}

// ---- invite-link capture + auto-redeem ---------------------------------------------------
function captureRefFromUrl() {
  try {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && ref.trim()) localStorage.setItem(PENDING_REF_KEY, ref.trim());
  } catch (_) {}
}

let pendingHandled = false;
async function maybeRedeemPending() {
  if (pendingHandled) return;
  if (!getCurrentUserSync()) return; // wait until signed in
  let pending = null;
  try { pending = localStorage.getItem(PENDING_REF_KEY); } catch (_) {}
  if (!pending) return;
  pendingHandled = true;
  try { localStorage.removeItem(PENDING_REF_KEY); } catch (_) {}
  const res = await redeemReferral(pending);
  if (res && res.ok) {
    try {
      const m = await import('./meow-coin.js');
      if (m.refreshServerWallet) await m.refreshServerWallet();
      if (m.showCoinPopup) m.showCoinPopup(res.referee_reward || 5, 'referral_referee');
    } catch (_) {}
  }
}

// Self-init on import (common.js imports this on every page so invite links land anywhere).
captureRefFromUrl();
try { subscribeAuthState(() => { maybeRedeemPending(); }); } catch (_) {}

// ---- Profile panel -----------------------------------------------------------------------
export function renderReferralPanel(container, lang) {
  if (!container) return;
  const th = lang === 'th';
  container.innerHTML = '';
  const card = document.createElement('section');
  card.className = 'panel mt-ref';

  if (!getCurrentUserSync()) {
    card.innerHTML = `
      <h2 class="mt-ref__title">${th ? 'ชวนเพื่อน' : 'Invite friends'}</h2>
      <p class="mt-ref__desc">${th ? 'เข้าสู่ระบบเพื่อรับโค้ดเชิญ — ชวนเพื่อนแล้วได้เหรียญทั้งคู่ (สูงสุด 9 คน)' : 'Sign in to get your invite code — you and your friend both earn coins (up to 9 friends).'}</p>
      <button type="button" class="mt-ref__signin" id="mt-ref-signin">${th ? 'เข้าสู่ระบบด้วย Google' : 'Sign in with Google'}</button>`;
    container.appendChild(card);
    card.querySelector('#mt-ref-signin').addEventListener('click', () => loginWithProvider('google').catch(() => {}));
    return;
  }

  card.innerHTML = `
    <h2 class="mt-ref__title">${th ? 'ชวนเพื่อน' : 'Invite friends'}</h2>
    <p class="mt-ref__desc">${th ? 'แชร์โค้ดของคุณ — เพื่อนได้ +5, คุณได้ +5 (เพื่อนคนที่ 6 เป็นต้นไป +10) สูงสุด 9 คน' : "Share your code — your friend gets +5, you get +5 (then +10 from your 6th friend), up to 9 friends."}</p>
    <div class="mt-ref__codebox"><span class="mt-ref__code" id="mt-ref-code">·····</span><button type="button" class="mt-ref__copy" id="mt-ref-copy-code">${th ? 'คัดลอกโค้ด' : 'Copy code'}</button><button type="button" class="mt-ref__copy" id="mt-ref-copy">${th ? 'แชร์ลิงก์' : 'Share link'}</button></div>
    <div class="mt-ref__ladder">
      <div class="mt-ref__ladder-row"><span id="mt-ref-count">0 / 9 ${th ? 'เพื่อน' : 'friends'}</span><span class="mt-ref__coins" id="mt-ref-coins">0 ${th ? 'เหรียญ' : 'coins'}</span></div>
      <div class="mt-ref__track"><div class="mt-ref__fill" id="mt-ref-fill"></div></div>
    </div>
    <hr class="mt-ref__hr">
    <p class="mt-ref__redeem-label">${th ? 'มีโค้ดจากเพื่อน?' : "Have a friend's code?"}</p>
    <div class="mt-ref__redeem">
      <input type="text" class="mt-ref__input" id="mt-ref-input" autocomplete="off" autocapitalize="characters" placeholder="${th ? 'ใส่โค้ด' : 'Enter code'}" />
      <button type="button" class="mt-ref__redeem-btn" id="mt-ref-redeem">${th ? 'รับเหรียญ' : 'Redeem'}</button>
    </div>
    <p class="mt-ref__msg" id="mt-ref-msg" hidden></p>`;
  container.appendChild(card);

  const codeEl = card.querySelector('#mt-ref-code');
  const copyBtn = card.querySelector('#mt-ref-copy');
  const copyCodeBtn = card.querySelector('#mt-ref-copy-code');
  const input = card.querySelector('#mt-ref-input');
  const redeemBtn = card.querySelector('#mt-ref-redeem');
  const msg = card.querySelector('#mt-ref-msg');
  let myCode = null;

  getMyReferral().then((r) => {
    if (!r || !r.code) return;
    myCode = r.code;
    codeEl.textContent = r.code;
    const uses = Number(r.uses) || 0;
    card.querySelector('#mt-ref-count').textContent = `${uses} / 9 ${th ? 'เพื่อน' : 'friends'}`;
    card.querySelector('#mt-ref-coins').textContent = `${coinsForUses(uses)} ${th ? 'เหรียญ' : 'coins'}`;
    card.querySelector('#mt-ref-fill').style.width = `${Math.round((Math.min(9, uses) / 9) * 100)}%`;
  }).catch(() => {});

  // REQ-8: copy the raw code itself (the Share-link button beside it copies the invite URL).
  copyCodeBtn.addEventListener('click', async () => {
    if (!myCode) return;
    try {
      await navigator.clipboard.writeText(myCode);
      const orig = copyCodeBtn.textContent;
      copyCodeBtn.textContent = th ? 'คัดลอกแล้ว!' : 'Copied!';
      setTimeout(() => { copyCodeBtn.textContent = orig; }, 1500);
    } catch (_) { /* clipboard blocked */ }
  });

  copyBtn.addEventListener('click', async () => {
    if (!myCode) return;
    const link = referralLink(myCode);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'MeowTarot', text: th ? 'มาเล่น MeowTarot กับฉันสิ! 🐾' : 'Join me on MeowTarot! 🐾', url: link });
      } else {
        await navigator.clipboard.writeText(link);
        const orig = copyBtn.textContent;
        copyBtn.textContent = th ? 'คัดลอกแล้ว!' : 'Copied!';
        setTimeout(() => { copyBtn.textContent = orig; }, 1500);
      }
    } catch (_) { /* user dismissed share / clipboard blocked */ }
  });

  redeemBtn.addEventListener('click', async () => {
    const code = (input.value || '').trim();
    if (!code) return;
    redeemBtn.disabled = true;
    const res = await redeemReferral(code);
    redeemBtn.disabled = false;
    msg.hidden = false;
    if (res && res.ok) {
      msg.textContent = th ? `รับ +${res.referee_reward || 5} เหรียญแล้ว! 🎉` : `You got +${res.referee_reward || 5} coins! 🎉`;
      msg.className = 'mt-ref__msg is-ok';
      showRefToast(msg.textContent, true); // REQ-10: success popup
      input.value = '';
      try { const m = await import('./meow-coin.js'); if (m.refreshServerWallet) await m.refreshServerWallet(); } catch (_) {}
    } else {
      msg.textContent = refErrorMsg(res && res.error, th);
      msg.className = 'mt-ref__msg is-err';
      showRefToast(msg.textContent, false); // REQ-10: failure popup
    }
  });
}
