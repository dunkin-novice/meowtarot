import { initShell, localizePath, pathHasThaiPrefix, translations } from './common.js';
import { loadTarotData, meowTarotCards, normalizeId } from './data.js';
import { findCardById } from './reading-helpers.js';

const params = new URLSearchParams(window.location.search);
const storageSelection = JSON.parse(sessionStorage.getItem('meowtarot_selection') || 'null');

function parseSelectedIds() {
  const paramCards = params.get('cards');
  const storedCards = storageSelection?.cards;
  const combined = paramCards || (Array.isArray(storedCards) ? storedCards.join(',') : storedCards);
  if (!combined) return [];
  return combined
    .toString()
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
}

const initialMode = params.get('mode') || storageSelection?.mode || 'daily';
const defaultSpread =
  params.get('spread')
  || storageSelection?.spread
  || (initialMode === 'daily' ? 'quick' : 'story');

let dataLoaded = false;

const state = {
  currentLang: params.get('lang') || (pathHasThaiPrefix(window.location.pathname) ? 'th' : 'en'),
  mode: initialMode,
  spread: defaultSpread,
  topic: params.get('topic') || storageSelection?.topic || 'generic',
  selectedIds: parseSelectedIds(),
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
  if (!card) return '';

  if (lang === 'en') {
    return card.card_name_en || card.name_en || card.name || card.id;
  }

  const thaiName = card.alias_th || card.name_th || card.name || card.card_name_en || card.id;
  const englishName = card.card_name_en || card.name_en || '';

  return englishName ? `${thaiName} (${englishName})` : thaiName;
}

function getOrientationLabel(card, lang = state.currentLang) {
  if (!card) return '';
  const reversed = (card.orientation || '').toLowerCase() === 'reversed';
  if (lang === 'th') return reversed ? 'ไพ่กลับหัว' : 'ไพ่ตั้งตรง';
  return reversed ? 'Reversed' : 'Upright';
}

function findCard(id) {
  return findCardById(meowTarotCards, id, normalizeId);
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
  const imply = getText(card, 'tarot_imply');
  const implyLine = document.createElement('p');
  if (imply) {
    implyLine.className = 'keywords';
    implyLine.textContent = imply;
  }

  header.append(title, subtitle);
  if (imply) header.appendChild(implyLine);
  return header;
}

function renderListSection(label, text) {
  if (!text) return null;
  const p = document.createElement('p');
  p.innerHTML = `<strong>${label}:</strong> ${text}`;
  return p;
}

function renderImplyLine(card) {
  const imply = getText(card, 'tarot_imply');
  if (!imply) return null;

  const p = document.createElement('p');
  p.className = 'keywords';
  p.textContent = imply;
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

  const headingText = state.mode === 'question' ? dict.guidanceHeading : heading;
  if (headingText) {
    const h = document.createElement('h3');
    h.textContent = headingText;
    panel.appendChild(h);
  }

  const parts = [];
  if (action) parts.push(action.trim());
  if (reflection) parts.push(reflection.trim());
  const combined = parts.join(' ');

  if (combined) {
    const p = document.createElement('p');
    p.textContent = combined;
    panel.appendChild(p);
  }

  if (affirmation) {
    const pAffirm = document.createElement('p');
    pAffirm.innerHTML = `<em>"${affirmation.trim()}"</em>`;
    panel.appendChild(pAffirm);
  }

  return panel;
}

function renderSingleCard(card, dict, topic) {
  if (!card || !readingContent) return;
  readingContent.innerHTML = '';
  const panel = document.createElement('div');
  panel.className = 'panel';
  panel.appendChild(buildCardHeader(card, dict));

  const implyNode = renderImplyLine(card);
  if (implyNode) panel.appendChild(implyNode);

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
    if (body) {
      const p = document.createElement('p');
      p.textContent = body;
      panel.appendChild(p);
    }
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
    const name = getName(card, state.currentLang);
    const orientation = getOrientationLabel(card, state.currentLang);
    const headerText =
      state.mode === 'question'
        ? orientation
          ? `${dict[position]} • ${name} • ${orientation}`
          : `${dict[position]} • ${name}`
        : `${dict[position]} • ${name}`;
    header.textContent = headerText;
    panel.appendChild(header);

    const implyNode = renderImplyLine(card);
    if (implyNode) panel.appendChild(implyNode);

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
      const story = getText(card, `standalone_${position}`);
      if (story) {
        const p = document.createElement('p');
        p.textContent = story;
        panel.appendChild(p);
      }
    }

    readingContent.appendChild(panel);
  });

  const presentCard = cards[1];
  if (!presentCard) return;

  const summaries = cards
    .slice(0, 3)
    .map((card, idx) => getText(card, `reading_summary_${positions[idx]}`))
    .filter(Boolean);
  const combinedSummary = summaries.join(' ');

  if (combinedSummary) {
    const wrap = document.createElement('div');
    wrap.className = 'panel';

    const h = document.createElement('h3');
    h.textContent = dict.readingSummaryTitle || (state.currentLang === 'th' ? 'ดวงของคุณวันนี้' : 'Your fortune today');
    wrap.appendChild(h);

    const p = document.createElement('p');
    p.textContent = combinedSummary;
    wrap.appendChild(p);

    readingContent.appendChild(wrap);
  }

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
      const p = document.createElement('p');
      p.textContent = storyline;
      wrap.appendChild(p);
      readingContent.appendChild(wrap);
    }
    const suggestionHeading = dict.suggestionTitle || (state.currentLang === 'th' ? 'คำแนะนำ' : 'Suggestion');
    const actions = buildActionBlock(presentCard, dict, {}, suggestionHeading);
    if (actions) readingContent.appendChild(actions);
  }
}

function renderReading(dict) {
  if (!readingContent) return;
  const cards = state.selectedIds.map((id) => findCard(id)).filter(Boolean);
  if (!cards.length) {
    const message = dict?.missingSelection || 'No cards found. Please draw cards first.';
    readingContent.innerHTML = `<div class="panel"><p class="lede">${message}</p></div>`;
    return;
  }

  if (state.mode === 'daily') {
    renderThreeCards(cards.slice(0, 3), dict, state.topic || 'generic');
    return;
  }

  if (state.spread === 'quick') {
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
  if (readingTitle) {
    if (state.mode === 'overall') {
      readingTitle.textContent = dict.overallTitle;
    } else if (state.mode === 'question') {
      readingTitle.textContent = dict.questionTitle;
    } else {
      readingTitle.textContent = dict.dailyTitle;
    }
  }

  if (dataLoaded) {
    renderReading(dict);
  }
}

function init() {
  initShell(state, handleTranslations, 'reading');

  newReadingBtn?.addEventListener('click', () => {
    const target = state.mode === 'question' ? '/question.html' : state.mode === 'overall' ? '/overall.html' : '/daily.html';
    window.location.href = localizePath(target, state.currentLang);
  });
  shareBtn?.addEventListener('click', handleShare);
  saveBtn?.addEventListener('click', saveImage);

  loadTarotData()
    .then(() => {
      dataLoaded = true;
      renderReading(translations[state.currentLang] || translations.en);
    })
    .catch(() => {
      dataLoaded = true;
      renderReading(translations[state.currentLang] || translations.en);
    });
}

document.addEventListener('DOMContentLoaded', init);
