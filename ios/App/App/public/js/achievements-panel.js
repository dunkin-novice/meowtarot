/**
 * achievements-panel.js — Profile page deck-milestone timeline
 *
 * Pure render function. Renders the streak-unlock deck milestones as a
 * vertical timeline: filled checkmark dot for achieved, day-number dot
 * for upcoming. The first unachieved milestone gets a "NEXT" badge.
 */

import { getAllDecks } from './data.js';

function fmt(template, vars) {
  let result = String(template || '');
  Object.entries(vars || {}).forEach(([k, v]) => {
    result = result.split(`{${k}}`).join(String(v));
  });
  return result;
}

function formatDate(isoDate, lang) {
  if (!isoDate) return '';
  try {
    const parsed = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return '';
    const locale = lang === 'th' ? 'th-TH' : 'en-US';
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(parsed);
  } catch {
    return '';
  }
}

function deckDateKey(deckId) {
  return `deck_${String(deckId || '').split('-').join('_')}`;
}

export function renderAchievementsPanel(container, progress, dict, lang) {
  if (!container) return;
  container.innerHTML = '';

  const streak = Number(progress?.streak_current) || 0;
  const dates = (progress && progress.achievement_dates) || {};

  const decks = getAllDecks()
    .filter((d) => d.role === 'streak-unlock' && typeof d.unlock_day === 'number')
    .sort((a, b) => a.unlock_day - b.unlock_day);

  const panel = document.createElement('section');
  panel.className = 'panel';

  const title = document.createElement('h2');
  title.textContent = dict.profileAchievementsTitle || 'Your Journey';
  panel.appendChild(title);

  const list = document.createElement('div');
  list.style.cssText = 'display: flex; flex-direction: column; gap: 10px; margin-top: 12px;';

  let nextAssigned = false;

  decks.forEach((deck) => {
    const achieved = streak >= deck.unlock_day;
    const dateStr = dates[deckDateKey(deck.id)] || null;
    const isNext = !achieved && !nextAssigned;
    if (isNext) nextAssigned = true;

    const row = document.createElement('div');
    row.style.cssText = [
      'display: flex',
      'align-items: center',
      'gap: 12px',
      'padding: 10px',
      'border-radius: 10px',
      `background: ${isNext ? 'rgba(146,112,208,0.10)' : 'transparent'}`,
    ].join(';');

    const dot = document.createElement('div');
    dot.style.cssText = [
      'width: 32px',
      'height: 32px',
      'border-radius: 50%',
      'flex-shrink: 0',
      'display: flex',
      'align-items: center',
      'justify-content: center',
      'font-size: 13px',
      'font-weight: 600',
      'box-sizing: border-box',
      achieved
        ? 'background: #9270d0; color: #ffffff'
        : 'background: rgba(146,112,208,0.15); color: #9270d0',
    ].join(';');
    dot.textContent = achieved ? '✓' : String(deck.unlock_day);
    row.appendChild(dot);

    const img = document.createElement('img');
    img.src = deck.backImage || '';
    img.alt = '';
    img.loading = 'lazy';
    img.style.cssText = [
      'width: 36px',
      'height: auto',
      'aspect-ratio: 5 / 8',
      'object-fit: cover',
      'border-radius: 4px',
      'flex-shrink: 0',
      `opacity: ${achieved ? '1' : '0.4'}`,
    ].join(';');
    row.appendChild(img);

    const textBlock = document.createElement('div');
    textBlock.style.cssText = 'flex: 1; min-width: 0;';

    const nameEn = document.createElement('div');
    nameEn.textContent = deck.name || '';
    nameEn.style.cssText = [
      "font-family: 'Playfair Display', Georgia, serif",
      'font-size: 14px',
      'font-weight: 600',
      'line-height: 1.2',
      achieved ? 'color: #3d2c58' : 'color: rgba(61,44,88,0.5)',
    ].join(';');
    textBlock.appendChild(nameEn);

    const nameTh = document.createElement('div');
    nameTh.textContent = deck.name_th || '';
    nameTh.style.cssText = "font-family: 'Sarabun', sans-serif; font-size: 11px; color: rgba(61,44,88,0.55); margin-top: 1px;";
    textBlock.appendChild(nameTh);

    if (achieved && dateStr) {
      const dateLine = document.createElement('div');
      dateLine.textContent = fmt(dict.profileAchievementUnlockedDate, { date: formatDate(dateStr, lang) });
      dateLine.style.cssText = "font-size: 11px; color: rgba(61,44,88,0.5); margin-top: 3px;";
      textBlock.appendChild(dateLine);
    }

    row.appendChild(textBlock);

    if (isNext) {
      const badge = document.createElement('span');
      badge.textContent = dict.profileAchievementNext || 'Next';
      badge.style.cssText = 'background: #9270d0; color: #fff; font-size: 10px; padding: 3px 7px; border-radius: 6px; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; flex-shrink: 0;';
      row.appendChild(badge);
    }

    list.appendChild(row);
  });

  panel.appendChild(list);
  container.appendChild(panel);
}
