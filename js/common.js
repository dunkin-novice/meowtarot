import { renderNavbar } from './components/navbar.js';
import { renderFooter } from './components/footer.js';

// Shared translations across all pages.
export const translations = {
  en: {
    navHome: 'Home',
    navDaily: 'Daily Fortune',
    navOverall: 'Overall Reading',
    navQuestion: 'Ask a Question',
    navMeanings: 'Tarot Cards Meaning',
    heroTagline: 'Let the cards (and the cats) guide your day.',
    fortuneTeller: 'Fortune Teller',
    languageLabel: 'Language',
    landingIntro:
      'Past • Present • Future in a single shuffle. MeowTarot blends playful charm with clear, calm guidance.',
    startReadingCta: 'Start your reading',
    ctaDaily: 'Daily Reading',
    ctaOverall: 'Overall Reading',
    ctaQuestion: 'Ask a Question',
    dailyTitle: 'Daily Reading',
    dailyDesc: 'Tap once a day to reveal today’s cat-guided message.',
    dailyDraw: 'Tap to draw your daily card',
    dailyRedraw: 'Draw for today',
    todayReminder: 'One card per device per day. Your card will stay pinned here.',
    overallTitle: 'Overall Reading',
    overallDesc: 'Draw three cards for a past / present / future storyline.',
    questionTitle: 'Ask a Question',
    questionDesc: 'Think of a question, pick a topic, then draw either one or three cards.',
    meaningTitle: 'Tarot Cards Meaning',
    meaningDesc: 'Preview a few cards from the MeowTarot deck. Full guide coming soon.',
    start: 'Start',
    startQuestion: 'Start Question Reading',
    instruction: 'Focus on your question and pick 3 cards.',
    contextDaily: 'Take a deep breath, relax, then start your reading.',
    contextQuestion: 'Hold your question in your mind before selecting.',
    shuffle: 'Shuffle',
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
    quickAnswer: 'Quick Answer (1 card)',
    storyMode: 'Story Mode (3 cards)',
    topicAny: 'Any question',
    topicLove: 'Love',
    topicCareer: 'Career',
    topicFinance: 'Finance',
    topicOther: 'Other',
    questionHint: 'You can type your question here (optional).',
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
  },
  th: {
    navHome: 'หน้าหลัก',
    navDaily: 'ดูดวงรายวัน',
    navOverall: 'ดูดวงภาพรวม',
    navQuestion: 'ถามคำถาม',
    navMeanings: 'ความหมายไพ่ทาโรต์',
    heroTagline: 'ให้ไพ่ (และน้องแมว) ช่วยบอกทางให้คุณในวันนี้',
    fortuneTeller: 'หมอดูประจำวัน',
    languageLabel: 'ภาษา',
    landingIntro:
      'อดีต • ปัจจุบัน • อนาคต ในการสับไพ่ครั้งเดียว MeowTarot ผสมความน่ารักกับคำแนะนำที่ชัดเจนและสงบ',
    startReadingCta: 'เริ่มดูดวง',
    ctaDaily: 'ดูดวงรายวัน',
    ctaOverall: 'ดูดวงภาพรวม',
    ctaQuestion: 'ถามคำถาม',
    dailyTitle: 'ดูดวงรายวัน',
    dailyDesc: 'แตะวันละครั้งเพื่อเปิดข้อความนำทางประจำวัน',
    dailyDraw: 'แตะเพื่อดึงไพ่ประจำวัน',
    dailyRedraw: 'ดึงไพ่สำหรับวันนี้',
    todayReminder: 'หนึ่งใบต่อวันต่ออุปกรณ์ ไพ่ของคุณจะถูกบันทึกไว้ตรงนี้',
    overallTitle: 'ดูดวงภาพรวม',
    overallDesc: 'ดึงไพ่ 3 ใบดูเรื่องราวอดีต / ปัจจุบัน / อนาคต',
    questionTitle: 'ถามคำถาม',
    questionDesc: 'คิดคำถาม เลือกหัวข้อ จากนั้นเลือกดู 1 หรือ 3 ใบได้ในหน้าเดียว',
    meaningTitle: 'ความหมายไพ่ทาโรต์',
    meaningDesc: 'ลองดูความหมายของไพ่บางใบจากสำรับ MeowTarot เร็ว ๆ นี้จะมีคู่มือแบบเต็ม',
    start: 'เริ่มดูดวง',
    startQuestion: 'เริ่มดูดวงถามคำถาม',
    instruction: 'โฟกัสที่คำถามในใจ แล้วเลือกไพ่ 3 ใบ',
    contextDaily: 'หายใจลึก ๆ ผ่อนคลาย แล้วเริ่มดูไพ่',
    contextQuestion: 'ตั้งใจที่คำถามก่อนเลือกไพ่',
    shuffle: 'สับไพ่ใหม่',
    continue: 'ไปต่อ',
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
    quickAnswer: 'คำตอบด่วน (1 ใบ)',
    storyMode: 'โหมดเรื่องราว (3 ใบ)',
    topicAny: 'คำถามทั่วไป',
    topicLove: 'ความรัก',
    topicCareer: 'การงาน',
    topicFinance: 'การเงิน',
    topicOther: 'อื่น ๆ',
    questionHint: 'คุณพิมพ์คำถามได้ที่นี่ (ไม่บังคับ)',
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
  },
};

export function applyTranslations(currentLang = 'en', afterApply) {
  const dict = translations[currentLang] || translations.en;
  document.documentElement.lang = currentLang;
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.dataset.i18n;
    if (dict[key]) node.textContent = dict[key];
  });
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });
  afterApply?.(dict);
}

export function initShell(state, afterApply, activePage) {
  renderNavbar(document.getElementById('site-header'), (lang) => {
    state.currentLang = lang;
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
