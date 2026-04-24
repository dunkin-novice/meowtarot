import { initShell, localizePath, pathHasThaiPrefix } from './common.js';
import {
  applyImageFallback,
  getCardBackFallbackUrl,
  getCardBackUrl,
  getCardImageUrl,
  loadTarotData,
} from './data.js';
import { initEmailCapture } from './email-capture.js';

const LANG = pathHasThaiPrefix(window.location.pathname) ? 'th' : 'en';

const QUIZ_COPY = {
  en: {
    eyebrow: 'Personality Quiz',
    title: 'Which Tarot Card Are You?',
    intro: 'Answer six quick questions and reveal the Major Arcana card that mirrors your vibe right now.',
    progressLabel: 'Question {current} of {total}',
    next: 'Next Question',
    restart: 'Retake Quiz',
    resultTitle: 'You are {cardName}',
    resultLead: 'Your personality card',
    dailyCta: 'Get Your Daily Reading',
    meaningsCta: 'Explore Card Meanings',
    shareCta: 'Share My Result',
    shareText: 'I got {cardName} in the MeowTarot personality quiz. Which tarot card are you?',
    shareSuccess: 'Share link copied to clipboard!',
  },
  th: {
    eyebrow: 'แบบทดสอบบุคลิกภาพ',
    title: 'คุณคือไพ่ทาโรต์ใบไหน?',
    intro: 'ตอบคำถาม 6 ข้อ แล้วค้นหาไพ่เมเจอร์อาร์คานาที่สะท้อนพลังของคุณตอนนี้',
    progressLabel: 'คำถามที่ {current} จาก {total}',
    next: 'คำถามถัดไป',
    restart: 'ทำแบบทดสอบอีกครั้ง',
    resultTitle: 'คุณคือ {cardName}',
    resultLead: 'ไพ่ประจำบุคลิกของคุณ',
    dailyCta: 'ดูดวงไพ่ประจำวัน',
    meaningsCta: 'เปิดคลังความหมายไพ่',
    shareCta: 'แชร์ผลลัพธ์ของฉัน',
    shareText: 'ฉันได้ไพ่ {cardName} จากแบบทดสอบ MeowTarot แล้วคุณได้ใบไหน?',
    shareSuccess: 'คัดลอกลิงก์สำหรับแชร์แล้ว!',
  },
};

const RESULTS = {
  fool: {
    cardId: '01-the-fool-upright',
    en: 'Playful explorer energy. You trust your instincts, embrace fresh starts, and turn uncertainty into adventure.',
    th: 'พลังนักสำรวจผู้ร่าเริง คุณเชื่อสัญชาตญาณ กล้าเริ่มต้นใหม่ และเปลี่ยนความไม่แน่นอนให้เป็นการผจญภัย',
  },
  magician: {
    cardId: '02-the-magician-upright',
    en: 'Creator mindset. You connect ideas fast, communicate with confidence, and make things happen with focus.',
    th: 'พลังนักสร้างสรรค์ คุณเชื่อมไอเดียได้ไว สื่อสารอย่างมั่นใจ และเปลี่ยนสิ่งที่คิดให้เกิดขึ้นจริง',
  },
  highPriestess: {
    cardId: '03-the-high-priestess-upright',
    en: 'Quiet intuitive power. You read between the lines, protect your energy, and value deep emotional truth.',
    th: 'พลังแห่งสัญชาตญาณที่สงบนิ่ง คุณอ่านความหมายที่ซ่อนอยู่ รักษาพลังใจ และให้ค่ากับความจริงภายใน',
  },
  empress: {
    cardId: '04-the-empress-upright',
    en: 'Nurturing abundance. You bring warmth to people around you and grow ideas with care, beauty, and patience.',
    th: 'พลังแห่งความอุดมสมบูรณ์และการโอบอุ้ม คุณเติมความอบอุ่นให้คนรอบตัว และบ่มเพาะสิ่งดีๆ อย่างนุ่มนวล',
  },
  chariot: {
    cardId: '08-the-chariot-upright',
    en: 'Driven achiever. You stay determined under pressure and channel strong willpower into meaningful progress.',
    th: 'พลังนักขับเคลื่อนเป้าหมาย คุณมุ่งมั่นแม้มีแรงกดดัน และเปลี่ยนความตั้งใจให้เป็นความก้าวหน้าที่จับต้องได้',
  },
  sun: {
    cardId: '20-the-sun-upright',
    en: 'Radiant optimist. You lift people up, lead with honesty, and invite joy wherever you go.',
    th: 'พลังแห่งความสดใส คุณส่งต่อกำลังใจ นำด้วยความจริงใจ และพาความสุขไปทุกที่ที่คุณอยู่',
  },
};

const QUESTIONS = {
  en: [
    {
      prompt: 'When you walk into a new situation, what feels most natural?',
      answers: [
        { label: 'Jump in and learn by doing', archetype: 'fool' },
        { label: 'Figure out what tools and people I can align', archetype: 'magician' },
        { label: 'Observe quietly before I make a move', archetype: 'highPriestess' },
      ],
    },
    {
      prompt: 'Your friends usually come to you for…',
      answers: [
        { label: 'Motivation and momentum', archetype: 'chariot' },
        { label: 'Comfort and emotional support', archetype: 'empress' },
        { label: 'Honest positivity and encouragement', archetype: 'sun' },
      ],
    },
    {
      prompt: 'What best matches your decision style?',
      answers: [
        { label: 'My gut knows first', archetype: 'highPriestess' },
        { label: 'I choose what creates visible results', archetype: 'magician' },
        { label: 'I choose what keeps me moving forward', archetype: 'chariot' },
      ],
    },
    {
      prompt: 'Your ideal weekend is…',
      answers: [
        { label: 'Spontaneous plan with no strict schedule', archetype: 'fool' },
        { label: 'Quality time, cozy rituals, and good food', archetype: 'empress' },
        { label: 'Something active, bright, and social', archetype: 'sun' },
      ],
    },
    {
      prompt: 'When a setback happens, you usually…',
      answers: [
        { label: 'Treat it like feedback and adjust quickly', archetype: 'magician' },
        { label: 'Dig deeper and trust timing', archetype: 'highPriestess' },
        { label: 'Reset my focus and push through', archetype: 'chariot' },
      ],
    },
    {
      prompt: 'Which statement sounds most like you?',
      answers: [
        { label: 'Life is better when we stay curious', archetype: 'fool' },
        { label: 'I shine brightest when I help others bloom', archetype: 'empress' },
        { label: 'Joy and truth are my north star', archetype: 'sun' },
      ],
    },
  ],
  th: [
    {
      prompt: 'เมื่อคุณต้องเจอสถานการณ์ใหม่ๆ คุณเป็นแบบไหนมากที่สุด?',
      answers: [
        { label: 'ลองทำเลย แล้วค่อยเรียนรู้ระหว่างทาง', archetype: 'fool' },
        { label: 'มองหาทรัพยากรและคนที่ช่วยต่อยอดได้', archetype: 'magician' },
        { label: 'สังเกตก่อน แล้วค่อยตัดสินใจ', archetype: 'highPriestess' },
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
      prompt: 'สไตล์การตัดสินใจของคุณใกล้เคียงข้อไหนที่สุด?',
      answers: [
        { label: 'ฉันเชื่อสัญชาตญาณเป็นอันดับแรก', archetype: 'highPriestess' },
        { label: 'ฉันเลือกสิ่งที่สร้างผลลัพธ์ได้จริง', archetype: 'magician' },
        { label: 'ฉันเลือกสิ่งที่พาฉันไปข้างหน้า', archetype: 'chariot' },
      ],
    },
    {
      prompt: 'วันหยุดในฝันของคุณคือ…',
      answers: [
        { label: 'แผนกะทันหัน ไม่ต้องเป๊ะมาก', archetype: 'fool' },
        { label: 'อยู่กับคนที่รัก บรรยากาศอบอุ่น', archetype: 'empress' },
        { label: 'กิจกรรมสดใส สนุก และได้เจอผู้คน', archetype: 'sun' },
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
    {
      prompt: 'ประโยคไหนเป็นตัวคุณที่สุด?',
      answers: [
        { label: 'ชีวิตจะสนุกขึ้นเมื่อเรายังอยากรู้อยากลอง', archetype: 'fool' },
        { label: 'ฉันมีความสุขเมื่อได้ดูแลคนรอบตัว', archetype: 'empress' },
        { label: 'ความสุขและความจริงใจคือเข็มทิศของฉัน', archetype: 'sun' },
      ],
    },
  ],
};

const scoreOrder = ['fool', 'magician', 'highPriestess', 'empress', 'chariot', 'sun'];
const state = {
  index: 0,
  answers: [],
  cards: [],
  currentLang: LANG,
};

function t(key, values = {}) {
  const template = QUIZ_COPY[state.currentLang][key] || '';
  return String(template).replace(/\{(\w+)\}/g, (_, name) => String(values[name] ?? ''));
}

function getQuizQuestions() {
  return QUESTIONS[state.currentLang];
}

function selectAnswer(archetype) {
  state.answers[state.index] = archetype;
  const total = getQuizQuestions().length;
  if (state.index < total - 1) {
    state.index += 1;
    renderQuestion();
    return;
  }
  renderResult();
}

function scoreResult() {
  const score = Object.fromEntries(scoreOrder.map((key) => [key, 0]));
  state.answers.forEach((archetype) => {
    if (score[archetype] !== undefined) score[archetype] += 1;
  });

  return scoreOrder.reduce((best, key) => {
    if (!best) return key;
    return score[key] > score[best] ? key : best;
  }, 'fool');
}

function getCardById(cardId) {
  return state.cards.find((card) => card.card_id === cardId) || null;
}

function renderQuestion() {
  const question = getQuizQuestions()[state.index];
  const total = getQuizQuestions().length;

  const progress = document.getElementById('quiz-progress');
  const prompt = document.getElementById('quiz-prompt');
  const answers = document.getElementById('quiz-answers');

  if (!progress || !prompt || !answers || !question) return;

  progress.textContent = t('progressLabel', { current: state.index + 1, total });
  prompt.textContent = question.prompt;
  answers.innerHTML = '';

  question.answers.forEach((answer) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'quiz-answer-btn';
    button.textContent = answer.label;
    button.addEventListener('click', () => selectAnswer(answer.archetype));
    answers.appendChild(button);
  });
}

async function shareResult(text) {
  const shareUrl = window.location.href;
  if (navigator.share) {
    try {
      await navigator.share({ text, url: shareUrl });
      return;
    } catch (_error) {
      // Continue to clipboard fallback.
    }
  }

  await navigator.clipboard.writeText(`${text} ${shareUrl}`);
  const status = document.getElementById('quiz-share-status');
  if (status) status.textContent = t('shareSuccess');
}

function renderResult() {
  const quizPanel = document.getElementById('quiz-panel');
  const resultPanel = document.getElementById('quiz-result');
  const resultTitle = document.getElementById('quiz-result-title');
  const resultSummary = document.getElementById('quiz-result-summary');
  const resultImage = document.getElementById('quiz-result-image');
  const dailyCta = document.getElementById('quiz-daily-cta');
  const meaningsCta = document.getElementById('quiz-meanings-cta');
  const shareCta = document.getElementById('quiz-share-cta');
  const restartCta = document.getElementById('quiz-restart-cta');

  const resultKey = scoreResult();
  const result = RESULTS[resultKey];
  const card = getCardById(result.cardId);
  const cardName = state.currentLang === 'th'
    ? card?.alias_th || card?.card_name_en || 'Tarot Card'
    : card?.card_name_en || 'Tarot Card';

  if (!quizPanel || !resultPanel || !resultTitle || !resultSummary || !resultImage || !dailyCta || !meaningsCta || !shareCta || !restartCta) {
    return;
  }

  resultTitle.textContent = t('resultTitle', { cardName });
  resultSummary.textContent = result[state.currentLang];

  if (card) {
    applyImageFallback(resultImage, getCardImageUrl(card), [getCardBackUrl(), getCardBackFallbackUrl()]);
    resultImage.alt = state.currentLang === 'th' ? `ภาพไพ่ ${cardName}` : `${cardName} tarot card`; 
  }

  dailyCta.textContent = t('dailyCta');
  dailyCta.href = localizePath('/daily.html', state.currentLang);
  meaningsCta.textContent = t('meaningsCta');
  meaningsCta.href = localizePath('/tarot-card-meanings/', state.currentLang);

  shareCta.textContent = t('shareCta');
  shareCta.onclick = () => {
    const text = t('shareText', { cardName });
    void shareResult(text);
  };

  restartCta.textContent = t('restart');
  restartCta.onclick = () => {
    state.index = 0;
    state.answers = [];
    document.getElementById('quiz-share-status').textContent = '';
    resultPanel.hidden = true;
    quizPanel.hidden = false;
    renderQuestion();
  };

  quizPanel.hidden = true;
  resultPanel.hidden = false;

  const emailCapture = initEmailCapture({ showDelayMs: 90000, readingDelayMs: 600 });
  emailCapture.triggerFromReadingResult();
}

function applyStaticCopy() {
  document.getElementById('quiz-eyebrow').textContent = t('eyebrow');
  document.getElementById('quiz-title').textContent = t('title');
  document.getElementById('quiz-intro').textContent = t('intro');
  document.getElementById('quiz-result-lead').textContent = t('resultLead');
}

async function initQuiz() {
  initShell(state, null, 'quiz');
  applyStaticCopy();
  state.cards = await loadTarotData();
  renderQuestion();
}

void initQuiz();
