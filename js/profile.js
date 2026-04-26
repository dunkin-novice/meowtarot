import {
  applyLocaleMeta,
  applyTranslations,
  initShell,
  localizePath,
  pathHasThaiPrefix,
  translations,
} from './common.js';
import { loadTarotManifest, normalizeId } from './data.js';
import { computePhase } from './phase.js';
import { getUserProgress } from './progress.js';
import { getCurrentUser, isAuthConfigured, loginWithProvider, logout, subscribeAuthState } from './auth.js';
import { loadReadings } from './reading-history.js';
import { trackProfileRevisit } from './analytics.js';

const state = {
  currentLang: pathHasThaiPrefix(window.location.pathname) ? 'th' : 'en',
  user: null,
  history: [],
  cardNameById: new Map(),
};

const els = {
  identity: document.getElementById('profile-identity'),
  streak: document.getElementById('profile-streak'),
  history: document.getElementById('profile-history'),
  cta: document.getElementById('profile-cta'),
};

function createLocalizedHref(pathname = '/') {
  return localizePath(pathname, state.currentLang);
}

function getModeHref(mode = 'daily') {
  if (mode === 'question') return createLocalizedHref('/question.html');
  if (mode === 'full') return createLocalizedHref('/overall.html');
  return createLocalizedHref('/daily.html');
}

function parseDate(value = '') {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function formatReadingDate(value = '') {
  const parsed = parseDate(value);
  if (!parsed) return value;
  const locale = state.currentLang === 'th' ? 'th-TH' : 'en-US';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(parsed);
}

function renderIdentity(dict) {
  if (!els.identity) return;
  els.identity.innerHTML = '';

  const card = document.createElement('section');
  card.className = 'panel';

  const title = document.createElement('h2');
  title.textContent = dict.profileIdentityTitle || (state.currentLang === 'th' ? 'บัญชี' : 'Account');
  card.appendChild(title);

  const line = document.createElement('p');
  if (state.user) {
    const displayName = state.user.user_metadata?.full_name || state.user.user_metadata?.name || state.user.email || state.user.id;
    line.textContent = displayName;
  } else {
    line.textContent = dict.profileGuestLabel || (state.currentLang === 'th' ? 'ยังไม่ได้เข้าสู่ระบบ' : 'Not signed in');
  }
  card.appendChild(line);

  if (state.user) {
    const logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.className = 'ghost';
    logoutBtn.textContent = dict.profileLogout || (state.currentLang === 'th' ? 'ออกจากระบบ' : 'Log out');
    logoutBtn.addEventListener('click', async () => {
      try {
        await logout();
      } catch (_) {
        // ignore
      }
    });
    card.appendChild(logoutBtn);
  } else {
    const loginBtn = document.createElement('button');
    loginBtn.type = 'button';
    loginBtn.className = 'primary';
    loginBtn.textContent = dict.profileSignInCta || (state.currentLang === 'th' ? 'เข้าสู่ระบบด้วย Google' : 'Sign in with Google');
    loginBtn.addEventListener('click', async () => {
      try {
        await loginWithProvider('google');
      } catch (_) {
        // ignore
      }
    });
    card.appendChild(loginBtn);
  }

  els.identity.appendChild(card);
}

function renderStreak(dict) {
  if (!els.streak) return;
  els.streak.innerHTML = '';
  const progress = getUserProgress();

  const card = document.createElement('section');
  card.className = 'panel';

  const title = document.createElement('h2');
  title.textContent = dict.profileStreakTitle || (state.currentLang === 'th' ? 'สรุปการเดินทาง' : 'Journey summary');
  card.appendChild(title);

  const streak = document.createElement('p');
  streak.textContent = (dict.profileStreakCurrent || (state.currentLang === 'th' ? 'สตรีคปัจจุบัน: {count} วัน' : 'Current streak: {count} days'))
    .replace('{count}', String(progress.streak_current || 0));
  card.appendChild(streak);

  const total = document.createElement('p');
  total.textContent = (dict.profileReadingsTotal || (state.currentLang === 'th' ? 'อ่านรายวันทั้งหมด: {count}' : 'Total daily readings: {count}'))
    .replace('{count}', String(progress.total_daily_reads || 0));
  card.appendChild(total);

  const phase = computePhase(progress, translations[state.currentLang] || translations.en, translations.en);
  if (phase?.label) {
    const phaseLine = document.createElement('p');
    phaseLine.textContent = (dict.profilePhaseLine || (state.currentLang === 'th' ? 'ช่วงพลัง: {label}' : 'Current phase: {label}'))
      .replace('{label}', phase.label);
    card.appendChild(phaseLine);
  }

  const monthlyStreak = document.createElement('p');
  const monthDays = getMonthlyReadingDays(state.history);
  monthlyStreak.textContent = (dict.profileMonthlyStreak || (state.currentLang === 'th' ? 'สตรีคเดือนนี้: {count} วัน' : 'Monthly streak: {count} days'))
    .replace('{count}', String(computeConsecutiveStreak(monthDays)));
  card.appendChild(monthlyStreak);

  const energy = document.createElement('p');
  energy.textContent = (dict.profileMostCommonEnergy || (state.currentLang === 'th' ? 'พลังที่พบบ่อยที่สุด: {label}' : 'Most common energy: {label}'))
    .replace('{label}', getMostCommonEnergyLabel(dict, state.history));
  card.appendChild(energy);

  els.streak.appendChild(card);
}

function getMonthlyReadingDays(history = []) {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const days = new Set();
  history.forEach((entry) => {
    const parsed = parseDate(entry?.read_date || entry?.created_at || '');
    if (!parsed) return;
    if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month) return;
    const dateToken = parsed.toISOString().slice(0, 10);
    days.add(dateToken);
  });
  return Array.from(days).sort();
}

function computeConsecutiveStreak(days = []) {
  if (!days.length) return 0;
  let longest = 1;
  let current = 1;
  for (let i = 1; i < days.length; i += 1) {
    const prev = parseDate(days[i - 1]);
    const next = parseDate(days[i]);
    if (!prev || !next) continue;
    const dayDiff = Math.round((next.getTime() - prev.getTime()) / 86400000);
    if (dayDiff === 1) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 1;
    }
  }
  return longest;
}

function inferEnergyFromCardId(cardId = '') {
  const id = normalizeId(cardId);
  if (!id) return 'major';
  if (id.includes('wands')) return 'fire';
  if (id.includes('cups')) return 'water';
  if (id.includes('swords')) return 'air';
  if (id.includes('pentacles')) return 'earth';
  return 'major';
}

function getMostCommonEnergyLabel(dict, history = []) {
  const tally = {
    fire: 0,
    water: 0,
    air: 0,
    earth: 0,
    major: 0,
  };

  history.forEach((entry) => {
    (entry?.reading_cards || []).forEach((cardEntry) => {
      const cardId = cardEntry?.card_id || cardEntry?.id || '';
      const energyKey = inferEnergyFromCardId(cardId);
      if (tally[energyKey] !== undefined) tally[energyKey] += 1;
    });
  });

  const topKey = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0] || 'major';
  if (topKey === 'fire') return dict.profileEnergyFire || (state.currentLang === 'th' ? 'ไฟ (Wands)' : 'Fire (Wands)');
  if (topKey === 'water') return dict.profileEnergyWater || (state.currentLang === 'th' ? 'น้ำ (Cups)' : 'Water (Cups)');
  if (topKey === 'air') return dict.profileEnergyAir || (state.currentLang === 'th' ? 'ลม (Swords)' : 'Air (Swords)');
  if (topKey === 'earth') return dict.profileEnergyEarth || (state.currentLang === 'th' ? 'ดิน (Pentacles)' : 'Earth (Pentacles)');
  return dict.profileEnergyMajor || (state.currentLang === 'th' ? 'เมเจอร์อาร์คานา' : 'Major Arcana');
}

function readingLabel(mode = '') {
  if (mode === 'question') return state.currentLang === 'th' ? 'ถามคำถาม' : 'Question';
  if (mode === 'full') return state.currentLang === 'th' ? 'เซลติกครอส' : 'Full';
  return state.currentLang === 'th' ? 'รายวัน' : 'Daily';
}

function prettifyCardId(value = '') {
  const normalized = normalizeId(String(value || '').replace(/-(upright|reversed)$/i, ''));
  if (!normalized) return '';
  return normalized
    .split('-')
    .filter(Boolean)
    .map((part) => (/^\d+$/.test(part) ? null : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
    .filter(Boolean)
    .join(' ');
}

function resolveCardLabel(cardEntry = {}) {
  const rawCardId = String(cardEntry?.card_id || cardEntry?.id || '').trim();
  if (!rawCardId) return '';

  const canonicalId = normalizeId(rawCardId);
  const baseCanonicalId = normalizeId(rawCardId.replace(/-(upright|reversed)$/i, ''));
  const cardMeta = state.cardNameById.get(canonicalId) || state.cardNameById.get(baseCanonicalId);
  if (cardMeta) {
    if (state.currentLang === 'th') {
      return cardMeta.alias_th || cardMeta.name_th || cardMeta.card_name_en || cardMeta.fallback || rawCardId;
    }
    return cardMeta.card_name_en || cardMeta.name_th || cardMeta.alias_th || cardMeta.fallback || rawCardId;
  }

  return prettifyCardId(rawCardId) || rawCardId;
}

function renderHistory(dict) {
  if (!els.history) return;
  els.history.innerHTML = '';

  const card = document.createElement('section');
  card.className = 'panel';

  const title = document.createElement('h2');
  title.textContent = dict.profileHistoryTitle || (state.currentLang === 'th' ? 'ประวัติการเปิดไพ่ล่าสุด' : 'Recent reading history');
  card.appendChild(title);

  if (!state.user) {
    const empty = document.createElement('div');
    empty.className = 'profile-empty-state';

    const emptyTitle = document.createElement('p');
    emptyTitle.className = 'profile-empty-state__title';
    emptyTitle.textContent = dict.profileHistoryLoginHint || (state.currentLang === 'th' ? 'เข้าสู่ระบบเพื่อดูประวัติการเปิดไพ่' : 'Sign in to view reading history.');
    empty.appendChild(emptyTitle);

    const emptyBody = document.createElement('p');
    emptyBody.className = 'profile-empty-state__body';
    emptyBody.textContent = dict.profileHistoryLoginBody || (state.currentLang === 'th' ? 'เมื่อเข้าสู่ระบบ คุณจะย้อนดูผลเดิมและติดตามพลังที่เด่นได้ง่ายขึ้น' : 'When signed in, you can revisit past readings and track your dominant energy.');
    empty.appendChild(emptyBody);

    card.appendChild(empty);
    els.history.appendChild(card);
    return;
  }

  if (!state.history.length) {
    const empty = document.createElement('div');
    empty.className = 'profile-empty-state';

    const emptyTitle = document.createElement('p');
    emptyTitle.className = 'profile-empty-state__title';
    emptyTitle.textContent = dict.profileHistoryEmpty || (state.currentLang === 'th' ? 'ยังไม่มีประวัติการเปิดไพ่' : 'No history yet.');
    empty.appendChild(emptyTitle);

    const emptyBody = document.createElement('p');
    emptyBody.className = 'profile-empty-state__body';
    emptyBody.textContent = dict.profileHistoryEmptyBody || (state.currentLang === 'th' ? 'เริ่มเปิดไพ่ครั้งแรก แล้วกลับมาที่นี่เพื่ออ่านซ้ำและค้นหาไพ่ใกล้เคียง' : 'Draw your first reading, then come back here to revisit and explore similar cards.');
    empty.appendChild(emptyBody);

    const startLink = document.createElement('a');
    startLink.className = 'ghost profile-empty-state__cta';
    startLink.href = getModeHref('daily');
    startLink.textContent = dict.profileHistoryStartCta || (state.currentLang === 'th' ? 'เริ่มเปิดไพ่รายวัน' : 'Start a daily reading');
    empty.appendChild(startLink);

    card.appendChild(empty);
    els.history.appendChild(card);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'history-list';
  state.history.forEach((entry) => {
    const item = document.createElement('li');
    item.className = 'profile-history-item';

    const cards = (entry.reading_cards || []).map((c) => resolveCardLabel(c)).filter(Boolean).join(', ');
    const heading = document.createElement('p');
    heading.className = 'profile-history-item__title';
    const date = formatReadingDate(entry.read_date || entry.created_at || '');
    heading.textContent = `${date} · ${readingLabel(entry.mode)}`;
    item.appendChild(heading);

    const cardsLine = document.createElement('p');
    cardsLine.className = 'profile-history-item__cards';
    cardsLine.textContent = cards;
    item.appendChild(cardsLine);

    const actions = document.createElement('div');
    actions.className = 'profile-history-item__actions';

    const readAgain = document.createElement('a');
    readAgain.className = 'ghost profile-history-item__action';
    readAgain.href = getModeHref(entry.mode);
    readAgain.textContent = dict.profileReadAgain || (state.currentLang === 'th' ? 'อ่านอีกครั้ง' : 'Read Again');
    actions.appendChild(readAgain);

    const firstCard = entry?.reading_cards?.[0];
    const similar = document.createElement('a');
    const similarCardId = normalizeId(firstCard?.card_id || firstCard?.id || '');
    similar.className = 'ghost profile-history-item__action';
    similar.href = `${createLocalizedHref('/meanings.html')}?card=${encodeURIComponent(similarCardId || '')}`;
    similar.textContent = dict.profileSeeSimilar || (state.currentLang === 'th' ? 'ดูไพ่ใกล้เคียง' : 'See Similar Cards');
    actions.appendChild(similar);

    item.appendChild(actions);
    list.appendChild(item);
  });
  card.appendChild(list);
  els.history.appendChild(card);
}

function renderLoginCta(dict) {
  if (!els.cta) return;
  els.cta.innerHTML = '';
  if (state.user || !isAuthConfigured()) return;

  const panel = document.createElement('section');
  panel.className = 'panel';
  const title = document.createElement('h2');
  title.textContent = dict.profileLoginTitle || (state.currentLang === 'th' ? 'บันทึกการเดินทางของคุณ' : 'Save your journey');
  panel.appendChild(title);

  const body = document.createElement('p');
  body.textContent = dict.profileLoginBody || (state.currentLang === 'th'
    ? 'เข้าสู่ระบบเพื่อเก็บประวัติการเปิดไพ่ล่าสุดของคุณ'
    : 'Sign in to keep your recent reading history.');
  panel.appendChild(body);

  els.cta.appendChild(panel);
}

async function refreshHistory() {
  if (!state.user?.id) {
    state.history = [];
    return;
  }
  state.history = await loadReadings(state.user.id, 20);
}

async function refreshCardNameMap() {
  if (state.cardNameById.size) return;
  try {
    const manifest = await loadTarotManifest();
    const nextMap = new Map();
    (manifest || []).forEach((card) => {
      const cardId = normalizeId(card?.card_id || card?.id || '');
      if (!cardId || nextMap.has(cardId)) return;
      const cardMeta = {
        card_name_en: card.card_name_en || card.name_en || '',
        name_th: card.name_th || '',
        alias_th: card.alias_th || card.name_th || '',
        fallback: prettifyCardId(cardId),
      };
      nextMap.set(cardId, cardMeta);

      const baseCardId = normalizeId(cardId.replace(/-(upright|reversed)$/i, ''));
      if (baseCardId && !nextMap.has(baseCardId)) nextMap.set(baseCardId, cardMeta);
    });
    state.cardNameById = nextMap;
  } catch (_) {
    state.cardNameById = new Map();
  }
}

async function renderAll(dict = translations[state.currentLang] || translations.en) {
  await refreshCardNameMap();
  await refreshHistory();
  renderIdentity(dict);
  renderStreak(dict);
  renderHistory(dict);
  renderLoginCta(dict);
}

function onTranslations(dict) {
  renderAll(dict);
}

function switchLanguageInPlace(nextLang) {
  if (!nextLang || nextLang === state.currentLang) return;
  state.currentLang = nextLang;
  applyTranslations(nextLang, onTranslations);
  applyLocaleMeta(nextLang);
}

function init() {
  initShell(state, onTranslations, 'profile', {
    onLangToggle: switchLanguageInPlace,
  });

  subscribeAuthState((nextUser) => {
    state.user = nextUser || null;
    renderAll();
  });

  getCurrentUser().then((user) => {
    state.user = user || null;
    // GA4: profile_revisit
    const _profileId = user?.id || 'guest';
    const _lastVisitRaw = localStorage.getItem('_mt_profile_last_visit');
    const _lastVisitMs = _lastVisitRaw ? Number(_lastVisitRaw) : null;
    const _nowMs = Date.now();
    const _daysSinceLast = _lastVisitMs
      ? Math.round(((_nowMs - _lastVisitMs) / 86_400_000) * 10) / 10
      : -1;
    try { localStorage.setItem('_mt_profile_last_visit', String(_nowMs)); } catch (_) {}
    trackProfileRevisit({
      profile_id: _profileId,
      locale: state.currentLang,
      days_since_last_visit: _daysSinceLast,
      entry_path: window.location.pathname,
    });
    renderAll();
  });
}

document.addEventListener('DOMContentLoaded', init);
