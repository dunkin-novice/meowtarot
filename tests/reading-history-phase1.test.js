import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  loadReadings,
  sanitizeReadingRecord,
  saveReadingRecord,
  toLocalIsoDate,
} from '../js/reading-history.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function createStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
  };
}

function setupDomForReadingModule() {
  global.window = {
    location: {
      search: '?m=q&s=story&t=love',
      pathname: '/reading.html',
      origin: 'https://example.com',
      href: 'https://example.com/reading.html?m=q&s=story&t=love',
      replace: () => {},
    },
    history: { replaceState: () => {} },
    innerWidth: 1280,
    addEventListener: () => {},
    removeEventListener: () => {},
    localStorage: createStorage(),
  };

  global.sessionStorage = createStorage();
  global.document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    removeEventListener: () => {},
    createElement: () => ({
      style: {},
      className: '',
      textContent: '',
      dataset: {},
      classList: { add: () => {}, remove: () => {}, toggle: () => {} },
      appendChild: () => {},
      setAttribute: () => {},
      addEventListener: () => {},
      remove: () => {},
      querySelector: () => null,
      querySelectorAll: () => [],
    }),
    body: {
      classList: { add: () => {}, remove: () => {}, toggle: () => {} },
      setAttribute: () => {},
      removeAttribute: () => {},
    },
  };
}

async function importReadingInternals() {
  setupDomForReadingModule();
  const moduleUrl = `${pathToFileURL(path.join(__dirname, '../js/reading.js')).href}?test=${Date.now()}-${Math.random()}`;
  return import(moduleUrl);
}

function createSaveClient(capture = {}) {
  return {
    from(tableName) {
      if (tableName === 'readings') {
        return {
          insert(payload) {
            capture.readingInsert = payload;
            return {
              select() {
                return {
                  single: async () => ({ data: { id: 501 }, error: null }),
                };
              },
            };
          },
        };
      }

      if (tableName === 'reading_cards') {
        return {
          async insert(rows) {
            capture.readingCardsInsert = rows;
            return { error: null };
          },
        };
      }

      throw new Error(`Unexpected table: ${tableName}`);
    },
  };
}

function createLoadClient(rows) {
  return {
    from(tableName) {
      assert.equal(tableName, 'readings');
      return {
        select() {
          return this;
        },
        eq(column, value) {
          assert.equal(column, 'user_id');
          assert.equal(value, 'user-1');
          return this;
        },
        order(column, options) {
          assert.equal(column, 'created_at');
          assert.deepEqual(options, { ascending: false });
          return this;
        },
        async limit(value) {
          assert.equal(value, 20);
          return { data: rows, error: null };
        },
      };
    },
  };
}

test('saveReadingRecord handles daily/question/full paths and writes reading_cards rows', async () => {
  const dailyCapture = {};
  const dailyId = await saveReadingRecord('user-1', {
    mode: 'daily',
    spread: 'quick',
    topic: 'generic',
    lang: 'en',
    cards: [{ card_id: '01-the-fool', orientation: 'upright' }],
  }, { client: createSaveClient(dailyCapture), now: new Date('2026-04-20T06:00:00Z') });

  assert.equal(dailyId, 501);
  assert.equal(dailyCapture.readingInsert.mode, 'daily');
  assert.equal(dailyCapture.readingInsert.read_date, '2026-04-20');
  assert.equal(dailyCapture.readingCardsInsert.length, 1);
  assert.equal(dailyCapture.readingCardsInsert[0].position, null);

  const questionCapture = {};
  await saveReadingRecord('user-1', {
    mode: 'question',
    spread: 'story',
    topic: 'love',
    lang: 'th',
    cards: [
      { card_id: '02-the-magician', orientation: 'reversed', position: 'situation', sort_order: 0 },
      { card_id: '03-the-high-priestess', orientation: 'upright', position: 'challenge', sort_order: 1 },
    ],
  }, { client: createSaveClient(questionCapture), now: new Date('2026-04-20T07:00:00Z') });

  assert.equal(questionCapture.readingInsert.mode, 'question');
  assert.equal(questionCapture.readingInsert.topic, 'love');
  assert.equal(questionCapture.readingCardsInsert[0].position, 'situation');
  assert.equal(questionCapture.readingCardsInsert[1].position, 'challenge');

  const fullCapture = {};
  await saveReadingRecord('user-1', {
    mode: 'overall',
    spread: 'story',
    topic: 'career',
    lang: 'en',
    cards: [{ id: '04-the-empress', orientation: 'upright', position: 'past', sort_order: 0 }],
  }, { client: createSaveClient(fullCapture), now: new Date('2026-04-20T08:00:00Z') });

  assert.equal(fullCapture.readingInsert.mode, 'full');
  assert.equal(fullCapture.readingCardsInsert[0].card_id, '04-the-empress');
  assert.equal(fullCapture.readingCardsInsert[0].position, 'past');
});

test('non-daily deferred save guard and duplicate protection key behavior are stable', async () => {
  const reading = await importReadingInternals();

  assert.equal(reading.__internalShouldDeferNonDailyHistorySave({
    userId: 'u1',
    rendered: true,
    mode: 'question',
    selectedIds: ['01-the-fool-upright'],
  }), true);

  assert.equal(reading.__internalShouldDeferNonDailyHistorySave({
    userId: 'u1',
    rendered: false,
    mode: 'question',
    selectedIds: ['01-the-fool-upright'],
  }), false);

  assert.equal(reading.__internalShouldDeferNonDailyHistorySave({
    userId: 'u1',
    rendered: true,
    mode: 'daily',
    selectedIds: ['01-the-fool-upright'],
  }), false);

  reading.__internalSetStateForTest({ spread: 'story', topic: 'love', currentLang: 'en' });
  const cards = [
    { id: '01-the-fool-upright', orientation: 'upright' },
    { id: '02-the-magician-reversed', orientation: 'reversed' },
    { id: '03-the-high-priestess-upright', orientation: 'upright' },
  ];
  const sessionKeyBefore = reading.__internalGetReadingSessionKey('question', cards);

  reading.__internalSetStateForTest({ currentLang: 'th' });
  const sessionKeyAfterLangSwitch = reading.__internalGetReadingSessionKey('question', cards);
  assert.equal(sessionKeyAfterLangSwitch, sessionKeyBefore);
});

test('question/full normalized card payloads include expected positions and sort order', async () => {
  const reading = await importReadingInternals();
  const questionCards = reading.__internalBuildNormalizedReadingCards('question', [
    { id: '01-the-fool-upright', orientation: 'upright' },
    { id: '02-the-magician-reversed', orientation: 'reversed' },
    { id: '03-the-high-priestess-upright', orientation: 'upright' },
  ]);
  assert.deepEqual(questionCards.map((entry) => entry.position), ['past', 'present', 'future']);
  assert.deepEqual(questionCards.map((entry) => entry.sort_order), [0, 1, 2]);

  const fullCards = reading.__internalBuildNormalizedReadingCards('full', Array.from({ length: 3 }, (_, index) => ({
    id: `${String(index + 1).padStart(2, '0')}-card-${index + 1}-upright`,
    orientation: 'upright',
  })));
  assert.deepEqual(fullCards.map((entry) => entry.position), ['past', 'present', 'future']);
});

test('local-date read_date handling uses local calendar date and loadReadings sorts card order', async () => {
  const readingDate = new Date('2026-04-20T23:30:00-07:00');
  const sanitized = sanitizeReadingRecord('user-1', {
    mode: 'daily',
    cards: [{ card_id: '01-the-fool', orientation: 'upright' }],
  }, { now: readingDate });

  assert.equal(toLocalIsoDate(readingDate), '2026-04-21');
  assert.equal(sanitized.read_date, '2026-04-21');

  const loaded = await loadReadings('user-1', 20, {
    client: createLoadClient([
      {
        id: 1,
        mode: 'question',
        reading_cards: [
          { card_id: 'b', sort_order: 2 },
          { card_id: 'a', sort_order: 0 },
          { card_id: 'c', sort_order: 1 },
        ],
      },
    ]),
  });

  assert.deepEqual(loaded[0].reading_cards.map((entry) => entry.card_id), ['a', 'c', 'b']);
});
