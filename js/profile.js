import {
  applyLocaleMeta,
  applyTranslations,
  initShell,
  localizePath,
  pathHasThaiPrefix,
  translations,
} from './common.js';
import { getAllDecks, loadTarotManifest, normalizeId, getReversedMode, setReversedMode, getActiveDeckId } from './data.js';
import { computePhase } from './phase.js';
import { getUserProgress, getNextStreakMilestone } from './progress.js';
import { getCurrentUser, isAuthConfigured, loginWithProvider, logout, deleteAccount, subscribeAuthState } from './auth.js';
import { loadReadings } from './reading-history.js';
import { serializeReadingStateToUrl } from './reading-url.js';
import { trackLocaleSwitched, trackProfileRevisit } from './analytics.js';
import { renderAchievementsPanel } from './achievements-panel.js';
import { renderReferralPanel } from './referral.js';

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

const CAT_AVATAR_SVG = `<svg viewBox="0 0 48 48" width="34" height="34" aria-hidden="true">
  <path d="M11 12 L15 4 L19 15 Z" fill="#fff6ea"/><path d="M37 12 L33 4 L29 15 Z" fill="#fff6ea"/>
  <ellipse cx="24" cy="27" rx="14" ry="12.5" fill="#fff6ea"/>
  <circle cx="19" cy="25" r="1.7" fill="#3d1a5c"/><circle cx="29" cy="25" r="1.7" fill="#3d1a5c"/>
  <path d="M22.5 30 L24 31.6 L25.5 30 Z" fill="#e8457a"/></svg>`;

// Header: avatar (real Google photo when signed in, cat fallback otherwise) + name + subtitle.
// Account actions (log out / privacy / sign-in) moved to the Settings tab's Account card.
function renderIdentity(dict) {
  if (!els.identity) return;
  els.identity.innerHTML = '';
  const th = state.currentLang === 'th';

  const header = document.createElement('div');
  header.className = 'profile-header';

  const av = document.createElement('div');
  av.className = 'profile-avatar' + (state.user ? '' : ' profile-avatar--guest');
  const photo = state.user && (state.user.user_metadata?.avatar_url || state.user.user_metadata?.picture);
  if (photo) {
    const img = document.createElement('img');
    img.src = photo; img.alt = ''; img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => { av.innerHTML = CAT_AVATAR_SVG; av.classList.add('profile-avatar--fallback'); });
    av.appendChild(img);
  } else {
    av.classList.add('profile-avatar--fallback');
    av.innerHTML = CAT_AVATAR_SVG;
  }
  if (state.user) {
    const flame = document.createElement('span');
    flame.className = 'profile-avatar__badge';
    flame.textContent = '🔥';
    av.appendChild(flame);
  }
  header.appendChild(av);

  const meta = document.createElement('div');
  meta.className = 'profile-header__meta';
  const name = document.createElement('div');
  name.className = 'profile-header__name';
  name.textContent = state.user
    ? (state.user.user_metadata?.full_name || state.user.user_metadata?.name || state.user.email || (th ? 'นักอ่านไพ่' : 'Reader'))
    : (th ? 'ผู้มาเยือน' : 'Guest reader');
  const sub = document.createElement('div');
  sub.className = 'profile-header__sub';
  sub.textContent = state.user
    ? (th ? 'นักอ่านไพ่แห่งแสงจันทร์' : 'Moonlit reader')
    : (th ? 'ลงชื่อเข้าใช้เพื่อบันทึกเส้นทางของคุณ' : 'Sign in to save your journey');
  meta.appendChild(name);
  meta.appendChild(sub);
  // Guest reader: surface a direct Sign-in button right here (founder 2026-06-26) —
  // previously the only inline CTA lived in the Settings tab's Account card.
  if (!state.user) {
    const signIn = document.createElement('button');
    signIn.type = 'button';
    signIn.className = 'primary profile-header__signin';
    signIn.textContent = dict.profileSignInCta || (th ? 'เข้าสู่ระบบด้วย Google' : 'Continue with Google');
    signIn.addEventListener('click', async () => { try { await loginWithProvider('google'); } catch (_) {} });
    meta.appendChild(signIn);
  }
  header.appendChild(meta);

  els.identity.appendChild(header);
}

// Settings → Account card: log out + privacy + (signed out) sign-in CTA.
function renderAccountActions(dict) {
  const host = document.getElementById('profile-account');
  if (!host) return;
  host.innerHTML = '';
  const th = state.currentLang === 'th';
  const card = document.createElement('section');
  card.className = 'panel';
  const title = document.createElement('h2');
  title.textContent = th ? 'บัญชี' : 'Account';
  card.appendChild(title);

  if (state.user) {
    const line = document.createElement('p');
    line.className = 'profile-account-email';
    line.textContent = (th ? 'เข้าสู่ระบบเป็น ' : 'Signed in as ') + (state.user.email || state.user.id);
    card.appendChild(line);
    const row = document.createElement('div');
    row.className = 'profile-account-actions';
    const privacyLink = document.createElement('a');
    privacyLink.className = 'ghost';
    privacyLink.href = th ? '/th/privacy.html' : '/privacy.html';
    privacyLink.textContent = dict.profilePrivacyLink || (th ? 'ความเป็นส่วนตัว' : 'Privacy');
    const logoutBtn = document.createElement('button');
    logoutBtn.type = 'button';
    logoutBtn.className = 'ghost';
    logoutBtn.textContent = dict.profileLogout || (th ? 'ออกจากระบบ' : 'Log out');
    logoutBtn.addEventListener('click', async () => { try { await logout(); } catch (_) {} });
    row.appendChild(privacyLink);
    row.appendChild(logoutBtn);
    card.appendChild(row);
  } else {
    const line = document.createElement('p');
    line.textContent = th ? 'ลงชื่อเข้าใช้เพื่อซิงก์สตรีค สำรับ และการอ่านไพ่ข้ามอุปกรณ์' : 'Sign in to sync your streak, decks and readings across devices.';
    card.appendChild(line);
    const loginBtn = document.createElement('button');
    loginBtn.type = 'button';
    loginBtn.className = 'primary';
    loginBtn.textContent = dict.profileSignInCta || (th ? 'เข้าสู่ระบบด้วย Google' : 'Continue with Google');
    loginBtn.addEventListener('click', async () => { try { await loginWithProvider('google'); } catch (_) {} });
    card.appendChild(loginBtn);
  }
  host.appendChild(card);
}

const THAI_NUMBER_WORDS = [
  'ศูนย์', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า',
  'สิบ', 'สิบเอ็ด', 'สิบสอง', 'สิบสาม', 'สิบสี่', 'สิบห้า', 'สิบหก', 'สิบเจ็ด', 'สิบแปด', 'สิบเก้า', 'ยี่สิบ',
];

function thaiNumberWord(n) {
  const num = Math.max(0, Number(n) || 0);
  if (num <= 20) return `${THAI_NUMBER_WORDS[num]}วัน`;
  if (num < 30) {
    // Thai uses "เอ็ด" (not "หนึ่ง") for the ones-digit 1 in 21/31/41...
    const ones = num - 20;
    return ones === 1 ? 'ยี่สิบเอ็ดวัน' : `ยี่สิบ${THAI_NUMBER_WORDS[ones]}วัน`;
  }
  return `${num} วัน`;
}

function renderStreak(dict) {
  if (!els.streak) return;
  els.streak.innerHTML = '';
  const progress = getUserProgress();

  // Top eyebrow row: "Your practice · บันทึกการเดินทาง"
  const topRow = document.createElement('div');
  topRow.className = 'profile-top-row';

  const eyebrowGroup = document.createElement('div');
  const eyebrowEn = document.createElement('div');
  eyebrowEn.className = 'profile-top-row__eyebrow';
  eyebrowEn.textContent = state.currentLang === 'th' ? 'บันทึกการเดินทาง' : 'Your practice';
  eyebrowGroup.appendChild(eyebrowEn);

  // Single-language per locale — no bilingual alt eyebrow.

  topRow.appendChild(eyebrowGroup);

  // Language toggle pill on the right of the top row. Replaces the
  // global navbar's EN/TH toggle — language switching is now profile-
  // only per the Phase 5 navbar removal pass. Clicking either side
  // calls switchLanguageInPlace which re-applies translations and
  // re-runs renderAll (so the toggle itself re-renders with the new
  // language selected).
  const langPill = document.createElement('div');
  langPill.className = 'profile-lang-pill';
  langPill.setAttribute('role', 'group');
  langPill.setAttribute('aria-label', 'Language');
  ['en', 'th'].forEach((lang) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'profile-lang-pill__btn';
    btn.dataset.lang = lang;
    btn.textContent = lang === 'en' ? 'EN' : 'TH';
    btn.setAttribute('aria-pressed', String(state.currentLang === lang));
    if (state.currentLang === lang) {
      btn.classList.add('is-active');
    }
    btn.addEventListener('click', () => {
      if (state.currentLang === lang) return;
      switchLanguageInPlace(lang);
    });
    langPill.appendChild(btn);
  });
  topRow.appendChild(langPill);

  els.streak.appendChild(topRow);

  // Streak hero
  const hero = document.createElement('div');
  hero.className = 'profile-streak-hero';

  const heroEyebrow = document.createElement('div');
  heroEyebrow.className = 'profile-streak-hero__eyebrow';
  heroEyebrow.textContent = state.currentLang === 'th' ? 'สตรีคปัจจุบัน' : 'Current streak';
  hero.appendChild(heroEyebrow);

  const currentStreak = Math.max(0, Number(progress.streak_current) || 0);
  const bestStreak = Math.max(0, Number(progress.streak_best) || 0);

  const heroNum = document.createElement('div');
  heroNum.className = 'profile-streak-hero__number';
  heroNum.textContent = String(currentStreak);
  hero.appendChild(heroNum);

  // TH-only secondary line under the big gradient number. The Thai
  // number-word (e.g. "สิบสี่วัน") only renders on the TH site so EN
  // doesn't leak Thai script into the streak hero.
  if (state.currentLang === 'th') {
    const heroNumTh = document.createElement('div');
    heroNumTh.className = 'profile-streak-hero__number-th';
    heroNumTh.textContent = thaiNumberWord(currentStreak);
    hero.appendChild(heroNumTh);
  }

  const heroSubtitle = document.createElement('div');
  heroSubtitle.className = 'profile-streak-hero__subtitle';
  const isLongest = currentStreak > 0 && currentStreak >= bestStreak;
  if (state.currentLang === 'th') {
    heroSubtitle.textContent = isLongest ? 'วันติดต่อกัน · ยาวที่สุดที่เคย' : `วันติดต่อกัน · สูงสุด ${bestStreak} วัน`;
  } else {
    heroSubtitle.textContent = isLongest ? 'days in a row · longest yet' : `days in a row · best ${bestStreak}`;
  }
  hero.appendChild(heroSubtitle);

  els.streak.appendChild(hero);

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

    // Phase 5: opening the sign-in gate from the history empty state
    // surfaces the same Continue-with-Google CTA as the design's
    // ScreenPopupSignIn. The inline "Sign in with Google" button in
    // renderIdentity stays as a separate entry point — both call
    // loginWithProvider('google').
    const cta = document.createElement('button');
    cta.type = 'button';
    cta.className = 'ghost profile-empty-state__cta';
    cta.textContent = dict.profileSignInCta || (state.currentLang === 'th' ? 'เข้าสู่ระบบด้วย Google' : 'Sign in to continue');
    cta.addEventListener('click', () => {
      import('./sign-in-gate.js').then(({ showSignInGate }) => {
        showSignInGate({
          lang: state.currentLang,
          onSignIn: () => loginWithProvider('google').catch(() => {}),
        });
      }).catch(() => {});
    });
    empty.appendChild(cta);

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
    // Deep-link straight to the rendered RESULT (was the entry/board page) — founder
    // 2026-06-26. Rebuild the compact reading URL from the stored cards; fall back to the
    // mode's board page only when an entry has no cards to hydrate from.
    const readAgainCards = (entry.reading_cards || [])
      .map((c) => {
        const base = normalizeId(c.card_id || c.id || '').replace(/-(upright|reversed)$/, '');
        if (!base) return '';
        const orient = String(c.orientation || '').toLowerCase() === 'reversed' ? 'reversed' : 'upright';
        return `${base}-${orient}`;
      })
      .filter(Boolean);
    readAgain.href = readAgainCards.length
      ? serializeReadingStateToUrl(
          { mode: entry.mode, spread: entry.spread, topic: entry.topic, lang: state.currentLang, cards: readAgainCards },
          { path: createLocalizedHref('/reading.html') },
        )
      : getModeHref(entry.mode);
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

function renderLifetimeStats(dict) {
  const host = document.getElementById('profile-lifetime-stats');
  if (!host) return;
  host.innerHTML = '';

  const history = Array.isArray(state.history) ? state.history : [];
  const cardsDrawn = history.reduce((acc, entry) => acc + (Array.isArray(entry?.reading_cards) ? entry.reading_cards.length : 0), 0);
  const questionsAsked = history.filter((entry) => entry?.mode === 'question').length;
  let sharesTotal = 0;
  try {
    const raw = window.localStorage?.getItem('_mt_shares_total');
    sharesTotal = Math.max(0, Number(raw) || 0);
  } catch (_) { /* sandbox */ }

  const panel = document.createElement('div');
  panel.className = 'profile-lifetime-stats';

  const stats = [
    {
      n: cardsDrawn,
      en: 'Cards drawn',
      th: 'ไพ่ที่เปิด',
    },
    {
      n: questionsAsked,
      en: 'Questions asked',
      th: 'คำถาม',
    },
    {
      n: sharesTotal,
      en: 'Times shared',
      th: 'จำนวนแชร์',
    },
  ];

  stats.forEach((s) => {
    const col = document.createElement('div');
    col.className = 'profile-lifetime-stat';
    const num = document.createElement('div');
    num.className = 'profile-lifetime-stat__num';
    num.textContent = String(s.n);
    col.appendChild(num);
    const label = document.createElement('div');
    label.className = 'profile-lifetime-stat__label';
    label.textContent = state.currentLang === 'th' ? s.th : s.en;
    col.appendChild(label);
    const labelAlt = document.createElement('div');
    labelAlt.className = 'profile-lifetime-stat__label-th';
    labelAlt.textContent = state.currentLang === 'th' ? s.en : s.th;
    col.appendChild(labelAlt);
    panel.appendChild(col);
  });

  host.appendChild(panel);
}

function renderLoginCta() {
  // The bottom "Save your journey" sign-in CTA was removed as redundant — the
  // identity card and the history empty-state already surface sign-in. Hide the
  // (now empty) host so it leaves no gap above the bottom nav.
  if (els.cta) { els.cta.innerHTML = ''; els.cta.hidden = true; }
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

// "Contact us" — Instagram + email (moved out of the footer).
function renderContact(dict) {
  const host = document.getElementById('profile-contact');
  if (!host) return;
  host.innerHTML = '';
  const th = state.currentLang === 'th';

  const card = document.createElement('section');
  card.className = 'panel profile-contact';

  const title = document.createElement('h2');
  title.textContent = dict.profileContactTitle || (th ? 'ติดต่อเรา' : 'Contact us');
  card.appendChild(title);

  const row = document.createElement('div');
  row.className = 'profile-contact__links';
  row.innerHTML = `
    <a class="profile-contact__link" href="https://www.instagram.com/meowtarotcom/" target="_blank" rel="noopener noreferrer">Instagram</a>
    <a class="profile-contact__link" href="mailto:hello@meowtarot.com">hello@meowtarot.com</a>
  `;
  card.appendChild(row);
  host.appendChild(card);
}

// "Other" — collapsed disclosure at the very bottom (Guideline 5.1.1(v)). Tap
// "Other" to reveal a "Delete account" button; tapping THAT opens a centered
// confirmation modal (warning + checkbox-gated delete). Signed-in users only.
// Reversed-cards visualization control — its own Settings card, visible to everyone.
function renderReversed() {
  const host = document.getElementById('profile-reversed');
  if (!host) return;
  host.innerHTML = '';
  host.appendChild(buildReversedModePanel(state.currentLang === 'th'));
}

function renderOther(dict) {
  const host = document.getElementById('profile-other');
  if (!host) return;
  host.innerHTML = '';
  // Account deletion is signed-in only.
  if (!state.user) { host.hidden = true; return; }
  host.hidden = false;

  const th = state.currentLang === 'th';

  const card = document.createElement('section');
  card.className = 'panel profile-other';

  const details = document.createElement('details');
  details.className = 'profile-other-disclosure';

  const summary = document.createElement('summary');
  summary.className = 'profile-other-disclosure__summary';
  summary.textContent = dict.profileOtherTitle || (th ? 'อื่น ๆ' : 'Other');
  details.appendChild(summary);

  const body = document.createElement('div');
  body.className = 'profile-other-disclosure__body';

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'profile-delete-trigger';
  trigger.textContent = dict.profileDeleteAccount || (th ? 'ลบบัญชี' : 'Delete account');
  trigger.addEventListener('click', () => openDeleteModal(dict, th));
  body.appendChild(trigger);

  details.appendChild(body);
  card.appendChild(details);
  host.appendChild(card);
}

// Visible "Reversed cards" control: Flip / Art / Flip + Art. Selecting a mode persists it
// and shows a Fool preview so the user sees what reversed cards will look like.
function buildReversedModePanel(th) {
  const panel = document.createElement('section');
  panel.className = 'panel profile-reversed-panel';

  const title = document.createElement('h2');
  title.className = 'profile-reversed-panel__title';
  title.textContent = th ? 'ไพ่กลับหัว' : 'Reversed cards';
  panel.appendChild(title);

  const desc = document.createElement('p');
  desc.className = 'profile-reversed-panel__desc';
  desc.textContent = th ? 'เลือกว่าไพ่กลับหัวจะแสดงแบบไหน' : 'Choose how reversed cards are shown.';
  panel.appendChild(desc);

  const seg = document.createElement('div');
  seg.className = 'profile-reversed-seg';
  const modes = [
    { key: 'flip', en: 'Flip', th: 'พลิก' },
    { key: 'art', en: 'Art', th: 'รูปแยก' },
    { key: 'flipart', en: 'Flip + Art', th: 'พลิก + รูปแยก' },
  ];
  const restyle = (active) => seg.querySelectorAll('button').forEach((b) => {
    const on = b.dataset.mode === active;
    b.classList.toggle('is-active', on);
    b.setAttribute('aria-pressed', String(on));
  });
  modes.forEach((m) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.mode = m.key;
    b.className = 'profile-reversed-seg__btn';
    b.textContent = th ? m.th : m.en;
    b.addEventListener('click', () => {
      setReversedMode(m.key);
      restyle(m.key);
      showReversedPreview(m.key, th);
    });
    seg.appendChild(b);
  });
  restyle(getReversedMode());
  panel.appendChild(seg);
  return panel;
}

function showReversedPreview(mode, th) {
  if (typeof document === 'undefined') return;
  document.getElementById('mt-rev-preview')?.remove();
  if (!document.getElementById('mt-rev-preview-style')) {
    const st = document.createElement('style');
    st.id = 'mt-rev-preview-style';
    st.textContent = `
      .mt-rev-overlay{position:fixed;inset:0;z-index:1250;display:flex;align-items:center;justify-content:center;padding:24px;background:rgba(28,12,52,0);transition:background .22s ease;}
      .mt-rev-overlay.in{background:rgba(28,12,52,.55);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);}
      .mt-rev-card{width:100%;max-width:300px;background:linear-gradient(180deg,#fffaf2,#fdf3ec);border:1px solid rgba(197,177,220,.55);border-radius:22px;padding:22px 20px 18px;text-align:center;box-shadow:0 30px 60px -20px rgba(20,8,40,.55);transform:translateY(12px) scale(.95);opacity:0;transition:transform .3s cubic-bezier(.34,1.56,.64,1),opacity .2s ease;}
      .mt-rev-overlay.in .mt-rev-card{transform:none;opacity:1;}
      .mt-rev-img{width:140px;aspect-ratio:848/1264;object-fit:contain;border-radius:12px;margin:0 auto 12px;display:block;box-shadow:0 14px 30px -12px rgba(61,26,92,.55);border:1px solid var(--mt-gold-pale,#e8c478);}
      .mt-rev-img.is-flipped{transform:rotate(180deg);}
      .mt-rev-text{font-family:var(--mt-font-body,"DM Sans",sans-serif);font-size:14px;color:var(--mt-ink-soft,#6b5b82);line-height:1.5;margin:0 0 14px;}
      .mt-rev-btn{width:100%;padding:12px;border:none;border-radius:14px;background:var(--mt-plum,#3d1a5c);color:#fff8e7;font-family:var(--mt-font-body,"DM Sans",sans-serif);font-weight:700;font-size:14px;cursor:pointer;}
    `;
    document.head.appendChild(st);
  }
  const deckId = getActiveDeckId();
  const CDN = 'https://cdn.meowtarot.com/assets';
  // flip → upright art (rotated via CSS); art + flipart → the dedicated reversed art.
  const src = mode === 'flip'
    ? `${CDN}/${deckId}/01-the-fool-upright.webp`
    : `${CDN}/${deckId}/01-the-fool-reversed.webp`;
  const rotated = mode !== 'art'; // flip + flipart rotate 180°

  const ov = document.createElement('div');
  ov.id = 'mt-rev-preview';
  ov.className = 'mt-rev-overlay';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.innerHTML = `
    <div class="mt-rev-card" role="document">
      <img class="mt-rev-img${rotated ? ' is-flipped' : ''}" src="${src}" alt="" />
      <p class="mt-rev-text">${th ? 'ตอนนี้ไพ่กลับหัวของคุณจะเป็นแบบนี้!' : "Now your reversed cards will look like this!"}</p>
      <button type="button" class="mt-rev-btn">${th ? 'เข้าใจแล้ว' : 'Got it'}</button>
    </div>`;
  const img = ov.querySelector('.mt-rev-img');
  img.addEventListener('error', () => { img.src = `${CDN}/${deckId}/01-the-fool-upright.webp`; });
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('in'));
  const close = () => { ov.classList.remove('in'); window.setTimeout(() => ov.remove(), 220); };
  ov.querySelector('.mt-rev-btn').addEventListener('click', close);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
}

// Centered confirmation modal for account deletion. The destructive call is
// gated behind an explicit checkbox before "Yes, delete" enables.
let deleteModalOpen = false;
function openDeleteModal(dict, th) {
  if (deleteModalOpen) return;
  deleteModalOpen = true;

  const ov = document.createElement('div');
  ov.className = 'profile-delete-overlay';
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');

  const card = document.createElement('div');
  card.className = 'profile-delete-modal';

  const close = () => {
    deleteModalOpen = false;
    ov.classList.remove('in');
    setTimeout(() => ov.remove(), 200);
  };

  const warn = document.createElement('p');
  warn.className = 'profile-delete-modal__warn';
  warn.textContent = dict.profileDeleteFinalBody
    || (th
      ? 'คุณกำลังลบบัญชี สำรับและการดูไพ่ที่บันทึกไว้ทั้งหมดจะหายไปอย่างถาวร และย้อนกลับไม่ได้'
      : "You're deleting your account. All your decks and saved readings will be gone for good. This can't be undone.");
  card.appendChild(warn);

  const checkLabel = document.createElement('label');
  checkLabel.className = 'profile-delete-checkbox';
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  const checkText = document.createElement('span');
  checkText.textContent = dict.profileDeleteCheckbox
    || (th
      ? 'ฉันเข้าใจว่าสำรับและการดูไพ่ของฉันจะถูกลบอย่างถาวร'
      : 'I understand my decks and readings will be permanently deleted.');
  checkLabel.appendChild(checkbox);
  checkLabel.appendChild(checkText);
  card.appendChild(checkLabel);

  const row = document.createElement('div');
  row.className = 'profile-delete-actions';

  const confirmBtn = document.createElement('button');
  confirmBtn.type = 'button';
  confirmBtn.className = 'profile-delete-confirm';
  confirmBtn.disabled = true;
  confirmBtn.textContent = dict.profileDeleteConfirmYes || (th ? 'ยืนยันลบบัญชี' : 'Yes, delete');

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'ghost';
  cancelBtn.textContent = dict.profileDeleteCancel || (th ? 'ยกเลิก' : 'Cancel');
  cancelBtn.addEventListener('click', close);

  checkbox.addEventListener('change', () => {
    confirmBtn.disabled = !checkbox.checked;
  });

  confirmBtn.addEventListener('click', async () => {
    if (confirmBtn.disabled) return;
    confirmBtn.disabled = true;
    cancelBtn.disabled = true;
    checkbox.disabled = true;
    confirmBtn.textContent = dict.profileDeleting || (th ? 'กำลังลบ…' : 'Deleting…');
    try {
      await deleteAccount();
      // deleteAccount() signs out → the auth-state listener re-renders to the guest view.
      close();
    } catch (_) {
      confirmBtn.disabled = false;
      cancelBtn.disabled = false;
      checkbox.disabled = false;
      confirmBtn.textContent = dict.profileDeleteConfirmYes || (th ? 'ยืนยันลบบัญชี' : 'Yes, delete');
      warn.textContent = dict.profileDeleteError || (th ? 'ลบไม่สำเร็จ ลองอีกครั้ง' : 'Could not delete your account. Please try again.');
    }
  });

  row.appendChild(confirmBtn);
  row.appendChild(cancelBtn);
  card.appendChild(row);

  ov.appendChild(card);
  ov.addEventListener('click', (e) => { if (e.target === ov) close(); });
  document.addEventListener('keydown', function esc(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
  });
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('in'));
}

async function renderAll(dict = translations[state.currentLang] || translations.en) {
  await refreshCardNameMap();
  await refreshHistory();
  renderIdentity(dict);
  renderStreak(dict);
  const progress = getUserProgress();
  // Deck INVENTORY ("My Decks") removed from Profile (founder 2026-06-22): Profile is now the
  // achievement REWARD board; the deck inventory lives only on "Your Decks" (/decks.html, the
  // Decks tab). Keeps reward vs inventory cleanly separated. #profile-deck-inventory dropped.
  renderLifetimeStats(dict);
  const achieveEl = document.getElementById('profile-achievements');
  if (achieveEl) renderAchievementsPanel(achieveEl, progress, dict, state.currentLang);
  const referralEl = document.getElementById('profile-referral');
  if (referralEl) renderReferralPanel(referralEl, state.currentLang);
  renderHistory(dict);
  renderContact(dict);
  renderReversed();
  renderAccountActions(dict);
  renderOther(dict);
  renderLoginCta(dict);
  renderTabs(dict);
}

// 3-tab segmented control (Rewards / Activity / Settings) — shows/hides the .profile-tab panels.
function renderTabs(dict) {
  const bar = document.getElementById('profile-tabs');
  if (!bar) return;
  const th = state.currentLang === 'th';
  const tabs = [
    { key: 'rewards', label: th ? 'รางวัล' : 'Rewards' },
    { key: 'activity', label: th ? 'กิจกรรม' : 'Activity' },
    { key: 'settings', label: th ? 'ตั้งค่า' : 'Settings' },
  ];
  const active = state.profileTab || 'rewards';
  bar.innerHTML = tabs.map((t) => `<button type="button" class="profile-tab-btn${t.key === active ? ' is-active' : ''}" data-go="${t.key}">${t.label}</button>`).join('');
  const activate = (key) => {
    state.profileTab = key;
    bar.querySelectorAll('.profile-tab-btn').forEach((b) => b.classList.toggle('is-active', b.dataset.go === key));
    document.querySelectorAll('.profile-tab').forEach((panel) => { panel.hidden = panel.dataset.tab !== key; });
  };
  bar.querySelectorAll('.profile-tab-btn').forEach((b) => b.addEventListener('click', () => activate(b.dataset.go)));
  activate(active);
}

function onTranslations(dict) {
  renderAll(dict);
}

function switchLanguageInPlace(nextLang) {
  if (!nextLang || nextLang === state.currentLang) return;
  const fromLocale = state.currentLang;
  state.currentLang = nextLang;
  // Mirror the side-effects that used to run on the global navbar's
  // lang-toggle click (locale_switched GA event, persisted locale, and
  // daily-reminder reschedule) so the profile-page pill is a drop-in
  // replacement for the removed top-navbar toggle.
  try { trackLocaleSwitched({ fromLocale, toLocale: nextLang }); } catch (_) {}
  try { localStorage.setItem('meowtarot_lang', nextLang); } catch (_) {}
  import('./notifications.js').then(({ isEnabled, scheduleDailyReminder }) => {
    if (isEnabled()) scheduleDailyReminder(translations[nextLang]);
  }).catch(() => {});
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
