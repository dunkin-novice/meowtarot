// Shared site footer (rendered into #site-footer by common.js initShell).
// Strings come from the i18n dict (passed by common.js) per the i18n-via-common rule;
// the contact address / social URL are literals (not translatable UI strings).
const IG_URL = 'https://www.instagram.com/meowtarotcom/';

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
        <a class="site-footer__ig" href="${IG_URL}" target="_blank" rel="noopener noreferrer" aria-label="MeowTarot on Instagram">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
            <rect x="2.5" y="2.5" width="19" height="19" rx="5.6"/>
            <circle cx="12" cy="12" r="4.2"/>
            <circle cx="17.4" cy="6.6" r="1.15" fill="currentColor" stroke="none"/>
          </svg>
        </a>
        <span class="site-footer__sep" aria-hidden="true">·</span>
        <a href="mailto:hello@meowtarot.com">hello@meowtarot.com</a>
        <span class="site-footer__sep" aria-hidden="true">·</span>
        <a href="${privacyHref}">${privacyLabel}</a>
      </p>
    </div>
  `;

  // In the Capacitor app (WKWebView) a target=_blank external link silently does
  // nothing — open it in the system browser instead. No-op on the plain web.
  const ig = container.querySelector('.site-footer__ig');
  if (ig && window.Capacitor?.isNativePlatform?.()) {
    ig.addEventListener('click', async (e) => {
      e.preventDefault();
      try {
        const { Browser } = await import('../vendor/browser.js');
        await Browser.open({ url: IG_URL });
      } catch (_) {
        window.open(IG_URL, '_blank');
      }
    });
  }
}
