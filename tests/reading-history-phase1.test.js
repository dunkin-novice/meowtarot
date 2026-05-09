import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  fetchCanonicalDailyReading,
  loadReadings,
  sanitizeReadingRecord,
  saveReadingRecord,
  toLocalIsoDate,
  upsertCanonicalDailyReading,
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

function createDailyConflictClient(capture = {}) {
  // First insert succeeds; second insert returns 23505; existing-row lookup returns id 501.
  capture.readingInserts = [];
  capture.readingCardsInserts = [];
  capture.existingLookups = 0;
  let insertCount = 0;
  return {
    from(tableName) {
      if (tableName === 'readings') {
        return {
          insert(payload) {
            insertCount += 1;
            capture.readingInserts.push(payload);
            const isFirst = insertCount === 1;
            return {
              select() {
                return {
                  single: async () => isFirst
                    ? { data: { id: 501 }, error: null }
                    : { data: null, error: { code: '23505', message: 'duplicate key' } },
                };
              },
            };
          },
          select() {
            return {
              eq() { return this; },
              maybeSingle: async () => {
                capture.existingLookups += 1;
                return { data: { id: 501 }, error: null };
              },
            };
          },
        };
      }
      if (tableName === 'reading_cards') {
        return {
          async insert(rows) {
            capture.readingCardsInserts.push(rows);
            return { error: null };
          },
        };
      }
      throw new Error(`Unexpected table: ${tableName}`);
    },
  };
}

function createSharedDailyStore() {
  const store = new Map();
  function key(userId, readDate) { return `${userId}|${readDate}`; }
  let nextId = 1000;
  function makeClient(captured = {}) {
    return {
      from(tableName) {
        if (tableName === 'readings') {
          return {
            insert(payload) {
              const k = key(payload.user_id, payload.read_date);
              return {
                select() {
                  return {
                    single: async () => {
                      if (store.has(k)) {
                        return { data: null, error: { code: '23505', message: 'duplicate key' } };
                      }
                      const id = nextId++;
                      store.set(k, { id, payload, cards: [] });
                      return { data: { id }, error: null };
                    },
                  };
                },
              };
            },
            select() {
              const filters = {};
              const api = {
                eq(col, val) { filters[col] = val; return api; },
                order() { return api; },
                limit() { return api; },
                async maybeSingle() {
                  const k2 = key(filters.user_id, filters.read_date);
                  const row = store.get(k2);
                  if (!row) return { data: null, error: null };
                  return {
                    data: {
                      id: row.id,
                      read_date: row.payload.read_date,
                      reading_cards: row.cards,
                    },
                    error: null,
                  };
                },
              };
              return api;
            },
          };
        }
        if (tableName === 'reading_cards') {
          return {
            async insert(rows) {
              if (!rows.length) return { error: null };
              const reading = [...store.values()].find((r) => r.id === rows[0].reading_id);
              if (reading) reading.cards = rows.map((r, i) => ({
                card_id: r.card_id,
                orientation: r.orientation,
                sort_order: r.sort_order ?? i,
              }));
              captured.lastInsert = rows;
              return { error: null };
            },
          };
        }
        throw new Error(`Unexpected table: ${tableName}`);
      },
    };
  }
  return { makeClient };
}

test('saveReadingRecord swallows 23505 for daily mode and returns existing canonical id without re-inserting cards', async () => {
  const capture = {};
  const client = createDailyConflictClient(capture);
  const card = { card_id: '01-the-fool', orientation: 'upright' };
  const now = new Date('2026-05-09T06:00:00Z');

  const firstId = await saveReadingRecord('user-1', {
    mode: 'daily', spread: 'quick', topic: 'generic', lang: 'en', cards: [card],
  }, { client, now });
  assert.equal(firstId, 501);
  assert.equal(capture.readingCardsInserts.length, 1);

  const secondId = await saveReadingRecord('user-1', {
    mode: 'daily', spread: 'quick', topic: 'generic', lang: 'en', cards: [card],
  }, { client, now });
  assert.equal(secondId, 501, 'second-draw same-day returns canonical first id');
  assert.equal(capture.existingLookups, 1, 'existing-row select fired exactly once');
  assert.equal(capture.readingCardsInserts.length, 1, 'no second reading_cards insert on conflict');
});

test('upsertCanonicalDailyReading is a no-op for anon users (no userId) and never touches the client', async () => {
  let clientTouched = false;
  const sentinelClient = {
    from() { clientTouched = true; throw new Error('anon path must not touch client'); },
  };
  const result = await upsertCanonicalDailyReading('', { card_id: '01-the-fool', orientation: 'upright' }, { client: sentinelClient });
  assert.equal(result, null);
  assert.equal(clientTouched, false);

  const result2 = await upsertCanonicalDailyReading('user-1', null, { client: sentinelClient });
  assert.equal(result2, null);
  assert.equal(clientTouched, false);
});

test('cross-device daily fetch returns the same canonical card written by the other client', async () => {
  const { makeClient } = createSharedDailyStore();
  const clientA = makeClient();
  const clientB = makeClient();
  const userId = 'user-xdevice';
  const now = new Date('2026-05-09T10:00:00Z');

  const writeId = await upsertCanonicalDailyReading(userId, {
    card_id: '07-the-chariot', orientation: 'reversed',
  }, { client: clientA, now, lang: 'en' });
  assert.ok(writeId, 'client A wrote a canonical row');

  const remote = await fetchCanonicalDailyReading(userId, '2026-05-09', { client: clientB });
  assert.ok(remote, 'client B sees the canonical row');
  assert.equal(remote.card_slug, 'the-chariot', 'numeric prefix stripped defensively');
  assert.equal(remote.orientation, 'reversed');
  assert.equal(remote.date, '2026-05-09');

  const conflictId = await upsertCanonicalDailyReading(userId, {
    card_id: '21-the-world', orientation: 'upright',
  }, { client: clientB, now, lang: 'en' });
  assert.equal(conflictId, writeId, 'second-device draw resolves to the same canonical id');

  const remoteAgain = await fetchCanonicalDailyReading(userId, '2026-05-09', { client: clientA });
  assert.equal(remoteAgain.card_slug, 'the-chariot', 'canonical card unchanged after second-device attempt');
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
