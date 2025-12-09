import { initShell, translations } from './common.js';
import { loadTarotData, meowTarotCards } from './data.js';

const params = new URLSearchParams(window.location.search);
const storageSelection = JSON.parse(sessionStorage.getItem('meowtarot_selection') || 'null');

const state = {
  currentLang: params.get('lang') || 'en',
  mode: params.get('mode') || storageSelection?.mode || 'daily',
  spread: params.get('spread') || storageSelection?.spread || 'quick',
  topic: params.get('topic') || storageSelection?.topic || 'generic',
  selectedIds: (params.get('cards') || storageSelection?.cards || [])
    .toString()
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean),
};

const readingContent = document.getElementById('reading-content');
const contextCopy = document.getElementById('reading-context');
const readingTitle = document.getElementById('readingTitle');
const newReadingBtn = document.getElementById('newReadingBtn');
const shareBtn = document.getElementById('shareBtn');
const saveBtn = document.getElementById('saveBtn');

function getText(card, keyBase, lang = state.currentLang) {
  const suffix = lang === 'en' ? '_en' : '_th';
  return card?.[`${keyBase}${suffix}`] || '';
}

function getName(card, lang = state.currentLang) {
  return lang === 'en'
    ? card.card_name_en || card.name_en || card.name || card.id
    : card.alias_th || card.name_th || card.name || card.id;
}

function getOrientationLabel(card, lang = state.currentLang) {
  if (!card) return '';
  const reversed = (card.orientation || '').toLowerCase() === 'reversed';
  if (lang === 'th') return reversed ? 'ไพ่กลับหัว' : 'ไพ่ตั้งตรง';
  return reversed ? 'Reversed' : 'Upright';
}

function findCard(id) {
  const idStr = String(id || '');
  const direct = meowTarotCards.find((card) => String(card.id) === idStr);
  if (direct) return direct;
  const baseId = idStr.endsWith('-reversed') ? idStr.replace(/-reversed$/, '') : idStr;
  return meowTarotCards.find((card) => String(card.id) === baseId) || null;
}

function buildCardHeader(card) {
  const header = document.createElement('div');
  header.className = 'card-heading';
  const title = document.createElement('h2');
  title.textContent = `${card.icon_emoji || '🐾'} ${getName(card)}`;
  const subtitle = document.createElement('p');
  const archetype = state.currentLang === 'en' ? card.archetype_en : card.archetype_th;
  const orientation = getOrientationLabel(card);
  subtitle.textContent = [archetype, orientation].filter(Boolean).join(' • ');
  header.append(title, subtitle);
  return header;
}

function renderListSection(label, text) {
  if (!text) return null;
  const p = document.createElement('p');
  p.innerHTML = `<strong>${label}:</strong> ${text}`;
  return p;
}

function appendSection(panel, title, text, className) {
  if (!text) return;
  const heading = document.createElement('h4');
  heading.textContent = title;
  const body = document.createElement('p');
  if (className) body.className = className;
  body.textContent = text;
  panel.append(heading, body);
}

function buildActionBlock(card, dict, labels = {}, heading) {
  if (!card) return null;
  const action = getText(card, 'action_prompt');
  const reflection = getText(card, 'reflection_question');
  const affirmation = getText(card, 'affirmation');

  if (!action && !reflection && !affirmation) return null;

  const panel = document.createElement('div');
  panel.className = 'panel';
  if (heading) {
    const h = document.createElement('h4');
    h.textContent = heading;
    panel.appendChild(h);
  }

  const rows = [
    [labels.actionLabel || dict.actionToday, action],
    [labels.reflectionLabel || dict.reflectionToday, reflection],
    [labels.affirmationLabel || dict.affirmation, affirmation],
  ];

  rows.forEach(([label, text]) => {
    if (text) panel.appendChild(renderListSection(label, text));
  });

  return panel;
}

function renderSingleCard(card, dict, topic) {
  if (!card || !readingContent) return;
  readingContent.innerHTML = '';
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.appendChild(buildCardHeader(card, dict));

  const summary = getText(card, 'reading_summary_present') || getText(card, 'reading_summary_preview');
  if (summary) {
    const p = document.createElement('p');
    p.className = 'lede';
    p.textContent = summary;
    panel.appendChild(p);
  }

  if (topic === 'love') {
    const main = getText(card, 'love_present') || getText(card, 'standalone_present');
    if (main) panel.appendChild(renderListSection(dict.topicLove, main));
    const single = getText(card, 'love_reading_single');
    const couple = getText(card, 'love_reading_couple');
    if (single) panel.appendChild(renderListSection(dict.loveSingles, single));
    if (couple) panel.appendChild(renderListSection(dict.loveCouples, couple));
  } else if (topic === 'career') {
    const main = getText(card, 'career_present');
    if (main) panel.appendChild(renderListSection(dict.topicCareer, main));
  } else if (topic === 'finance') {
    const main = getText(card, 'finance_present');
    if (main) panel.appendChild(renderListSection(dict.topicFinance, main));
    const crossover = getText(card, 'career_present');
    if (crossover) panel.appendChild(renderListSection(dict.careerToday, crossover));
  } else {
    const body = getText(card, 'standalone_present') || getText(card, 'tarot_imply_present');
    if (body) panel.appendChild(renderListSection(dict.summaryTitle, body));
  }

  readingContent.appendChild(panel);

  const actionHeading =
    topic === 'love'
      ? dict.loveActionHeading
      : topic === 'career'
        ? dict.careerActionHeading
        : topic === 'finance'
          ? dict.financeActionHeading
          : '';
  const actionBlock = buildActionBlock(card, dict, {}, actionHeading || null);
  if (actionBlock) readingContent.appendChild(actionBlock);
}

function renderThreeCards(cards, dict, topic) {
  if (!readingContent || !cards?.length) return;
  readingContent.innerHTML = '';
  const positions = ['past', 'present', 'future'];

  cards.forEach((card, idx) => {
    const position = positions[idx];
    const panel = document.createElement('div');
    panel.className = 'panel';
    const header = document.createElement('h3');
    header.textContent = `${dict[position]} • ${getName(card)}`;
    panel.appendChild(header);

    const summary = getText(card, `reading_summary_${position}`) || getText(card, 'reading_summary_preview');
    if (summary) appendSection(panel, dict.summaryTitle, summary, 'lede');

    if (topic === 'love') {
      const loveText = getText(card, `love_${position}`) || getText(card, `standalone_${position}`);
      appendSection(panel, dict.topicLove, loveText);
    } else if (topic === 'career') {
      const careerText = getText(card, `career_${position}`) || getText(card, `standalone_${position}`);
      appendSection(panel, dict.topicCareer, careerText);
    } else if (topic === 'finance') {
      const financeText = getText(card, `finance_${position}`) || getText(card, `standalone_${position}`);
      appendSection(panel, dict.topicFinance, financeText);
    } else {
      const story = getText(card, `standalone_${position}`) || getText(card, 'tarot_imply');
      if (story) appendSection(panel, dict.summaryTitle, story);
    }

    readingContent.appendChild(panel);
  });

  const presentCard = cards[1];
  if (!presentCard) return;

  if (topic === 'love') {
    const extras = [];
    const single = getText(presentCard, 'love_reading_single');
    const couple = getText(presentCard, 'love_reading_couple');
    if (single) extras.push(renderListSection(dict.loveSingles, single));
    if (couple) extras.push(renderListSection(dict.loveCouples, couple));
    if (extras.length) {
      const wrap = document.createElement('div');
      wrap.className = 'panel';
      extras.forEach((node) => node && wrap.appendChild(node));
      readingContent.appendChild(wrap);
    }
    const actions = buildActionBlock(presentCard, dict, {}, dict.loveActionHeading);
    if (actions) readingContent.appendChild(actions);
    return;
  }

  if (topic === 'career') {
    const actions = buildActionBlock(presentCard, dict, {}, dict.careerActionHeading);
    if (actions) readingContent.appendChild(actions);
  } else if (topic === 'finance') {
    const actions = buildActionBlock(presentCard, dict, {}, dict.financeActionHeading);
    if (actions) readingContent.appendChild(actions);
  } else {
    const storyline = getText(presentCard, 'reading_summary_preview');
    if (storyline) {
      const wrap = document.createElement('div');
      wrap.className = 'panel';
      appendSection(wrap, dict.overallReadingLabel || dict.summaryTitle, storyline);
      readingContent.appendChild(wrap);
    }
    const actions = buildActionBlock(presentCard, dict);
    if (actions) readingContent.appendChild(actions);
  }
}

function renderReading(dict) {
  if (!readingContent) return;
  const cards = state.selectedIds.map((id) => findCard(id)).filter(Boolean);
  if (!cards.length) {
    readingContent.innerHTML = `<p>${dict?.instruction || ''}</p>`;
    return;
  }

  if (state.mode === 'daily' || state.spread === 'quick') {
    renderSingleCard(cards[0], dict, state.topic || 'generic');
    return;
  }
  renderThreeCards(cards.slice(0, 3), dict, state.topic || 'generic');
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
  if (!readingContent) return;
  html2canvas(readingContent, { backgroundColor: '#0b102b', scale: 2 }).then((canvas) => {
    const link = document.createElement('a');
    link.download = `meowtarot-reading-${Date.now()}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  });
}

function updateContextCopy(dict = translations[state.currentLang]) {
  if (!contextCopy) return;
  if (state.mode === 'question') {
    contextCopy.textContent = dict.contextQuestion;
  } else if (state.mode === 'overall') {
    contextCopy.textContent = dict.overallTitle;
  } else {
    contextCopy.textContent = dict.contextDaily;
  }
}

function handleTranslations(dict) {
  updateContextCopy(dict);
  renderReading(dict);
  if (readingTitle) {
    if (state.mode === 'overall') {
      readingTitle.textContent = dict.overallTitle;
    } else if (state.mode === 'question') {
      readingTitle.textContent = dict.questionTitle;
    } else {
      readingTitle.textContent = dict.dailyTitle;
    }
  }
}

function init() {
  initShell(state, handleTranslations, 'reading');

  newReadingBtn?.addEventListener('click', () => {
    const target = state.mode === 'question' ? 'question.html' : state.mode === 'overall' ? 'overall.html' : 'daily.html';
    window.location.href = target;
  });
  shareBtn?.addEventListener('click', handleShare);
  saveBtn?.addEventListener('click', saveImage);

  loadTarotData()
    .then(() => {
      renderReading(translations[state.currentLang] || translations.en);
    })
    .catch(() => {
      renderReading(translations[state.currentLang] || translations.en);
    });
}

document.addEventListener('DOMContentLoaded', init);
