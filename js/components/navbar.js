export function renderNavbar(container, onLangToggle) {
  if (!container) return;
  container.innerHTML = `
    <div class="site-header">
      <a href="index.html" class="logo-text" data-logo>MEOWTAROT</a>
      <nav class="nav-actions">
        <a href="index.html" class="nav-link" data-page="home" data-i18n="navHome"></a>
        <a href="daily.html" class="nav-link" data-page="daily" data-i18n="navDaily"></a>
        <a href="question.html" class="nav-link" data-page="question" data-i18n="navQuestion"></a>
        <a href="meanings.html" class="nav-link" data-page="meanings" data-i18n="navMeanings"></a>
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
