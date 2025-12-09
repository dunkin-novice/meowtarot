import { initShell, translations } from './common.js';
import { loadTarotData } from './data.js';

const BOARD_CARD_COUNT = 12;
const OVERALL_SELECTION_COUNT = 3;
const QUESTION_QUICK_BOARD_COUNT = 6;
const QUESTION_QUICK_SELECTION = 1;

const state = {
  currentLang: 'en',
  cards: [],
  dailyCard: null,
  overallCards: [],
  overallBoard: [],
  questionCards: [],
  questionBoard: [],
  questionSpread: 'quick',
  questionTopic: 'generic',
};

function getDrawableCards(size = 6) {
  if (!state.cards.length) return [];
  const pool = [...state.cards];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, Math.min(size, pool.length));
}

function pickRandomCards(count = 1, size = 6) {
  const pool = getDrawableCards(size);
  const copy = [...pool];
  const selected = [];
  while (copy.length && selected.length < count) {
    const idx = Math.floor(Math.random() * copy.length);
    selected.push(copy.splice(idx, 1)[0]);
  }
  return selected;
}

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
  const reversed = card.orientation === 'reversed';
  if (lang === 'th') return reversed ? 'ไพ่กลับหัว' : 'ไพ่ตั้งตรง';
  return reversed ? 'Reversed' : 'Upright';
}

function renderBadge(label, value) {
  if (!value) return null;
  const badge = document.createElement('div');
  badge.className = 'meta-badge';
  badge.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
  return badge;
}

function renderAccordion(title, contentNodes) {
  const hasContent = contentNodes.some((node) => node && node.textContent);
  if (!hasContent) return null;
  const details = document.createElement('details');
  details.open = false;
  const summary = document.createElement('summary');
  summary.textContent = title;
  details.appendChild(summary);
  contentNodes.forEach((node) => {
    if (node && node.textContent) details.appendChild(node);
  });
  return details;
}

function renderListSection(label, text) {
  if (!text) return null;
  const p = document.createElement('p');
  p.innerHTML = `<strong>${label}:</strong> ${text}`;
  return p;
}

function renderColorBlock(label, color) {
  if (!color) return null;
  const wrap = document.createElement('div');
  wrap.className = 'color-chip';
  const swatch = document.createElement('span');
  swatch.className = 'swatch';
  swatch.style.background = color;
  const text = document.createElement('span');
  text.textContent = `${label} ${color}`;
  wrap.append(swatch, text);
  return wrap;
}

function renderDaily(dict) {
  const drawBtn = document.getElementById('daily-draw');
  const cardHolder = document.getElementById('daily-card');
  if (!drawBtn || !cardHolder) return;

  const stored = JSON.parse(localStorage.getItem('meowtarot_daily_card') || 'null');
  const today = new Date().toISOString().slice(0, 10);
  if (stored?.date === today) {
    const saved = state.cards.find((c) => c.id === stored.cardId);
    if (saved) state.dailyCard = saved;
  }

  drawBtn.textContent = stored?.date === today ? dict.dailyRedraw : dict.dailyDraw;

  drawBtn.onclick = () => {
    const picked = pickRandomCards(1, 6)[0];
    if (picked) {
      state.dailyCard = picked;
      localStorage.setItem('meowtarot_daily_card', JSON.stringify({ date: today, cardId: picked.id }));
      renderDailyCard(dict);
    }
  };

  renderDailyCard(dict);
}

function buildCardHeader(card, dict) {
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

function renderDailyCard(dict) {
  const cardHolder = document.getElementById('daily-card');
  if (!cardHolder) return;
  cardHolder.innerHTML = '';
  const card = state.dailyCard;
  if (!card) return;

  const header = buildCardHeader(card, dict);
  const summaryText = getText(card, 'reading_summary_present') || getText(card, 'reading_summary_preview');
  const summary = summaryText ? `<p class="lede">${summaryText}</p>` : '';
  const story = getText(card, 'standalone_present');

  const main = document.createElement('div');
  main.className = 'panel';
  main.innerHTML = `${summary}${story ? `<p>${story}</p>` : ''}`;

  const loveNodes = [];
  const single = getText(card, 'love_reading_single');
  const couple = getText(card, 'love_reading_couple');
  if (single) loveNodes.push(renderListSection(dict.loveSingles, single));
  if (couple) loveNodes.push(renderListSection(dict.loveCouples, couple));

  const workNodes = [];
  const career = getText(card, 'career_present');
  const finance = getText(card, 'finance_present');
  if (career) workNodes.push(renderListSection(dict.careerToday, career));
  if (finance) workNodes.push(renderListSection(dict.financeToday, finance));

  const actionNodes = [];
  const action = getText(card, 'action_prompt');
  const reflection = getText(card, 'reflection_question');
  const affirmation = getText(card, 'affirmation');
  if (action) actionNodes.push(renderListSection(dict.actionToday, action));
  if (reflection) actionNodes.push(renderListSection(dict.reflectionToday, reflection));
  if (affirmation) actionNodes.push(renderListSection(dict.affirmation, affirmation));

  const ritualNodes = [];
  const breath = card.breath_pattern ? `${dict.breathPattern}: ${card.breath_pattern}` : '';
  if (breath) ritualNodes.push(renderListSection(dict.breathPattern, card.breath_pattern));
  const ritual = getText(card, 'ritual_2min');
  if (ritual) ritualNodes.push(renderListSection(dict.ritual, ritual));
  const journal = getText(card, 'journal_prompt_3lines');
  if (journal) ritualNodes.push(renderListSection(dict.journalPrompt, journal.replace(/\n/g, '<br>')));

  const colors = [];
  if (Array.isArray(card.color_palette)) {
    colors.push(renderColorBlock(dict.powerColor, card.color_palette[0]));
    colors.push(renderColorBlock(dict.drainingColor, card.color_palette[2]));
  }

  const metaWrap = document.createElement('div');
  metaWrap.className = 'meta-row';
  const yesNo = renderBadge(dict.metaYesNo, card.yes_no_bias);
  const decision = renderBadge(dict.metaDecision, card.decision_support);
  const timing = renderBadge(dict.metaTiming, card.timing_hint);
  [yesNo, decision, timing].forEach((node) => node && metaWrap.appendChild(node));

  const accordions = [
    renderAccordion(dict.topicLove, loveNodes),
    renderAccordion(`${dict.topicCareer} & ${dict.topicFinance}`, workNodes),
    renderAccordion(dict.actionToday, actionNodes),
    renderAccordion(`${dict.ritual} & ${dict.breathPattern}`, ritualNodes),
    renderAccordion(dict.colorsTitle, colors),
  ].filter(Boolean);

  cardHolder.append(header, main, metaWrap, ...accordions);
}

function renderOverall(dict) {
  const startBtn = document.getElementById('overallStartBtn');
  const board = document.getElementById('overall-card-board');
  const result = document.getElementById('overall-result');
  if (!startBtn || !board || !result) return;

  const selectedIndices = [];

  const renderBoard = () => {
    board.innerHTML = '';
    result.innerHTML = '';
    board.hidden = false;
    selectedIndices.length = 0;

    state.overallBoard = getDrawableCards(BOARD_CARD_COUNT);

    for (let i = 0; i < BOARD_CARD_COUNT; i += 1) {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'card-slot';
      slot.appendChild(Object.assign(document.createElement('div'), { className: 'card-back', textContent: '🐾' }));

      slot.onclick = () => {
        if (selectedIndices.includes(i)) return;
        if (selectedIndices.length >= OVERALL_SELECTION_COUNT) return;
        selectedIndices.push(i);
        slot.classList.add('is-selected');
        const badge = document.createElement('span');
        badge.className = 'selection-badge';
        badge.textContent = `${selectedIndices.length}`;
        slot.appendChild(badge);

        if (selectedIndices.length === OVERALL_SELECTION_COUNT) {
          board.querySelectorAll('button').forEach((btn) => {
            btn.disabled = true;
          });
          setTimeout(() => {
            board.hidden = true;
            drawOverallThreeCards(selectedIndices, dict);
          }, 450);
        }
      };

      board.appendChild(slot);
    }
  };

  startBtn.onclick = () => {
    renderBoard();
  };
}

function drawOverallThreeCards(selectedIndices, dict) {
  const cards = (selectedIndices || []).map((idx) => state.overallBoard[idx]).filter(Boolean);
  state.overallCards = cards;
  renderOverallCards(dict, cards);
}

function renderOverallCards(dict, cards = state.overallCards) {
  const result = document.getElementById('overall-result');
  if (!result) return;
  result.innerHTML = '';

  if (!cards || cards.length !== OVERALL_SELECTION_COUNT) return;

  const positions = ['past', 'present', 'future'];
  const listWrap = document.createElement('div');
  listWrap.className = 'multi-card-result';

  cards.forEach((card, idx) => {
    const position = positions[idx];
    const panel = document.createElement('div');
    panel.className = 'panel';
    const heading = document.createElement('h3');
    heading.textContent = `${dict[position] || position} • ${getName(card)}`;
    panel.appendChild(heading);

    const orientation = getOrientationLabel(card);
    if (orientation) {
      const badge = document.createElement('p');
      badge.className = 'eyebrow';
      badge.textContent = orientation;
      panel.appendChild(badge);
    }

    const summaryText =
      getText(card, `reading_summary_${position}`) || getText(card, 'reading_summary_preview');
    if (summaryText) {
      const p = document.createElement('p');
      p.className = 'lede';
      p.textContent = summaryText;
      panel.appendChild(p);
    }

    const body =
      getText(card, `standalone_${position}`)
      || getText(card, 'tarot_imply')
      || getText(card, 'tarot_imply_present');
    if (body) {
      const p = document.createElement('p');
      p.textContent = body;
      panel.appendChild(p);
    }

    listWrap.appendChild(panel);
  });

  result.appendChild(listWrap);

  const presentCard = cards[1];
  const storyline = getText(presentCard, 'reading_summary_preview');
  if (storyline) {
    const box = document.createElement('div');
    box.className = 'panel';
    const h = document.createElement('h4');
    h.textContent = dict.overallReadingLabel || dict.summaryTitle;
    const p = document.createElement('p');
    p.textContent = storyline;
    box.append(h, p);
    result.appendChild(box);
  }
}

function buildMetaRow(card, dict, overrides = {}) {
  if (!card) return null;
  const yesNoLabel = overrides.metaYesNo || dict.metaYesNo;
  const decisionLabel = overrides.metaDecision || dict.metaDecision;
  const timingLabel = overrides.metaTiming || dict.metaTiming;

  const meta = document.createElement('div');
  meta.className = 'meta-row';

  const yesNo = renderBadge(yesNoLabel, card.yes_no_bias);
  const decision = renderBadge(decisionLabel, card.decision_support);
  const timing = renderBadge(timingLabel, card.timing_hint);

  [yesNo, decision, timing].forEach((node) => node && meta.appendChild(node));

  return meta.children.length ? meta : null;
}

function appendText(panel, text, className) {
  if (!text) return;
  const p = document.createElement('p');
  if (className) p.className = className;
  p.textContent = text;
  panel.appendChild(p);
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

function renderQuestionResult(cards, spreadType, topic, dict) {
  const holder = document.getElementById('question-result');
  if (!holder) return;
  holder.innerHTML = '';
  if (!cards?.length) return;

  const normalizedTopic = topic === 'other' ? 'generic' : topic;

  const metaOverrides =
    normalizedTopic === 'love'
      ? {
        metaYesNo: dict.loveMetaYesNo,
        metaDecision: dict.loveMetaDecision,
        metaTiming: dict.loveMetaTiming,
      }
      : {};

  if (spreadType === 'quick') {
    const card = cards[0];
    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.appendChild(buildCardHeader(card, dict));

    if (normalizedTopic === 'love') {
      const summary = getText(card, 'reading_summary_present');
      appendText(panel, summary, 'lede');
      const main = getText(card, 'love_present') || getText(card, 'standalone_present');
      if (main) panel.appendChild(renderListSection(dict.topicLove, main));
      const single = getText(card, 'love_reading_single');
      const couple = getText(card, 'love_reading_couple');
      if (single) panel.appendChild(renderListSection(dict.loveSingles, single));
      if (couple) panel.appendChild(renderListSection(dict.loveCouples, couple));
    } else if (normalizedTopic === 'career') {
      const main = getText(card, 'career_present');
      const overlay = getText(card, 'reading_summary_present');
      appendText(panel, overlay, 'lede');
      if (main) panel.appendChild(renderListSection(dict.topicCareer, main));
    } else if (normalizedTopic === 'finance') {
      const main = getText(card, 'finance_present');
      const overlay = getText(card, 'reading_summary_present');
      appendText(panel, overlay, 'lede');
      if (main) panel.appendChild(renderListSection(dict.topicFinance, main));
      const crossover = getText(card, 'career_present');
      if (crossover) panel.appendChild(renderListSection(dict.careerToday, crossover));
    } else {
      const summary = getText(card, 'reading_summary_present');
      appendText(panel, summary, 'lede');
      appendText(panel, getText(card, 'standalone_present'));
    }

    const metaRow = buildMetaRow(card, dict, metaOverrides);
    if (metaRow) panel.appendChild(metaRow);
    holder.appendChild(panel);

    const actionHeading =
      normalizedTopic === 'love'
        ? dict.loveActionHeading
        : normalizedTopic === 'career'
          ? dict.careerActionHeading
          : normalizedTopic === 'finance'
            ? dict.financeActionHeading
            : '';
    const actionBlock = buildActionBlock(card, dict, {}, actionHeading || null);
    if (actionBlock) holder.appendChild(actionBlock);
    return;
  }

  const positions = ['past', 'present', 'future'];
  cards.forEach((card, idx) => {
    const position = positions[idx];
    const panel = document.createElement('div');
    panel.className = 'panel';
    const header = document.createElement('h3');
    header.textContent = `${dict[position]} • ${getName(card)}`;
    panel.appendChild(header);

    if (normalizedTopic === 'love') {
      appendText(panel, getText(card, `reading_summary_${position}`), 'lede');
      const loveText = getText(card, `love_${position}`) || getText(card, `standalone_${position}`);
      appendSection(panel, dict.topicLove, loveText);
    } else if (normalizedTopic === 'career') {
      appendText(panel, getText(card, `reading_summary_${position}`), 'lede');
      const careerText = getText(card, `career_${position}`) || getText(card, `standalone_${position}`);
      appendSection(panel, dict.topicCareer, careerText);
    } else if (normalizedTopic === 'finance') {
      appendText(panel, getText(card, `reading_summary_${position}`), 'lede');
      const financeText = getText(card, `finance_${position}`) || getText(card, `standalone_${position}`);
      appendSection(panel, dict.topicFinance, financeText);
    } else {
      appendText(panel, getText(card, `reading_summary_${position}`), 'lede');
      appendText(panel, getText(card, `standalone_${position}`));
    }

    if (position === 'present') {
      const metaRow = buildMetaRow(card, dict, metaOverrides);
      if (metaRow) panel.appendChild(metaRow);
    }

    holder.appendChild(panel);
  });

  const presentCard = cards[1];

  if (normalizedTopic === 'love') {
    const extras = [];
    const single = getText(presentCard, 'love_reading_single');
    const couple = getText(presentCard, 'love_reading_couple');
    if (single) extras.push(renderListSection(dict.loveSingles, single));
    if (couple) extras.push(renderListSection(dict.loveCouples, couple));
    if (extras.length) {
      const wrap = document.createElement('div');
      wrap.className = 'panel';
      extras.forEach((node) => node && wrap.appendChild(node));
      holder.appendChild(wrap);
    }
    const loveActions = buildActionBlock(presentCard, dict, {}, dict.loveActionHeading);
    if (loveActions) holder.appendChild(loveActions);
    return;
  }

  if (normalizedTopic === 'career') {
    const actions = buildActionBlock(presentCard, dict, {}, dict.careerActionHeading);
    if (actions) holder.appendChild(actions);
  } else if (normalizedTopic === 'finance') {
    const actions = buildActionBlock(presentCard, dict, {}, dict.financeActionHeading);
    if (actions) holder.appendChild(actions);
  } else {
    const storyline = getText(presentCard, 'reading_summary_preview');
    if (storyline) {
      const wrap = document.createElement('div');
      wrap.className = 'panel';
      appendSection(wrap, dict.overallReadingLabel || dict.summaryTitle, storyline);
      holder.appendChild(wrap);
    }
    const actions = buildActionBlock(presentCard, dict);
    if (actions) holder.appendChild(actions);
  }
}

function renderQuestion(dict) {
  const board = document.getElementById('question-card-board');
  const spreadToggle = document.getElementById('spread-toggle');
  const topicToggle = document.getElementById('topic-toggle');
  const result = document.getElementById('question-result');
  const resetBtn = document.getElementById('question-reset');
  if (!board || !spreadToggle || !topicToggle || !result || !resetBtn) return;

  const selectedIndices = [];

  const setActive = (container, btn) => {
    container.querySelectorAll('.chip').forEach((chip) => {
      chip.classList.remove('active', 'chip-active');
    });
    btn.classList.add('active', 'chip-active');
  };

  const renderBoard = () => {
    result.innerHTML = '';
    board.innerHTML = '';
    board.hidden = false;
    selectedIndices.length = 0;

    const selectionGoal = state.questionSpread === 'quick' ? QUESTION_QUICK_SELECTION : OVERALL_SELECTION_COUNT;
    const boardCount = state.questionSpread === 'quick' ? QUESTION_QUICK_BOARD_COUNT : BOARD_CARD_COUNT;

    state.questionBoard = getDrawableCards(boardCount);

    for (let i = 0; i < boardCount; i += 1) {
      const slot = document.createElement('button');
      slot.type = 'button';
      slot.className = 'card-slot';
      slot.appendChild(Object.assign(document.createElement('div'), { className: 'card-back', textContent: '🐾' }));

      slot.onclick = () => {
        if (selectedIndices.includes(i)) return;
        if (selectedIndices.length >= selectionGoal) return;
        selectedIndices.push(i);
        slot.classList.add('is-selected');
        const badge = document.createElement('span');
        badge.className = 'selection-badge';
        badge.textContent = `${selectedIndices.length}`;
        slot.appendChild(badge);

        if (selectedIndices.length === selectionGoal) {
          board.querySelectorAll('button').forEach((btn) => {
            btn.disabled = true;
          });
          setTimeout(() => {
            board.hidden = true;
            state.questionCards = selectedIndices
              .map((idx) => state.questionBoard[idx])
              .filter(Boolean);
            renderQuestionResult(state.questionCards, state.questionSpread, state.questionTopic, dict);
          }, 450);
        }
      };

      board.appendChild(slot);
    }
  };

  spreadToggle.querySelectorAll('[data-spread]').forEach((btn) => {
    btn.onclick = () => {
      setActive(spreadToggle, btn);
      state.questionSpread = btn.dataset.spread;
      renderBoard();
    };
  });

  topicToggle.querySelectorAll('[data-topic]').forEach((btn) => {
    btn.onclick = () => {
      setActive(topicToggle, btn);
      state.questionTopic = btn.dataset.topic;
      result.innerHTML = '';
    };
  });

  resetBtn.onclick = () => {
    renderBoard();
  };

  renderBoard();
}

function renderPage(dict) {
  const page = document.body.dataset.page;
  if (page === 'daily') renderDaily(dict);
  if (page === 'overall') renderOverall(dict);
  if (page === 'question') renderQuestion(dict);
}

function init() {
  initShell(state, (dict) => renderPage(dict), document.body.dataset.page);
  loadTarotData()
    .then((cards) => {
      state.cards = cards;
      renderPage(translations[state.currentLang] || translations.en);
    })
    .catch(() => {
      renderPage(translations[state.currentLang] || translations.en);
    });
}

document.addEventListener('DOMContentLoaded', init);
