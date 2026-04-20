import {
  applyLocaleMeta,
  applyTranslations,
  initShell,
  pathHasThaiPrefix,
  translations,
} from './common.js';
import { loadTarotManifest, normalizeId } from './data.js';
import { computePhase } from './phase.js';
import { getUserProgress } from './progress.js';
import { getCurrentUser, isAuthConfigured, loginWithProvider, logout, subscribeAuthState } from './auth.js';
import { loadReadings } from './reading-history.js';

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

  els.streak.appendChild(card);
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
    const empty = document.createElement('p');
    empty.textContent = dict.profileHistoryLoginHint || (state.currentLang === 'th' ? 'เข้าสู่ระบบเพื่อดูประวัติการเปิดไพ่' : 'Sign in to view reading history.');
    card.appendChild(empty);
    els.history.appendChild(card);
    return;
  }

  if (!state.history.length) {
    const empty = document.createElement('p');
    empty.textContent = dict.profileHistoryEmpty || (state.currentLang === 'th' ? 'ยังไม่มีประวัติการเปิดไพ่' : 'No history yet.');
    card.appendChild(empty);
    els.history.appendChild(card);
    return;
  }

  const list = document.createElement('ul');
  list.className = 'history-list';
  state.history.forEach((entry) => {
    const item = document.createElement('li');
    const cards = (entry.reading_cards || []).map((c) => resolveCardLabel(c)).filter(Boolean).join(', ');
    const date = entry.read_date || '';
    item.textContent = `${date} · ${readingLabel(entry.mode)} · ${cards}`;
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
    renderAll();
  });
}

document.addEventListener('DOMContentLoaded', init);
