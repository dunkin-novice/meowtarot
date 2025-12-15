import { initShell } from './common.js';
import { getCardImageUrl, loadTarotData, meowTarotCards, normalizeId } from './data.js';

const SUIT_RANGES = {
  major: { start: 1, end: 22 },
  wands: { start: 23, end: 36 },
  cups: { start: 37, end: 50 },
  swords: { start: 51, end: 64 },
  pentacles: { start: 65, end: 78 },
};

const SUIT_COPY = {
  major: {
    name: 'Major Arcana',
    slug: 'major',
    path: '/tarot-card-meanings/major',
    title: 'Major Arcana Tarot Card Meanings',
    intro:
      'The Major Arcana follows the Fool’s journey through every life milestone. Each archetype reveals a turning point—awakening, challenge, or integration—that ripples across every area of your life.',
    element: 'All elements',
    themes: ['Archetypes', 'Soul lessons', 'Destiny shifts'],
    highlights: ['Numbers 0–21 · The Fool to The World', 'Use when you want the big picture of a reading'],
    guide: {
      lead: 'Ask big, zoomed-out questions. These archetypes signal defining plot points and invite you to link past, present, and future.',
      steps: [
        {
          title: 'Spot the chapter',
          text: 'Notice whether a card signals a beginning (The Fool, The Magician), midpoint test (Strength, Death), or finale (Judgement, The World).',
        },
        {
          title: 'Map the lesson',
          text: 'Pair the card with your question: what belief, choice, or surrender is being asked of you right now?',
        },
        {
          title: 'Anchor the advice',
          text: 'Summarize the card’s light and shadow in one line you can act on today.',
        },
      ],
    },
    faqLead: 'Understand how to read the 22 archetypes without splitting upright vs reversed URLs.',
    faqs: [
      {
        q: 'What makes the Major Arcana different from the suits?',
        a: 'They chart the core life journey—identity, values, spiritual growth—versus situational themes like career or relationships covered by the Minor suits.',
      },
      {
        q: 'Should I always include a Major Arcana card in a spread?',
        a: 'Not necessarily. When a Major appears naturally, treat it as a spotlight. If none show up, your situation may be more about day-to-day decisions.',
      },
      {
        q: 'Do I need separate upright and reversed pages?',
        a: 'No. Click any card to see upright and reversed meanings on a single, canonical page so link equity is never split.',
      },
      {
        q: 'How do I read multiple Majors in one pull?',
        a: 'Order them by number to see the storyline arc. Early numbers hint at setup energy, while later numbers show culmination and integration.',
      },
      {
        q: 'What is the fastest way to find a Major Arcana card?',
        a: 'Use this suit list in list view for a scannable order, then tap the card name to open the full meaning page.',
      },
    ],
  },
  wands: {
    name: 'Wands',
    slug: 'wands',
    path: '/tarot-card-meanings/wands',
    title: 'Wands Tarot Card Meanings',
    intro:
      'Wands is the fire suit—sparks of action, creativity, and confidence. It tracks how you start, commit to, and protect your momentum.',
    element: 'Fire',
    themes: ['Action', 'Passion', 'Creative drive'],
    highlights: ['Ace through King · 14 cards', 'Great for timing next steps and career momentum'],
    guide: {
      lead: 'Read Wands when you need momentum, motivation, or a reality check on why energy is stalling.',
      steps: [
        {
          title: 'Trace the flame',
          text: 'Ace and Two spark ideas. Three through Six show growth and recognition. Ten and court cards show how you steward or overextend the flame.',
        },
        {
          title: 'Pair with body cues',
          text: 'Notice your physical response to the card—tingle, excitement, tension. It mirrors where your drive is blocked or ready.',
        },
        {
          title: 'Check the fuel source',
          text: 'Is the motivation intrinsic (Ace, Page) or external validation (Six)? Align with the source that sustains you.',
        },
      ],
    },
    faqLead: 'Keep Wands interpretations consistent across upright and reversed meanings.',
    faqs: [
      {
        q: 'What questions fit the Wands suit?',
        a: 'Anything about initiative, career momentum, creative direction, launching, or recovering enthusiasm.',
      },
      {
        q: 'How do I order the Wands cards?',
        a: 'Use the canonical Ace → Ten sequence, then Page, Knight, Queen, and King.',
      },
      {
        q: 'Do Wands always mean yes?',
        a: 'They lean toward action, but reversed Wands can flag burnout, impatience, or misdirected effort.',
      },
      {
        q: 'How do I skim meanings fast?',
        a: 'Switch to list view, scan the card names in order, and tap the one you need—no reversed URL required.',
      },
    ],
  },
  cups: {
    name: 'Cups',
    slug: 'cups',
    path: '/tarot-card-meanings/cups',
    title: 'Cups Tarot Card Meanings',
    intro:
      'Cups is the water suit of feelings, intuition, and relationships. It reveals how you give, receive, and refill emotional energy.',
    element: 'Water',
    themes: ['Feelings', 'Intuition', 'Relationships'],
    highlights: ['Ace through King · 14 cards', 'Perfect for love spreads and emotional check-ins'],
    guide: {
      lead: 'Use Cups when you need clarity on connection, empathy, and emotional boundaries.',
      steps: [
        {
          title: 'Follow the tide',
          text: 'Ace to Three show openings and community. Four through Seven test satisfaction and vision. Ten and courts teach mature emotional flow.',
        },
        {
          title: 'Name the feeling word',
          text: 'Assign one feeling to each pull—curious, content, restless, guarded—to keep readings grounded.',
        },
        {
          title: 'Check reciprocity',
          text: 'Ask whether energy is mutual or one-sided. Cups cards highlight where to pour back into yourself.',
        },
      ],
    },
    faqLead: 'Answer relationship and intuition questions without splitting meaning URLs.',
    faqs: [
      {
        q: 'Are Cups only about romance?',
        a: 'No. They cover all emotional exchanges—family, friendship, creative fulfillment, and spiritual trust.',
      },
      {
        q: 'What if a Cups card feels heavy?',
        a: 'Reversed or challenging Cups point to stuck feelings. Note the emotion, then choose one supportive action to move the water.',
      },
      {
        q: 'Which Cups card starts the story?',
        a: 'Ace of Cups introduces new emotional flow. In list view you can see how it evolves through the suit.',
      },
      {
        q: 'Why keep one canonical link?',
        a: 'Every Cups card opens a single page with upright and reversed meanings together, preventing duplicate URLs.',
      },
    ],
  },
  swords: {
    name: 'Swords',
    slug: 'swords',
    path: '/tarot-card-meanings/swords',
    title: 'Swords Tarot Card Meanings',
    intro:
      'Swords is the air suit of mindset, truth, and decisions. It shows how thoughts cut through fog—or create it.',
    element: 'Air',
    themes: ['Mindset', 'Truth', 'Decisions'],
    highlights: ['Ace through King · 14 cards', 'Ideal for clarity, communication, and conflict resolution'],
    guide: {
      lead: 'Use Swords to diagnose thinking patterns and communication styles before choosing a path.',
      steps: [
        {
          title: 'Track the story arc',
          text: 'Ace plants a thought. Two through Five reveal tension and choice. Nine, Ten, and courts show how to cut cords and reclaim clarity.',
        },
        {
          title: 'Translate fear into facts',
          text: 'Name the belief attached to the card. Replace spiraling thoughts with one grounded statement you can test.',
        },
        {
          title: 'Balance head and heart',
          text: 'Pair Swords pulls with Cups or Wands cards in the spread to keep decisions aligned with emotion and action.',
        },
      ],
    },
    faqLead: 'Keep clarity-first interpretations in one canonical Swords library.',
    faqs: [
      {
        q: 'Do Swords always mean conflict?',
        a: 'They can. But they also represent truth-telling, contracts, and boundary setting—the tools that resolve conflict.',
      },
      {
        q: 'How should I read challenging Swords cards?',
        a: 'Look for the thought pattern. Then identify the smallest verifiable action—one conversation, one boundary—that shifts the story.',
      },
      {
        q: 'What order should I learn them?',
        a: 'Follow Ace → Ten, then Page, Knight, Queen, King. The list view here keeps that order clear.',
      },
      {
        q: 'Do I need separate reversed links?',
        a: 'No. Every card page combines upright and reversed meanings to avoid splitting SEO value.',
      },
    ],
  },
  pentacles: {
    name: 'Pentacles',
    slug: 'pentacles',
    path: '/tarot-card-meanings/pentacles',
    title: 'Pentacles Tarot Card Meanings',
    intro:
      'Pentacles is the earth suit of money, body, and sustainable growth. It shows how you build resources and security over time.',
    element: 'Earth',
    themes: ['Money', 'Work', 'Security'],
    highlights: ['Ace through King · 14 cards', 'Great for career, health, and long-term planning'],
    guide: {
      lead: 'Ask Pentacles about pacing: what deserves patience, investment, or a healthier routine?',
      steps: [
        {
          title: 'Plot the harvest cycle',
          text: 'Ace and Two plant the seed. Three through Seven track skill and effort. Nine, Ten, and courts show legacy and stewardship.',
        },
        {
          title: 'Measure effort vs reward',
          text: 'Notice where you overwork (Five, Seven) or enjoy returns (Nine, Ten). Adjust habits accordingly.',
        },
        {
          title: 'Ground the advice',
          text: 'Translate every pull into one tangible action—budget tweak, body care, or boundary—that protects your resources.',
        },
      ],
    },
    faqLead: 'Read money and wellbeing questions without splitting upright and reversed URLs.',
    faqs: [
      {
        q: 'Are Pentacles only about money?',
        a: 'They cover all material resources—finances, body, time, skills, and the environments that support growth.',
      },
      {
        q: 'What order do Pentacles cards follow?',
        a: 'Ace through Ten, then Page, Knight, Queen, King. This page lists them in that exact order for quick scanning.',
      },
      {
        q: 'How do I read a reversed Pentacles card?',
        a: 'Click the card to see upright and reversed interpretations together. Reversed often flags misaligned effort or scarcity beliefs.',
      },
      {
        q: 'Which spreads pair well with Pentacles?',
        a: 'Career, money, health, or habit-tracking spreads—anything requiring steady, practical guidance.',
      },
    ],
  },
};

const state = {
  suitKey: 'major',
  cards: [],
  view: 'grid',
};

initShell();

function detectSuit() {
  const bodySuit = document.body?.dataset?.suit;
  if (bodySuit && SUIT_COPY[bodySuit]) return bodySuit;

  const match = window.location.pathname.match(/tarot-card-meanings\/(major|wands|cups|swords|pentacles)/i);
  if (match && SUIT_COPY[match[1]]) return match[1];
  return 'major';
}

function getCardNumber(card) {
  const raw = card.card_id || card.id || '';
  const match = raw.match(/^(\d{2})/);
  return match ? parseInt(match[1], 10) : null;
}

function getSuitCards(cards, suitKey) {
  const range = SUIT_RANGES[suitKey];
  if (!range) return [];
  return cards
    .filter((card) => {
      const num = getCardNumber(card);
      const orientation = (card.orientation || '').toLowerCase();
      return num && num >= range.start && num <= range.end && orientation !== 'reversed';
    })
    .sort((a, b) => (getCardNumber(a) || 0) - (getCardNumber(b) || 0));
}

function buildCardHref(card) {
  const slug = card.seo_slug_en || normalizeId(card.card_name_en || card.name_en || card.name || card.id);
  return `/meanings.html?card=${slug}`;
}

function getCardSummary(card) {
  return card.reading_summary_preview_en || card.tarot_imply_en || card.meaning_en || '';
}

function padNumber(num) {
  return String(num || '').padStart(2, '0');
}

function renderCards() {
  const cardContainer = document.getElementById('suitCardList');
  if (!cardContainer) return;
  cardContainer.classList.toggle('is-grid', state.view === 'grid');
  cardContainer.classList.toggle('is-list', state.view === 'list');
  cardContainer.innerHTML = '';

  const range = SUIT_RANGES[state.suitKey];

  state.cards.forEach((card) => {
    const num = getCardNumber(card);
    const relative = num && range ? num - range.start + 1 : null;
    const displayNumber = padNumber(relative || num);

    const cardEl = document.createElement('article');
    cardEl.className = 'suit-card';

    const name = card.card_name_en || card.name_en || card.name || card.id;
    const summary = getCardSummary(card);
    const imageUrl = getCardImageUrl(card, { orientation: 'upright' });
    const altText = card.image_alt_en || `${name} tarot card illustration`;

    cardEl.innerHTML = `
      <a class="suit-card-link" href="${buildCardHref(card)}">
        <div class="suit-card-media" aria-hidden="true">
          <img loading="lazy" src="${imageUrl}" alt="${altText}" />
          <span class="suit-card-number">${displayNumber}</span>
        </div>
        <div class="suit-card-body">
          <p class="suit-card-order">${displayNumber}</p>
          <h3>${name}</h3>
          ${summary ? `<p class="suit-card-summary">${summary}</p>` : ''}
        </div>
      </a>
    `;

    cardContainer.appendChild(cardEl);
  });
}

function renderChips(config, cardCount) {
  const chipRow = document.getElementById('suitChips');
  if (!chipRow) return;

  chipRow.innerHTML = '';
  const chips = [];

  if (config.element) chips.push({ label: 'Element', value: config.element });
  if (config.themes?.length) chips.push({ label: 'Core themes', value: config.themes.join(' · ') });
  chips.push({ label: 'Card count', value: `${cardCount} cards` });

  chips.forEach((chip) => {
    const span = document.createElement('span');
    span.className = 'chip';
    span.innerHTML = `<strong>${chip.label}:</strong> ${chip.value}`;
    chipRow.appendChild(span);
  });
}

function renderHighlights(config) {
  const container = document.getElementById('suitHighlights');
  if (!container) return;
  container.innerHTML = '';

  (config.highlights || []).forEach((text) => {
    const item = document.createElement('div');
    item.className = 'highlight-card';
    item.textContent = text;
    container.appendChild(item);
  });
}

function renderGuide(config) {
  const lead = document.getElementById('guideLead');
  const grid = document.getElementById('guideContent');
  if (lead) lead.textContent = config.guide?.lead || '';
  if (!grid) return;
  grid.innerHTML = '';

  (config.guide?.steps || []).forEach((step) => {
    const card = document.createElement('article');
    card.className = 'guide-card';
    card.innerHTML = `
      <h3>${step.title}</h3>
      <p>${step.text}</p>
    `;
    grid.appendChild(card);
  });
}

function renderFaq(config) {
  const faqTitle = document.getElementById('faqTitle');
  const faqLead = document.getElementById('faqLead');
  const faqList = document.getElementById('faqList');

  if (faqTitle) faqTitle.textContent = `${config.name} FAQs`;
  if (faqLead) faqLead.textContent = config.faqLead || '';
  if (!faqList) return;

  faqList.innerHTML = '';
  (config.faqs || []).forEach((item) => {
    const details = document.createElement('details');
    details.className = 'faq-item';
    details.innerHTML = `
      <summary>${item.q}</summary>
      <p>${item.a}</p>
    `;
    faqList.appendChild(details);
  });
}

function setHero(config, cardCount) {
  const title = document.getElementById('suitTitle');
  const intro = document.getElementById('suitIntro');
  const cardCountEl = document.getElementById('suitCardCount');
  const eyebrow = document.querySelector('[data-suit-eyebrow]');
  const crumb = document.querySelector('[data-suit-crumb]');

  if (title) title.textContent = `${config.name} Tarot Card Meanings`;
  if (intro) intro.textContent = config.intro;
  if (cardCountEl) cardCountEl.textContent = cardCount;
  if (eyebrow) eyebrow.textContent = `${config.name} suit guide`;
  if (crumb) crumb.textContent = config.name;

  renderChips(config, cardCount);
  renderHighlights(config);
}

function setViewToggle() {
  const toggles = Array.from(document.querySelectorAll('.view-toggle [data-view]'));
  toggles.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === state.view);
  });
}

function bindViewToggle() {
  const toggles = Array.from(document.querySelectorAll('.view-toggle [data-view]'));
  toggles.forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (!view || view === state.view) return;
      state.view = view;
      setViewToggle();
      renderCards();
    });
  });
}

function setSeo(config) {
  const canonicalUrl = `https://www.meowtarot.com${config.path}`;
  const description = `${config.name} tarot card meanings with canonical upright + reversed guidance, keywords, and a fast card finder.`;
  const title = `${config.title} | MeowTarot`;

  const setContent = (selector, value, attr = 'content') => {
    const el = document.querySelector(selector);
    if (el) el.setAttribute(attr, value);
  };

  document.title = title;
  setContent('meta[name="description"][data-suit-meta="description"]', description);
  setContent('meta[property="og:title"][data-suit-meta="og-title"]', title);
  setContent('meta[property="og:description"][data-suit-meta="og-description"]', description);
  setContent('meta[property="og:url"][data-suit-meta="og-url"]', canonicalUrl);
  setContent('meta[name="twitter:title"][data-suit-meta="twitter-title"]', title);
  setContent('meta[name="twitter:description"][data-suit-meta="twitter-description"]', description);
  setContent('link[rel="canonical"][data-suit-meta="canonical"]', canonicalUrl, 'href');

  const faqEntities = (config.faqs || []).map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  }));

  const schema = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.meowtarot.com/' },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'Tarot Card Meanings',
            item: 'https://www.meowtarot.com/meanings.html',
          },
          { '@type': 'ListItem', position: 3, name: config.name, item: canonicalUrl },
        ],
      },
      {
        '@type': 'CollectionPage',
        '@id': `${canonicalUrl}#webpage`,
        url: canonicalUrl,
        name: config.title,
        description,
        about: [
          { '@type': 'Thing', name: `${config.name.toLowerCase()} tarot meanings` },
          { '@type': 'Thing', name: `${config.name} suit` },
        ],
        inLanguage: 'en',
        isPartOf: { '@id': 'https://www.meowtarot.com/#website' },
      },
      {
        '@type': 'FAQPage',
        '@id': `${canonicalUrl}#faq`,
        mainEntity: faqEntities,
      },
    ],
  };

  const schemaEl = document.getElementById('suit-schema');
  if (schemaEl) schemaEl.textContent = JSON.stringify(schema, null, 2);
}

function init() {
  state.suitKey = detectSuit();
  const config = SUIT_COPY[state.suitKey] || SUIT_COPY.major;

  bindViewToggle();
  setViewToggle();
  setSeo(config);

  loadTarotData()
    .then(() => {
      state.cards = getSuitCards(meowTarotCards, state.suitKey);
      setHero(config, state.cards.length);
      renderGuide(config);
      renderFaq(config);
      renderCards();
    })
    .catch((err) => {
      console.error('Failed to load suit cards', err);
    });
}

init();
