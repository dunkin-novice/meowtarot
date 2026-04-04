export function renderNavbar(container, onLangToggle) {
  if (!container) return () => {};
  const pageTitle = 'MeowTarot';
  const isThaiPath = window.location.pathname === '/th' || window.location.pathname.startsWith('/th/');
  const prefix = isThaiPath ? '/th' : '';
  const homeHref = isThaiPath ? '/th/' : '/';
  const localizeHref = (path) => `${prefix}${path}`;

  container.innerHTML = `
    <div class="site-header primary-nav">
      <div class="nav-card-top">
        <button class="mobile-menu-toggle header-menu-toggle" aria-label="Toggle navigation" aria-expanded="false" aria-controls="primary-nav-panel">
          <span class="bar"></span>
          <span class="bar"></span>
          <span class="bar"></span>
        </button>
        <a href="${homeHref}" class="header-title nav-brand" data-logo aria-live="polite" aria-label="Go to home">${pageTitle}</a>
        <div class="nav-actions">
          <div class="language-toggle language-toggle--mobile" role="group" aria-label="Language toggle">
            <button class="lang-btn" data-lang="en" type="button">EN</button>
            <span class="divider" aria-hidden="true">|</span>
            <button class="lang-btn" data-lang="th" type="button">TH</button>
          </div>
        </div>
      </div>
      <a href="${homeHref}" class="logo-text nav-logo" data-logo aria-label="Go to home">✦</a>
      <button class="nav-backdrop" type="button" aria-hidden="true" tabindex="-1"></button>
      <nav class="nav-panel page-card" id="primary-nav-panel" aria-label="Primary">
        <div class="nav-links">
          <a href="${homeHref}" class="nav-link" data-page="home" data-i18n="navHome"></a>
          <a href="${localizeHref('/daily.html')}" class="nav-link" data-page="daily" data-i18n="navDaily"></a>
          <a href="${localizeHref('/full.html')}" class="nav-link" data-page="full" data-i18n="navOverall"></a>
          <a href="${localizeHref('/question.html')}" class="nav-link" data-page="question" data-i18n="navQuestion"></a>
          <a href="${localizeHref('/tarot-card-meanings/')}" class="nav-link" data-page="meanings" data-i18n="navMeanings"></a>
        </div>
        <div class="nav-meta">
          <div class="language-toggle language-toggle--menu" role="group" aria-label="Language toggle">
            <button class="lang-btn" data-lang="en" type="button">EN</button>
            <span class="divider" aria-hidden="true">|</span>
            <button class="lang-btn" data-lang="th" type="button">TH</button>
          </div>
        </div>
      </nav>
    </div>
  `;

  const toggleBtn = container.querySelector('.mobile-menu-toggle');
  const navPanel = container.querySelector('.nav-panel');
  const backdrop = container.querySelector('.nav-backdrop');
  let scrollCloseTimer = null;

  const updateNavHeight = () => {
    const navHeight = container.offsetHeight;
    if (navHeight) {
      document.documentElement.style.setProperty('--nav-height', `${navHeight}px`);
    }
  };

  const closeMenu = () => {
    if (!navPanel.classList.contains('is-open')) return;
    navPanel.classList.remove('is-open');
    backdrop?.classList.remove('is-open');
    toggleBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
    updateNavHeight();
  };

  const handleToggleClick = () => {
    const isOpen = navPanel.classList.toggle('is-open');
    backdrop?.classList.toggle('is-open', isOpen);
    toggleBtn.setAttribute('aria-expanded', String(isOpen));
    document.body.classList.toggle('nav-open', isOpen);
    updateNavHeight();
  };

  const handleOutsideInteraction = (event) => {
    if (navPanel.classList.contains('is-open') && !container.contains(event.target)) {
      closeMenu();
    }
  };

  const handleScroll = () => {
    if (!navPanel.classList.contains('is-open')) return;
    if (scrollCloseTimer) return;
    scrollCloseTimer = window.setTimeout(() => {
      scrollCloseTimer = null;
      closeMenu();
    }, 120);
  };

  const handleEscapeKey = (event) => {
    if (event.key === 'Escape') {
      closeMenu();
    }
  };

  toggleBtn.addEventListener('click', handleToggleClick);
  backdrop?.addEventListener('click', closeMenu);

  container.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  container.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      onLangToggle?.(btn.dataset.lang);
    });
  });

  window.addEventListener('scroll', handleScroll, { passive: true });
  document.addEventListener('pointerdown', handleOutsideInteraction);
  document.addEventListener('focusin', handleOutsideInteraction);
  document.addEventListener('keydown', handleEscapeKey);

  updateNavHeight();
  window.addEventListener('load', updateNavHeight);
  requestAnimationFrame(updateNavHeight);
  window.addEventListener('resize', updateNavHeight, { passive: true });

  return () => {
    closeMenu();
    if (scrollCloseTimer) {
      window.clearTimeout(scrollCloseTimer);
      scrollCloseTimer = null;
    }
    toggleBtn.removeEventListener('click', handleToggleClick);
    backdrop?.removeEventListener('click', closeMenu);
    window.removeEventListener('scroll', handleScroll);
    document.removeEventListener('pointerdown', handleOutsideInteraction);
    document.removeEventListener('focusin', handleOutsideInteraction);
    document.removeEventListener('keydown', handleEscapeKey);
    window.removeEventListener('load', updateNavHeight);
    window.removeEventListener('resize', updateNavHeight);
  };
}
