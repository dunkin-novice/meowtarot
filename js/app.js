import { renderNavbar } from './components/navbar.js';
import { renderFooter } from './components/footer.js';

const translations = {
  en: {
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
  },
  th: {
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
  },
};

const tarotCards = [
  { id: 'MAJ_00', name_en: 'The Fool', name_th: 'ไพ่คนโง่', meaning_en: 'New beginnings, spontaneity, a leap of faith.', meaning_th: 'การเริ่มต้นใหม่ ความกล้า การก้าวกระโดดด้วยศรัทธา' },
  { id: 'MAJ_01', name_en: 'The Magician', name_th: 'ไพ่จอมเวท', meaning_en: 'Manifestation, skill, resourcefulness.', meaning_th: 'พลังสร้างสรรค์ ความสามารถ และทรัพยากรครบถ้วน' },
  { id: 'MAJ_02', name_en: 'The High Priestess', name_th: 'ไพ่สตรีนักบวช', meaning_en: 'Intuition, mystery, inner wisdom.', meaning_th: 'สัญชาตญาณ ความลับ ปัญญาภายใน' },
  { id: 'MAJ_03', name_en: 'The Empress', name_th: 'ไพ่จักรพรรดินี', meaning_en: 'Nurturing, abundance, creativity.', meaning_th: 'ความอุดมสมบูรณ์ การโอบอุ้ม ความคิดสร้างสรรค์' },
  { id: 'MAJ_04', name_en: 'The Emperor', name_th: 'ไพ่จักรพรรดิ', meaning_en: 'Structure, leadership, stability.', meaning_th: 'ความเป็นผู้นำ โครงสร้าง ความมั่นคง' },
  { id: 'MAJ_05', name_en: 'The Hierophant', name_th: 'ไพ่พระสังฆราช', meaning_en: 'Tradition, guidance, spiritual wisdom.', meaning_th: 'ประเพณี คำแนะนำ ความรู้ทางจิตวิญญาณ' },
  { id: 'MAJ_06', name_en: 'The Lovers', name_th: 'ไพ่คนรัก', meaning_en: 'Connection, harmony, choices of the heart.', meaning_th: 'ความรัก ความลงตัว การตัดสินใจจากหัวใจ' },
  { id: 'MAJ_07', name_en: 'The Chariot', name_th: 'ไพ่รถศึก', meaning_en: 'Momentum, determination, victory.', meaning_th: 'แรงผลักดัน ความมุ่งมั่น ความสำเร็จ' },
  { id: 'MAJ_08', name_en: 'Strength', name_th: 'ไพ่พลังภายใน', meaning_en: 'Courage, patience, gentle power.', meaning_th: 'ความกล้าหาญ ความอดทน พลังที่อ่อนโยน' },
  { id: 'MAJ_09', name_en: 'The Hermit', name_th: 'ไพ่ฤๅษี', meaning_en: 'Introspection, guidance, solitude.', meaning_th: 'การพิจารณาตัวเอง แสงสว่างภายใน ความสงบ' },
  { id: 'MAJ_10', name_en: 'Wheel of Fortune', name_th: 'ไพ่กงล้อแห่งโชคชะตา', meaning_en: 'Cycles, change, destiny turning.', meaning_th: 'วัฏจักร การเปลี่ยนแปลง โชคชะตาเคลื่อน' },
  { id: 'MAJ_11', name_en: 'Justice', name_th: 'ไพ่ยุติธรรม', meaning_en: 'Balance, truth, fair decisions.', meaning_th: 'ความยุติธรรม ความจริง การตัดสินใจที่เที่ยงตรง' },
  { id: 'MAJ_12', name_en: 'The Hanged Man', name_th: 'ไพ่ชายถูกแขวน', meaning_en: 'Perspective, pause, surrender.', meaning_th: 'มุมมองใหม่ การหยุดพัก การปล่อยวาง' },
  { id: 'MAJ_13', name_en: 'Death', name_th: 'ไพ่ความเปลี่ยนแปลง', meaning_en: 'Transformation, endings, rebirth.', meaning_th: 'การเปลี่ยนผ่าน การจบสิ้น การเกิดใหม่' },
  { id: 'MAJ_14', name_en: 'Temperance', name_th: 'ไพ่พอเหมาะพอดี', meaning_en: 'Balance, moderation, harmony.', meaning_th: 'ความพอดี การผสมผสานที่ลงตัว ความสงบ' },
  { id: 'MAJ_15', name_en: 'The Devil', name_th: 'ไพ่ปีศาจ', meaning_en: 'Attachments, temptation, awareness of limits.', meaning_th: 'พันธนาการ สิ่งยั่วยวน การรู้ขอบเขต' },
  { id: 'MAJ_16', name_en: 'The Tower', name_th: 'ไพ่หอคอย', meaning_en: 'Sudden change, revelation, rebuild.', meaning_th: 'การเปลี่ยนแปลงฉับพลัน การตาสว่าง การสร้างใหม่' },
  { id: 'MAJ_17', name_en: 'The Star', name_th: 'ไพ่ดวงดาว', meaning_en: 'Hope, healing, inspiration.', meaning_th: 'ความหวัง การเยียวยา แรงบันดาลใจ' },
  { id: 'MAJ_18', name_en: 'The Moon', name_th: 'ไพ่พระจันทร์', meaning_en: 'Dreams, intuition, the unseen.', meaning_th: 'ความฝัน สัญชาตญาณ สิ่งที่มองไม่เห็น' },
  { id: 'MAJ_19', name_en: 'The Sun', name_th: 'ไพ่ดวงอาทิตย์', meaning_en: 'Joy, clarity, warmth.', meaning_th: 'ความสุข ความชัดเจน ความอบอุ่น' },
  { id: 'MAJ_20', name_en: 'Judgement', name_th: 'ไพ่การตื่นรู้', meaning_en: 'Awakening, evaluation, calling.', meaning_th: 'การตื่นรู้ การทบทวน เสียงเรียกภายใน' },
  { id: 'MAJ_21', name_en: 'The World', name_th: 'ไพ่โลก', meaning_en: 'Completion, integration, wholeness.', meaning_th: 'ความสมบูรณ์ การเชื่อมโยงทั้งหมด ความสำเร็จ' },
];

const state = {
  currentLang: 'en',
  spreadCards: [],
  selectedIds: [],
  reading: [],
  context: 'daily',
};

const cardGrid = document.getElementById('cardGrid');
const resultsGrid = document.getElementById('resultsGrid');
const hintText = document.getElementById('hintText');
const continueBtn = document.getElementById('continueBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const newReadingBtn = document.getElementById('newReadingBtn');
const shareBtn = document.getElementById('shareBtn');
const saveBtn = document.getElementById('saveBtn');
const meaningList = document.getElementById('meaningList');
const summaryContent = document.getElementById('summaryContent');
const resultsSection = document.getElementById('results');
const overlay = document.getElementById('board-overlay');
const selectedCount = document.getElementById('selectedCount');
const contextCopy = document.getElementById('context-copy');

function applyTranslations() {
  const dict = translations[state.currentLang];
  document.documentElement.lang = state.currentLang;
  document.querySelectorAll('[data-i18n]').forEach((node) => {
    const key = node.dataset.i18n;
    if (dict[key]) node.textContent = dict[key];
  });
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === state.currentLang);
  });
  contextCopy.textContent = state.context === 'question' ? dict.contextQuestion : dict.contextDaily;
  renderMeaningList();
  if (state.reading.length === 3) renderResults();
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function prepareSpread(context = state.context) {
  state.context = context;
  state.selectedIds = [];
  state.reading = [];
  state.spreadCards = shuffleArray(tarotCards).slice(0, 15);
  overlay.classList.add('is-hidden');
  renderGrid();
  updateContinueState();
  cardGrid.classList.add('shuffling');
  setTimeout(() => cardGrid.classList.remove('shuffling'), 600);
  contextCopy.textContent = translations[state.currentLang][context === 'question' ? 'contextQuestion' : 'contextDaily'];
  resultsSection.classList.remove('show');
}

function renderGrid() {
  cardGrid.innerHTML = '';
  state.spreadCards.forEach((card) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.dataset.id = card.id;

    const back = document.createElement('div');
    back.className = 'face back card-back';

    const front = document.createElement('div');
    front.className = 'face front';
    front.innerHTML = '<div class="icon">🜚</div><div class="name">MeowTarot</div>';

    cardEl.append(back, front);
    cardEl.addEventListener('click', () => toggleSelect(card.id, cardEl));
    cardGrid.appendChild(cardEl);
  });
}

function toggleSelect(id, el) {
  const already = state.selectedIds.includes(id);
  if (already) {
    state.selectedIds = state.selectedIds.filter((cid) => cid !== id);
    el.classList.remove('selected');
  } else if (state.selectedIds.length < 3) {
    state.selectedIds.push(id);
    el.classList.add('selected');
  }
  updateContinueState();
}

function updateContinueState() {
  const dict = translations[state.currentLang];
  selectedCount.textContent = `${state.selectedIds.length}/3`;
  if (state.selectedIds.length === 3) {
    continueBtn.disabled = false;
    hintText.textContent = '';
  } else {
    continueBtn.disabled = true;
    hintText.textContent = dict.selectThreeHint;
  }
}

function renderResults() {
  const dict = translations[state.currentLang];
  const labels = [dict.past, dict.present, dict.future];
  resultsGrid.innerHTML = '';
  const selectedCards = state.selectedIds.slice(0, 3).map((id) => tarotCards.find((c) => c.id === id));
  state.reading = selectedCards;
  revealSelected();

  selectedCards.forEach((card, idx) => {
    const name = state.currentLang === 'en' ? card.name_en : card.name_th;
    const meaning = state.currentLang === 'en' ? card.meaning_en : card.meaning_th;
    const cardEl = document.createElement('div');
    cardEl.className = 'result-card';
    cardEl.innerHTML = `
      <div class="label">${labels[idx]}</div>
      <h5>${name}</h5>
      <p>${meaning}</p>
    `;
    resultsGrid.appendChild(cardEl);
  });

  summaryContent.innerHTML = '';
  buildSummary(selectedCards).forEach((line) => {
    const p = document.createElement('p');
    p.textContent = line;
    summaryContent.appendChild(p);
  });

  resultsSection.classList.add('show');
  resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function revealSelected() {
  document.querySelectorAll('#cardGrid .card').forEach((cardEl) => {
    const isPicked = state.selectedIds.includes(cardEl.dataset.id);
    const cardData = tarotCards.find((c) => c.id === cardEl.dataset.id);
    if (cardData) {
      const name = state.currentLang === 'en' ? cardData.name_en : cardData.name_th;
      cardEl.querySelector('.front').innerHTML = `<div class="icon">🜂</div><div class="name">${name}</div>`;
    }
    cardEl.classList.toggle('revealed', isPicked);
  });
}

function buildSummary(cards) {
  const dict = translations[state.currentLang];
  const names = cards.map((c) => (state.currentLang === 'en' ? c.name_en : c.name_th));
  return [
    dict.summaryPast.replace('{card}', names[0]),
    dict.summaryPresent.replace('{card}', names[1]),
    dict.summaryFuture.replace('{card}', names[2]),
    dict.summaryAdvice,
  ];
}

function renderMeaningList() {
  meaningList.innerHTML = '';
  tarotCards.slice(0, 6).forEach((card) => {
    const name = state.currentLang === 'en' ? card.name_en : card.name_th;
    const meaning = state.currentLang === 'en' ? card.meaning_en : card.meaning_th;
    const div = document.createElement('div');
    div.className = 'sample-card';
    div.innerHTML = `<h5>${name}</h5><p>${meaning}</p>`;
    meaningList.appendChild(div);
  });
}

function handleShare() {
  const url = window.location.href;
  if (navigator.share) {
    navigator.share({ title: 'MeowTarot', text: translations[state.currentLang].yourReading, url }).catch(() => copyLink(url));
  } else {
    copyLink(url);
  }
}

function copyLink(url) {
  navigator.clipboard.writeText(url).then(() => alert(translations[state.currentLang].shareFallback));
}

function saveImage() {
  html2canvas(resultsSection, { backgroundColor: '#0b102b', scale: 2 }).then((canvas) => {
    const link = document.createElement('a');
    link.download = `meowtarot-reading-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}

function attachLanguageToggle() {
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.currentLang = btn.dataset.lang;
      applyTranslations();
    });
  });
}

function attachStartButtons() {
  document.querySelectorAll('[data-start]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const context = btn.dataset.start;
      prepareSpread(context);
      document.getElementById('daily-board').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

function attachNavHighlight() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setActiveSection(entry.target.id);
        }
      });
    },
    { threshold: 0.4 }
  );

  ['hero', 'daily-fortune', 'ask-question', 'tarot-meanings'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
}

function setActiveSection(id) {
  document.querySelectorAll('.nav-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.section === id);
  });
  document.querySelectorAll('.pill-link').forEach((link) => {
    link.classList.toggle('active', link.dataset.section === id);
  });
}

function initNavbarFooter() {
  renderNavbar(document.getElementById('site-header'), (lang) => {
    state.currentLang = lang;
    applyTranslations();
  });
  renderFooter(document.getElementById('site-footer'));
}

function init() {
  initNavbarFooter();
  attachLanguageToggle();
  attachStartButtons();
  applyTranslations();
  renderMeaningList();
  attachNavHighlight();

  shuffleBtn.addEventListener('click', () => prepareSpread(state.context));
  continueBtn.addEventListener('click', () => {
    if (state.selectedIds.length === 3) renderResults();
  });
  newReadingBtn.addEventListener('click', () => {
    prepareSpread(state.context);
    document.getElementById('daily-board').scrollIntoView({ behavior: 'smooth' });
  });
  shareBtn.addEventListener('click', handleShare);
  saveBtn.addEventListener('click', saveImage);

  document.querySelectorAll('[data-logo]').forEach((logo) => {
    logo.addEventListener('click', (e) => {
      e.preventDefault();
      document.getElementById('hero').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

document.addEventListener('DOMContentLoaded', init);
