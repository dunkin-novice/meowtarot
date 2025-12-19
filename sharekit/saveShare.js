/*
 * Save and Share helpers for Share Kit
 */

async function copyLinkToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.warn('Clipboard fallback', err);
    return false;
  }
}

function triggerDownload(blob, filename) {
  const blobUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.rel = 'noopener';
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
  return blobUrl;
}

async function shareBlob(blob, filename, shareText) {
  if (!navigator.canShare || !navigator.share) return false;
  const file = new File([blob], filename, { type: blob.type });
  if (!navigator.canShare({ files: [file] })) return false;
  await navigator.share({ files: [file], title: shareText || document.title, text: shareText });
  return true;
}

async function saveOrShare(blob, { filename = 'meowtarot.png', shareText = '' } = {}) {
  const shared = await shareBlob(blob, filename, shareText).catch(() => false);
  if (shared) return { shared: true };
  const blobUrl = triggerDownload(blob, filename);
  return { shared: false, blobUrl };
}

window.ShareKitSaveShare = { copyLinkToClipboard, triggerDownload, shareBlob, saveOrShare };
