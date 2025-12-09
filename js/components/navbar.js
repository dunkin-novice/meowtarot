export function renderNavbar(container, onLangToggle) {
  if (!container) return;
  container.innerHTML = `
    <div class="site-header primary-nav">
      <a href="index.html" class="logo-text" data-logo>MEOWTAROT</a>
      <button class="mobile-menu-toggle" aria-label="Toggle navigation" aria-expanded="false">
        <span class="bar"></span>
        <span class="bar"></span>
        <span class="bar"></span>
      </button>
      <nav class="nav-panel">
        <div class="nav-links nav-actions">
          <a href="index.html" class="nav-link" data-page="home" data-i18n="navHome"></a>
          <a href="daily.html" class="nav-link" data-page="daily" data-i18n="navDaily"></a>
          <a href="overall.html" class="nav-link" data-page="overall" data-i18n="navOverall"></a>
          <a href="question.html" class="nav-link" data-page="question" data-i18n="navQuestion"></a>
          <a href="meanings.html" class="nav-link" data-page="meanings" data-i18n="navMeanings"></a>
        </div>
        <div class="nav-meta">
          <div class="language-toggle" aria-label="Language toggle">
            <button class="lang-btn" data-lang="en">EN</button>
            <span class="divider">|</span>
            <button class="lang-btn" data-lang="th">TH</button>
          </div>
        </div>
      </nav>
    </div>
  `;

  const toggleBtn = container.querySelector('.mobile-menu-toggle');
  const navPanel = container.querySelector('.nav-panel');

  const closeMenu = () => {
    navPanel.classList.remove('is-open');
    toggleBtn.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('nav-open');
  };

  toggleBtn.addEventListener('click', () => {
    const isOpen = navPanel.classList.toggle('is-open');
    toggleBtn.setAttribute('aria-expanded', String(isOpen));
    document.body.classList.toggle('nav-open', isOpen);
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
}
