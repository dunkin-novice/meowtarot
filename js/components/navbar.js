export function renderNavbar(container, onLangToggle) {
  if (!container) return;
  const rawTitle = document.querySelector('main h1')?.textContent?.trim() || '';
  const pageTitle = rawTitle && rawTitle.length <= 28 ? rawTitle : 'MeowTarot';

  container.innerHTML = `
    <div class="site-header primary-nav">
      <div class="nav-card-top">
        <button class="mobile-menu-toggle header-menu-toggle" aria-label="Toggle navigation" aria-expanded="false" aria-controls="primary-nav-panel">
          <span class="bar"></span>
          <span class="bar"></span>
          <span class="bar"></span>
        </button>
        <p class="header-title" aria-live="polite">${pageTitle}</p>
        <a href="index.html" class="logo-text" data-logo aria-label="Go to home">✦</a>
      </div>
      <nav class="nav-panel page-card" id="primary-nav-panel" aria-label="Primary">
        <div class="nav-links">
          <a href="index.html" class="nav-link" data-page="home" data-i18n="navHome"></a>
          <a href="daily.html" class="nav-link" data-page="daily" data-i18n="navDaily"></a>
          <a href="overall.html" class="nav-link" data-page="overall" data-i18n="navOverall"></a>
          <a href="question.html" class="nav-link" data-page="question" data-i18n="navQuestion"></a>
          <a href="tarot-card-meanings/" class="nav-link" data-page="meanings" data-i18n="navMeanings"></a>
        </div>
        <div class="nav-meta">
          <div class="language-toggle" role="group" aria-label="Language toggle">
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
  const updateNavHeight = () => {
    const navHeight = container.offsetHeight;
    if (navHeight) {
      document.documentElement.style.setProperty('--nav-height', `${navHeight}px`);
    }
  };

  const closeMenu = () => {
    navPanel.classList.remove('is-open');
    toggleBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
  };

  toggleBtn.addEventListener('click', () => {
    const isOpen = navPanel.classList.toggle('is-open');
    toggleBtn.setAttribute('aria-expanded', String(isOpen));
    document.body.classList.toggle('nav-open', isOpen);
    updateNavHeight();
  });

  container.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  container.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      closeMenu();
      onLangToggle?.(btn.dataset.lang);
    });
  });

  updateNavHeight();
  window.addEventListener('load', updateNavHeight);
  requestAnimationFrame(updateNavHeight);
  window.addEventListener('resize', updateNavHeight, { passive: true });
}
