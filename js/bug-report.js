/**
 * bug-report.js — in-app bug / feedback reporter.
 *
 * Flow: capture a best-effort screenshot of the current page → open a modal
 * (note box + Cloudflare Turnstile bot check + screenshot thumbnail) → on submit,
 * POST {note, diagnostics, screenshot, turnstileToken} to the `bug-report` Supabase
 * Edge Function, which verifies Turnstile server-side and emails info@meowtarot.com
 * via Resend.
 *
 * Loaded lazily (only when the footer "Report a bug" link is clicked), so the heavy
 * html2canvas dependency never touches normal page loads.
 *
 * SETUP REQUIRED before this works end-to-end:
 *   - Cloudflare Turnstile: set the site key below (or window.MEOWTAROT_TURNSTILE_SITE_KEY).
 *     Secret key + RESEND_API_KEY live in the edge function's env (server-side).
 *   - Deploy supabase/functions/bug-report.
 */

import { getActiveDeckId } from './data.js';

// Public Turnstile site key (safe to ship in client). Replace with the real key
// from the Cloudflare dashboard, or set window.MEOWTAROT_TURNSTILE_SITE_KEY.
const TURNSTILE_SITE_KEY = (typeof window !== 'undefined' && window.MEOWTAROT_TURNSTILE_SITE_KEY)
  || 'TURNSTILE_SITE_KEY_PLACEHOLDER';

const OVERLAY_ID = 'mt-bug-overlay';
const STYLE_ID = 'mt-bug-style';

const COPY = {
  en: {
    title: 'Report a bug',
    body: 'Spotted something off? Tell us what happened — a screenshot of this screen is attached automatically.',
    placeholder: 'What went wrong? What were you doing?',
    screenshotLabel: 'Screenshot attached',
    send: 'Send report',
    sending: 'Sending…',
    cancel: 'Cancel',
    success: 'Thanks! Your report was sent 🐾',
    error: 'Could not send — please try again.',
    robotError: 'Please complete the verification.',
    dismiss: 'Close',
  },
  th: {
    title: 'แจ้งปัญหา',
    body: 'เจออะไรผิดปกติไหม? บอกเราได้เลย — ภาพหน้าจอนี้จะถูกแนบไปอัตโนมัติ',
    placeholder: 'เกิดอะไรขึ้น? ตอนนั้นกำลังทำอะไรอยู่?',
    screenshotLabel: 'แนบภาพหน้าจอแล้ว',
    send: 'ส่งรายงาน',
    sending: 'กำลังส่ง…',
    cancel: 'ยกเลิก',
    success: 'ขอบคุณ! ส่งรายงานเรียบร้อยแล้ว 🐾',
    error: 'ส่งไม่สำเร็จ ลองอีกครั้ง',
    robotError: 'กรุณายืนยันว่าไม่ใช่บอท',
    dismiss: 'ปิด',
  },
};

function getCopy(lang) { return COPY[lang] || COPY.en; }

function collectDiagnostics(lang) {
  let deck = '';
  try { deck = getActiveDeckId() || ''; } catch (_) {}
  const errs = (typeof window !== 'undefined' && Array.isArray(window.__mtErrors)) ? window.__mtErrors.slice(-8) : [];
  return {
    url: typeof location !== 'undefined' ? location.href : '',
    referrer: typeof document !== 'undefined' ? document.referrer : '',
    user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
    language: typeof navigator !== 'undefined' ? navigator.language : '',
    locale: lang,
    viewport: typeof window !== 'undefined' ? `${window.innerWidth}x${window.innerHeight}` : '',
    dpr: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    active_deck: deck,
    is_native: !!(window?.Capacitor?.isNativePlatform?.()),
    recent_errors: errs,
  };
}

// Best-effort page screenshot → downscaled JPEG data URL, or null on failure.
async function captureScreenshot() {
  try {
    const { html2canvas } = await import('./vendor/html2canvas.js');
    const canvas = await html2canvas(document.body, {
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: null,
      scale: 1,
      windowWidth: document.documentElement.clientWidth,
      windowHeight: document.documentElement.clientHeight,
      x: window.scrollX,
      y: window.scrollY,
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    });
    // Downscale to max 1000px wide to keep the email attachment small.
    const maxW = 1000;
    const scale = canvas.width > maxW ? maxW / canvas.width : 1;
    const out = document.createElement('canvas');
    out.width = Math.round(canvas.width * scale);
    out.height = Math.round(canvas.height * scale);
    out.getContext('2d').drawImage(canvas, 0, 0, out.width, out.height);
    return out.toDataURL('image/jpeg', 0.8);
  } catch (_) {
    return null; // screenshot is best-effort; the report still sends without it
  }
}

function injectStylesOnce() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .mt-bug-overlay {
      position: fixed; inset: 0; z-index: 1300;
      background: rgba(28, 12, 52, 0.45);
      backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
      display: flex; align-items: center; justify-content: center; padding: 22px;
      opacity: 0; transition: opacity 200ms ease;
    }
    .mt-bug-overlay.is-visible { opacity: 1; }
    .mt-bug-card {
      width: 100%; max-width: 380px; max-height: 88vh; overflow-y: auto;
      background: linear-gradient(180deg, #fffaf2 0%, #fdf3ec 100%);
      border-radius: 22px; padding: 22px 20px 18px; position: relative;
      box-shadow: 0 30px 60px -20px rgba(20, 8, 40, 0.5);
      border: 1px solid rgba(197,177,220,0.5);
      font-family: var(--mt-font-body, "DM Sans", system-ui, sans-serif);
      transform: translateY(12px) scale(0.98); transition: transform 260ms cubic-bezier(0.34,1.56,0.64,1);
    }
    .mt-bug-overlay.is-visible .mt-bug-card { transform: none; }
    .mt-bug-title { font-family: var(--mt-font-display, "Cormorant Garamond", Georgia, serif); font-style: italic; font-weight: 600; font-size: 22px; color: var(--mt-plum, #3d1a5c); margin: 0 0 6px; }
    .mt-bug-body { font-size: 13px; color: var(--mt-ink-soft, #6b5b82); margin: 0 0 12px; line-height: 1.5; }
    .mt-bug-textarea { width: 100%; box-sizing: border-box; min-height: 96px; resize: vertical; border-radius: 12px; border: 1px solid rgba(197,177,220,0.6); background: #fff; padding: 11px 12px; font: inherit; font-size: 14px; color: #2c2440; }
    .mt-bug-textarea:focus { outline: none; border-color: var(--mt-plum-mid, #6a3f8e); }
    .mt-bug-shot { margin: 10px 0; display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--mt-ink-soft, #6b5b82); }
    .mt-bug-shot img { width: 46px; height: 46px; object-fit: cover; border-radius: 8px; border: 1px solid rgba(197,177,220,0.6); }
    .mt-bug-turnstile { margin: 10px 0; min-height: 0; }
    .mt-bug-cta { margin-top: 6px; width: 100%; font-weight: 600; font-size: 14.5px; padding: 13px 18px; border-radius: 14px; background: var(--mt-plum, #3d1a5c); color: #fff8e7; border: none; cursor: pointer; }
    .mt-bug-cta:disabled { opacity: 0.55; cursor: default; }
    .mt-bug-cancel { margin-top: 6px; width: 100%; font-weight: 500; font-size: 13px; padding: 11px; background: transparent; color: var(--mt-plum-mid, #6a3f8e); border: none; cursor: pointer; }
    .mt-bug-msg { font-size: 12.5px; margin: 8px 0 0; min-height: 16px; }
    .mt-bug-msg.is-err { color: #b23b4e; }
    .mt-bug-msg.is-ok { color: #2e7d52; }
  `;
  document.head.appendChild(style);
}

let turnstileToken = '';

function loadTurnstileWidget(container, onToken) {
  const render = () => {
    if (!window.turnstile || !container) return;
    try {
      window.turnstile.render(container, {
        sitekey: TURNSTILE_SITE_KEY,
        callback: (t) => { turnstileToken = t; onToken(t); },
        'expired-callback': () => { turnstileToken = ''; onToken(''); },
        'error-callback': () => { turnstileToken = ''; onToken(''); },
      });
    } catch (_) {}
  };
  if (window.turnstile) { render(); return; }
  if (!document.getElementById('mt-turnstile-script')) {
    const s = document.createElement('script');
    s.id = 'mt-turnstile-script';
    s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    s.async = true; s.defer = true;
    s.onload = render;
    document.head.appendChild(s);
  } else {
    // script already loading — poll briefly
    let n = 0; const iv = setInterval(() => { if (window.turnstile || n++ > 40) { clearInterval(iv); render(); } }, 150);
  }
}

export async function showBugReport({ lang = 'en' } = {}) {
  if (typeof document === 'undefined' || !document.body) return;
  if (document.getElementById(OVERLAY_ID)) return;
  const copy = getCopy(lang);
  injectStylesOnce();
  turnstileToken = '';

  // Capture the screenshot BEFORE the modal covers the page.
  const screenshot = await captureScreenshot();

  const overlay = document.createElement('div');
  overlay.id = OVERLAY_ID;
  overlay.className = 'mt-bug-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.innerHTML = `
    <div class="mt-bug-card" role="document">
      <h2 class="mt-bug-title">${copy.title}</h2>
      <p class="mt-bug-body">${copy.body}</p>
      <textarea class="mt-bug-textarea" placeholder="${copy.placeholder}"></textarea>
      ${screenshot ? `<div class="mt-bug-shot"><img src="${screenshot}" alt="" /><span>${copy.screenshotLabel}</span></div>` : ''}
      <div class="mt-bug-turnstile"></div>
      <p class="mt-bug-msg" aria-live="polite"></p>
      <button type="button" class="mt-bug-cta">${copy.send}</button>
      <button type="button" class="mt-bug-cancel">${copy.cancel}</button>
    </div>
  `;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('is-visible'));

  const textarea = overlay.querySelector('.mt-bug-textarea');
  const sendBtn = overlay.querySelector('.mt-bug-cta');
  const cancelBtn = overlay.querySelector('.mt-bug-cancel');
  const msg = overlay.querySelector('.mt-bug-msg');
  textarea?.focus();

  loadTurnstileWidget(overlay.querySelector('.mt-bug-turnstile'), () => {});

  const close = () => {
    overlay.classList.remove('is-visible');
    setTimeout(() => overlay.remove(), 220);
  };
  cancelBtn?.addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

  sendBtn?.addEventListener('click', async () => {
    msg.className = 'mt-bug-msg';
    msg.textContent = '';
    if (TURNSTILE_SITE_KEY !== 'TURNSTILE_SITE_KEY_PLACEHOLDER' && !turnstileToken) {
      msg.textContent = copy.robotError; msg.className = 'mt-bug-msg is-err'; return;
    }
    sendBtn.disabled = true; cancelBtn.disabled = true;
    sendBtn.textContent = copy.sending;
    try {
      const { getSupabaseClient } = await import('./auth.js');
      const client = await getSupabaseClient();
      if (!client) throw new Error('no client');
      const { error } = await client.functions.invoke('bug-report', {
        body: {
          note: (textarea?.value || '').slice(0, 4000),
          diagnostics: collectDiagnostics(lang),
          screenshot: screenshot || null,
          turnstileToken,
        },
      });
      if (error) throw error;
      msg.textContent = copy.success; msg.className = 'mt-bug-msg is-ok';
      setTimeout(close, 1400);
    } catch (_) {
      sendBtn.disabled = false; cancelBtn.disabled = false;
      sendBtn.textContent = copy.send;
      msg.textContent = copy.error; msg.className = 'mt-bug-msg is-err';
    }
  });
}
