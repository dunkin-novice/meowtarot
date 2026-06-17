// Shared site footer (rendered into #site-footer by common.js initShell).
// Kept intentionally minimal: copyright + privacy policy. Contact (Instagram +
// email) lives in the Profile "Contact us" section; bug reporting is the floating
// Report button (see common.js). Strings via the i18n dict (i18n-via-common rule).
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
        <a href="${privacyHref}">${privacyLabel}</a>
      </p>
    </div>
  `;
}
