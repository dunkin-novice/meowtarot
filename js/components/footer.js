export function renderFooter(container) {
  if (!container) return;
  const year = new Date().getFullYear();
  container.innerHTML = `
    <div class="site-footer">
      <p>© ${year} MeowTarot · All rights reserved.</p>
    </div>
  `;
}
