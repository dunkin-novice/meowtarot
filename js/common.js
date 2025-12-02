import { renderNavbar } from './components/navbar.js';
import { renderFooter } from './components/footer.js';

// Shared translations across all pages.
export const translations = {
  en: {
    navHome: 'Home',
    navDaily: 'Daily Fortune',
    navQuestion: 'Ask a Question',
    navMeanings: 'Tarot Cards Meaning',
    heroTagline: 'Let the cards (and the cats) guide your day.',
    fortuneTeller: 'Fortune Teller',
    languageLabel: 'Language',
    dailyTitle: 'Daily Fortune',
    dailyDesc: 'A quick pulse check for your day. Pull three cards to see today’s energy.',
    questionTitle: 'Ask a Question',
    questionDesc: 'Hold a question in your mind, then draw your past-present-future spread for clarity.',
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
    summaryTitle: 'Overall Reading',
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
    landingIntro: 'Past • Present • Future in a single shuffle. MeowTarot blends playful charm with clear, calm guidance.',
    startReadingCta: 'Start your reading',
  },
  th: {
    navHome: 'หน้าหลัก',
    navDaily: 'ดูดวงรายวัน',
    navQuestion: 'ถามคำถาม',
    navMeanings: 'ความหมายไพ่ทาโรต์',
    heroTagline: 'ให้ไพ่ (และน้องแมว) ช่วยบอกทางให้คุณในวันนี้',
    fortuneTeller: 'หมอดูประจำวัน',
    languageLabel: 'ภาษา',
    dailyTitle: 'ดูดวงรายวัน',
    dailyDesc: 'เช็กพลังงานของวันนี้แบบคร่าว ๆ ด้วยการดึงไพ่ 3 ใบ',
    questionTitle: 'ถามคำถาม',
    questionDesc: 'ตั้งคำถามในใจ แล้วดูไพ่ในอดีต-ปัจจุบัน-อนาคตเพื่อหาความชัดเจน',
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
    summaryTitle: 'สรุปคำทำนาย',
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
    landingIntro: 'อดีต • ปัจจุบัน • อนาคต ในการสับไพ่ครั้งเดียว MeowTarot ผสมความน่ารักกับคำแนะนำที่ชัดเจนและสงบ',
    startReadingCta: 'เริ่มดูดวง',
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
