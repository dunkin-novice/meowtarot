/*
 * Share Kit UI controller
 */

(function () {
  const { createRenderer, SHAREKIT_PRESETS } = window.ShareKitRenderer;
  const { saveOrShare, copyLinkToClipboard } = window.ShareKitSaveShare;

  function el(tag, className, content) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (content) node.innerHTML = content;
    return node;
  }

  function formatFilename(presetKey, readingResult) {
    const slug = readingResult.slug || readingResult.readingType || 'reading';
    return `${slug}-${presetKey}-${new Date().toISOString().slice(0, 10)}.png`;
  }

  function createModal(config, state) {
    const overlay = el('div', 'sharekit-overlay');
    const modal = el('div', 'sharekit-modal');
    const preview = el('div', 'sharekit-preview');
    const previewImg = el('img');
    preview.appendChild(previewImg);

    const panel = el('div', 'sharekit-panel');
    const titleRow = el('div', 'sharekit-title-row');
    const title = el('h3');
    title.textContent = 'Share your reading';
    const closeBtn = el('button', 'sharekit-close', '&times;');
    closeBtn.addEventListener('click', () => state.close());
    titleRow.append(title, closeBtn);

    const presetGrid = el('div', 'sharekit-preset-grid');
    Object.values(SHAREKIT_PRESETS).forEach((preset) => {
      const btn = el('button', 'sharekit-btn');
      btn.textContent = preset.label;
      btn.addEventListener('click', () => state.selectPreset(preset.key));
      presetGrid.appendChild(btn);
    });

    const loader = el('span', 'sharekit-loader');
    loader.textContent = 'Rendering…';

    const actions = el('div', 'sharekit-actions');
    const renderShareBtn = el('button', 'sharekit-btn primary', 'Share');
    const saveBtn = el('button', 'sharekit-btn', 'Save Image');
    const copyLinkBtn = el('button', 'sharekit-btn', 'Copy Link');

    renderShareBtn.addEventListener('click', () => state.share());
    saveBtn.addEventListener('click', () => state.save());
    copyLinkBtn.addEventListener('click', () => state.copyLink());

    actions.append(renderShareBtn, saveBtn, copyLinkBtn);

    const status = el('div', 'sharekit-status');

    const safeToggleWrap = el('label', 'sharekit-safezone-toggle');
    const safeCheckbox = el('input');
    safeCheckbox.type = 'checkbox';
    safeCheckbox.addEventListener('change', () => state.setSafeZone(safeCheckbox.checked));
    safeToggleWrap.append(safeCheckbox, document.createTextNode('Show Instagram safe zone')); 

    panel.append(titleRow, presetGrid, loader, actions, safeToggleWrap, status);

    modal.append(preview, panel);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    return { overlay, previewImg, loader, status, renderShareBtn, saveBtn, copyLinkBtn, safeCheckbox };
  }

  function openShareKit(readingResult, kitConfig = {}) {
    const existing = document.querySelector('.sharekit-overlay');
    if (existing) existing.remove();
    const renderer = createRenderer(kitConfig);
    let cachedPresetKey = 'story';
    let lastRender = null;
    let safeZone = false;
    const renderCache = new Map();

    function revokeCacheUrls() {
      renderCache.forEach((entry) => {
        if (entry && entry.url) URL.revokeObjectURL(entry.url);
      });
      renderCache.clear();
    }

    const ui = createModal(kitConfig, {
      close: () => {
        ui.overlay.classList.remove('active');
        document.body.style.overflow = '';
        revokeCacheUrls();
      },
      selectPreset: async (presetKey) => {
        cachedPresetKey = presetKey;
        await renderPreset();
      },
      setSafeZone: async (enabled) => {
        safeZone = enabled;
        await renderPreset(true);
      },
      share: async () => {
        if (!lastRender) await renderPreset();
        if (!lastRender) return;
        ui.status.textContent = 'Preparing share…';
        const result = await saveOrShare(lastRender.blob, {
          filename: formatFilename(cachedPresetKey, readingResult),
          shareText: `${readingResult.readingType || 'Tarot'} via MeowTarot`,
        });
        if (result.shared) {
          ui.status.textContent = 'Shared successfully!';
        } else {
          ui.status.textContent = 'Saved to downloads. If sharing is unavailable, open your Photos and share manually.';
        }
      },
      save: async () => {
        if (!lastRender) await renderPreset();
        if (!lastRender) return;
        ui.status.textContent = 'Saving…';
        saveOrShare(lastRender.blob, { filename: formatFilename(cachedPresetKey, readingResult) })
          .then(() => {
            ui.status.textContent = 'Saved! Check your downloads/photos.';
          })
          .catch(() => {
            ui.status.textContent = 'Save failed. Try long-pressing the preview to save.';
          });
      },
      copyLink: async () => {
        const shareUrl = readingResult.shareUrl || kitConfig.baseUrl;
        if (!shareUrl) {
          ui.status.textContent = 'No link available.';
          return;
        }
        const ok = await copyLinkToClipboard(shareUrl);
        ui.status.textContent = ok ? 'Link copied!' : 'Unable to auto-copy. Long-press to copy the link.';
      },
    });

    if (!navigator.canShare || !navigator.share) {
      ui.renderShareBtn.textContent = 'Save';
    }

    async function renderPreset(force) {
      ui.loader.classList.add('active');
      ui.status.textContent = 'Rendering…';
      try {
        const cacheKey = `${cachedPresetKey}-${safeZone ? 'safe' : 'clean'}`;
        if (!force && renderCache.has(cacheKey)) {
          lastRender = renderCache.get(cacheKey);
          applyPreview(lastRender);
          return;
        }
        lastRender = await renderer.renderReading(readingResult, cachedPresetKey, { safeZone });
        const previous = renderCache.get(cacheKey);
        if (previous && previous.url) URL.revokeObjectURL(previous.url);
        renderCache.set(cacheKey, lastRender);
        applyPreview(lastRender);
        ui.status.textContent = navigator.canShare ? 'Ready to share' : 'Ready to save';
      } catch (err) {
        console.error(err);
        ui.status.textContent = 'Render failed. Please try again.';
      } finally {
        ui.loader.classList.remove('active');
      }
    }

    function applyPreview(renderResult) {
      ui.previewImg.src = renderResult.url;
    }

    ui.overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
    renderPreset();
  }

  window.openShareKit = openShareKit;
})();
