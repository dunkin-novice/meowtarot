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
        <div class="nav-actions">
          <button class="nav-search-toggle" type="button" aria-label="Search tarot cards" aria-expanded="false" aria-controls="nav-search-panel">🔍</button>
          <div class="language-toggle language-toggle--mobile" role="group" aria-label="Language toggle">
            <button class="lang-btn" data-lang="en" type="button">EN</button>
            <span class="divider" aria-hidden="true">|</span>
            <button class="lang-btn" data-lang="th" type="button">TH</button>
          </div>
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
          <button class="nav-search-toggle nav-search-toggle--desktop" type="button" aria-label="Search tarot cards" aria-expanded="false" aria-controls="nav-search-panel">🔍</button>
          <div class="language-toggle language-toggle--menu" role="group" aria-label="Language toggle">
            <button class="lang-btn" data-lang="en" type="button">EN</button>
            <span class="divider" aria-hidden="true">|</span>
            <button class="lang-btn" data-lang="th" type="button">TH</button>
          </div>
        </div>
      </nav>
      <div class="nav-search-panel page-card" id="nav-search-panel" hidden>
        <label class="visually-hidden" for="navSearchInput">Search tarot cards by name</label>
        <input id="navSearchInput" type="search" placeholder="Search tarot cards…" autocomplete="off" />
      </div>
    </div>
  `;

  const toggleBtn = container.querySelector('.mobile-menu-toggle');
  const navPanel = container.querySelector('.nav-panel');
  const searchToggles = Array.from(container.querySelectorAll('.nav-search-toggle'));
  const searchPanel = container.querySelector('.nav-search-panel');
  const searchInput = container.querySelector('#navSearchInput');
  let scrollCloseTimer = null;

  const updateNavHeight = () => {
    const navHeight = container.offsetHeight;
    if (navHeight) {
      document.documentElement.style.setProperty('--nav-height', `${navHeight}px`);
    }
  };

  const closeSearch = () => {
    if (!searchPanel || searchPanel.hidden) return;
    searchPanel.hidden = true;
    searchToggles.forEach((btn) => btn.setAttribute('aria-expanded', 'false'));
    container.querySelector('.site-header')?.classList.remove('search-open');
    updateNavHeight();
  };

  const openSearch = () => {
    if (!searchPanel) return;
    searchPanel.hidden = false;
    searchToggles.forEach((btn) => btn.setAttribute('aria-expanded', 'true'));
    container.querySelector('.site-header')?.classList.add('search-open');
    updateNavHeight();
    requestAnimationFrame(() => searchInput?.focus());
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

  const handleSearchToggle = () => {
    if (!searchPanel) return;
    if (searchPanel.hidden) {
      closeMenu();
      openSearch();
    } else {
      closeSearch();
    }
  };

  const syncSearchValue = (query = '') => {
    if (!searchInput) return;
    if (searchInput.value === query) return;
    searchInput.value = query;
  };

  const emitSearch = (query = '') => {
    window.dispatchEvent(new CustomEvent('meowtarot:nav-search', { detail: { query } }));
  };

  const handleOutsideInteraction = (event) => {
    if (navPanel.classList.contains('is-open') && !container.contains(event.target)) {
      closeMenu();
    }
    if (!searchPanel?.hidden && !container.contains(event.target)) {
      closeSearch();
    }
  };

  const handleScroll = () => {
    if (!navPanel.classList.contains('is-open') && searchPanel?.hidden) return;
    if (scrollCloseTimer) return;
    scrollCloseTimer = window.setTimeout(() => {
      scrollCloseTimer = null;
      closeMenu();
      closeSearch();
    }, 120);
  };

  const handleGlobalSearchSync = (event) => {
    syncSearchValue(event.detail?.query || '');
  };

  toggleBtn.addEventListener('click', handleToggleClick);
  searchToggles.forEach((btn) => btn.addEventListener('click', handleSearchToggle));

  container.querySelectorAll('.nav-link').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  container.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      closeMenu();
      closeSearch();
      onLangToggle?.(btn.dataset.lang);
    });
  });

  searchInput?.addEventListener('input', (event) => {
    emitSearch(event.target.value || '');
  });

  searchInput?.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeSearch();
      searchToggles[0]?.focus();
    }
  });

  window.addEventListener('meowtarot:meanings-search-sync', handleGlobalSearchSync);
  window.addEventListener('scroll', handleScroll, { passive: true });
  document.addEventListener('pointerdown', handleOutsideInteraction);
  document.addEventListener('focusin', handleOutsideInteraction);

  updateNavHeight();
  window.addEventListener('load', updateNavHeight);
  requestAnimationFrame(updateNavHeight);
  window.addEventListener('resize', updateNavHeight, { passive: true });

  return () => {
    closeMenu();
    closeSearch();
    if (scrollCloseTimer) {
      window.clearTimeout(scrollCloseTimer);
      scrollCloseTimer = null;
    }
    toggleBtn.removeEventListener('click', handleToggleClick);
    searchToggles.forEach((btn) => btn.removeEventListener('click', handleSearchToggle));
    window.removeEventListener('meowtarot:meanings-search-sync', handleGlobalSearchSync);
    window.removeEventListener('scroll', handleScroll);
    document.removeEventListener('pointerdown', handleOutsideInteraction);
    document.removeEventListener('focusin', handleOutsideInteraction);
    window.removeEventListener('load', updateNavHeight);
    window.removeEventListener('resize', updateNavHeight);
  };
}
