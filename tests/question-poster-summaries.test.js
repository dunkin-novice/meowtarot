import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveQuestionPosterSummaries } from '../share/poster.js';

test('Ask a Question poster summaries prefer topic-specific card fields for Career, Finance, and Love (EN)', () => {
  const makePayload = (topic) => ({ mode: 'question', lang: 'en', topic, reading: {} });
  const cardEntries = [
    { card: { career_past_en: 'Career past', finance_past_en: 'Finance past', love_past_en: 'Love past', reading_summary_past_en: 'Generic past' } },
    { card: { career_present_en: 'Career present', finance_present_en: 'Finance present', love_present_en: 'Love present', reading_summary_present_en: 'Generic present' } },
    { card: { career_future_en: 'Career future', finance_future_en: 'Finance future', love_future_en: 'Love future', reading_summary_future_en: 'Generic future' } },
  ];

  assert.deepEqual(resolveQuestionPosterSummaries(makePayload('career'), cardEntries), ['Career past', 'Career present', 'Career future']);
  assert.deepEqual(resolveQuestionPosterSummaries(makePayload('finance'), cardEntries), ['Finance past', 'Finance present', 'Finance future']);
  assert.deepEqual(resolveQuestionPosterSummaries(makePayload('love'), cardEntries), ['Love past', 'Love present', 'Love future']);
});

test('Ask a Question poster summaries use Thai locale topic fields first', () => {
  const payload = { mode: 'question', lang: 'th', topic: 'career', reading: {} };
  const cardEntries = [
    { card: { career_past_th: 'งานอดีต', career_past_en: 'Career past' } },
    { card: { career_present_th: 'งานปัจจุบัน', career_present_en: 'Career present' } },
    { card: { career_future_th: 'งานอนาคต', career_future_en: 'Career future' } },
  ];

  assert.deepEqual(resolveQuestionPosterSummaries(payload, cardEntries), ['งานอดีต', 'งานปัจจุบัน', 'งานอนาคต']);
});

test('Ask a Question poster summaries fall back to localized reading_summary when topic fields are missing', () => {
  const payload = {
    mode: 'question',
    lang: 'th',
    topic: 'family',
    reading: {
      reading_summary_past_th: 'สรุปอดีต',
      reading_summary_present_th: 'สรุปปัจจุบัน',
      reading_summary_future_th: 'สรุปอนาคต',
    },
  };
  const cardEntries = [
    { card: { reading_summary_past_en: 'Generic past EN' } },
    { card: { reading_summary_present_en: 'Generic present EN' } },
    { card: { reading_summary_future_en: 'Generic future EN' } },
  ];

  assert.deepEqual(resolveQuestionPosterSummaries(payload, cardEntries), ['สรุปอดีต', 'สรุปปัจจุบัน', 'สรุปอนาคต']);
});

test('Ask a Question poster summaries support all topic mappings', () => {
  const topics = ['love', 'finance', 'career', 'self', 'family', 'travel', 'health'];

  for (const topic of topics) {
    const payload = { mode: 'question', lang: 'en', topic, reading: {} };
    const cardEntries = [
      { card: { [`${topic}_past_en`]: `${topic}-past` } },
      { card: { [`${topic}_present_en`]: `${topic}-present` } },
      { card: { [`${topic}_future_en`]: `${topic}-future` } },
    ];

    assert.deepEqual(resolveQuestionPosterSummaries(payload, cardEntries), [`${topic}-past`, `${topic}-present`, `${topic}-future`]);
  }
});
