const STORAGE_KEYS = Object.freeze({
  dismissedUntil: 'meowtarot_email_capture_dismissed_until',
  signedUp: 'meowtarot_email_capture_signed_up',
  email: 'meowtarot_email_capture_email',
  source: 'meowtarot_email_capture_source',
  updatedAt: 'meowtarot_email_capture_updated_at',
});

const SESSION_KEYS = Object.freeze({
  shown: 'meowtarot_email_capture_shown_session',
});

const DISMISS_FOR_DAYS = 7;
const DEFAULT_SHOW_DELAY_MS = 45_000;
const READING_TRIGGER_DELAY_MS = 1_200;

function safeGet(storage, key) {
  try {
    return storage.getItem(key);
  } catch (_) {
    return null;
  }
}

function safeSet(storage, key, value) {
  try {
    storage.setItem(key, value);
  } catch (_) {
    // Ignore storage write failures (private mode or blocked storage).
  }
}

function safeRemove(storage, key) {
  try {
    storage.removeItem(key);
  } catch (_) {
    // Ignore storage write failures.
  }
}

function nowMs() {
  return Date.now();
}

function getDismissedUntil() {
  const raw = safeGet(window.localStorage, STORAGE_KEYS.dismissedUntil);
  const parsed = Number(raw || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasSignedUp() {
  return safeGet(window.localStorage, STORAGE_KEYS.signedUp) === '1';
}

function wasShownThisSession() {
  return safeGet(window.sessionStorage, SESSION_KEYS.shown) === '1';
}

function markShownThisSession() {
  safeSet(window.sessionStorage, SESSION_KEYS.shown, '1');
}

function canShow() {
  if (!window?.document?.body) return false;
  if (hasSignedUp()) return false;
  if (wasShownThisSession()) return false;
  return getDismissedUntil() <= nowMs();
}

function validateEmail(email = '') {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
}

function buildPopupMarkup() {
  const overlay = document.createElement('div');
  overlay.className = 'email-capture-overlay';
  overlay.setAttribute('aria-hidden', 'true');

  overlay.innerHTML = `
    <div class="email-capture-backdrop" data-email-capture-close="backdrop"></div>
    <section class="email-capture-modal" role="dialog" aria-modal="true" aria-labelledby="email-capture-title">
      <button type="button" class="email-capture-close" aria-label="Close email signup" data-email-capture-close="close">✕</button>
      <p class="email-capture-kicker">Free guide</p>
      <h2 id="email-capture-title" class="email-capture-title">Get your free Cat Tarot Starter Guide</h2>
      <p class="email-capture-subtitle">A gentle beginner guide to tarot meanings, daily card pulls, and cute cat-themed reflection prompts.</p>
      <form class="email-capture-form" novalidate>
        <label class="email-capture-label" for="email-capture-input">Email</label>
        <input id="email-capture-input" class="email-capture-input" type="email" autocomplete="email" inputmode="email" placeholder="you@example.com" required />
        <p class="email-capture-error" aria-live="polite"></p>
        <button type="submit" class="primary email-capture-submit">Send me the guide</button>
      </form>
      <p class="email-capture-success" aria-live="polite"></p>
      <button type="button" class="ghost email-capture-later" data-email-capture-close="later">Maybe later</button>
    </section>
  `;

  return overlay;
}

export function initEmailCapture(options = {}) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return { triggerFromReadingResult: () => {} };
  }

  const showDelayMs = Number.isFinite(options.showDelayMs) ? options.showDelayMs : DEFAULT_SHOW_DELAY_MS;
  const readingDelayMs = Number.isFinite(options.readingDelayMs) ? options.readingDelayMs : READING_TRIGGER_DELAY_MS;

  let isOpen = false;
  let hasRendered = false;
  let root = null;

  function render() {
    if (hasRendered) return root;
    root = buildPopupMarkup();
    document.body.appendChild(root);

    const form = root.querySelector('.email-capture-form');
    const input = root.querySelector('.email-capture-input');
    const errorEl = root.querySelector('.email-capture-error');
    const successEl = root.querySelector('.email-capture-success');

    const hideWithDismiss = (days = DISMISS_FOR_DAYS) => {
      const until = nowMs() + days * 24 * 60 * 60 * 1000;
      safeSet(window.localStorage, STORAGE_KEYS.dismissedUntil, String(until));
      close();
    };

    const closeTriggers = root.querySelectorAll('[data-email-capture-close]');
    closeTriggers.forEach((btn) => {
      btn.addEventListener('click', (event) => {
        const reason = event.currentTarget?.getAttribute('data-email-capture-close');
        if (reason === 'later' || reason === 'backdrop' || reason === 'close') {
          hideWithDismiss(DISMISS_FOR_DAYS);
        }
      });
    });

    form?.addEventListener('submit', (event) => {
      event.preventDefault();
      const email = String(input?.value || '').trim().toLowerCase();
      errorEl.textContent = '';

      if (!validateEmail(email)) {
        errorEl.textContent = 'Please enter a valid email address.';
        return;
      }

      safeSet(window.localStorage, STORAGE_KEYS.email, email);
      safeSet(window.localStorage, STORAGE_KEYS.signedUp, '1');
      safeSet(window.localStorage, STORAGE_KEYS.source, 'lead_magnet_cat_tarot_starter_guide');
      safeSet(window.localStorage, STORAGE_KEYS.updatedAt, new Date().toISOString());
      safeRemove(window.localStorage, STORAGE_KEYS.dismissedUntil);

      successEl.textContent = 'Thank you — your guide is reserved. We’ll send it when the guide is ready.';
      form.setAttribute('hidden', 'hidden');
      const laterBtn = root.querySelector('.email-capture-later');
      if (laterBtn) laterBtn.setAttribute('hidden', 'hidden');
      setTimeout(() => close(), 2000);
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && isOpen) {
        hideWithDismiss(DISMISS_FOR_DAYS);
      }
    });

    hasRendered = true;
    return root;
  }

  function open(trigger = 'time_on_site') {
    if (isOpen || !canShow()) return;
    const el = render();
    if (!el) return;
    isOpen = true;
    markShownThisSession();
    safeSet(window.localStorage, STORAGE_KEYS.source, trigger);
    document.body.classList.add('is-modal-open');
    el.classList.add('is-open');
    el.setAttribute('aria-hidden', 'false');
    el.querySelector('.email-capture-input')?.focus();
  }

  function close() {
    if (!isOpen || !root) return;
    isOpen = false;
    root.classList.remove('is-open');
    root.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-modal-open');
  }

  const timerId = window.setTimeout(() => {
    open('time_on_site_45s');
  }, Math.max(0, showDelayMs));

  return {
    triggerFromReadingResult() {
      window.clearTimeout(timerId);
      window.setTimeout(() => open('reading_result_loaded'), Math.max(0, readingDelayMs));
    },
  };
}

export const EMAIL_CAPTURE_STORAGE_KEYS = STORAGE_KEYS;
