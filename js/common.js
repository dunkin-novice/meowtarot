import { renderNavbar } from './components/navbar.js';
import { renderFooter } from './components/footer.js';

// Shared translations across all pages.
export const translations = {
  en: {
    navHome: 'Home',
    navDaily: 'Daily Fortune',
    navOverall: 'Full Reading',
    navQuestion: 'Ask a Question',
    navMeanings: 'Card Meanings',
    heroTagline: 'Daily guidance and full spreads, led by curious cats.',
    fortuneTeller: 'Fortune Teller',
    languageLabel: 'Language',
    landingIntro:
      'Pick a mode: Daily Reading gives a single card of the day. Full Reading explores a 10-card Celtic Cross spread. Ask a Question uses a focused 3-card Past / Present / Future answer in your chosen topic.',
    startReadingCta: 'Start your reading',
    homeDailyCta: 'Daily Reading',
    homeOverallCta: 'Full Reading',
    homeQuestionCta: 'Ask a Question',
    ctaDaily: 'Daily Reading',
    ctaOverall: 'Full Reading',
    ctaQuestion: 'Ask a Question',
    dailyTitle: 'Daily Reading',
    dailyDesc: 'Tap once a day to reveal today’s cat-guided message.',
    dailyDraw: 'Draw your card for today',
    dailyRedraw: 'Draw for today',
    todayReminder: 'One card per device per day. Your card will stay pinned here.',
    overallTitle: 'Celtic Cross',
    overallShortDesc: 'Draw 10 cards for a complete Celtic Cross reading.',
    overallDesc: 'Reveal a 10-card Celtic Cross spread for the bigger picture around your question or life path.',
    overallStartCta: 'Start Celtic Cross reading',
    questionTitle: 'Ask a Question',
    questionDesc: '3-card reading · Past · Present · Future',
    questionLead: 'Bring one question close to your heart. Choose a topic first, then draw 3 cards for Past · Present · Future guidance.',
    questionPromptTitle: 'Set your intention first',
    questionPromptBody: 'Ask about one situation only. The clearer your question, the more resonant your reading will feel.',
    questionStepTopic: '1. Choose the part of life you want insight on.',
    questionStepDraw: '2. Draw 3 cards to reveal the emotional arc of your situation.',
    questionStepRead: '3. Read your Past · Present · Future message and takeaway.',
    questionTopicSelectionTitle: 'Choose a topic for your reading',
    questionTopicSelectionBody: 'Start with the part of life you want insight on. This topic list is ready to grow as more reading paths are added.',
    questionSelectedTopicLabel: 'Chosen topic',
    questionTopicLabel: 'Topic',
    questionResultKicker: 'Ask a Question · {topic}',
    questionResultContext: 'Your cards trace the emotional movement around this question from what shaped it to what comes next.',
    questionTopicPanelTitle: '{topic} perspective',
    questionTakeawayTitle: 'Your takeaway',
    questionTakeawayLead: 'Taken together, your cards suggest {summary}',
    questionShareTitle: 'Ask a Question · {topic}',
    questionShareSubtitle: 'Past · Present · Future insight',
    sharePromptTitle: 'Your shareable poster is ready',
    sharePromptBody: 'Save it for yourself or post it while the message still feels fresh.',
    meaningTitle: 'Tarot Cards Meaning',
    meaningDesc: 'Preview a few cards from the MeowTarot deck. Full guide coming soon.',
    start: 'Start',
    startQuestion: 'Start Question Reading',
    instruction: 'Focus on your question and pick 3 cards.',
    contextDaily: '',
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
    readingSubtitle: '10-card spread · Celtic Cross',
    shareFallback: 'Link copied!',
    spreadQuick: 'Quick Answer (1 card)',
    spreadStory: 'Story Mode (3 cards)',
    topicGeneric: 'Any question',
    topicLove: 'Love',
    topicCareer: 'Career',
    topicFinance: 'Finance',
    topicOther: 'Other',
    topicSelf: 'Self',
    topicFamily: 'Family',
    topicTravel: 'Travel',
    topicHealth: 'Health & well-being',
    topicLoveDesc: 'Relationships, feelings, connection, and emotional clarity.',
    topicCareerDesc: 'Work direction, decisions, ambition, and next steps.',
    topicFinanceDesc: 'Money choices, stability, opportunities, and resources.',
    topicOtherDesc: 'A flexible space for any other question on your mind.',
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
    affirmation: 'Archetype',
    ritual: 'Ritual',
    breathPattern: 'Breath pattern',
    journalPrompt: 'Journal prompt',
    colorsTitle: 'Colors of the day',
    powerColor: 'Power color',
    drainingColor: 'Draining color',
    overallReadingLabel: 'Full reading',
    questionSpreadNote: 'Past · Present · Future',
    missingSelection: 'No cards were found. Please draw your cards first to see the reading.',
    loveMetaYesNo: 'Love answer tendency',
    loveMetaDecision: 'Love advice',
    loveMetaTiming: 'Timing for love',
    loveActionHeading: 'What to do about this love situation',
    careerActionHeading: 'Career guidance',
    financeActionHeading: 'Financial guidance',
    readingSummaryTitle: 'Your fortune today',
    yourFortuneTitle: 'Your Fortune',
    energyTitle: 'Energy Balance',
    energyFire: 'Fire',
    energyWater: 'Water',
    energyAir: 'Air',
    energyEarth: 'Earth',
    metaZodiac: 'Zodiac',
    suggestionTitle: 'Suggestion',
    guidanceHeading: 'Guidance',
    ritualNudgeTitle: 'Take a breath first',
    ritualNudgeBody: 'Hold your question in mind before drawing',
    celticCrossEyebrow: 'Full Reading',
    celticCrossTitle: 'Celtic Cross',
    celticCrossNextStep: 'Your next step',
    celticCrossHoldEnergy: 'Hold this energy',
    celticCrossAskYourself: 'Ask yourself',
    positionPresent: 'The Present',
    positionChallenge: 'The Challenge',
    positionPast: 'The Past',
    positionFuture: 'The Future',
    positionAbove: 'Above',
    positionBelow: 'Below',
    positionAdvice: 'Advice',
    positionExternal: 'External Influences',
    positionHopes: 'Hopes & Fears',
    positionOutcome: 'Outcome',
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
      'เลือกโหมดที่ต้องการ: ดูดวงรายวันคือไพ่ใบเดียวประจำวัน ดูดวงชีวิตใช้ไพ่ 10 ใบแบบเซลติกครอส ถามคำถามจะใช้ไพ่ 3 ใบ อดีต / ปัจจุบัน / อนาคต ตามหัวข้อที่เลือก',
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
    overallTitle: 'เซลติกครอส',
    overallShortDesc: 'ดึงไพ่ 10 ใบเพื่ออ่านแบบเซลติกครอสอย่างเต็มรูปแบบ',
    overallDesc: 'เปิดไพ่เซลติกครอส 10 ใบเพื่อดูภาพรวมที่ลึกขึ้นของคำถามหรือเส้นทางชีวิตของคุณ',
    overallStartCta: 'เริ่มดูเซลติกครอส',
    questionTitle: 'ถามคำถาม',
    questionDesc: 'ไพ่ 3 ใบ · อดีต · ปัจจุบัน · อนาคต',
    questionLead: 'โอบคำถามไว้ในใจ เลือกหัวข้อก่อน แล้วสุ่มไพ่ 3 ใบเพื่อดูคำแนะนำแบบ อดีต · ปัจจุบัน · อนาคต',
    questionPromptTitle: 'ตั้งเจตนาก่อนหยิบไพ่',
    questionPromptBody: 'ถามเพียงหนึ่งสถานการณ์ให้ชัดเจน ยิ่งคำถามเฉพาะเจาะจง คำทำนายก็ยิ่งสะท้อนใจมากขึ้น',
    questionStepTopic: '1. เลือกเรื่องในชีวิตที่อยากขอคำแนะนำ',
    questionStepDraw: '2. หยิบไพ่ 3 ใบเพื่อเปิดเส้นเรื่องของสถานการณ์นี้',
    questionStepRead: '3. อ่านข้อความ อดีต · ปัจจุบัน · อนาคต พร้อมข้อสรุปสำคัญ',
    questionTopicSelectionTitle: 'เลือกหัวข้อสำหรับการดูดวงครั้งนี้',
    questionTopicSelectionBody: 'เริ่มจากเรื่องในชีวิตที่อยากได้คำแนะนำก่อน โครงสร้างนี้ออกแบบให้เพิ่มหัวข้อใหม่ได้ง่ายในอนาคต',
    questionSelectedTopicLabel: 'หัวข้อที่เลือก',
    questionTopicLabel: 'หัวข้อ',
    questionResultKicker: 'ถามคำถาม · {topic}',
    questionResultContext: 'ไพ่ทั้งสามใบกำลังเล่าเส้นทางอารมณ์ของคำถามนี้ ตั้งแต่สิ่งที่ก่อร่าง ไปจนถึงสิ่งที่กำลังเคลื่อนไปข้างหน้า',
    questionTopicPanelTitle: 'มุมมองเรื่อง{topic}',
    questionTakeawayTitle: 'ข้อสรุปสำคัญ',
    questionTakeawayLead: 'เมื่อมองรวมกัน ไพ่ของคุณกำลังบอกว่า {summary}',
    questionShareTitle: 'ถามคำถาม · {topic}',
    questionShareSubtitle: 'อินไซต์แบบ อดีต · ปัจจุบัน · อนาคต',
    sharePromptTitle: 'โปสเตอร์พร้อมแชร์แล้ว',
    sharePromptBody: 'บันทึกเก็บไว้หรือโพสต์ตอนที่ข้อความนี้ยังรู้สึกชัดกับใจคุณอยู่',
    meaningTitle: 'ความหมายไพ่ทาโรต์',
    meaningDesc: 'ลองดูความหมายของไพ่บางใบจากสำรับ MeowTarot เร็ว ๆ นี้จะมีคู่มือแบบเต็ม',
    start: 'เริ่มดูดวง',
    startQuestion: 'เริ่มดูดวงถามคำถาม',
    instruction: 'โฟกัสที่คำถามในใจ แล้วเลือกไพ่ 3 ใบ',
    contextDaily: '',
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
    readingSubtitle: 'ไพ่ 10 ใบ · เซลติกครอส',
    shareFallback: 'คัดลอกลิงก์',
    spreadQuick: 'คำตอบด่วน (1 ใบ)',
    spreadStory: 'โหมดเรื่องราว (3 ใบ)',
    topicGeneric: 'คำถามทั่วไป',
    topicLove: 'ความรัก',
    topicCareer: 'การงาน',
    topicFinance: 'การเงิน',
    topicOther: 'เรื่องอื่น ๆ',
    topicSelf: 'ตัวเอง',
    topicFamily: 'ครอบครัว',
    topicTravel: 'การเดินทาง',
    topicHealth: 'สุขภาพและความเป็นอยู่',
    topicLoveDesc: 'ความสัมพันธ์ ความรู้สึก การเชื่อมโยง และความชัดเจนทางใจ',
    topicCareerDesc: 'ทิศทางการงาน การตัดสินใจ ความทะเยอทะยาน และก้าวถัดไป',
    topicFinanceDesc: 'การเงิน ความมั่นคง โอกาส และทรัพยากรที่มีอยู่',
    topicOtherDesc: 'พื้นที่ยืดหยุ่นสำหรับคำถามอื่น ๆ ที่อยู่ในใจคุณ',
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
    affirmation: 'ต้นแบบพลังงาน',
    ritual: 'พิธีกรรม',
    breathPattern: 'จังหวะหายใจ',
    journalPrompt: 'ไกด์เขียนบันทึก',
    colorsTitle: 'สีประจำวัน',
    powerColor: 'สีเสริมพลัง',
    drainingColor: 'สีที่ควรเลี่ยง',
    overallReadingLabel: 'คำทำนายชีวิต',
    questionSpreadNote: 'อดีต · ปัจจุบัน · อนาคต',
    missingSelection: 'ยังไม่มีไพ่ที่เลือก โปรดกลับไปหยิบไพ่ก่อนดูคำทำนาย',
    loveMetaYesNo: 'แนวโน้มคำตอบความรัก',
    loveMetaDecision: 'คำแนะนำเรื่องความรัก',
    loveMetaTiming: 'จังหวะเวลาของความรัก',
    loveActionHeading: 'แนวทางดูแลเรื่องความรักนี้',
    careerActionHeading: 'คำแนะนำด้านการงาน',
    financeActionHeading: 'คำแนะนำด้านการเงิน',
    readingSummaryTitle: 'ดวงของคุณวันนี้',
    yourFortuneTitle: 'ดวงของคุณ',
    energyTitle: 'สมดุลพลังงาน',
    energyFire: 'ไฟ',
    energyWater: 'น้ำ',
    energyAir: 'ลม',
    energyEarth: 'ดิน',
    metaZodiac: 'ราศี',
    suggestionTitle: 'คำแนะนำ',
    guidanceHeading: 'คำแนะนำ',
    ritualNudgeTitle: 'หายใจลึกๆ ก่อนนะ',
    ritualNudgeBody: 'ตั้งใจคิดถึงคำถามก่อนหยิบไพ่',
    celticCrossEyebrow: 'อ่านไพ่เต็มรูปแบบ',
    celticCrossTitle: 'เซลติกครอส',
    celticCrossNextStep: 'ก้าวต่อไปของคุณ',
    celticCrossHoldEnergy: 'โอบพลังนี้ไว้',
    celticCrossAskYourself: 'ลองถามตัวเอง',
    positionPresent: 'สถานการณ์ปัจจุบัน',
    positionChallenge: 'ความท้าทาย',
    positionPast: 'อดีต',
    positionFuture: 'อนาคต',
    positionAbove: 'เป้าหมาย',
    positionBelow: 'รากฐาน',
    positionAdvice: 'คำแนะนำ',
    positionExternal: 'อิทธิพลภายนอก',
    positionHopes: 'ความหวังและความกลัว',
    positionOutcome: 'ผลลัพธ์',
  },
};

const LANG_STORAGE_KEY = 'meowtarot_lang';
let navbarCleanup = null;

function normalizeLang(value) {
  return value === 'th' ? 'th' : value === 'en' ? 'en' : null;
}

function getUrlLanguage(locationLike = window.location) {
  const urlLang = normalizeLang(new URLSearchParams(locationLike?.search || '').get('lang'));
  if (urlLang) return urlLang;
  return pathHasThaiPrefix(locationLike?.pathname || '/') ? 'th' : 'en';
}

export function computeLanguageHref(targetLang, locationLike = window.location) {
  const pathname = normalizePathname(locationLike?.pathname || '/');
  const params = new URLSearchParams(locationLike?.search || '');
  if (params.has('lang')) params.set('lang', targetLang);
  const search = params.toString() ? `?${params.toString()}` : '';
  const hash = locationLike?.hash || '';
  const targetPath = localizePath(pathname, targetLang) || (targetLang === 'th' ? '/th/' : '/');
  return `${targetPath}${search}${hash}`;
}

export function switchLang(targetLang) {
  window.location.href = computeLanguageHref(targetLang);
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
  const stored = normalizeLang(localStorage.getItem(LANG_STORAGE_KEY));
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

export function initShell(state, afterApply, activePage, options = {}) {
  const urlLang = getUrlLanguage(window.location);
  const savedLang = getSavedLang('en');
  state.currentLang = normalizeLang(urlLang) || savedLang || 'en';
  localStorage.setItem(LANG_STORAGE_KEY, state.currentLang);

  navbarCleanup?.();
  navbarCleanup = renderNavbar(document.getElementById('site-header'), (lang) => {
    if (lang === state.currentLang) return;
    localStorage.setItem(LANG_STORAGE_KEY, lang);
    if (typeof options?.onLangToggle === 'function') {
      options.onLangToggle(lang);
      return;
    }
    switchLang(lang);
  });
  renderFooter(document.getElementById('site-footer'));
  highlightActiveNav(activePage);
  attachLogoHome();
  applyTranslations(state.currentLang, afterApply);
  applyLocaleMeta(state.currentLang);
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    navbarCleanup?.();
    navbarCleanup = null;
  });
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
