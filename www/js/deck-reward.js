/**
 * deck-reward.js — Streak milestone unlock popup
 *
 * Triggered after a daily reading when a streak crosses a deck's unlock_day.
 * Bottom-sheet popup with deck preview, name, and claim/later CTAs.
 * Self-contained DOM injection; no auto-dismiss (user action required).
 */

import { markDeckRewardSeen, hasSeenDeckReward, getAllDecks, canUnlockDeck, isGiftedDeck } from './data.js';
import { translations } from './common.js';
import { getCurrentUserSync, loginWithProvider } from './auth.js';

const STYLE_FLAG = '__mt_deck_reward_styles_injected';
const POPUP_ID = 'mt-deck-reward-popup';

const STYLES = `
.mt-dr-overlay {
  position: fixed;
  inset: 0;
  background: rgba(20, 14, 40, 0.6);
  -webkit-backdrop-filter: blur(8px);
  backdrop-filter: blur(8px);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 9999;
  opacity: 0;
  transition: opacity 280ms ease;
}
.mt-dr-overlay.mt-dr-active { opacity: 1; }
.mt-dr-overlay.mt-dr-fade-out { opacity: 0; }
.mt-dr-sheet {
  width: 100%;
  max-width: 480px;
  background: #ffffff;
  border-radius: 24px 24px 0 0;
  padding: 12px 24px 32px;
  box-sizing: border-box;
  transform: translateY(100%);
  transition: transform 320ms cubic-bezier(0.2, 0.8, 0.2, 1);
  text-align: center;
  font-family: 'Sarabun', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: #332f42;
  max-height: 90vh;
  overflow-y: auto;
  padding-bottom: calc(32px + env(safe-area-inset-bottom));
}
.mt-dr-overlay.mt-dr-active .mt-dr-sheet { transform: translateY(0); }
.mt-dr-handle {
  width: 40px;
  height: 4px;
  border-radius: 2px;
  background: rgba(60, 40, 90, 0.2);
  margin: 0 auto 16px;
}
.mt-dr-sparkles {
  position: relative;
  height: 24px;
  margin-bottom: 4px;
  pointer-events: none;
}
.mt-dr-sparkles span {
  position: absolute;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: radial-gradient(circle, #f7c84d 0%, rgba(247, 200, 77, 0) 70%);
  opacity: 0.6;
  animation: mt-dr-sparkle 2.4s ease-in-out infinite;
}
.mt-dr-sparkles span:nth-child(1) { top: 0; left: 22%; animation-delay: 0s; }
.mt-dr-sparkles span:nth-child(2) { top: 8px; left: 42%; animation-delay: 0.5s; }
.mt-dr-sparkles span:nth-child(3) { top: 4px; left: 64%; animation-delay: 1.1s; }
.mt-dr-sparkles span:nth-child(4) { top: 12px; left: 82%; animation-delay: 1.6s; }
@keyframes mt-dr-sparkle {
  0%, 100% { transform: scale(0.6); opacity: 0.3; }
  50% { transform: scale(1.4); opacity: 1; }
}
.mt-dr-card-wrap {
  margin: 0 auto 20px;
  display: flex;
  justify-content: center;
}
.mt-dr-card {
  width: 140px;
  height: 224px;
  object-fit: cover;
  border-radius: 12px;
  box-shadow: 0 12px 32px rgba(80, 50, 130, 0.25);
  transform: rotate(-4deg) scale(0.92);
  transition: transform 380ms cubic-bezier(0.2, 0.8, 0.2, 1);
}
.mt-dr-overlay.mt-dr-active .mt-dr-card { transform: rotate(0deg) scale(1); }
.mt-dr-eyebrow {
  font-size: 13px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #9270d0;
  margin: 0 0 6px;
  font-weight: 500;
}
.mt-dr-title {
  font-family: 'Playfair Display', Georgia, serif;
  font-size: 26px;
  font-weight: 600;
  line-height: 1.2;
  margin: 0 0 4px;
  color: #3d2c58;
}
.mt-dr-subtitle {
  font-family: 'Sarabun', sans-serif;
  font-size: 15px;
  color: rgba(61, 44, 88, 0.6);
  margin: 0 0 14px;
}
.mt-dr-body {
  font-size: 15px;
  line-height: 1.5;
  margin: 0 0 24px;
  color: #4a4359;
}
.mt-dr-cta-primary {
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
  margin-bottom: 8px;
  transition: transform 120ms ease, box-shadow 120ms ease;
}
.mt-dr-cta-primary:hover { transform: translateY(-1px); box-shadow: 0 6px 18px rgba(110, 80, 170, 0.35); }
.mt-dr-cta-primary:active { transform: translateY(0); }
.mt-dr-cta-secondary {
  display: block;
  width: 100%;
  padding: 12px 20px;
  border: none;
  background: transparent;
  color: rgba(61, 44, 88, 0.7);
  font-family: inherit;
  font-size: 14px;
  cursor: pointer;
}
.mt-dr-cta-secondary:hover { color: #3d2c58; }
@media (prefers-reduced-motion: reduce) {
  .mt-dr-overlay,
  .mt-dr-sheet,
  .mt-dr-card { transition: none !important; }
  .mt-dr-sparkles span { animation: none !important; opacity: 0.5; }
}
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

function fmt(template, vars) {
  let result = String(template || '');
  Object.entries(vars || {}).forEach(([k, v]) => {
    result = result.split(`{${k}}`).join(String(v));
  });
  return result;
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

function getPrimaryName(deck, lang) {
  if (lang === 'th') return deck.name_th || deck.name || '';
  return deck.name || deck.name_th || '';
}

function getSecondaryName(deck, lang) {
  const primary = getPrimaryName(deck, lang);
  const other = lang === 'th' ? deck.name : deck.name_th;
  if (!other || other === primary) return '';
  return other;
}

/**
 * Show the deck-reward bottom-sheet popup.
 *
 * @param {object} deck - DECKS registry entry { id, name, name_th, backImage, unlock_day, ... }
 * @param {string} lang - 'en' | 'th'
 */
export function showDeckRewardPopup(deck, lang = 'en') {
  if (typeof document === 'undefined') return;
  if (!document.body) return;
  if (!deck || !deck.id) return;
  if (hasSeenDeckReward(deck.id)) return;
  if (document.getElementById(POPUP_ID)) return;

  injectStylesOnce();

  const dict = getDict(lang);
  const primaryName = getPrimaryName(deck, lang);
  const secondaryName = getSecondaryName(deck, lang);
  const dayValue = deck.unlock_day == null ? '' : String(deck.unlock_day);
  // A gifted deck isn't earned by a streak day, so the "You reached Day N" copy
  // doesn't apply — use the gift-specific eyebrow + body instead.
  const gift = isGiftedDeck(deck.id);

  const overlay = document.createElement('div');
  overlay.id = POPUP_ID;
  overlay.className = 'mt-dr-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'mt-dr-title');

  const titleText = fmt(dict.deckRewardTitle, { deck: primaryName });
  const bodyText = gift
    ? fmt(dict.deckRewardGiftBody || dict.deckRewardBody, { deck: primaryName })
    : fmt(dict.deckRewardBody, { day: dayValue, deck: primaryName });
  const eyebrowText = gift
    ? (dict.deckRewardGiftEyebrow || dict.deckRewardEyebrow)
    : dict.deckRewardEyebrow;
  const isAuthed = !!getCurrentUserSync();
  const primaryCtaText = isAuthed
    ? dict.deckRewardClaimCta
    : (dict.deckRewardSignInCta || 'Sign in to claim');
  const signInNote = isAuthed
    ? ''
    : `<p class="mt-dr-subtitle">${escapeHtml(dict.deckRewardSignInBody || 'Sign in to save your deck unlock across devices.')}</p>`;

  overlay.innerHTML = `
    <div class="mt-dr-sheet" role="document">
      <div class="mt-dr-handle" aria-hidden="true"></div>
      <div class="mt-dr-sparkles" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </div>
      <div class="mt-dr-card-wrap">
        <img class="mt-dr-card" src="${escapeHtml(deck.backImage)}" alt="" />
      </div>
      <p class="mt-dr-eyebrow">${escapeHtml(eyebrowText)}</p>
      <h2 id="mt-dr-title" class="mt-dr-title">${escapeHtml(titleText)}</h2>
      ${secondaryName ? `<p class="mt-dr-subtitle">${escapeHtml(secondaryName)}</p>` : ''}
      <p class="mt-dr-body">${escapeHtml(bodyText)}</p>
      ${signInNote}
      <button type="button" class="mt-dr-cta-primary">${escapeHtml(primaryCtaText)}</button>
      <button type="button" class="mt-dr-cta-secondary">${escapeHtml(dict.deckRewardLaterCta)}</button>
    </div>
  `;

  document.body.appendChild(overlay);

  import('./analytics.js')
    .then(({ trackPopupShown }) => trackPopupShown({ popup: 'deck_reward', surface: document.body?.dataset?.page || 'page', deckId: deck.id, locale: lang }))
    .catch(() => {});

  requestAnimationFrame(() => {
    overlay.classList.add('mt-dr-active');
  });

  const dismiss = () => {
    overlay.classList.remove('mt-dr-active');
    overlay.classList.add('mt-dr-fade-out');
    setTimeout(() => {
      if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }, 320);
  };

  const primaryBtn = overlay.querySelector('.mt-dr-cta-primary');
  const secondaryBtn = overlay.querySelector('.mt-dr-cta-secondary');

  if (primaryBtn) {
    if (isAuthed) {
      primaryBtn.addEventListener('click', () => {
        // BUG-016 #3: defer the active-deck switch instead of flipping it live
        // on the result page. Switching mid-session desynced the already-
        // rendered result (drawn deck) from the share poster, which reads the
        // live active deck at generation time. Routing through the same
        // pending-claim mechanism the unauth path uses keeps the current
        // reading + its poster on the deck it was drawn with; auth.js applies
        // the pending deck on the next page load (onAuthStateChange), so the
        // new deck takes effect from the user's next reading onward. (Restyling
        // the on-screen reading on switch is a deferred future feature.)
        try { localStorage.setItem('meowtarot_pending_deck_claim', deck.id); } catch (_) { /* swallow */ }
        markDeckRewardSeen(deck.id);
        dismiss();
      }, { once: true });
    } else {
      primaryBtn.addEventListener('click', async () => {
        try {
          localStorage.setItem('meowtarot_pending_deck_claim', deck.id);
          await loginWithProvider('google');
        } catch (error) {
          console.warn('Sign-in for deck claim failed', error);
        }
      }, { once: true });
    }
  }

  if (secondaryBtn) {
    secondaryBtn.addEventListener('click', () => {
      markDeckRewardSeen(deck.id);
      dismiss();
    }, { once: true });
  }
}

/**
 * Surface a popup for ANY deck that is now available to the signed-in user but
 * whose reward they haven't seen yet — covers gifted decks (no streak crossing)
 * and future achievement-unlocked decks, plus any streak deck whose popup was
 * missed (e.g. earned while logged out). Streak-day crossings still fire their
 * own popup inline on the daily result; this is the catch-all on app open.
 *
 * Scalable by design: it reads canUnlockDeck() (the single source of unlock
 * truth) for every deck, so new decks / new unlock requirements need no change
 * here. Default decks are excluded (they were never a "reward"). Shows one at a
 * time (the popup is a singleton); the rest surface on subsequent opens.
 *
 * @param {string} lang - 'en' | 'th'
 */
export function maybeShowUnseenDeckRewards(lang = 'en') {
  if (typeof document === 'undefined' || !document.body) return;
  // Don't stack on top of the login-reward popup or an already-open deck popup.
  if (document.getElementById('mt-login-reward-popup')) return;
  if (document.getElementById(POPUP_ID)) return;

  const next = getAllDecks().find((deck) => {
    if (!deck || deck.role === 'default') return false; // defaults aren't rewards
    const rewardable = deck.role === 'streak-unlock' || isGiftedDeck(deck.id);
    return rewardable && canUnlockDeck(deck.id) && !hasSeenDeckReward(deck.id);
  });

  if (next) showDeckRewardPopup(next, lang);
}
