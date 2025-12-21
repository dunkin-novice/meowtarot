/**
 * diagnoseSelfTest(selfTest, exporterLib?)
 * Quick helper to pick primary failure class (A–F) from SELFTEST_JSON
 * and surface the minimal exporter options to try.
 */
const RISKY_CSS = new Set([
  'filter',
  'backdrop-filter',
  'mix-blend-mode',
  'mask',
  'clip-path',
  'position:fixed',
  'transform',
]);

function pickPrimaryCause(selfTest) {
  if (!selfTest || typeof selfTest !== 'object') return { cause: 'A', evidence: ['missing SELFTEST_JSON'] };
  const evidence = [];
  const target = selfTest.target || {};
  const sizeRisk = selfTest.sizeRisk || {};
  const images = Array.isArray(selfTest.images) ? selfTest.images : [];

  if (selfTest.reason === 'selector-not-found') {
    evidence.push('reason: selector-not-found');
    return { cause: 'A', evidence };
  }

  if (target.hidden || target.width === 0 || target.height === 0 || target.display === 'none' || target.visibility === 'hidden') {
    evidence.push(`target.hidden=${target.hidden}`, `width=${target.width}`, `height=${target.height}`, `display=${target.display}`, `visibility=${target.visibility}`);
    return { cause: 'A', evidence };
  }

  const corsImage = images.find((img) => img && img.corsRisk);
  if (corsImage) {
    evidence.push(`corsRisk src=${corsImage.src}`);
    return { cause: 'B', evidence };
  }

  if (selfTest.waits && (!selfTest.waits.fonts || !selfTest.waits.images)) {
    evidence.push(`waits.fonts=${selfTest.waits.fonts}`, `waits.images=${selfTest.waits.images}`);
    return { cause: 'C', evidence };
  }

  const cssRisk = (selfTest.cssRisks || []).find((r) => RISKY_CSS.has(r.type));
  if (cssRisk) {
    evidence.push(`cssRisks[0].type=${cssRisk.type}`, `value=${cssRisk.value || 'n/a'}`);
    return { cause: 'D', evidence };
  }

  if (sizeRisk.atRisk) {
    evidence.push(`pixelEstimate=${sizeRisk.pixelEstimate}`, `threshold=${sizeRisk.threshold}`);
    return { cause: 'F', evidence };
  }

  return { cause: 'A', evidence: ['default fallback (no other flags)'] };
}

function exporterPatch(exporterLib = 'html-to-image') {
  const baseOptions = {
    useCORS: true,
    allowTaint: false,
    cacheBust: true,
    pixelRatio: Math.min(2, window.devicePixelRatio || 1),
  };

  if (exporterLib === 'html2canvas') {
    return {
      library: 'html2canvas',
      options: {
        useCORS: true,
        allowTaint: false,
        logging: false,
        backgroundColor: null,
        scale: Math.min(2, window.devicePixelRatio || 1),
      },
    };
  }

  return { library: 'html-to-image', options: baseOptions };
}

module.exports = { diagnoseSelfTest: pickPrimaryCause, exporterPatch };
