/**
 * deck-inventory.js — Profile page deck inventory grid
 *
 * Pure render function. Renders all 12 decks as a 2-column grid:
 * unlocked decks are tappable to switch active deck; locked decks
 * show a Day-N badge and surface a brief unlock hint on tap.
 */

import { getActiveDeckId, setActiveDeck, canUnlockDeck, getDecksForDisplay } from './data.js';

function fmt(template, vars) {
  let result = String(template || '');
  Object.entries(vars || {}).forEach(([k, v]) => {
    result = result.split(`{${k}}`).join(String(v));
  });
  return result;
}

export function renderDeckInventory(container, progress, dict, lang, onDeckSwitch) {
  if (!container) return;
  container.innerHTML = '';

  const activeId = getActiveDeckId();
  // Shared display order (available-first, by unlock_day) — same on the home strip
  // and board picker so all three match. Active is shown via glow + "Active" badge
  // below, NOT by moving it to the front.
  const decks = getDecksForDisplay();

  const panel = document.createElement('section');
  panel.className = 'panel';

  const title = document.createElement('h2');
  title.textContent = dict.profileDeckInventoryTitle || 'My Decks';
  panel.appendChild(title);

  const grid = document.createElement('div');
  grid.style.cssText = 'display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 12px;';

  decks.forEach((deck) => {
    const active = deck.id === activeId;
    const unlocked = canUnlockDeck(deck.id);

    const cell = document.createElement('div');
    cell.style.cssText = [
      'position: relative',
      'display: flex',
      'flex-direction: column',
      'align-items: center',
      'padding: 14px 10px',
      'border-radius: 12px',
      `background: ${active ? 'rgba(196,168,240,0.2)' : 'rgba(196,168,240,0.08)'}`,
      `border: 2px solid ${active ? '#9270d0' : 'transparent'}`,
      'cursor: pointer',
      'box-sizing: border-box',
    ].join(';');

    const img = document.createElement('img');
    img.src = deck.backImage || '';
    img.alt = '';
    img.loading = 'lazy';
    img.style.cssText = [
      'width: 100%',
      'max-width: 120px',
      'aspect-ratio: 5 / 8',
      'object-fit: cover',
      'border-radius: 8px',
      'box-shadow: 0 4px 12px rgba(80, 50, 130, 0.18)',
      'margin-bottom: 10px',
      `opacity: ${(unlocked || active) ? '1' : '0.35'}`,
    ].join(';');
    cell.appendChild(img);

    const nameEn = document.createElement('div');
    nameEn.textContent = deck.name || '';
    nameEn.style.cssText = "font-family: 'Playfair Display', Georgia, serif; font-size: 15px; font-weight: 600; color: #3d2c58; text-align: center; line-height: 1.2;";
    cell.appendChild(nameEn);

    const nameTh = document.createElement('div');
    nameTh.textContent = deck.name_th || '';
    nameTh.style.cssText = "font-family: 'Sarabun', sans-serif; font-size: 12px; color: rgba(61,44,88,0.6); text-align: center; margin-top: 2px;";
    cell.appendChild(nameTh);

    if (active) {
      const badge = document.createElement('span');
      badge.textContent = dict.profileDeckActive || 'Active';
      badge.style.cssText = 'position: absolute; top: 8px; left: 8px; background: #9270d0; color: #fff; font-size: 10px; padding: 3px 7px; border-radius: 6px; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase;';
      cell.appendChild(badge);
    }

    if (!unlocked && !active) {
      const lockBadge = document.createElement('span');
      const isThai = window.location.pathname.startsWith('/th/');
      const isSignInLock = deck.role === 'default';
      lockBadge.textContent = isSignInLock
        ? (isThai ? '🔒 เข้าสู่ระบบเพื่อปลดล็อก' : '🔒 Sign in to unlock')
        : (isThai ? `🔒 วันที่ ${deck.unlock_day}` : `🔒 Day ${deck.unlock_day}`);
      lockBadge.style.cssText = 'position: absolute; top: 8px; right: 8px; background: rgba(61,44,88,0.85); color: #fff; font-size: 11px; padding: 3px 7px; border-radius: 6px; font-weight: 500;';
      cell.appendChild(lockBadge);
    }

    cell.addEventListener('click', () => {
      if (!unlocked) {
        if (cell.querySelector('.mt-deck-hint')) return;
        const hint = document.createElement('div');
        hint.className = 'mt-deck-hint';
        const isSignInLock = deck.role === 'default';
        const isThai = window.location.pathname.startsWith('/th/');
        hint.textContent = isSignInLock
          ? (isThai ? 'เข้าสู่ระบบเพื่อปลดล็อกสำรับนี้' : 'Sign in to unlock this deck')
          : fmt(dict.profileDeckLockedHint, { day: deck.unlock_day });
        hint.style.cssText = 'margin-top: 10px; font-size: 11px; color: #9270d0; text-align: center; padding: 4px 6px; line-height: 1.3;';
        cell.appendChild(hint);
        setTimeout(() => {
          if (hint.parentNode) hint.parentNode.removeChild(hint);
        }, 3000);
        return;
      }
      if (active) return;
      setActiveDeck(deck.id);
      if (typeof onDeckSwitch === 'function') onDeckSwitch();
    });

    grid.appendChild(cell);
  });

  panel.appendChild(grid);
  container.appendChild(panel);
}
