import { renderNavbar } from './components/navbar.js';
import { renderFooter } from './components/footer.js';

// Shared translations across all pages.
export const translations = {
  en: {
    navHome: 'Home',
    navDaily: 'Daily Fortune',
    navOverall: 'Life Reading',
    navQuestion: 'Ask a Question',
    navMeanings: 'Card Meanings',
    heroTagline: 'Daily guidance and full spreads, led by curious cats.',
    fortuneTeller: 'Fortune Teller',
    languageLabel: 'Language',
    landingIntro:
      'Pick a mode: Daily Reading gives a single card of the day. Life Reading explores a 3-card Past / Present / Future story. Ask a Question uses a focused 3-card spread in your chosen topic.',
    startReadingCta: 'Start your reading',
    homeDailyCta: 'Daily Reading',
    homeOverallCta: 'Life Reading',
    homeQuestionCta: 'Ask a Question',
    ctaDaily: 'Daily Reading',
    ctaOverall: 'Life Reading',
    ctaQuestion: 'Ask a Question',
    dailyTitle: 'Daily Reading',
    dailyDesc: 'Tap once a day to reveal today’s cat-guided message.',
    dailyDraw: 'Draw your card for today',
    dailyRedraw: 'Draw for today',
    todayReminder: 'One card per device per day. Your card will stay pinned here.',
    overallTitle: 'Life Reading',
    overallShortDesc: 'Pull 3 cards for your broader life story.',
    overallDesc: 'Draw three cards for a past / present / future storyline about your life.',
    overallStartCta: 'Start life reading',
    questionTitle: 'Ask a Question',
    questionDesc: 'Think of a question, pick a topic, then draw three cards.',
    questionLead: 'Think of a question in your mind, pick a topic, then draw three cards.',
    meaningTitle: 'Tarot Cards Meaning',
    meaningDesc: 'Preview a few cards from the MeowTarot deck. Full guide coming soon.',
    start: 'Start',
    startQuestion: 'Start Question Reading',
    instruction: 'Focus on your question and pick 3 cards.',
    contextDaily: 'Take a deep breath, relax, then start your reading.',
    dailyStartHint: 'Tap Start to spread the cards.',
    contextQuestion: 'Hold your question in your mind before selecting.',
    shuffle: 'Shuffle',
    shuffleCards: 'Shuffle cards',
    continue: 'Continue',
    selectThreeHint: 'Select 3 cards to continue.',
    past: 'Past',
    present: 'Present',
    future: 'Future',
    summaryTitle: 'Overall message',
    summaryPast: 'Your past shows {card} shaping your foundation.',
    summaryPresent: 'Right now you are facing {card} energy.',
    summaryFuture: 'In the future, you may encounter {card}—stay open to the lesson.',
    summaryAdvice: 'Advice: trust your intuition and take one grounded step forward.',
    newReading: 'New Reading',
    share: 'Share',
    save: 'Save as Image',
    yourReading: 'Your MeowTarot Reading',
    readingSubtitle: '3-card spread · Past / Present / Future',
    shareFallback: 'Link copied!',
    spreadQuick: 'Quick Answer (1 card)',
    spreadStory: 'Story Mode (3 cards)',
    topicGeneric: 'Any question',
    topicLove: 'Love',
    topicCareer: 'Career',
    topicFinance: 'Finance',
    drawAnswer: 'Tap to draw your answer',
    drawStory: 'Draw 3 cards',
    metaYesNo: "Today's answer tendency",
    metaDecision: 'Advice',
    metaTiming: 'Timing',
    loveSingles: 'For singles',
    loveCouples: 'For couples',
    careerToday: 'Career today',
    financeToday: 'Money today',
    actionToday: 'Suggestion',
    reflectionToday: 'Reflection',
    affirmation: 'Affirmation',
    ritual: 'Ritual',
    breathPattern: 'Breath pattern',
    journalPrompt: 'Journal prompt',
    colorsTitle: 'Colors of the day',
    powerColor: 'Power color',
    drainingColor: 'Draining color',
    overallReadingLabel: 'Life reading',
    questionSpreadNote: '3-card spread · Past / Present / Future',
    missingSelection: 'No cards were found. Please draw your cards first to see the reading.',
    loveMetaYesNo: 'Love answer tendency',
    loveMetaDecision: 'Love advice',
    loveMetaTiming: 'Timing for love',
    loveActionHeading: 'What to do about this love situation',
    careerActionHeading: 'Career guidance',
    financeActionHeading: 'Financial guidance',
    readingSummaryTitle: 'Your fortune today',
    suggestionTitle: 'Suggestion',
    guidanceHeading: 'Guidance',
  },
  th: {
    navHome: 'หน้าหลัก',
    navDaily: 'ดูดวงรายวัน',
    navOverall: 'ดูดวงชีวิต',
    navQuestion: 'ถามคำถาม',
    navMeanings: 'ความหมายไพ่',
    heroTagline: 'รับคำแนะนำรายวันและสเปรดเต็ม ๆ โดยน้องแมว',
    fortuneTeller: 'หมอดูประจำวัน',
    languageLabel: 'ภาษา',
    landingIntro:
      'เลือกโหมดที่ต้องการ: ดูดวงรายวันคือไพ่ใบเดียวประจำวัน ดูดวงชีวิตใช้ไพ่ 3 ใบ อดีต / ปัจจุบัน / อนาคต ถามคำถามจะใช้ไพ่ 3 ใบตามหัวข้อที่เลือก',
    startReadingCta: 'เริ่มดูดวง',
    homeDailyCta: 'ดูดวงรายวัน',
    homeOverallCta: 'ดูดวงชีวิต',
    homeQuestionCta: 'ถามคำถาม',
    ctaDaily: 'ดูดวงรายวัน',
    ctaOverall: 'ดูดวงชีวิต',
    ctaQuestion: 'ถามคำถาม',
    dailyTitle: 'ดูดวงรายวัน',
    dailyDesc: 'แตะวันละครั้งเพื่อเปิดข้อความนำทางประจำวัน',
    dailyDraw: 'สุ่มไพ่ประจำวันของคุณ',
    dailyRedraw: 'ดึงไพ่สำหรับวันนี้',
    todayReminder: 'หนึ่งใบต่อวันต่ออุปกรณ์ ไพ่ของคุณจะถูกบันทึกไว้ตรงนี้',
    overallTitle: 'ดูดวงชีวิต',
    overallShortDesc: 'หยิบไพ่ 3 ใบ เล่าเรื่องภาพรวมชีวิตของคุณ',
    overallDesc: 'ดึงไพ่ 3 ใบดูเรื่องราวอดีต / ปัจจุบัน / อนาคต ในชีวิตของคุณ',
    overallStartCta: 'เริ่มดูดวงชีวิต 3 ใบ',
    questionTitle: 'ถามคำถาม',
    questionDesc: 'คิดคำถาม เลือกหัวข้อ จากนั้นหยิบไพ่ 3 ใบ',
    questionLead: 'ตั้งใจคิดคำถาม เลือกหัวข้อ จากนั้นสุ่มไพ่ 3 ใบเพื่อรับคำทำนาย',
    meaningTitle: 'ความหมายไพ่ทาโรต์',
    meaningDesc: 'ลองดูความหมายของไพ่บางใบจากสำรับ MeowTarot เร็ว ๆ นี้จะมีคู่มือแบบเต็ม',
    start: 'เริ่มดูดวง',
    startQuestion: 'เริ่มดูดวงถามคำถาม',
    instruction: 'โฟกัสที่คำถามในใจ แล้วเลือกไพ่ 3 ใบ',
    contextDaily: 'หายใจลึก ๆ ผ่อนคลาย แล้วเริ่มดูไพ่',
    dailyStartHint: 'แตะปุ่มเริ่มเพื่อกระจายไพ่',
    contextQuestion: 'ตั้งใจที่คำถามก่อนเลือกไพ่',
    shuffle: 'สับไพ่ใหม่',
    shuffleCards: 'สับไพ่ใหม่',
    continue: 'ดูคำทำนาย',
    selectThreeHint: 'เลือกไพ่ให้ครบ 3 ใบก่อนดำเนินการต่อ',
    past: 'อดีต',
    present: 'ปัจจุบัน',
    future: 'อนาคต',
    summaryTitle: 'สาระสำคัญ',
    summaryPast: 'ในอดีตของคุณมีพลังของ {card} หล่อหลอมพื้นฐาน',
    summaryPresent: 'ตอนนี้คุณกำลังพบเจอพลังงานของ {card}',
    summaryFuture: 'ในอนาคต คุณอาจได้เจอ {card} จงเปิดใจเรียนรู้',
    summaryAdvice: 'คำแนะนำ: เชื่อสัญชาตญาณและค่อย ๆ ก้าวไปอย่างมั่นคง',
    newReading: 'ดูดวงใหม่อีกครั้ง',
    share: 'แชร์คำทำนายนี้',
    save: 'บันทึกเป็นรูปภาพ',
    yourReading: 'ผลการดูดวง MeowTarot',
    readingSubtitle: 'ไพ่ 3 ใบ · อดีต / ปัจจุบัน / อนาคต',
    shareFallback: 'คัดลอกลิงก์',
    spreadQuick: 'คำตอบด่วน (1 ใบ)',
    spreadStory: 'โหมดเรื่องราว (3 ใบ)',
    topicGeneric: 'คำถามทั่วไป',
    topicLove: 'ความรัก',
    topicCareer: 'การงาน',
    topicFinance: 'การเงิน',
    drawAnswer: 'แตะเพื่อดึงคำตอบ',
    drawStory: 'ดึงไพ่ 3 ใบ',
    metaYesNo: 'แนวโน้มคำตอบวันนี้',
    metaDecision: 'คำแนะนำ',
    metaTiming: 'จังหวะเวลา',
    loveSingles: 'สำหรับคนโสด',
    loveCouples: 'สำหรับคนมีคู่',
    careerToday: 'การงานวันนี้',
    financeToday: 'การเงินวันนี้',
    actionToday: 'คำแนะนำ',
    reflectionToday: 'คำถามชวนคิด',
    affirmation: 'ถ้อยยืนยันพลังใจ',
    ritual: 'พิธีกรรม',
    breathPattern: 'จังหวะหายใจ',
    journalPrompt: 'ไกด์เขียนบันทึก',
    colorsTitle: 'สีประจำวัน',
    powerColor: 'สีเสริมพลัง',
    drainingColor: 'สีที่ควรเลี่ยง',
    overallReadingLabel: 'คำทำนายชีวิต',
    questionSpreadNote: 'ไพ่ 3 ใบ · อดีต / ปัจจุบัน / อนาคต',
    missingSelection: 'ยังไม่มีไพ่ที่เลือก โปรดกลับไปหยิบไพ่ก่อนดูคำทำนาย',
    loveMetaYesNo: 'แนวโน้มคำตอบความรัก',
    loveMetaDecision: 'คำแนะนำเรื่องความรัก',
    loveMetaTiming: 'จังหวะเวลาของความรัก',
    loveActionHeading: 'แนวทางดูแลเรื่องความรักนี้',
    careerActionHeading: 'คำแนะนำด้านการงาน',
    financeActionHeading: 'คำแนะนำด้านการเงิน',
    readingSummaryTitle: 'ดวงของคุณวันนี้',
    suggestionTitle: 'คำแนะนำ',
    guidanceHeading: 'คำแนะนำ',
  },
};

const LANG_STORAGE_KEY = 'meowtarot_lang';

export function switchLang(targetLang) {
  const { pathname, search } = window.location;
  const isThai = pathname.startsWith('/th');
  const base = isThai ? pathname.replace(/^\/th/, '') || '/' : pathname || '/';

  let newPath;
  if (targetLang === 'th') {
    newPath = '/th' + (base === '/' ? '/' : base);
  } else {
    newPath = base === '/' ? '/' : base;
  }

  window.location.href = newPath + search;
}

function normalizePathname(pathname = '/') {
  if (!pathname || pathname === '/') return '/';
  if (pathname === '/index.html') return '/';
  if (pathname === '/th' || pathname === '/th/') return '/th/';
  if (pathname === '/th/index.html') return '/th/';
  return pathname;
}

export function pathHasThaiPrefix(pathname = '') {
  const normalized = normalizePathname(pathname);
  return normalized === '/th/' || normalized.startsWith('/th/');
}

export function stripThaiPrefix(pathname = '') {
  const normalized = normalizePathname(pathname);
  if (normalized === '/th/') return '/';
  if (normalized.startsWith('/th/')) return normalized.replace(/^\/th/, '') || '/';
  return normalized || '/';
}

export function localizePath(pathname = '/', lang = 'en') {
  const normalized = stripThaiPrefix(pathname.startsWith('/') ? pathname : `/${pathname}`);
  if (lang === 'th') {
    if (normalized === '/') return '/th/';
    return `/th${normalized}`;
  }
  return normalized || '/';
}

function updateLink(rel, href, hreflang) {
  if (!href) return;
  let selector = `link[rel="${rel}"]`;
  if (hreflang) selector += `[hreflang="${hreflang}"]`;
  let link = document.head.querySelector(selector);
  if (!link) {
    link = document.createElement('link');
    link.rel = rel;
    if (hreflang) link.hreflang = hreflang;
    document.head.appendChild(link);
  }
  link.href = href;
}

export function applyLocaleMeta(currentLang = 'en') {
  const base = 'https://www.meowtarot.com';
  const pathname = normalizePathname(window.location?.pathname || '/');
  const cleanPath = stripThaiPrefix(pathname);

  const enHref = new URL(cleanPath || '/', base).toString();
  const thHref = new URL(localizePath(cleanPath || '/', 'th'), base).toString();

  const canonical = currentLang === 'th' ? thHref : enHref;
  updateLink('canonical', canonical);
  updateLink('alternate', enHref, 'en');
  updateLink('alternate', thHref, 'th-TH');
  updateLink('alternate', enHref, 'x-default');
}

function getSavedLang(defaultLang = 'en') {
  const stored = localStorage.getItem(LANG_STORAGE_KEY);
  return stored || defaultLang;
}

export function applyTranslations(currentLang = 'en', afterApply) {
  const dict = translations[currentLang] || translations.en;
  document.documentElement.lang = currentLang;
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.dataset.i18n;
    if (dict[key]) node.textContent = dict[key];
  });
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    const isActive = btn.dataset.lang === currentLang;
    btn.classList.toggle('active', isActive);
    btn.setAttribute('aria-pressed', isActive);
    btn.setAttribute('aria-selected', isActive);
  });
  afterApply?.(dict);
}

export function initShell(state, afterApply, activePage) {
  const pathLang = window.location.pathname.startsWith('/th') ? 'th' : 'en';
  state.currentLang = pathLang;

  renderNavbar(document.getElementById('site-header'), (lang) => {
    if (lang === state.currentLang) return;
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    switchLang(lang);
  });
  renderFooter(document.getElementById('site-footer'));
  highlightActiveNav(activePage);
  attachLogoHome();
  applyTranslations(state.currentLang, afterApply);
  applyLocaleMeta(state.currentLang);
}

function highlightActiveNav(activePage) {
  if (!activePage) return;
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.page === activePage);
  });
}

function attachLogoHome() {
  document.querySelectorAll('[data-logo]').forEach((logo) => {
    logo.addEventListener('click', (e) => {
      const isThai = location.pathname.startsWith('/th');
      const homePath = isThai ? '/th/' : '/';
      if (location.pathname === homePath || location.pathname.endsWith('/index.html')) return;
      e.preventDefault();
      window.location.href = homePath;
    });
  });
}
