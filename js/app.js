const translations = {
  en: {
    heroTagline: "Let the cards (and the cats) guide your day.",
    languageLabel: "Language",
    fortuneTeller: "Fortune Teller",
    ctaDaily: "Daily Fortune",
    ctaAsk: "Ask a Question",
    ctaMeaning: "Tarot Cards Meaning",
    start: "Start",
    dailyFortune: "Daily Fortune",
    dailyFortuneDesc: "A quick pulse check for your day. Pull three cards to see today's energy.",
    askQuestion: "Ask a Question",
    askQuestionDesc: "Hold a question in your mind, then draw your past-present-future spread for clarity.",
    tarotMeaning: "Tarot Cards Meaning",
    tarotMeaningDesc: "Preview a few cards from the MeowTarot deck. Full guide coming soon.",
    instruction: "Focus on your question and pick 3 cards.",
    shuffle: "Shuffle",
    continue: "Continue",
    selectThreeHint: "Select 3 cards to continue.",
    past: "Past",
    present: "Present",
    future: "Future",
    summaryTitle: "Overall Reading",
    summaryPast: "Your past shows {card} shaping your foundation.",
    summaryPresent: "Right now you are facing {card} energy.",
    summaryFuture: "In the future, you may encounter {card}—stay open to the lesson.",
    summaryAdvice: "Advice: trust your intuition and take one grounded step forward.",
    newReading: "New Reading",
    share: "Share",
    save: "Save as Image",
    yourReading: "Your MeowTarot Reading",
    readingSubtitle: "3-card spread · Past / Present / Future",
    readingSaved: "Reading copied to clipboard!",
    shareFallback: "Link copied!",
  },
  th: {
    heroTagline: "ให้ไพ่ (และน้องแมว) ช่วยบอกทางให้คุณในวันนี้",
    languageLabel: "ภาษา",
    fortuneTeller: "หมอดูประจำวัน",
    ctaDaily: "ดูดวงรายวัน",
    ctaAsk: "ถามคำถาม",
    ctaMeaning: "ความหมายไพ่ทาโรต์",
    start: "เริ่มดูดวง",
    dailyFortune: "ดูดวงรายวัน",
    dailyFortuneDesc: "เช็กพลังประจำวัน ดึงไพ่ 3 ใบเพื่อดูจังหวะวันนี้",
    askQuestion: "ถามคำถาม",
    askQuestionDesc: "นึกถึงคำถามในใจ แล้วเปิดไพ่ อดีต-ปัจจุบัน-อนาคต เพื่อหาความชัดเจน",
    tarotMeaning: "ความหมายไพ่ทาโรต์",
    tarotMeaningDesc: "ตัวอย่างความหมายไพ่จากเด็ค MeowTarot คู่มือเต็มกำลังมาเร็ว ๆ นี้",
    instruction: "โฟกัสที่คำถามในใจ แล้วเลือกไพ่ 3 ใบ",
    shuffle: "สับไพ่ใหม่",
    continue: "ไปต่อ",
    selectThreeHint: "เลือกไพ่ให้ครบ 3 ใบก่อนดำเนินการต่อ",
    past: "อดีต",
    present: "ปัจจุบัน",
    future: "อนาคต",
    summaryTitle: "สรุปคำทำนาย",
    summaryPast: "ในอดีตของคุณมีพลังของ {card} หล่อหลอมพื้นฐาน",
    summaryPresent: "ตอนนี้คุณกำลังพบเจอพลังงานของ {card}",
    summaryFuture: "ในอนาคต คุณอาจได้เจอ {card} จงเปิดใจเรียนรู้",
    summaryAdvice: "คำแนะนำ: เชื่อสัญชาตญาณและค่อย ๆ ก้าวไปอย่างมั่นคง",
    newReading: "ดูดวงใหม่อีกครั้ง",
    share: "แชร์คำทำนายนี้",
    save: "บันทึกเป็นรูปภาพ",
    yourReading: "ผลการดูดวง MeowTarot",
    readingSubtitle: "ไพ่ 3 ใบ · อดีต / ปัจจุบัน / อนาคต",
    readingSaved: "คัดลอกลิงก์แล้ว!",
    shareFallback: "คัดลอกลิงก์",
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
};

const readingSection = document.getElementById('reading');
const resultsSection = document.getElementById('results');
const cardGrid = document.getElementById('cardGrid');
const resultsGrid = document.getElementById('resultsGrid');
const hintText = document.getElementById('hintText');
const continueBtn = document.getElementById('continueBtn');
const shuffleBtn = document.getElementById('shuffleBtn');
const startBtn = document.getElementById('startReading');
const newReadingBtn = document.getElementById('newReadingBtn');
const shareBtn = document.getElementById('shareBtn');
const saveBtn = document.getElementById('saveBtn');
const meaningList = document.getElementById('meaningList');
const summaryContent = document.getElementById('summaryContent');

function applyTranslations() {
  const dictionary = translations[state.currentLang];
  document.documentElement.lang = state.currentLang;
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    if (dictionary[key]) {
      el.textContent = dictionary[key];
    }
  });
  document.querySelectorAll('.lang-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.lang === state.currentLang);
  });
  renderMeaningList();
  if (state.reading.length === 3) {
    renderResults();
  }
}

function shuffleArray(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function prepareSpread() {
  state.selectedIds = [];
  state.reading = [];
  state.spreadCards = shuffleArray(tarotCards).slice(0, 15);
  renderGrid();
  updateContinueState();
  readingSection.classList.remove('is-hidden');
  resultsSection.classList.remove('show');
  resultsSection.classList.add('is-hidden');
  cardGrid.classList.add('shuffling');
  setTimeout(() => cardGrid.classList.remove('shuffling'), 600);
}

function renderGrid() {
  cardGrid.innerHTML = '';
  state.spreadCards.forEach((card) => {
    const cardEl = document.createElement('div');
    cardEl.className = 'card';
    cardEl.dataset.id = card.id;
    cardEl.addEventListener('click', () => toggleSelect(card.id, cardEl));
    if (state.selectedIds.includes(card.id)) {
      cardEl.classList.add('selected');
    }
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
  const dictionary = translations[state.currentLang];
  if (state.selectedIds.length === 3) {
    continueBtn.disabled = false;
    hintText.textContent = '';
  } else {
    continueBtn.disabled = true;
    hintText.textContent = dictionary.selectThreeHint;
  }
}

function renderResults() {
  const dictionary = translations[state.currentLang];
  const labels = [dictionary.past, dictionary.present, dictionary.future];
  resultsGrid.innerHTML = '';
  const selectedCards = state.selectedIds
    .slice(0, 3)
    .map((id) => tarotCards.find((c) => c.id === id));
  state.reading = selectedCards;

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
  const summaries = buildSummary(selectedCards);
  summaries.forEach((text) => {
    const p = document.createElement('p');
    p.textContent = text;
    summaryContent.appendChild(p);
  });

  resultsSection.classList.remove('is-hidden');
  resultsSection.classList.add('show');
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
  tarotCards.slice(0, 4).forEach((card) => {
    const name = state.currentLang === 'en' ? card.name_en : card.name_th;
    const meaning = state.currentLang === 'en' ? card.meaning_en : card.meaning_th;
    const div = document.createElement('div');
    div.className = 'sample-card';
    div.innerHTML = `<strong>${name}</strong><p>${meaning}</p>`;
    meaningList.appendChild(div);
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

function handleShare() {
  const url = window.location.href;
  if (navigator.share) {
    navigator
      .share({
        title: 'MeowTarot',
        text: translations[state.currentLang].yourReading,
        url,
      })
      .catch(() => copyLink(url));
  } else {
    copyLink(url);
  }
}

function copyLink(url) {
  navigator.clipboard.writeText(url).then(() => {
    alert(translations[state.currentLang].shareFallback);
  });
}

function saveImage() {
  html2canvas(resultsSection, {
    backgroundColor: '#0b1335',
    scale: 2,
  }).then((canvas) => {
    const link = document.createElement('a');
    link.download = `meowtarot-reading-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}

function init() {
  readingSection.classList.add('is-hidden');
  resultsSection.classList.add('is-hidden');
  attachLanguageToggle();
  applyTranslations();
  renderMeaningList();

  startBtn.addEventListener('click', prepareSpread);
  shuffleBtn.addEventListener('click', prepareSpread);
  continueBtn.addEventListener('click', () => {
    if (state.selectedIds.length === 3) {
      renderResults();
      resultsSection.scrollIntoView({ behavior: 'smooth' });
    }
  });
  newReadingBtn.addEventListener('click', () => {
    prepareSpread();
    readingSection.scrollIntoView({ behavior: 'smooth' });
  });
  shareBtn.addEventListener('click', handleShare);
  saveBtn.addEventListener('click', saveImage);
}

document.addEventListener('DOMContentLoaded', init);
