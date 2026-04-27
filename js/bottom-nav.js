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
        features: 'ฟีเจอร์',
        today: 'วันนี้',
        draw: 'สุ่มไพ่',
        cards: 'ความหมายไพ่',
        profile: 'โปรไฟล์',
      }
      : {
        features: 'Features',
        today: 'Today',
        draw: 'Draw',
        cards: 'Cards',
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
  if (normalized.startsWith('/features.html/')) return 'features';
  if (normalized.startsWith('/today/')) return 'today';
  if (normalized.startsWith('/daily.html/')) return 'draw';
  if (normalized.startsWith('/tarot-card-meanings/') || normalized.startsWith('/cards/')) return 'cards';
  if (normalized.startsWith('/profile.html/')) return 'profile';
  return '';
}

function buildNavMarkup(pathname) {
  const { prefix, labels } = getLocaleConfig(pathname);
  const active = getActiveTab(pathname);

  const tabs = [
    { key: 'features', href: `${prefix}/features.html`, icon: '✨', label: labels.features },
    { key: 'today', href: `${prefix}/today/`, icon: '📅', label: labels.today },
    { key: 'draw', href: `${prefix}/daily.html`, icon: '🐾', label: labels.draw, center: true },
    { key: 'cards', href: `${prefix}/tarot-card-meanings/`, icon: '📚', label: labels.cards },
    { key: 'profile', href: `${prefix}/profile.html`, icon: '👤', label: labels.profile },
  ];

  return `
    <nav class="bottom-nav" aria-label="Mobile app navigation">
      <a class="bottom-nav__item ${active === 'features' ? 'is-active' : ''}" href="${tabs[0].href}">
        <span class="bottom-nav__icon" aria-hidden="true">${tabs[0].icon}</span>
        <span class="bottom-nav__label">${tabs[0].label}</span>
      </a>
      <a class="bottom-nav__item ${active === 'today' ? 'is-active' : ''}" href="${tabs[1].href}">
        <span class="bottom-nav__icon" aria-hidden="true">${tabs[1].icon}</span>
        <span class="bottom-nav__label">${tabs[1].label}</span>
      </a>
      <a class="bottom-nav__item bottom-nav__item--center ${active === 'draw' ? 'is-active' : ''}" href="${tabs[2].href}" aria-label="${tabs[2].label}">
        <span class="bottom-nav__center-btn" aria-hidden="true">${tabs[2].icon}</span>
        <span class="bottom-nav__label">${tabs[2].label}</span>
      </a>
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

  let host = document.getElementById('bottom-nav-shell');
  if (!host) {
    host = document.createElement('div');
    host.id = 'bottom-nav-shell';
    document.body.appendChild(host);
  }
  host.innerHTML = buildNavMarkup(pathname);
  document.body.classList.add('has-bottom-nav');
}
