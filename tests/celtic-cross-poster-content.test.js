import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveCelticCrossPosterContent } from '../share/poster.js';

test('resolveCelticCrossPosterContent uses Celtic Cross standalone fields with localized fallbacks', () => {
  const payload = {
    mode: 'full',
    lang: 'en',
    cards: [
      { position: 'present' },
      { position: 'challenge' },
      { position: 'past' },
      { position: 'future' },
      { position: 'above' },
      { position: 'below' },
      { position: 'advice' },
      { position: 'external' },
      { position: 'hopes' },
      { position: 'outcome' },
    ],
  };

  const cardEntries = [
    { card: { card_name_en: 'The Star', standalone_present_en: 'Present clarity is returning.' }, orientation: 'upright' },
    { card: { card_name_en: 'Two of Swords' }, orientation: 'upright' },
    { card: { card_name_en: 'Six of Cups' }, orientation: 'upright' },
    { card: { card_name_en: 'Ace of Wands' }, orientation: 'upright' },
    { card: { card_name_en: 'The Sun' }, orientation: 'upright' },
    { card: { card_name_en: 'Four of Pentacles' }, orientation: 'upright' },
    { card: { card_name_en: 'Strength', general_meaning_en: 'Respond gently and stay steady.' }, orientation: 'reversed' },
    { card: { card_name_en: 'Three of Pentacles' }, orientation: 'upright' },
    { card: { card_name_en: 'Nine of Swords' }, orientation: 'upright' },
    { card: { card_name_en: 'The World', tarot_imply_en: 'A fuller cycle is ready to complete. Trust the opening.' }, orientation: 'upright' },
  ];

  const content = resolveCelticCrossPosterContent(payload, cardEntries);

  assert.equal(content.present.body, 'Present clarity is returning.');
  assert.equal(content.advice.body, 'Respond gently and stay steady.');
  assert.equal(content.outcome.body, 'A fuller cycle is ready to complete. Trust the opening.');
  assert.equal(content.heroTitle, 'A fuller cycle is ready to complete.');
  assert.equal(content.outcome.title, 'The World');
  assert.equal(content.advice.orientationLabel, 'Reversed');
});

test('resolveCelticCrossPosterContent supports Thai copy and titles', () => {
  const payload = {
    mode: 'full',
    lang: 'th',
    cards: Array.from({ length: 10 }, (_, index) => ({ position: ['present', 'challenge', 'above', 'past', 'below', 'future', 'advice', 'external', 'hopes', 'outcome'][index] })),
  };

  const cardEntries = [
    { card: { card_name_th: 'ไพ่ดวงดาว', standalone_present_th: 'ตอนนี้หัวใจเริ่มกลับมานิ่งแล้ว' }, orientation: 'upright' },
    {},
    {},
    {},
    {},
    {},
    { card: { card_name_th: 'ไพ่พละกำลัง', action_prompt_th: 'ค่อย ๆ เดินและวางใจในจังหวะของตัวเอง' }, orientation: 'upright' },
    {},
    {},
    { card: { card_name_th: 'ไพ่โลก', standalone_future_th: 'ปลายทางนี้กำลังปิดวงอย่างสวยงาม' }, orientation: 'upright' },
  ];

  const content = resolveCelticCrossPosterContent(payload, cardEntries);

  assert.equal(content.strings.eyebrow, 'เซลติกครอส');
  assert.equal(content.present.title, 'ไพ่ดวงดาว');
  assert.equal(content.advice.body, 'ค่อย ๆ เดินและวางใจในจังหวะของตัวเอง');
  assert.equal(content.outcome.body, 'ปลายทางนี้กำลังปิดวงอย่างสวยงาม');
  assert.equal(content.heroTitle, 'ปลายทางนี้กำลังปิดวงอย่างสวยงาม');
});
