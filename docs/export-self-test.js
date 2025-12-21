/*
 * runExportSelfTest(selector?: string) -> Promise<Report>
 * DevTools-friendly self-test for html2canvas/html-to-image/dom-to-image exporters.
 */
function detectLibrary() {
  if (typeof window === 'undefined') return 'unknown';
  if (window.html2canvas) return 'html2canvas';
  if (window.htmlToImage || (window.htmlToImage && window.htmlToImage.toPng)) return 'html-to-image';
  if (window.domtoimage || (window.domtoimage && window.domtoimage.toPng)) return 'dom-to-image';
  return 'unknown';
}

function safeURL(url) {
  try {
    return new URL(url, window.location.href);
  } catch (err) {
    return null;
  }
}

function gatherCSSRisks(target) {
  const flags = [];
  const nodes = [target, ...Array.from(target.querySelectorAll('*'))];
  nodes.forEach((node) => {
    const style = window.getComputedStyle(node);
    if (style.filter && style.filter !== 'none') {
      flags.push({ type: 'filter', selector: node.tagName.toLowerCase(), value: style.filter });
    }
    if (style.backdropFilter && style.backdropFilter !== 'none') {
      flags.push({ type: 'backdrop-filter', selector: node.tagName.toLowerCase(), value: style.backdropFilter });
    }
    if (style.mixBlendMode && style.mixBlendMode !== 'normal') {
      flags.push({ type: 'mix-blend-mode', selector: node.tagName.toLowerCase(), value: style.mixBlendMode });
    }
    if (style.mask && style.mask !== 'none') {
      flags.push({ type: 'mask', selector: node.tagName.toLowerCase(), value: style.mask });
    }
    if (style.clipPath && style.clipPath !== 'none') {
      flags.push({ type: 'clip-path', selector: node.tagName.toLowerCase(), value: style.clipPath });
    }
    if (style.position === 'fixed') {
      flags.push({ type: 'position:fixed', selector: node.tagName.toLowerCase() });
    }
    if (style.transform && style.transform !== 'none') {
      flags.push({ type: 'transform', selector: node.tagName.toLowerCase(), value: style.transform });
    }
  });
  return flags;
}

function waitForImages(imgs) {
  const promises = imgs.map((img) => {
    if (img.complete && img.naturalWidth > 0) {
      if (typeof img.decode === 'function') {
        return img.decode().catch(() => undefined);
      }
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      const cleanup = () => {
        img.removeEventListener('load', onLoad);
        img.removeEventListener('error', onError);
      };
      const onLoad = () => {
        cleanup();
        if (typeof img.decode === 'function') {
          img.decode().then(resolve).catch(resolve);
        } else {
          resolve();
        }
      };
      const onError = () => {
        cleanup();
        resolve();
      };
      img.addEventListener('load', onLoad, { once: true });
      img.addEventListener('error', onError, { once: true });
    });
  });
  return Promise.all(promises);
}

async function waitDoubleRaf() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
}

async function runExportSelfTest(selector = '#share-card') {
  const report = {
    ok: true,
    reason: null,
    selector,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    library: detectLibrary(),
    waits: {
      fonts: false,
      images: false,
      raf: false,
    },
    target: null,
    images: [],
    cssRisks: [],
    sizeRisk: null,
    errors: [],
  };

  const errorListener = (event) => {
    report.errors.push(event?.message || String(event));
  };
  window.addEventListener('error', errorListener);

  try {
    const target = document.querySelector(selector);
    if (!target) {
      report.ok = false;
      report.reason = 'selector-not-found';
      return report;
    }

    const rect = target.getBoundingClientRect();
    const style = window.getComputedStyle(target);
    report.target = {
      tag: target.tagName.toLowerCase(),
      width: rect.width,
      height: rect.height,
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      position: style.position,
      transform: style.transform,
      hidden:
        rect.width === 0
        || rect.height === 0
        || style.display === 'none'
        || style.visibility === 'hidden'
        || parseFloat(style.opacity || '1') === 0,
    };

    // Wait for fonts.
    try {
      if (document.fonts && typeof document.fonts.ready?.then === 'function') {
        await document.fonts.ready;
        report.waits.fonts = true;
      }
    } catch (err) {
      report.errors.push(`fonts-wait-error: ${err?.message || err}`);
    }

    // Gather image info and wait for them.
    const imgs = Array.from(target.querySelectorAll('img'));
    const imageInfo = imgs.map((img) => {
      const url = safeURL(img.currentSrc || img.src || '');
      const sameOrigin = url ? url.origin === window.location.origin : true;
      const crossOriginAttr = img.getAttribute('crossorigin');
      return {
        src: url ? url.href : img.src,
        sameOrigin,
        crossOriginAttr,
        complete: img.complete,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        corsRisk: !sameOrigin && !crossOriginAttr,
      };
    });
    report.images = imageInfo;

    try {
      await waitForImages(imgs);
      report.waits.images = true;
    } catch (err) {
      report.errors.push(`image-wait-error: ${err?.message || err}`);
    }

    // CSS risks
    report.cssRisks = gatherCSSRisks(target);

    // RAF stabilization
    await waitDoubleRaf();
    report.waits.raf = true;

    // Size risk estimation
    const dpr = window.devicePixelRatio || 1;
    const pixelEstimate = rect.width * rect.height * dpr * dpr;
    report.sizeRisk = {
      pixelEstimate,
      threshold: 20000000,
      atRisk: pixelEstimate > 20000000,
    };

    report.reason = report.ok ? null : report.reason;
    return report;
  } catch (err) {
    report.ok = false;
    report.reason = err?.message || String(err);
    report.errors.push(report.reason);
    return report;
  } finally {
    window.removeEventListener('error', errorListener);
    console.log('Export self-test report:', report);
    console.log('SELFTEST_JSON:', JSON.stringify(report));
  }
}

if (typeof window !== 'undefined' && !window.runExportSelfTest) {
  window.runExportSelfTest = runExportSelfTest;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { runExportSelfTest };
}
