export function renderNavbar(container, onLangToggle) {
  if (!container) return;
  container.innerHTML = `
    <div class="site-header">
      <a href="/" class="logo-text" data-logo>MEOWTAROT</a>
      <nav class="nav-actions">
        <a href="#daily-fortune" class="nav-link" data-section="daily-fortune" data-i18n="navDaily"></a>
        <a href="#ask-question" class="nav-link" data-section="ask-question" data-i18n="navQuestion"></a>
        <a href="#tarot-meanings" class="nav-link" data-section="tarot-meanings" data-i18n="navMeanings"></a>
        <div class="language-toggle" aria-label="Language toggle">
          <button class="lang-btn" data-lang="en">EN</button>
          <span class="divider">|</span>
          <button class="lang-btn" data-lang="th">TH</button>
        </div>
      </nav>
    </div>
  `;

  container.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => onLangToggle?.(btn.dataset.lang));
  });
}
