import {
  applyLocaleMeta,
  applyTranslations,
  initShell,
  localizePath,
  pathHasThaiPrefix,
  translations,
} from './common.js';
import { getAllDecks, loadTarotManifest, normalizeId } from './data.js';
import { computePhase } from './phase.js';
import { getUserProgress, getNextStreakMilestone, resetLocalProgress } from './progress.js';
import { getCurrentUser, isAuthConfigured, loginWithProvider, logout, deleteAccount, subscribeAuthState } from './auth.js';
import { loadReadings } from './reading-history.js';
import { trackLocaleSwitched, trackProfileRevisit } from './analytics.js';
import { renderDeckInventory } from './deck-inventory.js';
import { renderAchievementsPanel } from './achievements-panel.js';

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

    const th = state.currentLang === 'th';

    // Privacy policy link.
    const privacyLink = document.createElement('a');
    privacyLink.className = 'profile-privacy-link';
    privacyLink.href = th ? '/th/privacy.html' : '/privacy.html';
    privacyLink.textContent = dict.profilePrivacyLink || (th ? 'นโยบายความเป็นส่วนตัว' : 'Privacy Policy');
    card.appendChild(privacyLink);

    // Delete account — App Store Guideline 5.1.1(v). Two-step inline confirm.
    const deleteWrap = document.createElement('div');
    deleteWrap.className = 'profile-delete-wrap';
    card.appendChild(deleteWrap);

    const renderDeleteTrigger = () => {
      deleteWrap.innerHTML = '';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'profile-delete-trigger';
      btn.textContent = dict.profileDeleteAccount || (th ? 'ลบบัญชี' : 'Delete account');
      btn.addEventListener('click', renderDeleteConfirm);
      deleteWrap.appendChild(btn);
    };

    const renderDeleteConfirm = () => {
      deleteWrap.innerHTML = '';
      const warn = document.createElement('p');
      warn.className = 'profile-delete-warn';
      warn.textContent = dict.profileDeleteConfirmBody
        || (th
          ? 'การลบบัญชีจะลบบัญชีและการดูไพ่ที่บันทึกไว้ทั้งหมดอย่างถาวร ย้อนกลับไม่ได้'
          : 'This permanently deletes your account and all saved readings. This cannot be undone.');
      deleteWrap.appendChild(warn);

      const row = document.createElement('div');
      row.className = 'profile-delete-actions';

      const confirmBtn = document.createElement('button');
      confirmBtn.type = 'button';
      confirmBtn.className = 'profile-delete-confirm';
      confirmBtn.textContent = dict.profileDeleteConfirmYes || (th ? 'ยืนยันลบบัญชี' : 'Yes, delete');

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.className = 'ghost';
      cancelBtn.textContent = dict.profileDeleteCancel || (th ? 'ยกเลิก' : 'Cancel');
      cancelBtn.addEventListener('click', renderDeleteTrigger);

      confirmBtn.addEventListener('click', async () => {
        confirmBtn.disabled = true;
        cancelBtn.disabled = true;
        confirmBtn.textContent = dict.profileDeleting || (th ? 'กำลังลบ…' : 'Deleting…');
        try {
          await deleteAccount();
          // deleteAccount() signs out → the auth-state listener re-renders to the guest view.
        } catch (_) {
          confirmBtn.disabled = false;
          cancelBtn.disabled = false;
          confirmBtn.textContent = dict.profileDeleteConfirmYes || (th ? 'ยืนยันลบบัญชี' : 'Yes, delete');
          warn.textContent = dict.profileDeleteError || (th ? 'ลบไม่สำเร็จ ลองอีกครั้ง' : 'Could not delete your account. Please try again.');
        }
      });

      row.appendChild(confirmBtn);
      row.appendChild(cancelBtn);
      deleteWrap.appendChild(row);
    };

    renderDeleteTrigger();
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

  // Progress panel (Next: deck + bar + Moonveil-style info box)
  const nextMilestone = getNextStreakMilestone(progress);
  if (nextMilestone) {
    const { target, current, remaining } = nextMilestone;
    const fillPct = Math.max(0, Math.min(100, Math.round((current / target) * 100)));
    const targetDeck = getAllDecks().find((d) => d.unlock_day === target);
    const deckNameEn = targetDeck?.name || '';
    const deckNameTh = targetDeck?.name_th || deckNameEn;
    const deckBlurbEn = targetDeck?.blurb_en || targetDeck?.tagline_en || '';
    const deckBlurbTh = targetDeck?.blurb_th || targetDeck?.tagline_th || '';

    const panel = document.createElement('div');
    panel.className = 'profile-progress-panel';

    const head = document.createElement('div');
    head.className = 'profile-progress-panel__head';

    const headLeft = document.createElement('div');
    const titleEn = document.createElement('div');
    titleEn.className = 'profile-progress-panel__title';
    titleEn.textContent = state.currentLang === 'th'
      ? `สำรับถัดไป · ${deckNameTh}`
      : `Next: ${deckNameEn}`;
    headLeft.appendChild(titleEn);
    // Single-language per locale — no bilingual alt title-th line.
    head.appendChild(headLeft);

    const headRight = document.createElement('div');
    headRight.className = 'profile-progress-panel__remaining';
    const remNum = document.createElement('div');
    remNum.className = 'profile-progress-panel__remaining-num';
    remNum.textContent = String(remaining);
    headRight.appendChild(remNum);
    const remLabel = document.createElement('div');
    remLabel.className = 'profile-progress-panel__remaining-label';
    remLabel.textContent = state.currentLang === 'th' ? 'วันที่เหลือ' : 'days to go';
    headRight.appendChild(remLabel);
    head.appendChild(headRight);

    panel.appendChild(head);

    const bar = document.createElement('div');
    bar.className = 'profile-progress-bar';
    const track = document.createElement('div');
    track.className = 'profile-progress-bar__track';
    const fill = document.createElement('div');
    fill.className = 'profile-progress-bar__fill';
    fill.style.width = `${fillPct}%`;
    const pearl = document.createElement('div');
    pearl.className = 'profile-progress-bar__pearl';
    fill.appendChild(pearl);
    track.appendChild(fill);
    bar.appendChild(track);

    const labels = document.createElement('div');
    labels.className = 'profile-progress-bar__labels';
    const dayCurr = document.createElement('span');
    dayCurr.textContent = state.currentLang === 'th' ? `วันที่ ${current}` : `Day ${current}`;
    labels.appendChild(dayCurr);
    const dayTarget = document.createElement('span');
    dayTarget.textContent = state.currentLang === 'th' ? `วันที่ ${target} · ปลดล็อก` : `Day ${target} · unlock`;
    labels.appendChild(dayTarget);
    bar.appendChild(labels);

    panel.appendChild(bar);

    if (deckBlurbEn || deckBlurbTh) {
      const blurb = document.createElement('div');
      blurb.className = 'profile-progress-panel__blurb';
      const bName = document.createElement('b');
      bName.textContent = state.currentLang === 'th' ? deckNameTh : deckNameEn;
      blurb.appendChild(bName);
      const blurbText = document.createTextNode(' ' + (state.currentLang === 'th' ? (deckBlurbTh || deckBlurbEn) : (deckBlurbEn || deckBlurbTh)));
      blurb.appendChild(blurbText);
      if (deckBlurbTh && state.currentLang !== 'th') {
        const th = document.createElement('div');
        th.className = 'profile-progress-panel__blurb-th';
        th.textContent = deckBlurbTh;
        blurb.appendChild(th);
      }
      panel.appendChild(blurb);
    }

    els.streak.appendChild(panel);
  }
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
      en: 'Readings shared',
      th: 'แชร์แล้ว',
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

// "Other" — deactivate (local journey reset). Distinct from the account-delete
// in the identity card: this only clears local streak/progress on this device.
function renderOther(dict) {
  const host = document.getElementById('profile-other');
  if (!host) return;
  host.innerHTML = '';
  const th = state.currentLang === 'th';

  const card = document.createElement('section');
  card.className = 'panel profile-other';

  const title = document.createElement('h2');
  title.textContent = dict.profileOtherTitle || (th ? 'อื่น ๆ' : 'Other');
  card.appendChild(title);

  const wrap = document.createElement('div');
  wrap.className = 'profile-other__wrap';
  card.appendChild(wrap);

  const renderTrigger = () => {
    wrap.innerHTML = '';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'profile-deactivate-trigger';
    btn.textContent = dict.profileDeactivate || (th ? 'ปิดการใช้งานบัญชี' : 'Deactivate account');
    btn.addEventListener('click', renderConfirm);
    wrap.appendChild(btn);
  };

  const renderConfirm = () => {
    wrap.innerHTML = '';
    const warn = document.createElement('p');
    warn.className = 'profile-deactivate-warn';
    warn.textContent = dict.profileDeactivateConfirm
      || (th ? 'สตรีคและความคืบหน้าทั้งหมดบนเครื่องนี้จะถูกลบ แน่ใจไหม?' : 'All your streak and progress on this device will be deleted. Are you sure?');
    wrap.appendChild(warn);

    const row = document.createElement('div');
    row.className = 'profile-deactivate-actions';
    const yes = document.createElement('button');
    yes.type = 'button';
    yes.className = 'profile-deactivate-confirm';
    yes.textContent = dict.profileDeactivateYes || (th ? 'ยืนยัน ลบทั้งหมด' : 'Yes, delete it');
    const no = document.createElement('button');
    no.type = 'button';
    no.className = 'ghost';
    no.textContent = dict.profileDeleteCancel || (th ? 'ยกเลิก' : 'Cancel');
    no.addEventListener('click', renderTrigger);
    yes.addEventListener('click', () => {
      try { resetLocalProgress(); } catch (_) {}
      renderAll();
    });
    row.appendChild(yes);
    row.appendChild(no);
    wrap.appendChild(row);
  };

  renderTrigger();
  host.appendChild(card);
}

async function renderAll(dict = translations[state.currentLang] || translations.en) {
  await refreshCardNameMap();
  await refreshHistory();
  renderIdentity(dict);
  renderStreak(dict);
  const progress = getUserProgress();
  const deckInvEl = document.getElementById('profile-deck-inventory');
  if (deckInvEl) {
    renderDeckInventory(deckInvEl, progress, dict, state.currentLang, () => renderAll());
    // Phase 5: "View all decks" CTA below the horizontal strip routes
    // to the standalone /decks.html page (ScreenDeckInventory).
    const seeAll = document.createElement('a');
    seeAll.className = 'profile-deck-see-all';
    seeAll.href = localizePath('/decks.html', state.currentLang);
    // EN-only on EN site / TH-only on TH site — drop the bilingual alt.
    const seeAllEn = document.createElement('span');
    seeAllEn.className = 'profile-deck-see-all__en';
    seeAllEn.textContent = state.currentLang === 'th' ? 'ดูสำรับทั้งหมด' : 'View all decks';
    seeAll.appendChild(seeAllEn);
    deckInvEl.appendChild(seeAll);
  }
  renderLifetimeStats(dict);
  const achieveEl = document.getElementById('profile-achievements');
  if (achieveEl) renderAchievementsPanel(achieveEl, progress, dict, state.currentLang);
  renderHistory(dict);
  renderContact(dict);
  renderOther(dict);
  renderLoginCta(dict);
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
