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
    actionToday: 'Action for today',
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
    actionToday: 'แนวทางปฏิบัติ',
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
  },
};

const LANG_STORAGE_KEY = 'meowtarot_lang';

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
  const savedLang = getSavedLang(state.currentLang || 'en');
  state.currentLang = savedLang;

  renderNavbar(document.getElementById('site-header'), (lang) => {
    state.currentLang = lang;
    localStorage.setItem(LANG_STORAGE_KEY, state.currentLang);
    applyTranslations(state.currentLang, afterApply);
  });
  renderFooter(document.getElementById('site-footer'));
  highlightActiveNav(activePage);
  attachLogoHome();
  applyTranslations(state.currentLang, afterApply);
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
      if (location.pathname.endsWith('index.html') || location.pathname === '/') return;
      e.preventDefault();
      window.location.href = 'index.html';
    });
  });
}
