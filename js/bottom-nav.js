const MOBILE_QUERY = '(max-width: 768px)';
const EXCLUDED_PREFIXES = ['/share/', '/docs/', '/sharekit/'];
const DAILY_CARD_OF_DAY_STORAGE_KEY = 'meowtarot.daily.cardOfTheDay';
const CONTINUE_BUTTON_IDS = ['daily-continue', 'question-continue', 'overall-continue'];

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
        home: 'หน้าแรก',
        today: 'วันนี้',
        draw: 'สุ่มไพ่',
        cards: 'ความหมายไพ่',
        profile: 'โปรไฟล์',
        todayCard: 'ดูไพ่วันนี้',
        continue: 'ดำเนินการต่อ',
        share: 'แชร์เรื่องราว',
      }
      : {
        home: 'Home',
        today: 'Today',
        draw: 'Draw',
        cards: 'Cards',
        profile: 'Profile',
        todayCard: "Today's Card",
        continue: 'Continue',
        share: 'Share Story',
      },
  };
}

function shouldExclude(pathname) {
  const normalized = normalizePath(pathname);
  return EXCLUDED_PREFIXES.some((prefix) => normalized.startsWith(prefix) || normalized.startsWith(`/th${prefix}`));
}

function getActiveTab(pathname) {
  const normalized = normalizePath(pathname.replace(/^\/th/, '') || '/');
  if (normalized === '/' || normalized.startsWith('/index.html/')) return 'home';
  if (normalized.startsWith('/today/')) return 'today';
  if (normalized.startsWith('/daily.html/')) return 'draw';
  if (normalized.startsWith('/tarot-card-meanings/') || normalized.startsWith('/cards/')) return 'cards';
  if (normalized.startsWith('/profile.html/')) return 'profile';
  return '';
}

function isOnTodayPath(pathname) {
  const stripped = pathname.replace(/^\/th/, '') || '/';
  return stripped.startsWith('/today/');
}

function getTodayLocalIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function isTodayCardDrawn() {
  try {
    const raw = window.localStorage?.getItem(DAILY_CARD_OF_DAY_STORAGE_KEY);
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return false;
    return String(parsed.date || '').trim() === getTodayLocalIso();
  } catch (_) {
    return false;
  }
}

function isContinueReady() {
  for (const id of CONTINUE_BUTTON_IDS) {
    const btn = document.getElementById(id);
    if (btn && !btn.disabled) return true;
  }
  return false;
}

function hasContinueContext(page) {
  if (page === 'daily' && document.getElementById('daily-board')) return true;
  if (page === 'question-draw') return true;
  if (page === 'full' && document.getElementById('overall-continue')) return true;
  return false;
}

function getContextualCenterState(pathname) {
  const page = document.body?.dataset.page || '';
  const { prefix } = getLocaleConfig(pathname);

  if (page === 'reading') {
    return { state: 'share' };
  }

  if (hasContinueContext(page)) {
    return { state: 'continue', ready: isContinueReady() };
  }

  if (page === 'daily') {
    const drawn = isTodayCardDrawn();
    if (isOnTodayPath(pathname) && drawn) {
      return { state: 'today', href: `${prefix}/today/` };
    }
    if (!drawn) {
      return { state: 'today', href: `${prefix}/daily.html` };
    }
    return { state: 'today', href: `${prefix}/today/` };
  }

  return { state: 'draw', href: `${prefix}/daily.html` };
}

const SHARE_ICON_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37Z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>';

function buildCenterElement(centerInfo, labels, active) {
  if (centerInfo.state === 'share') {
    return `<button type="button" class="bottom-nav__item bottom-nav__item--center bottom-nav__item--share" aria-label="${labels.share}" data-center-action="share">
        <span class="bottom-nav__center-btn bottom-nav__center-btn--share" aria-hidden="true">${SHARE_ICON_SVG}</span>
        <span class="bottom-nav__label">${labels.share}</span>
      </button>`;
  }

  if (centerInfo.state === 'continue') {
    const disabled = centerInfo.ready ? '' : 'disabled';
    const label = labels.continue;
    return `<button type="button" class="bottom-nav__item bottom-nav__item--center bottom-nav__item--continue" aria-label="${label}" data-center-action="continue" ${disabled}>
        <span class="bottom-nav__center-btn bottom-nav__center-btn--continue" aria-hidden="true">▶</span>
        <span class="bottom-nav__label">${label}</span>
      </button>`;
  }

  if (centerInfo.state === 'today') {
    return `<a class="bottom-nav__item bottom-nav__item--center" href="${centerInfo.href}" aria-label="${labels.todayCard}">
        <span class="bottom-nav__center-btn" aria-hidden="true">🌙</span>
        <span class="bottom-nav__label">${labels.todayCard}</span>
      </a>`;
  }

  const isActive = active === 'draw';
  return `<a class="bottom-nav__item bottom-nav__item--center ${isActive ? 'is-active' : ''}" href="${centerInfo.href}" aria-label="${labels.draw}">
      <span class="bottom-nav__center-btn" aria-hidden="true">🐾</span>
      <span class="bottom-nav__label">${labels.draw}</span>
    </a>`;
}

function buildNavMarkup(pathname) {
  const { prefix, labels } = getLocaleConfig(pathname);
  const active = getActiveTab(pathname);
  const centerInfo = getContextualCenterState(pathname);

  const tabs = [
    { key: 'home', href: `${prefix}/index.html`, icon: '🏠', label: labels.home },
    { key: 'today', href: `${prefix}/today/`, icon: '📅', label: labels.today },
    { key: 'cards', href: `${prefix}/tarot-card-meanings/`, icon: '📚', label: labels.cards },
    { key: 'profile', href: `${prefix}/profile.html`, icon: '👤', label: labels.profile },
  ];

  const centerEl = buildCenterElement(centerInfo, labels, active);

  return `
    <nav class="bottom-nav" aria-label="Mobile app navigation">
      <a class="bottom-nav__item ${active === 'home' ? 'is-active' : ''}" href="${tabs[0].href}">
        <span class="bottom-nav__icon" aria-hidden="true">${tabs[0].icon}</span>
        <span class="bottom-nav__label">${tabs[0].label}</span>
      </a>
      <a class="bottom-nav__item ${active === 'today' ? 'is-active' : ''}" href="${tabs[1].href}">
        <span class="bottom-nav__icon" aria-hidden="true">${tabs[1].icon}</span>
        <span class="bottom-nav__label">${tabs[1].label}</span>
      </a>
      ${centerEl}
      <a class="bottom-nav__item ${active === 'cards' ? 'is-active' : ''}" href="${tabs[2].href}">
        <span class="bottom-nav__icon" aria-hidden="true">${tabs[2].icon}</span>
        <span class="bottom-nav__label">${tabs[2].label}</span>
      </a>
      <a class="bottom-nav__item ${active === 'profile' ? 'is-active' : ''}" href="${tabs[3].href}">
        <span class="bottom-nav__icon" aria-hidden="true">${tabs[3].icon}</span>
        <span class="bottom-nav__label">${tabs[3].label}</span>
      </a>
    </nav>
  `;
}

function bindWindowListeners() {
  if (typeof window === 'undefined') return;
  if (window._meowNavListenerBound) return;
  window._meowNavListenerBound = true;
  const rerender = () => renderBottomNav();
  window.addEventListener('resize', rerender, { passive: true });
  window.addEventListener('orientationchange', rerender, { passive: true });
}

function bindShellDelegation(shell) {
  if (shell.dataset.navClickBound) return;
  shell.dataset.navClickBound = 'true';
  shell.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-center-action]');
    if (!btn) return;
    if (btn.disabled) {
      e.preventDefault();
      return;
    }
    const action = btn.dataset.centerAction;
    if (action === 'share') {
      document.dispatchEvent(new CustomEvent('meow:request-share'));
    } else if (action === 'continue') {
      document.dispatchEvent(new CustomEvent('meow:request-continue'));
    }
  }, { capture: true });
}

function bindMutationObserver() {
  if (typeof window === 'undefined') return;
  if (window._meowNavObserver) return;
  const observer = new MutationObserver(() => renderBottomNav());
  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['data-page', 'data-reading-mode', 'data-daily-phase'],
  });
  CONTINUE_BUTTON_IDS.forEach((id) => {
    const btn = document.getElementById(id);
    if (btn) {
      observer.observe(btn, { attributes: true, attributeFilter: ['disabled'] });
    }
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

  bindShellDelegation(shell);
  bindMutationObserver();
}
