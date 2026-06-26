/**
 * login-reward.js — First-sign-in welcome popup
 *
 * Triggered once per user (per device) when they first sign in.
 * Centered modal showing the Veila Tarot starter deck. Single CTA
 * grants the deck by setting it as the active deck.
 * Gated by localStorage flag 'meowtarot_login_reward_seen'.
 */

import { DECKS, setActiveDeck } from './data.js';
import { translations } from './common.js';

const STYLE_FLAG = '__mt_login_reward_styles_injected';
const POPUP_ID = 'mt-login-reward-popup';
const SEEN_STORAGE_KEY = 'meowtarot_login_reward_seen';
const WELCOME_DATE_KEY = 'meowtarot_welcomeback_date';
const SHOW_DELAY_MS = 800;

let pending = false;

const STYLES = `
.mt-lr-overlay {
  position: fixed;
  inset: 0;
  background: rgba(20, 14, 40, 0.7);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
  box-sizing: border-box;
  opacity: 0;
  transition: opacity 320ms ease;
}
.mt-lr-overlay.mt-lr-active { opacity: 1; }
.mt-lr-overlay.mt-lr-fade-out { opacity: 0; }
.mt-lr-card {
  width: 100%;
  max-width: 360px;
  background: #ffffff;
  border-radius: 24px;
  padding: 28px 24px 32px;
  box-sizing: border-box;
  text-align: center;
  font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #332f42;
  transform: scale(0.92) translateY(16px);
  transition: transform 360ms cubic-bezier(0.2, 0.8, 0.2, 1);
  box-shadow: 0 24px 60px rgba(20, 14, 40, 0.35);
}
.mt-lr-overlay.mt-lr-active .mt-lr-card { transform: scale(1) translateY(0); }
.mt-lr-sparkles {
  position: relative;
  height: 20px;
  margin-bottom: 4px;
  pointer-events: none;
}
.mt-lr-sparkles span {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: radial-gradient(circle, #f7c84d 0%, rgba(247, 200, 77, 0) 70%);
  opacity: 0.6;
  animation: mt-lr-sparkle 2.4s ease-in-out infinite;
}
.mt-lr-sparkles span:nth-child(1) { top: 0; left: 24%; animation-delay: 0s; }
.mt-lr-sparkles span:nth-child(2) { top: 6px; left: 46%; animation-delay: 0.6s; }
.mt-lr-sparkles span:nth-child(3) { top: 2px; left: 70%; animation-delay: 1.2s; }
@keyframes mt-lr-sparkle {
  0%, 100% { transform: scale(0.6); opacity: 0.3; }
  50% { transform: scale(1.4); opacity: 1; }
}
.mt-lr-img-wrap {
  margin: 0 auto 16px;
  display: flex;
  justify-content: center;
}
.mt-lr-img {
  width: 120px;
  height: 192px;
  object-fit: cover;
  border-radius: 10px;
  box-shadow: 0 10px 28px rgba(80, 50, 130, 0.25);
}
.mt-lr-eyebrow {
  font-size: 12px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: #9270d0;
  margin: 0 0 6px;
  font-weight: 600;
}
.mt-lr-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 22px;
  font-weight: 600;
  line-height: 1.25;
  margin: 0 0 12px;
  color: #3d2c58;
}
.mt-lr-body {
  font-size: 14px;
  line-height: 1.55;
  margin: 0 0 24px;
  color: #4a4359;
}
.mt-lr-cta {
  display: block;
  width: 100%;
  padding: 14px 20px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #9270d0 0%, #6d4ea8 100%);
  color: #ffffff;
  font-family: inherit;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
}
.mt-lr-cta:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(110, 80, 170, 0.35); }
.mt-lr-cta:active { transform: translateY(0); }
@media (prefers-reduced-motion: reduce) {
  .mt-lr-overlay,
  .mt-lr-card { transition: none !important; }
  .mt-lr-sparkles span { animation: none !important; opacity: 0.5; }
}
.mt-welcome-toast {
  position: fixed;
  left: 50%;
  top: calc(env(safe-area-inset-top, 0px) + 18px);
  transform: translate(-50%, -14px);
  z-index: 9999;
  padding: 10px 18px;
  border-radius: 999px;
  background: rgba(61, 26, 92, 0.92);
  color: #fff;
  font-family: var(--mt-font-body, sans-serif);
  font-size: 14px;
  font-weight: 600;
  box-shadow: 0 8px 24px rgba(31, 21, 52, 0.34);
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s ease, transform 0.3s ease;
}
.mt-welcome-toast.in { opacity: 1; transform: translate(-50%, 0); }
`;

function injectStylesOnce() {
  if (typeof document === 'undefined') return;
  if (document[STYLE_FLAG]) return;
  const styleEl = document.createElement('style');
  styleEl.textContent = STYLES;
  document.head.appendChild(styleEl);
  document[STYLE_FLAG] = true;
}

function getDict(lang) {
  if (lang === 'th' && translations.th) return translations.th;
  return translations.en;
}

function escapeHtml(value) {
  return String(value == null ? '' : value).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function readSeen() {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(SEEN_STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

function markSeen() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(SEEN_STORAGE_KEY, 'true');
  } catch {
    // ignore
  }
}

function buildPopup(deckBackUrl, dict) {
  const overlay = document.createElement('div');
  overlay.id = POPUP_ID;
  overlay.className = 'mt-lr-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'mt-lr-title');

  overlay.innerHTML = `
    <div class="mt-lr-card" role="document">
      <div class="mt-lr-sparkles" aria-hidden="true">
        <span></span><span></span><span></span>
      </div>
      <div class="mt-lr-img-wrap">
        <img class="mt-lr-img" src="${escapeHtml(deckBackUrl)}" alt="" />
      </div>
      <p class="mt-lr-eyebrow">${escapeHtml(dict.loginRewardEyebrow)}</p>
      <h2 id="mt-lr-title" class="mt-lr-title">${escapeHtml(dict.loginRewardTitle)}</h2>
      <p class="mt-lr-body">${escapeHtml(dict.loginRewardBody)}</p>
      <button type="button" class="mt-lr-cta">${escapeHtml(dict.loginRewardClaimCta)}</button>
    </div>
  `;

  return overlay;
}

/**
 * Show the login reward popup if the user is signed in and hasn't seen it yet.
 *
 * @param {object|null} user - Supabase auth user (or null for guest)
 * @param {string} lang - 'en' | 'th'
 */
function showWelcomeToast(lang) {
  if (typeof document === 'undefined' || !document.body) return;
  if (document.getElementById('mt-welcome-toast')) return;
  // Show at most once per calendar day (founder 2026-06-26). Supabase re-fires SIGNED_IN
  // with no in-memory prevUser on each fresh page load, so without this the "Welcome back"
  // toast popped on every homepage visit.
  try {
    const today = new Date().toISOString().slice(0, 10);
    if (localStorage.getItem(WELCOME_DATE_KEY) === today) return;
    localStorage.setItem(WELCOME_DATE_KEY, today);
  } catch (_) { /* storage blocked → fall through and just show it */ }
  injectStylesOnce();
  const dict = getDict(lang);
  const toast = document.createElement('div');
  toast.id = 'mt-welcome-toast';
  toast.className = 'mt-welcome-toast';
  toast.setAttribute('role', 'status');
  toast.textContent = dict.loginWelcomeBack || 'Welcome back!';
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('in'));
  setTimeout(() => {
    toast.classList.remove('in');
    setTimeout(() => toast.remove(), 320);
  }, 2200);
}

export function maybeShowLoginReward(user, lang, opts = {}) {
  if (typeof document === 'undefined') return;
  if (!user) return;
  if (pending) return;

  // First-EVER login = account just created (≈ within 5 min) AND the reward hasn't shown.
  // Anything else is a returning login → no deck reward; a light "welcome back" toast on a
  // genuine fresh sign-in only (not on every page-load session restore).
  const createdMs = user.created_at ? Date.parse(user.created_at) : 0;
  const isFirstEver = createdMs > 0 && (Date.now() - createdMs) < 5 * 60 * 1000 && !readSeen();

  if (!isFirstEver) {
    markSeen(); // never re-trigger the deck reward for returning users
    if (opts.fresh) showWelcomeToast(lang);
    return;
  }

  pending = true;
  setTimeout(() => {
    pending = false;

    if (!document.body) return;
    if (document.getElementById(POPUP_ID)) return;
    markSeen(); // mark on SHOW (was only on claim → re-showed if dismissed/reloaded)

    injectStylesOnce();

    const dict = getDict(lang);
    const deckBackUrl = DECKS && DECKS['veila-tarot'] ? DECKS['veila-tarot'].backImage : '';

    const overlay = buildPopup(deckBackUrl, dict);
    document.body.appendChild(overlay);

    import('./analytics.js')
      .then(({ trackPopupShown }) => trackPopupShown({ popup: 'login_reward', surface: document.body?.dataset?.page || 'page', deckId: 'veila-tarot', locale: lang }))
      .catch(() => {});

    requestAnimationFrame(() => {
      overlay.classList.add('mt-lr-active');
    });

    const dismiss = () => {
      overlay.classList.remove('mt-lr-active');
      overlay.classList.add('mt-lr-fade-out');
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 320);
    };

    const cta = overlay.querySelector('.mt-lr-cta');
    if (cta) {
      cta.addEventListener('click', () => {
        setActiveDeck('veila-tarot');
        markSeen();
        dismiss();
      }, { once: true });
    }
  }, SHOW_DELAY_MS);
}
