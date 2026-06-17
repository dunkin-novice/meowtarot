// Shared site footer (rendered into #site-footer by common.js initShell).
// Strings come from the i18n dict (passed by common.js) per the i18n-via-common rule;
// the contact address is a literal (not a translatable UI string).
export function renderFooter(container, dict = {}) {
  if (!container) return;
  const year = new Date().getFullYear();
  const rights = dict.footerRights || 'All rights reserved.';
  const privacyLabel = dict.profilePrivacyLink || 'Privacy Policy';
  const isTh = typeof location !== 'undefined' && /^\/th(\/|$)/.test(location.pathname || '');
  const privacyHref = isTh ? '/th/privacy.html' : '/privacy.html';
  container.innerHTML = `
    <div class="site-footer">
      <p>© ${year} MeowTarot · ${rights}</p>
      <p class="site-footer__links">
        <a href="https://www.instagram.com/meowtarotcom/" target="_blank" rel="noopener" aria-label="MeowTarot on Instagram">Instagram</a>
        <span class="site-footer__sep" aria-hidden="true">·</span>
        <a href="mailto:hello@meowtarot.com">hello@meowtarot.com</a>
        <span class="site-footer__sep" aria-hidden="true">·</span>
        <a href="${privacyHref}">${privacyLabel}</a>
      </p>
    </div>
  `;
}
