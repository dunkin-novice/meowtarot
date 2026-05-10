const MOBILE_QUERY = '(max-width: 768px)';
const EXCLUDED_PREFIXES = ['/share/', '/docs/', '/sharekit/'];
let listenersBound = false;

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
        continueLabel: 'ดำเนินการต่อ',
        shareLabel: 'แชร์',
      }
      : {
        home: 'Home',
        today: 'Today',
        draw: 'Draw',
        cards: 'Cards',
        profile: 'Profile',
        continueLabel: 'Continue',
        shareLabel: 'Share',
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

function getContextualCenterState() {
  const page = document.body.dataset.page;

  if (page === 'reading') {
    return 'share';
  }

  if (page === 'question' || page === 'full') {
    const hasBtn = !!(
      document.getElementById('question-continue') ||
      document.getElementById('overall-continue')
    );
    if (hasBtn) return 'continue';
  }

  if (page === 'daily') {
    const isSelectionPage = !!document.getElementById('daily-board');
    if (isSelectionPage) return 'continue';
  }

  return 'draw';
}

function buildNavMarkup(pathname) {
  const { prefix, labels } = getLocaleConfig(pathname);
  const active = getActiveTab(pathname);

  const tabs = [
    { key: 'home', href: `${prefix}/index.html`, icon: '🏡', label: labels.home },
    { key: 'today', href: `${prefix}/today/`, icon: '🗓️', label: labels.today },
    { key: 'draw', href: `${prefix}/daily.html`, icon: '🐾', label: labels.draw, center: true },
    { key: 'cards', href: `${prefix}/tarot-card-meanings/`, icon: '🎴', label: labels.cards },
    { key: 'profile', href: `${prefix}/profile.html`, icon: '😸', label: labels.profile },
  ];

  const centerState = getContextualCenterState();

  const centerConfigs = {
    draw: {
      tag: 'a',
      href: tabs[2].href,
      icon: '🐾',
      label: labels.draw,
      extra: '',
    },
    continue: {
      tag: 'button',
      href: null,
      icon: '▶',
      label: labels.continueLabel || 'Continue',
      extra: 'data-center-action="continue"',
    },
    share: {
      tag: 'button',
      href: null,
      icon: '📷',
      label: labels.shareLabel || 'Share',
      extra: 'data-center-action="share"',
    },
  };

  const c = centerConfigs[centerState];
  const isActive = centerState === 'draw' && active === 'draw';

  const centerEl = c.tag === 'a'
    ? `<a class="bottom-nav__item bottom-nav__item--center ${isActive ? 'is-active' : ''}" href="${c.href}" aria-label="${c.label}" ${c.extra}>
        <span class="bottom-nav__center-btn" aria-hidden="true">${c.icon}</span>
        <span class="bottom-nav__label">${c.label}</span>
      </a>`
    : `<button type="button" class="bottom-nav__item bottom-nav__item--center bottom-nav__item--${centerState}" aria-label="${c.label}" ${c.extra}>
        <span class="bottom-nav__center-btn bottom-nav__center-btn--${centerState}" aria-hidden="true">${c.icon}</span>
        <span class="bottom-nav__label">${c.label}</span>
      </button>`;

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
      <a class="bottom-nav__item ${active === 'cards' ? 'is-active' : ''}" href="${tabs[3].href}">
        <span class="bottom-nav__icon" aria-hidden="true">${tabs[3].icon}</span>
        <span class="bottom-nav__label">${tabs[3].label}</span>
      </a>
      <a class="bottom-nav__item ${active === 'profile' ? 'is-active' : ''}" href="${tabs[4].href}">
        <span class="bottom-nav__icon" aria-hidden="true">${tabs[4].icon}</span>
        <span class="bottom-nav__label">${tabs[4].label}</span>
      </a>
    </nav>
  `;
}

function bindListeners() {
  if (listenersBound || typeof window === 'undefined') return;
  const rerender = () => renderBottomNav();
  window.addEventListener('resize', rerender, { passive: true });
  window.addEventListener('orientationchange', rerender, { passive: true });
  listenersBound = true;
}

if (typeof window !== 'undefined' && !window._meowContinueListenerBound) {
  window._meowContinueListenerBound = true;
  document.addEventListener('meow:request-continue', () => {
    const continueBtn =
      document.getElementById('daily-continue') ||
      document.getElementById('question-continue') ||
      document.getElementById('overall-continue');
    if (continueBtn && !continueBtn.disabled) {
      continueBtn.click();
    }
  });
}

export function renderBottomNav() {
  if (typeof window === 'undefined') return;

  bindListeners();
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

  if (!window._meowNavObserver) {
    window._meowNavObserver = new MutationObserver(() => {
      renderBottomNav();
    });
    window._meowNavObserver.observe(document.body, {
      attributes: true,
      attributeFilter: [
        'data-daily-phase',
        'data-reading-mode',
        'data-page',
      ],
    });
  }

  if (!shell.dataset.navListenerBound) {
    shell.dataset.navListenerBound = 'true';
    shell.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-center-action]');
      if (!btn) return;
      const action = btn.dataset.centerAction;
      if (action === 'share') {
        document.dispatchEvent(new CustomEvent('meow:request-share'));
      }
      if (action === 'continue') {
        document.dispatchEvent(new CustomEvent('meow:request-continue'));
      }
    }, { capture: true });
  }
}
