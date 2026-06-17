/**
 * sign-in-gate.js — Phase 5 Sign-in modal
 *
 * Centered modal popup (NOT a bottom sheet) shown when an
 * unauthenticated user attempts an action that benefits from sign-in
 * (saving a reading, viewing history). Two affordances:
 *   - Primary: Continue with Google (calls onSignIn callback)
 *   - Secondary: Maybe later (dismiss)
 *
 * Design: PopupSignIn in MeowTarot Redesign.html section 12.A.
 *
 * Usage:
 *   import { showSignInGate } from './sign-in-gate.js';
 *   showSignInGate({
 *     lang: 'en',
 *     onSignIn: () => loginWithProvider('google'),
 *     onDismiss: () => {},
 *   });
 *
 * The function returns the overlay element so callers can imperatively
 * dismiss it if needed.
 */

import { isInAppBrowser, isNativePlatform, loginWithProvider } from './auth.js';
import { trackPopupShown, trackPopupDismissed } from './analytics.js';

const OVERLAY_ID = 'mt-signin-gate-overlay';
const STYLE_ID = 'mt-signin-gate-style';

const COPY = {
  en: {
    title: 'Sign in to save your reading',
    body: 'Your streak, decks, and readings are waiting.',
    primary: 'Continue with Google',
    applePrimary: 'Continue with Apple',
    secondary: 'Maybe later',
    dismissLabel: 'Dismiss',
    inAppTitle: 'Open in your browser to sign in',
    inAppBody: 'Google blocks sign-in inside in-app browsers (LINE, Facebook, etc.). Tap the ··· menu and choose “Open in Safari/Chrome”, then sign in there.',
    inAppPrimary: 'Copy link',
    inAppCopied: 'Link copied ✓',
  },
  th: {
    title: 'เข้าสู่ระบบเพื่อบันทึกการอ่านไพ่',
    body: 'สตรีคและไพ่ของคุณรอคุณอยู่',
    primary: 'เข้าสู่ระบบด้วย Google',
    applePrimary: 'เข้าสู่ระบบด้วย Apple',
    secondary: 'ไว้ทีหลัง',
    dismissLabel: 'ปิด',
    inAppTitle: 'เปิดในเบราว์เซอร์เพื่อเข้าสู่ระบบ',
    inAppBody: 'Google ไม่อนุญาตให้เข้าสู่ระบบในเบราว์เซอร์ในแอป (LINE, Facebook ฯลฯ) แตะเมนู ··· แล้วเลือก “เปิดใน Safari/Chrome” จากนั้นเข้าสู่ระบบ',
    inAppPrimary: 'คัดลอกลิงก์',
    inAppCopied: 'คัดลอกแล้ว ✓',
  },
};

function getCopy(lang) {
  return COPY[lang] || COPY.en;
}

function injectStylesOnce() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .mt-signin-overlay {
      position: fixed; inset: 0; z-index: 1200;
      background: rgba(28, 12, 52, 0.45);
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center;
      padding: 22px;
      opacity: 0; transition: opacity 220ms ease;
    }
    .mt-signin-overlay.is-visible { opacity: 1; }

    .mt-signin-card {
      width: 100%; max-width: 360px;
      background: linear-gradient(180deg, #fffaf2 0%, #fdf3ec 100%);
      border-radius: 24px;
      padding: 26px 22px 22px;
      position: relative;
      box-shadow: 0 30px 60px -20px rgba(20, 8, 40, 0.5),
                  0 8px 20px -8px rgba(20, 8, 40, 0.25);
      border: 1px solid rgba(255, 255, 255, 0.6);
      transform: translateY(12px) scale(0.98);
      transition: transform 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .mt-signin-overlay.is-visible .mt-signin-card { transform: none; }

    .mt-signin-dismiss {
      position: absolute; top: 14px; right: 14px;
      width: 30px; height: 30px; border-radius: 50%;
      background: rgba(61, 26, 92, 0.08); border: none;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      color: var(--mt-plum-mid, #6a3f8e); font-size: 18px; line-height: 1;
      font-family: var(--mt-font-body, "DM Sans", system-ui, sans-serif);
      -webkit-tap-highlight-color: transparent;
    }
    .mt-signin-dismiss:hover { background: rgba(61, 26, 92, 0.14); }

    .mt-signin-icon {
      width: 54px; height: 54px; border-radius: 50%;
      background: linear-gradient(135deg, #f6e2d8, #f4cdd7);
      display: flex; align-items: center; justify-content: center;
      color: var(--mt-plum, #3d1a5c); margin-bottom: 16px;
      box-shadow: 0 8px 18px -8px rgba(61, 26, 92, 0.3);
      border: 1px solid rgba(201, 147, 58, 0.45);
      font-size: 28px; line-height: 1;
    }

    .mt-signin-title {
      font-family: var(--mt-font-display, "Cormorant Garamond", Georgia, serif);
      font-size: 22px; font-weight: 600; color: var(--mt-plum, #3d1a5c);
      font-style: italic; line-height: 1.15; margin: 0;
    }
    .mt-signin-title-alt {
      font-family: var(--mt-font-display-th, "Noto Serif Thai", serif);
      font-size: 16px; color: var(--mt-plum-mid, #6a3f8e);
      margin: 6px 0 0; font-weight: 600; line-height: 1.3;
    }
    .mt-signin-body {
      font-family: var(--mt-font-body, "DM Sans", system-ui, sans-serif);
      font-size: 13.5px; color: var(--mt-ink-soft, #7c5e96);
      margin: 12px 0 0; line-height: 1.55;
    }
    .mt-signin-body-alt {
      font-family: var(--mt-font-thai, "IBM Plex Sans Thai", sans-serif);
      font-size: 12.5px; color: var(--mt-ink-soft, #7c5e96);
      margin: 4px 0 0; line-height: 1.55;
    }

    .mt-signin-cta-primary {
      margin-top: 20px; width: 100%;
      font-family: var(--mt-font-body, "DM Sans", system-ui, sans-serif);
      font-weight: 600; font-size: 14.5px;
      padding: 13px 18px; border-radius: 14px;
      background: var(--mt-plum, #3d1a5c); color: #fff8e7;
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 10px;
      box-shadow: 0 10px 22px -8px rgba(61, 26, 92, 0.5);
      letter-spacing: 0.01em;
      -webkit-tap-highlight-color: transparent;
      transition: transform 140ms ease;
    }
    .mt-signin-cta-primary:active { transform: scale(0.97); }
    .mt-signin-cta-primary__g {
      width: 18px; height: 18px; border-radius: 50%;
      background: #fff8e7;
      display: flex; align-items: center; justify-content: center;
      color: var(--mt-plum, #3d1a5c);
      font-family: var(--mt-font-display, "Cormorant Garamond", Georgia, serif);
      font-weight: 700; font-size: 11px; font-style: italic;
    }

    .mt-signin-cta-secondary {
      margin-top: 8px; width: 100%;
      font-family: var(--mt-font-body, "DM Sans", system-ui, sans-serif);
      font-weight: 500; font-size: 13px;
      padding: 12px 18px; border-radius: 14px;
      background: transparent; color: var(--mt-plum-mid, #6a3f8e);
      border: none; cursor: pointer;
      -webkit-tap-highlight-color: transparent;
    }
    .mt-signin-cta-secondary:hover { color: var(--mt-plum, #3d1a5c); }

    .mt-signin-cta-apple {
      margin-top: 8px; width: 100%;
      font-family: var(--mt-font-body, "DM Sans", system-ui, sans-serif);
      font-weight: 600; font-size: 14.5px;
      padding: 13px 18px; border-radius: 14px;
      background: #000; color: #fff;
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center; gap: 8px;
      letter-spacing: 0.01em;
      -webkit-tap-highlight-color: transparent;
      transition: transform 140ms ease;
    }
    .mt-signin-cta-apple:active { transform: scale(0.97); }
    .mt-signin-cta-apple__logo { font-size: 17px; line-height: 1; margin-top: -2px; }
  `;
  document.head.appendChild(style);
}

export function showSignInGate({ lang = 'en', onSignIn, onDismiss } = {}) {
  if (typeof document === 'undefined' || !document.body) return null;
  if (document.getElementById(OVERLAY_ID)) return null;

  injectStylesOnce();
  const copy = getCopy(lang);

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'mt-signin-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-labelledby', 'mt-signin-title');

  // In-app browsers (LINE/FB/IG/…) can't complete Google OAuth (disallowed_useragent),
  // so show "open in your browser" guidance + a copy-link button instead of the doomed
  // Google button.
  const inApp = isInAppBrowser();
  const native = isNativePlatform();
  const gTitle = inApp ? copy.inAppTitle : copy.title;
  const gBody = inApp ? copy.inAppBody : copy.body;
  const gPrimary = inApp ? copy.inAppPrimary : copy.primary;
  const gBadge = inApp ? '' : '<span class="mt-signin-cta-primary__g" aria-hidden="true">G</span>';
  // Native iOS must also offer Sign in with Apple (App Store Guideline 4.8).
  const appleBtnHtml = (native && !inApp)
    ? `<button type="button" class="mt-signin-cta-apple">
        <span class="mt-signin-cta-apple__logo" aria-hidden="true"></span><span>${copy.applePrimary}</span>
      </button>`
    : '';

  const cardHtml = `
    <div class="mt-signin-card" role="document">
      <button type="button" class="mt-signin-dismiss" aria-label="${copy.dismissLabel}">×</button>
      <div class="mt-signin-icon" aria-hidden="true">🐾</div>
      <h2 id="mt-signin-title" class="mt-signin-title">${gTitle}</h2>
      <p class="mt-signin-body">${gBody}</p>
      <button type="button" class="mt-signin-cta-primary">
        ${gBadge}<span>${gPrimary}</span>
      </button>
      ${appleBtnHtml}
      <button type="button" class="mt-signin-cta-secondary">${copy.secondary}</button>
    </div>
  `;
  overlay.innerHTML = cardHtml;
  document.body.appendChild(overlay);

  requestAnimationFrame(() => overlay.classList.add('is-visible'));

  const gateSurface = (typeof document !== 'undefined' && document.body?.dataset?.page) || 'page';
  try { trackPopupShown({ popup: 'signin_gate', surface: gateSurface, locale: lang, inApp }); } catch (_) {}

  const dismiss = () => {
    overlay.classList.remove('is-visible');
    window.setTimeout(() => overlay.remove(), 240);
    document.removeEventListener('keydown', escListener);
    try { trackPopupDismissed({ popup: 'signin_gate', surface: gateSurface, locale: lang }); } catch (_) {}
    if (typeof onDismiss === 'function') {
      try { onDismiss(); } catch (_) {}
    }
  };

  const escListener = (e) => {
    if (e.key === 'Escape') dismiss();
  };
  document.addEventListener('keydown', escListener);

  overlay.querySelector('.mt-signin-dismiss')?.addEventListener('click', dismiss);
  overlay.querySelector('.mt-signin-cta-secondary')?.addEventListener('click', dismiss);

  // Clicking the backdrop (overlay itself, not the card) dismisses.
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) dismiss();
  });

  overlay.querySelector('.mt-signin-cta-primary')?.addEventListener('click', (e) => {
    if (inApp) {
      // Copy the page link so the user can paste it into Safari/Chrome and sign in there.
      const label = e.currentTarget.querySelector('span:last-child');
      const done = () => { if (label) label.textContent = copy.inAppCopied; };
      try {
        if (navigator.clipboard?.writeText) navigator.clipboard.writeText(window.location.href).then(done).catch(done);
        else done();
      } catch (_) { done(); }
      return; // keep the gate open so they can read the instructions
    }
    // Hide the popup first so it doesn't obstruct the Google OAuth flow.
    overlay.classList.remove('is-visible');
    window.setTimeout(() => overlay.remove(), 240);
    document.removeEventListener('keydown', escListener);
    if (typeof onSignIn === 'function') {
      try { onSignIn(); } catch (_) {}
    }
  });

  // Sign in with Apple (native only) — triggers the native Apple sheet directly.
  overlay.querySelector('.mt-signin-cta-apple')?.addEventListener('click', () => {
    overlay.classList.remove('is-visible');
    window.setTimeout(() => overlay.remove(), 240);
    document.removeEventListener('keydown', escListener);
    loginWithProvider('apple').catch((err) => {
      if (err?.code !== 'CANCELLED') console.warn('Apple sign-in failed', err);
    });
  });

  return overlay;
}
