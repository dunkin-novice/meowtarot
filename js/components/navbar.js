export function renderNavbar(container, onLangToggle) {
  if (!container) return () => {};
  const pageTitle = 'MeowTarot';

  container.innerHTML = `
    <div class="site-header primary-nav">
      <div class="nav-card-top">
        <button class="mobile-menu-toggle header-menu-toggle" aria-label="Toggle navigation" aria-expanded="false" aria-controls="primary-nav-panel">
          <span class="bar"></span>
          <span class="bar"></span>
          <span class="bar"></span>
        </button>
        <a href="index.html" class="header-title nav-brand" data-logo aria-live="polite" aria-label="Go to home">${pageTitle}</a>
        <div class="language-toggle language-toggle--mobile" role="group" aria-label="Language toggle">
          <button class="lang-btn" data-lang="en" type="button">EN</button>
          <span class="divider" aria-hidden="true">|</span>
          <button class="lang-btn" data-lang="th" type="button">TH</button>
        </div>
      </div>
      <a href="index.html" class="logo-text nav-logo" data-logo aria-label="Go to home">✦</a>
      <nav class="nav-panel page-card" id="primary-nav-panel" aria-label="Primary">
        <div class="nav-links">
          <a href="index.html" class="nav-link" data-page="home" data-i18n="navHome"></a>
          <a href="daily.html" class="nav-link" data-page="daily" data-i18n="navDaily"></a>
          <a href="overall.html" class="nav-link" data-page="overall" data-i18n="navOverall"></a>
          <a href="question.html" class="nav-link" data-page="question" data-i18n="navQuestion"></a>
          <a href="tarot-card-meanings/" class="nav-link" data-page="meanings" data-i18n="navMeanings"></a>
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
    toggleBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
    updateNavHeight();
  };

  const handleToggleClick = () => {
    const isOpen = navPanel.classList.toggle('is-open');
    toggleBtn.setAttribute('aria-expanded', String(isOpen));
    document.body.classList.toggle('nav-open', isOpen);
    updateNavHeight();
  };

  const handleOutsideInteraction = (event) => {
    if (!navPanel.classList.contains('is-open')) return;
    if (container.contains(event.target)) return;
    closeMenu();
  };

  const handleScroll = () => {
    if (!navPanel.classList.contains('is-open')) return;
    if (scrollCloseTimer) return;
    scrollCloseTimer = window.setTimeout(() => {
      scrollCloseTimer = null;
      closeMenu();
    }, 120);
  };

  toggleBtn.addEventListener('click', handleToggleClick);

  container.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  container.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeMenu();
      onLangToggle?.(btn.dataset.lang);
    });
  });

  window.addEventListener('scroll', handleScroll, { passive: true });
  document.addEventListener('pointerdown', handleOutsideInteraction);
  document.addEventListener('focusin', handleOutsideInteraction);

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
    window.removeEventListener('scroll', handleScroll);
    document.removeEventListener('pointerdown', handleOutsideInteraction);
    document.removeEventListener('focusin', handleOutsideInteraction);
    window.removeEventListener('load', updateNavHeight);
    window.removeEventListener('resize', updateNavHeight);
  };
}
