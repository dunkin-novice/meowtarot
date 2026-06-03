/**
 * bottom-nav.js — Phase 5 floating-pill bottom navigation
 *
 * 4 tabs: Today (index/daily landing) · Decks · Ask · Profile.
 * No center button — the old contextual Share/Continue/Draw center
 * affordance is gone; Continue/Share live in the page itself, and
 * Draw is reached via the Today tab → daily.html flow.
 *
 * Hand-crafted SVG cat glyphs per tab — kawaii pastel register
 * matching the design doc's CatIcon style. Single fill="currentColor"
 * so CSS controls the active vs inactive tint with no JS.
 */

const MOBILE_QUERY = '(max-width: 768px)';
const EXCLUDED_PREFIXES = ['/share/', '/docs/', '/sharekit/'];

function normalizePath(pathname = '/') {
  if (!pathname) return '/';
  return pathname.endsWith('/') ? pathname : `${pathname}/`;
}

function getLocaleConfig(pathname) {
  const isThai = pathname === '/th' || pathname.startsWith('/th/');
  const prefix = isThai ? '/th' : '';
  return {
    isThai,
    prefix,
    labels: isThai
      ? {
        today: 'วันนี้',
        decks: 'สำรับ',
        ask: 'ถาม',
        profile: 'โปรไฟล์',
      }
      : {
        today: 'Today',
        decks: 'Decks',
        ask: 'Ask',
        profile: 'Profile',
      },
  };
}

function shouldExclude(pathname) {
  const normalized = normalizePath(pathname);
  return EXCLUDED_PREFIXES.some((prefix) => normalized.startsWith(prefix) || normalized.startsWith(`/th${prefix}`));
}

function getActiveTab(pathname) {
  const normalized = normalizePath(pathname.replace(/^\/th/, '') || '/');
  if (
    normalized === '/' ||
    normalized.startsWith('/index.html/') ||
    normalized.startsWith('/today/') ||
    normalized.startsWith('/daily.html/')
  ) return 'today';
  if (
    normalized.startsWith('/decks.html') ||
    normalized.startsWith('/decks/') ||
    normalized.startsWith('/tarot-card-meanings/') ||
    normalized.startsWith('/cards/')
  ) return 'decks';
  if (
    normalized.startsWith('/question.html') ||
    normalized.startsWith('/question/') ||
    normalized.startsWith('/full.html')
  ) return 'ask';
  if (normalized.startsWith('/profile.html')) return 'profile';
  return '';
}

/* ─────────────────────────────────────────────────────────────
 * SVG cat glyphs — single-color paths, currentColor fill so
 * active/inactive states are CSS-driven. 24x24 viewBox, scales
 * cleanly to the 22px rendered size.
 * ───────────────────────────────────────────────────────────── */

const ICON_TODAY = `
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
    <ellipse cx="10.5" cy="16.5" rx="6.5" ry="3.4"/>
    <path d="M7 13 L8 8.5 L11 13 Z"/>
    <path d="M17 4.5 l 0.55 1.3 l 1.4 0.18 l -1 1 l 0.27 1.4 l -1.22 -0.7 l -1.22 0.7 l 0.27 -1.4 l -1 -1 l 1.4 -0.18 z"/>
  </svg>
`.trim();

const ICON_DECKS = `
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
    <rect x="2.8" y="10" width="5.6" height="11.5" rx="0.9" transform="rotate(-14 5.6 15.75)"/>
    <rect x="9.2" y="9" width="5.6" height="11.5" rx="0.9"/>
    <rect x="15.6" y="10" width="5.6" height="11.5" rx="0.9" transform="rotate(14 18.4 15.75)"/>
    <path d="M9 9 L10.5 5 L12 9 Z"/>
    <path d="M12 9 L13.5 5 L15 9 Z"/>
  </svg>
`.trim();

const ICON_ASK = `
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
    <path d="M3 11 L4.5 6.5 L7 11 Z"/>
    <path d="M9 11 L11 7 L13 11 Z"/>
    <circle cx="8" cy="14" r="4.5"/>
    <circle cx="18" cy="9" r="3.5" fill="none" stroke="currentColor" stroke-width="1.4"/>
    <path d="M16.9 8.3 q 0 -1.1 1.1 -1.1 q 1.1 0 1.1 1.1 q 0 0.65 -0.55 0.95 l -0.4 0.35" fill="none" stroke="currentColor" stroke-width="1.1" stroke-linecap="round"/>
    <circle cx="18" cy="10.5" r="0.5"/>
    <circle cx="14" cy="13" r="0.9"/>
  </svg>
`.trim();

const ICON_PROFILE = `
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
    <path d="M5 7 L7.5 3 L10 8 Z"/>
    <path d="M10 8 Q15 8 17 11 Q18.5 14 17 17 Q15 18.5 11 18.5 Q6 18.5 5.5 14 Q5.5 10 6.5 8 Z"/>
  </svg>
`.trim();

const ICONS = {
  today: ICON_TODAY,
  decks: ICON_DECKS,
  ask: ICON_ASK,
  profile: ICON_PROFILE,
};

function buildNavMarkup(pathname) {
  const { prefix, labels } = getLocaleConfig(pathname);
  const active = getActiveTab(pathname);

  const tabs = [
    { key: 'today',   href: `${prefix}/index.html`,    label: labels.today },
    { key: 'decks',   href: `${prefix}/decks.html`,    label: labels.decks },
    { key: 'ask',     href: `${prefix}/question.html`, label: labels.ask },
    { key: 'profile', href: `${prefix}/profile.html`,  label: labels.profile },
  ];

  const tabHtml = tabs.map((tab) => `
    <a class="bottom-nav__item ${active === tab.key ? 'is-active' : ''}" href="${tab.href}">
      <span class="bottom-nav__icon" aria-hidden="true">${ICONS[tab.key]}</span>
      <span class="bottom-nav__label">${tab.label}</span>
    </a>
  `).join('');

  return `<nav class="bottom-nav bottom-nav--phase5" aria-label="Mobile app navigation">${tabHtml}</nav>`;
}

function bindWindowListeners() {
  if (typeof window === 'undefined') return;
  if (window._meowNavListenerBound) return;
  window._meowNavListenerBound = true;
  const rerender = () => renderBottomNav();
  window.addEventListener('resize', rerender, { passive: true });
  window.addEventListener('orientationchange', rerender, { passive: true });
}

function bindMutationObserver() {
  if (typeof window === 'undefined') return;
  if (window._meowNavObserver) return;
  const observer = new MutationObserver(() => renderBottomNav());
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['data-page', 'data-reading-mode', 'data-daily-phase'],
  });
  window._meowNavObserver = observer;
}

export function renderBottomNav() {
  if (typeof window === 'undefined') return;

  bindWindowListeners();
  const pathname = window.location.pathname || '/';
  if (shouldExclude(pathname)) {
    document.body.classList.remove('has-bottom-nav');
    return;
  }

  const mobile = window.matchMedia(MOBILE_QUERY);
  if (!mobile.matches) {
    document.body.classList.remove('has-bottom-nav');
    return;
  }

  let shell = document.getElementById('bottom-nav-shell');
  if (!shell) {
    shell = document.createElement('div');
    shell.id = 'bottom-nav-shell';
    document.body.appendChild(shell);
  }
  shell.innerHTML = buildNavMarkup(pathname);
  document.body.classList.add('has-bottom-nav');

  bindMutationObserver();
}
