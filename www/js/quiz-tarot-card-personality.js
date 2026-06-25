import { initShell, localizePath, pathHasThaiPrefix } from './common.js';
import {
  applyImageFallback,
  getCardBackFallbackUrl,
  getCardBackUrl,
  getCardImageUrl,
  loadTarotData,
} from './data.js';
import { getCurrentUser } from './auth.js';
import { trackShareClicked, trackCtaClicked } from './analytics.js';

const LANG = pathHasThaiPrefix(window.location.pathname) ? 'th' : 'en';

// Where the last result is saved (simple per-device "profile" record; the profile
// page can read this key). Cross-device account sync would need a Supabase table.
const RESULT_STORAGE_KEY = 'meowtarot_personality_card';

const QUIZ_COPY = {
  en: {
    eyebrow: 'Personality Quiz',
    title: 'Which Tarot Card Are You?',
    intro: 'Answer 5 quick questions and see which card is you.',
    start: 'Start',
    timeNote: 'Takes ~30 seconds',
    progressCount: 'Question {current} / {total}',
    progressLeftMany: '{n} questions left',
    progressLeftOne: '1 question left',
    progressLeftDone: 'Last one!',
    questionEyebrow: 'Question',
    hint: 'Tap an answer to jump to the next one',
    resultLead: 'You are…',
    savedProfile: 'Saved to your profile',
    savedDevice: 'Saved on this device',
    watermark: 'meowtarot.com · Tarot personality quiz',
    shareCta: 'Share my result',
    shareText: 'I got {cardName} in the MeowTarot personality quiz 🔮 Which tarot card are you?',
    shareSuccess: 'Share link copied!',
    dailyCta: 'Get your daily reading',
    restart: 'Retake',
  },
  th: {
    eyebrow: 'แบบทดสอบบุคลิกภาพ',
    title: 'คุณคือไพ่ทาโรต์ใบไหน?',
    intro: 'ตอบ 5 ข้อสั้นๆ แล้วดูว่าคุณคือไพ่ใบไหน',
    start: 'เริ่มเล่น',
    timeNote: 'ใช้เวลา ~30 วินาที',
    progressCount: 'ข้อ {current} / {total}',
    progressLeftMany: 'เหลืออีก {n} ข้อ',
    progressLeftOne: 'เหลืออีก 1 ข้อ',
    progressLeftDone: 'ข้อสุดท้ายแล้ว!',
    questionEyebrow: 'คำถาม',
    hint: 'แตะคำตอบเพื่อไปข้อถัดไปอัตโนมัติ',
    resultLead: 'คุณคือ…',
    savedProfile: 'บันทึกลงโปรไฟล์แล้ว',
    savedDevice: 'บันทึกไว้ในเครื่องนี้แล้ว',
    watermark: 'meowtarot.com · แบบทดสอบไพ่ทาโรต์',
    shareCta: 'แชร์ผลลัพธ์',
    shareText: 'ฉันได้ไพ่ {cardName} จากแบบทดสอบ MeowTarot 🔮 แล้วคุณได้ใบไหน?',
    shareSuccess: 'คัดลอกลิงก์สำหรับแชร์แล้ว!',
    dailyCta: 'ดูดวงไพ่ประจำวัน',
    restart: 'ทำอีกครั้ง',
  },
};

const RESULTS = {
  fool: {
    cardId: '01-the-fool-upright',
    en: 'Playful explorer energy. You trust your instincts, embrace fresh starts, and turn uncertainty into adventure.',
    th: 'พลังนักสำรวจผู้ร่าเริง คุณเชื่อสัญชาตญาณ กล้าเริ่มต้นใหม่ และเปลี่ยนความไม่แน่นอนให้เป็นการผจญภัย',
    traitsEn: ['Curious', 'Spontaneous', 'Open', 'Brave'],
    traitsTh: ['อยากรู้อยากลอง', 'สปอนเทเนียส', 'เปิดรับ', 'กล้าเริ่ม'],
  },
  magician: {
    cardId: '02-the-magician-upright',
    en: 'Creator mindset. You connect ideas fast, communicate with confidence, and make things happen with focus.',
    th: 'พลังนักสร้างสรรค์ คุณเชื่อมไอเดียได้ไว สื่อสารอย่างมั่นใจ และเปลี่ยนสิ่งที่คิดให้เกิดขึ้นจริง',
    traitsEn: ['Resourceful', 'Driven', 'Focused', 'Confident'],
    traitsTh: ['ลงมือไว', 'มั่นใจ', 'โฟกัส', 'สร้างผลลัพธ์'],
  },
  highPriestess: {
    cardId: '03-the-high-priestess-upright',
    en: 'Quiet intuitive power. You read between the lines, protect your energy, and value deep emotional truth.',
    th: 'พลังแห่งสัญชาตญาณที่สงบนิ่ง คุณอ่านความหมายที่ซ่อนอยู่ รักษาพลังใจ และให้ค่ากับความจริงภายใน',
    traitsEn: ['Intuitive', 'Calm', 'Deep', 'Perceptive'],
    traitsTh: ['สัญชาตญาณดี', 'นิ่ง', 'ลึกซึ้ง', 'อ่านคนเก่ง'],
  },
  empress: {
    cardId: '04-the-empress-upright',
    en: 'Nurturing abundance. You bring warmth to people around you and grow ideas with care, beauty, and patience.',
    th: 'พลังแห่งความอุดมสมบูรณ์และการโอบอุ้ม คุณเติมความอบอุ่นให้คนรอบตัว และบ่มเพาะสิ่งดีๆ อย่างนุ่มนวล',
    traitsEn: ['Warm', 'Nurturing', 'Caring', 'Patient'],
    traitsTh: ['อบอุ่น', 'ดูแลคน', 'ใจดี', 'อ่อนโยน'],
  },
  chariot: {
    cardId: '08-the-chariot-upright',
    en: 'Driven achiever. You stay determined under pressure and channel strong willpower into meaningful progress.',
    th: 'พลังนักขับเคลื่อนเป้าหมาย คุณมุ่งมั่นแม้มีแรงกดดัน และเปลี่ยนความตั้งใจให้เป็นความก้าวหน้าที่จับต้องได้',
    traitsEn: ['Determined', 'Bold', 'Driven', 'Resilient'],
    traitsTh: ['มุ่งมั่น', 'ไม่ยอมแพ้', 'มีพลัง', 'เดินหน้า'],
  },
  sun: {
    cardId: '20-the-sun-upright',
    en: 'Radiant optimist. You lift people up, lead with honesty, and invite joy wherever you go.',
    th: 'พลังแห่งความสดใส คุณส่งต่อกำลังใจ นำด้วยความจริงใจ และพาความสุขไปทุกที่ที่คุณอยู่',
    traitsEn: ['Radiant', 'Honest', 'Uplifting', 'Optimistic'],
    traitsTh: ['สดใส', 'จริงใจ', 'ให้กำลังใจ', 'มองโลกในแง่ดี'],
  },
};

// 5 short questions; every archetype is reachable across the answer set.
const QUESTIONS = {
  en: [
    {
      prompt: 'Walking into a new situation, what feels most natural?',
      answers: [
        { label: 'Jump in and learn by doing', archetype: 'fool' },
        { label: 'Line up the right tools and people', archetype: 'magician' },
        { label: 'Observe quietly before I move', archetype: 'highPriestess' },
      ],
    },
    {
      prompt: 'Your friends usually come to you for…',
      answers: [
        { label: 'Motivation and momentum', archetype: 'chariot' },
        { label: 'Comfort and emotional support', archetype: 'empress' },
        { label: 'Honest positivity and hope', archetype: 'sun' },
      ],
    },
    {
      prompt: 'What best matches your decision style?',
      answers: [
        { label: 'My gut knows first', archetype: 'highPriestess' },
        { label: 'I pick what gets real results', archetype: 'magician' },
        { label: 'I pick what keeps me moving', archetype: 'chariot' },
      ],
    },
    {
      prompt: 'Your ideal weekend is…',
      answers: [
        { label: 'A spontaneous plan, no schedule', archetype: 'fool' },
        { label: 'Cozy time with people I love', archetype: 'empress' },
        { label: 'Something bright, fun, and social', archetype: 'sun' },
      ],
    },
    {
      prompt: 'When a setback hits, you usually…',
      answers: [
        { label: 'Treat it as feedback and adjust', archetype: 'magician' },
        { label: 'Sit with it and trust the timing', archetype: 'highPriestess' },
        { label: 'Reset and push forward', archetype: 'chariot' },
      ],
    },
  ],
  th: [
    {
      prompt: 'เมื่อต้องเจอสถานการณ์ใหม่ๆ คุณเป็นแบบไหน?',
      answers: [
        { label: 'ลองทำเลย แล้วค่อยเรียนรู้ระหว่างทาง', archetype: 'fool' },
        { label: 'มองหาทรัพยากรและคนที่ช่วยต่อยอดได้', archetype: 'magician' },
        { label: 'สังเกตเงียบๆ ก่อนค่อยขยับ', archetype: 'highPriestess' },
      ],
    },
    {
      prompt: 'เพื่อนมักมาหาคุณเรื่อง…',
      answers: [
        { label: 'แรงผลักดันและการเดินหน้า', archetype: 'chariot' },
        { label: 'กำลังใจและพื้นที่ปลอดภัยทางใจ', archetype: 'empress' },
        { label: 'พลังบวกและความหวัง', archetype: 'sun' },
      ],
    },
    {
      prompt: 'สไตล์การตัดสินใจของคุณใกล้ข้อไหนที่สุด?',
      answers: [
        { label: 'เชื่อสัญชาตญาณเป็นอันดับแรก', archetype: 'highPriestess' },
        { label: 'เลือกสิ่งที่สร้างผลลัพธ์ได้จริง', archetype: 'magician' },
        { label: 'เลือกสิ่งที่พาฉันไปข้างหน้า', archetype: 'chariot' },
      ],
    },
    {
      prompt: 'วันหยุดในฝันของคุณคือ…',
      answers: [
        { label: 'แผนกะทันหัน ไม่ต้องเป๊ะ', archetype: 'fool' },
        { label: 'อยู่กับคนที่รัก บรรยากาศอบอุ่น', archetype: 'empress' },
        { label: 'กิจกรรมสดใส สนุก ได้เจอผู้คน', archetype: 'sun' },
      ],
    },
    {
      prompt: 'เวลาเจออุปสรรค คุณมักจะ…',
      answers: [
        { label: 'มองเป็นฟีดแบ็ก แล้วปรับทันที', archetype: 'magician' },
        { label: 'นิ่งก่อน แล้วฟังจังหวะชีวิต', archetype: 'highPriestess' },
        { label: 'ตั้งหลักใหม่ แล้วไปต่อ', archetype: 'chariot' },
      ],
    },
  ],
};

const scoreOrder = ['fool', 'magician', 'highPriestess', 'empress', 'chariot', 'sun'];

const state = {
  currentLang: LANG,
  index: 0,
  answers: [],
  cards: [],
};

const els = {};

function t(key, values = {}) {
  const template = QUIZ_COPY[state.currentLang][key] || '';
  return String(template).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

function getQuestions() {
  return QUESTIONS[state.currentLang];
}

function showView(view) {
  ['intro', 'question', 'result'].forEach((name) => {
    const el = els[`view_${name}`];
    if (el) el.hidden = name !== view;
  });
  window.scrollTo({ top: 0, behavior: 'auto' });
}

// Most-picked archetype. Ties are broken by whichever tied archetype the user
// chose earliest (feels fairer than alphabetical), then by scoreOrder.
function scoreResult() {
  const counts = Object.fromEntries(scoreOrder.map((key) => [key, 0]));
  const firstPick = {};
  state.answers.forEach((archetype, i) => {
    if (counts[archetype] === undefined) return;
    counts[archetype] += 1;
    if (firstPick[archetype] === undefined) firstPick[archetype] = i;
  });

  const max = Math.max(...scoreOrder.map((k) => counts[k]));
  const tied = scoreOrder.filter((k) => counts[k] === max && max > 0);
  if (!tied.length) return 'fool';
  return tied.reduce((best, k) => (firstPick[k] < firstPick[best] ? k : best), tied[0]);
}

function getCardById(cardId) {
  return state.cards.find((card) => card.card_id === cardId) || null;
}

function getCardName(card) {
  if (!card) return state.currentLang === 'th' ? 'ไพ่ทาโรต์' : 'Tarot Card';
  return state.currentLang === 'th'
    ? card.alias_th || card.card_name_en || 'ไพ่ทาโรต์'
    : card.card_name_en || card.alias_th || 'Tarot Card';
}

function saveResultToProfile(payload) {
  try {
    localStorage.setItem(RESULT_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch (_) {
    return false;
  }
}

function selectAnswer(archetype) {
  state.answers[state.index] = archetype;
  const total = getQuestions().length;
  if (state.index < total - 1) {
    state.index += 1;
    renderQuestion();
  } else {
    renderResult();
  }
}

function renderQuestion() {
  const questions = getQuestions();
  const total = questions.length;
  const question = questions[state.index];
  if (!question) return;

  showView('question');

  els.progressCount.innerHTML = t('progressCount', { current: state.index + 1, total })
    .replace(String(state.index + 1), `<strong>${state.index + 1}</strong>`);

  const remaining = total - (state.index + 1);
  els.progressLeft.textContent = remaining <= 0
    ? t('progressLeftDone')
    : remaining === 1 ? t('progressLeftOne') : t('progressLeftMany', { n: remaining });

  els.progressBar.innerHTML = '';
  for (let i = 0; i < total; i += 1) {
    const seg = document.createElement('span');
    seg.className = 'quiz-progress__seg';
    if (i <= state.index) seg.classList.add('is-filled');
    els.progressBar.appendChild(seg);
  }

  els.questionEyebrow.textContent = t('questionEyebrow');
  els.prompt.textContent = question.prompt;
  els.hint.textContent = t('hint');

  els.answers.innerHTML = '';
  question.answers.forEach((answer) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quiz-answer';
    button.innerHTML = `
      <span class="quiz-answer__radio" aria-hidden="true"></span>
      <span class="quiz-answer__label"></span>
    `;
    button.querySelector('.quiz-answer__label').textContent = answer.label;
    button.addEventListener('click', () => {
      if (button.classList.contains('is-selected')) return;
      [...els.answers.children].forEach((el) => el.classList.remove('is-selected'));
      button.classList.add('is-selected');
      // Brief pause so the selected state is visible before advancing.
      window.setTimeout(() => selectAnswer(answer.archetype), 220);
    });
    els.answers.appendChild(button);
  });
}

async function shareResult(text) {
  const shareUrl = window.location.href.split('#')[0];
  trackShareClicked({ locale: state.currentLang, mode: 'quiz', shareChannel: 'native' });
  if (navigator.share) {
    try {
      await navigator.share({ text, url: shareUrl });
      return;
    } catch (_) { /* fall through to clipboard */ }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${shareUrl}`);
    els.shareStatus.textContent = t('shareSuccess');
  } catch (_) { /* ignore */ }
}

async function renderResult() {
  const resultKey = scoreResult();
  const result = RESULTS[resultKey];
  const card = getCardById(result.cardId);
  const cardName = getCardName(card);

  showView('result');

  els.resultLead.textContent = t('resultLead');
  els.resultNameEn.textContent = card?.card_name_en || 'Tarot Card';
  els.resultNameTh.textContent = card?.alias_th || '';
  els.resultNameTh.hidden = !card?.alias_th;
  els.resultSummary.textContent = result[state.currentLang];
  els.resultMark.textContent = t('watermark');

  if (card) {
    applyImageFallback(
      els.resultImage,
      getCardImageUrl(card, { orientation: 'upright' }),
      [getCardBackUrl(), getCardBackFallbackUrl()].filter(Boolean),
    );
    els.resultImage.alt = state.currentLang === 'th' ? `ไพ่ ${cardName}` : `${cardName} tarot card`;
  }

  const traits = state.currentLang === 'th' ? result.traitsTh : result.traitsEn;
  els.resultTraits.innerHTML = '';
  (traits || []).forEach((trait) => {
    const chip = document.createElement('span');
    chip.className = 'quiz-trait';
    chip.textContent = trait;
    els.resultTraits.appendChild(chip);
  });

  // Save (per-device). Show profile vs device wording based on sign-in.
  const saved = saveResultToProfile({
    key: resultKey,
    cardId: result.cardId,
    cardNameEn: card?.card_name_en || '',
    cardNameTh: card?.alias_th || '',
    lang: state.currentLang,
    savedAt: new Date().toISOString(),
  });
  trackCtaClicked({ cta: `quiz_complete_${resultKey}`, location: 'quiz', locale: state.currentLang });

  if (saved) {
    els.saved.hidden = false;
    getCurrentUser()
      .then((user) => { els.saved.textContent = user ? t('savedProfile') : t('savedDevice'); })
      .catch(() => { els.saved.textContent = t('savedDevice'); });
  } else {
    els.saved.hidden = true;
  }

  els.shareStatus.textContent = '';
  els.shareBtn.onclick = () => shareResult(t('shareText', { cardName }));
  els.dailyCta.href = localizePath('/daily.html', state.currentLang);
  els.restartBtn.onclick = restartQuiz;
}

function restartQuiz() {
  state.index = 0;
  state.answers = [];
  els.shareStatus.textContent = '';
  renderQuestion();
}

function applyStaticCopy() {
  els.eyebrow.textContent = t('eyebrow');
  els.title.textContent = t('title');
  els.intro.textContent = t('intro');
  els.startBtn.textContent = t('start');
  els.timeNote.textContent = t('timeNote');
  els.shareBtn.innerHTML = `<span class="quiz-share-btn__icon" aria-hidden="true">↗</span> ${t('shareCta')}`;
  els.dailyCta.textContent = t('dailyCta');
  els.restartBtn.textContent = t('restart');

  // Hero fan = deck-aware card backs.
  const backUrl = getCardBackUrl();
  [...document.querySelectorAll('.quiz-hero__card')].forEach((img) => {
    applyImageFallback(img, backUrl, [getCardBackFallbackUrl()].filter(Boolean));
  });
}

function cacheEls() {
  const byId = (id) => document.getElementById(id);
  Object.assign(els, {
    view_intro: document.querySelector('[data-view="intro"]'),
    view_question: document.querySelector('[data-view="question"]'),
    view_result: document.querySelector('[data-view="result"]'),
    eyebrow: byId('quizEyebrow'),
    title: byId('quizTitle'),
    intro: byId('quizIntro'),
    startBtn: byId('quizStartBtn'),
    timeNote: byId('quizTime'),
    progressCount: byId('quizProgressCount'),
    progressLeft: byId('quizProgressLeft'),
    progressBar: byId('quizProgressBar'),
    questionEyebrow: byId('quizQEyebrow'),
    prompt: byId('quizPrompt'),
    answers: byId('quizAnswers'),
    hint: byId('quizHint'),
    resultLead: byId('quizResultLead'),
    resultImage: byId('quizResultImage'),
    resultNameEn: byId('quizResultNameEn'),
    resultNameTh: byId('quizResultNameTh'),
    resultSummary: byId('quizResultSummary'),
    resultTraits: byId('quizResultTraits'),
    resultMark: byId('quizResultMark'),
    saved: byId('quizSaved'),
    shareBtn: byId('quizShareBtn'),
    dailyCta: byId('quizDailyCta'),
    restartBtn: byId('quizRestartBtn'),
    shareStatus: byId('quizShareStatus'),
  });
}

async function initQuiz() {
  initShell(state, null, 'quiz');
  cacheEls();
  state.cards = await loadTarotData();
  applyStaticCopy();

  els.startBtn.addEventListener('click', () => {
    state.index = 0;
    state.answers = [];
    trackCtaClicked({ cta: 'quiz_start', location: 'quiz', locale: state.currentLang });
    renderQuestion();
  });

  showView('intro');
}

void initQuiz();
