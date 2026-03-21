import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { normalizeCards, normalizeId } from '../js/data.js';
import {
  buildQuestionReadingInputPayload,
  findCardById,
  generateQuestionReading,
  generateQuestionShareSummary,
  getBaseCardId,
  getBaseId,
  getQuestionMeaningField,
  getOrientation,
  matchesCardId,
  toSeoSlugFromId,
  toOrientation,
} from '../js/reading-helpers.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cardsJsonPath = path.join(__dirname, '../data/cards.json');
const cardsJson = JSON.parse(fs.readFileSync(cardsJsonPath, 'utf8'));
const rawCards = Array.isArray(cardsJson) ? cardsJson : Array.isArray(cardsJson.cards) ? cardsJson.cards : [];
const deck = normalizeCards(rawCards);

test('getBaseId strips orientation while getOrientation defaults to upright', () => {
  assert.strictEqual(getBaseId('01-the-fool-reversed'), '01-the-fool');
  assert.strictEqual(getBaseId('01-the-fool-upright'), '01-the-fool');
  assert.strictEqual(getOrientation('01-the-fool-reversed'), 'reversed');
  assert.strictEqual(getOrientation('01-the-fool-upright'), 'upright');
  assert.strictEqual(getOrientation('MAJ_01'), 'upright');
  assert.strictEqual(getBaseCardId('MAJ_01'), 'maj-01');
  assert.strictEqual(toOrientation({ id: '01-the-fool-reversed', orientation: 'reversed' }), 'reversed');
});

test('SEO slug generation ignores orientation suffixes', () => {
  const sample = deck.find((card) => card.id.includes('-')); // any normalized id
  assert.ok(sample, 'expected at least one card in the deck');

  const base = getBaseId(sample.id, normalizeId);
  assert.strictEqual(toSeoSlugFromId(sample.id, normalizeId), base);
  assert.strictEqual(toSeoSlugFromId(`${base}-reversed`, normalizeId), base);
});

test('findCardById resolves SEO slug ids', () => {
  const slugged = deck.find((card) => card.seo_slug_en);
  assert.ok(slugged, 'expected to find at least one card with an SEO slug');

  const card = findCardById(deck, slugged.seo_slug_en);
  assert.ok(card, 'expected to resolve a card for the first slugged ID');
  assert.ok(matchesCardId(card, slugged.seo_slug_en));
  assert.strictEqual(getBaseId(card.id), getBaseId(slugged.id));
});

test('findCardById prefers the requested orientation', () => {
  const sampleBase = getBaseId(deck[0].id);
  const upright = deck.find((card) => card.id === `${sampleBase}-upright`);
  const reversed = deck.find((card) => card.id === `${sampleBase}-reversed`);

  assert.ok(upright, 'expected upright orientation');
  assert.ok(reversed, 'expected reversed orientation');

  const uprightHit = findCardById(deck, `${sampleBase}-upright`);
  const reversedHit = findCardById(deck, `${sampleBase}-reversed`);

  assert.strictEqual(uprightHit?.id, upright.id);
  assert.strictEqual(reversedHit?.id, reversed.id);
});

test('each base card appears in both upright and reversed orientations', () => {
  const baseIds = new Set(deck.map((card) => getBaseId(card.id)));

  for (const baseId of baseIds) {
    const upright = deck.find((card) => card.id === `${baseId}-upright`);
    const reversed = deck.find((card) => card.id === `${baseId}-reversed`);
    assert.ok(upright, `missing upright orientation for ${baseId}`);
    assert.ok(reversed, `missing reversed orientation for ${baseId}`);
  }

  assert.strictEqual(deck.length, baseIds.size * 2, 'deck should be doubled by orientation');
});

test('getQuestionMeaningField switches to standalone for non-specialized topics', () => {
  assert.strictEqual(getQuestionMeaningField('love', 'past'), 'love_past_en');
  assert.strictEqual(getQuestionMeaningField('career', 'present'), 'career_present_en');
  assert.strictEqual(getQuestionMeaningField('finance', 'future'), 'finance_future_en');
  assert.strictEqual(getQuestionMeaningField('other', 'future'), 'standalone_future_en');
  assert.strictEqual(getQuestionMeaningField('self', 'past'), 'standalone_past_en');
});

test('buildQuestionReadingInputPayload derives question input from selected cards and repo data', () => {
  const payload = buildQuestionReadingInputPayload({
    topic: 'career',
    selectedIds: ['01-the-fool-upright', '02-the-magician-reversed', '03-the-high-priestess-upright'],
    cards: deck,
  });

  assert.deepStrictEqual(payload.cards.map((card) => [card.position, card.card]), [
    ['past', 'The Fool'],
    ['present', 'The Magician'],
    ['future', 'The High Priestess'],
  ]);

  assert.strictEqual(
    payload.cards[0].meaning,
    deck.find((card) => card.id === '01-the-fool-upright')?.career_past_en,
  );
  assert.strictEqual(
    payload.cards[1].meaning,
    deck.find((card) => card.id === '02-the-magician-reversed')?.career_present_en,
  );
  assert.strictEqual(
    payload.cards[2].meaning,
    deck.find((card) => card.id === '03-the-high-priestess-upright')?.career_future_en,
  );
  assert.strictEqual(
    payload.cards[1].reading_summary_preview_en,
    deck.find((card) => card.id === '02-the-magician-reversed')?.reading_summary_preview_en,
  );
  assert.deepStrictEqual(payload.action, {
    prompt: deck.find((card) => card.id === '02-the-magician-reversed')?.action_prompt_en || '',
    reflection: deck.find((card) => card.id === '02-the-magician-reversed')?.reflection_question_en || '',
    affirmation: deck.find((card) => card.id === '02-the-magician-reversed')?.affirmation_en || '',
  });
  assert.strictEqual(
    payload.reading_summary_preview_en,
    deck.find((card) => card.id === '02-the-magician-reversed')?.reading_summary_preview_en || '',
  );
});

test('generateQuestionReading is a pure transformation of llmInput and uses positions instead of array order', () => {
  const llmInput = {
    reading_summary_preview_en: 'Past lessons are clarifying the present and shaping a steadier future.',
    cards: [
      { position: 'future', card: 'The High Priestess', meaning: 'Trust what is quietly unfolding.' },
      { position: 'past', card: 'The Fool', meaning: 'Your earlier leap created this opening.' },
      { position: 'present', card: 'The Magician', meaning: 'Use what is already in your hands.' },
    ],
    action: {
      prompt: 'Pick one tool and use it today.',
    },
  };

  assert.deepStrictEqual(generateQuestionReading(llmInput), {
    intro: 'Right now, this question centers on The Magician: past lessons are clarifying the present and shaping a steadier future.',
    spread: [
      { position: 'past', card: 'The Fool', meaning: 'Your earlier leap created this opening.' },
      { position: 'present', card: 'The Magician', meaning: 'Use what is already in your hands.' },
      { position: 'future', card: 'The High Priestess', meaning: 'Trust what is quietly unfolding.' },
    ],
    synthesis: 'Your earlier leap created this opening. Now, The Magician asks for this response: use what is already in your hands. Taken together, it shows that past lessons are clarifying the present and shaping a steadier future. That opens into trust what is quietly unfolding.',
    takeaway: 'Beneath the surface, past lessons are clarifying the present and shaping a steadier future. Next, focus on this: Use what is already in your hands.',
    action: {
      position: 'present',
      card: 'The Magician',
      insight: 'Use what is already in your hands.',
      direction: 'Pick one tool and use it today.',
    },
  });
});


test('generateQuestionShareSummary builds compact share copy from question reading output', () => {
  const reading = generateQuestionReading({
    reading_summary_preview_en: 'Past lessons are clarifying the present and shaping a steadier future.',
    cards: [
      { position: 'future', card: 'The High Priestess', meaning: 'Trust what is quietly unfolding.' },
      { position: 'past', card: 'The Fool', meaning: 'Your earlier leap created this opening.' },
      { position: 'present', card: 'The Magician', meaning: 'Use what is already in your hands.' },
    ],
    action: {
      prompt: 'Pick one tool and use it today.',
    },
  });

  assert.deepStrictEqual(generateQuestionShareSummary(reading), {
    headline: 'The Magician: Use what is already in your hands',
    summary: 'Your earlier leap created this opening. Now, use what is already in your hands. Next, trust what is quietly unfolding.',
    cta: 'Pick one tool and use it today.',
  });
});

test('generateQuestionShareSummary falls back to existing reading output when action details are missing', () => {
  const reading = {
    intro: 'Right now, this question centers on the present moment: make the practical choice in front of you.',
    spread: [
      { position: 'present', card: 'Two of Pentacles', meaning: 'Make the practical choice in front of you.' },
      { position: 'future', card: 'Six of Swords', meaning: 'A calmer stretch is coming once you commit.' },
    ],
    synthesis: 'Make the practical choice in front of you. That opens into a calmer stretch is coming once you commit.',
    takeaway: 'Beneath the surface, make the practical choice in front of you. Next, focus on this: A calmer stretch is coming once you commit.',
    action: {
      position: 'present',
      card: '',
      insight: '',
      direction: '',
    },
  };

  assert.deepStrictEqual(generateQuestionShareSummary(reading), {
    headline: 'Two of Pentacles: Make the practical choice in front of you',
    summary: 'Now, make the practical choice in front of you. Next, a calmer stretch is coming once you commit.',
    cta: 'Start here: make the practical choice in front of you.',
  });
});
