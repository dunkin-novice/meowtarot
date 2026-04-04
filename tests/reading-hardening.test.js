import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { normalizeCards, meowTarotCards } from '../js/data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cardsJsonPath = path.join(__dirname, '../data/cards.json');
const cardsJson = JSON.parse(fs.readFileSync(cardsJsonPath, 'utf8'));
const rawCards = Array.isArray(cardsJson) ? cardsJson : Array.isArray(cardsJson.cards) ? cardsJson.cards : [];
const deck = normalizeCards(rawCards);

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
    clear() {
      store.clear();
    },
  };
}

function setupDom(search = '') {
  const sessionStorage = createStorage();
  const location = {
    search,
    pathname: '/reading.html',
    origin: 'https://example.com',
    href: `https://example.com/reading.html${search}`,
    replacedTo: null,
    replace(url) {
      this.replacedTo = url;
    },
  };

  global.window = {
    location,
    history: { replaceState: () => {} },
    innerWidth: 1024,
    localStorage: createStorage(),
    addEventListener: () => {},
    removeEventListener: () => {},
  };

  global.sessionStorage = sessionStorage;
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

async function importReading(search = '') {
  setupDom(search);
  const moduleUrl = `${pathToFileURL(path.join(__dirname, '../js/reading.js')).href}?t=${Date.now()}-${Math.random()}`;
  const mod = await import(moduleUrl);
  meowTarotCards.splice(0, meowTarotCards.length, ...deck);
  return {
    findCard: mod.__internalFindCard,
    validateReadingState: mod.__internalValidateReadingState,
    tryRecoverNonDailySelectionFromStorage: mod.__internalTryRecoverNonDailySelectionFromStorage,
    resetRecoveryGuard: mod.__internalResetRecoveryGuard,
    setStateForTest: mod.__internalSetStateForTest,
    getStateForTest: mod.__internalGetStateForTest,
  };
}

test('patch A: count mismatch in question mode recovers once from valid storage and keeps URL topic/spread', async () => {
  const hooks = await importReading('?m=q&s=story&t=love');
  const validRecoveryCards = ['01-the-fool-upright', '02-the-magician-reversed', '03-the-high-priestess-upright'];
  sessionStorage.setItem('meowtarot_selection', JSON.stringify({
    mode: 'question',
    spread: 'quick',
    topic: 'career',
    cards: validRecoveryCards,
  }));

  hooks.setStateForTest({
    mode: 'question',
    spread: 'story',
    topic: 'love',
    selectedIds: ['01-the-fool-upright'],
  });
  hooks.resetRecoveryGuard();

  assert.strictEqual(hooks.validateReadingState(), true);
  assert.deepStrictEqual(hooks.getStateForTest().selectedIds, validRecoveryCards);
  assert.strictEqual(hooks.getStateForTest().topic, 'love');
  assert.strictEqual(hooks.getStateForTest().spread, 'story');
});

test('patch A: unresolved cards in question mode uses recoverable fallback when storage is invalid', async () => {
  const hooks = await importReading('?m=q&s=story&t=love');
  hooks.resetRecoveryGuard();
  hooks.setStateForTest({
    mode: 'question',
    spread: 'story',
    topic: 'love',
    selectedIds: ['bad-1', 'bad-2', 'bad-3'],
  });
  sessionStorage.setItem('meowtarot_selection', JSON.stringify({
    mode: 'question',
    spread: 'story',
    topic: 'love',
    cards: ['01-the-fool-upright', '02-the-magician-reversed', '03-the-high-priestess-upright'],
  }));
  assert.strictEqual(hooks.validateReadingState(), true);

  const hooks2 = await importReading('?m=q&s=story&t=love');
  hooks2.resetRecoveryGuard();
  hooks2.setStateForTest({
    mode: 'question',
    spread: 'story',
    topic: 'love',
    selectedIds: ['bad-1', 'bad-2', 'bad-3'],
  });
  sessionStorage.setItem('meowtarot_selection', JSON.stringify({
    mode: 'question',
    spread: 'story',
    topic: 'love',
    cards: ['missing-a', 'missing-b', 'missing-c'],
  }));
  assert.strictEqual(hooks2.validateReadingState(), true);
  assert.deepStrictEqual(hooks2.getStateForTest().selectedIds, []);
  assert.strictEqual(window.location.replacedTo, null);
});

test('patch A: recovery is one-shot and daily mode behavior remains unchanged', async () => {
  const hooks = await importReading('?m=q&s=story&t=love');
  hooks.resetRecoveryGuard();
  hooks.setStateForTest({
    mode: 'question',
    spread: 'story',
    topic: 'love',
    selectedIds: ['bad-1'],
  });
  sessionStorage.setItem('meowtarot_selection', JSON.stringify({
    mode: 'question',
    spread: 'story',
    topic: 'love',
    cards: ['missing-a', 'missing-b', 'missing-c'],
  }));
  assert.strictEqual(hooks.validateReadingState(), false);
  const firstRedirect = window.location.replacedTo;

  window.location.replacedTo = null;
  assert.strictEqual(hooks.validateReadingState(), false);
  assert.ok(window.location.replacedTo);
  assert.notStrictEqual(firstRedirect, undefined);

  const dailyHooks = await importReading('?m=d&s=quick&t=g');
  dailyHooks.resetRecoveryGuard();
  dailyHooks.setStateForTest({
    mode: 'daily',
    spread: 'quick',
    topic: 'generic',
    selectedIds: ['01-the-fool-upright', '02-the-magician-reversed'],
  });
  assert.strictEqual(dailyHooks.validateReadingState(), true);
  assert.deepStrictEqual(dailyHooks.getStateForTest().selectedIds, []);
});

test('patch B: findCard resolves slug, compact/expanded tokens, and legacy majors', async () => {
  const hooks = await importReading('?m=q&s=story&t=love');
  const slug = hooks.findCard('01-the-fool-upright');
  const compact = hooks.findCard('1u');
  const expanded = hooks.findCard('1-upright');
  const legacy = hooks.findCard('maj-00');

  assert.strictEqual(slug?.id, '01-the-fool-upright');
  assert.strictEqual(compact?.id, '01-the-fool-upright');
  assert.strictEqual(expanded?.id, '01-the-fool-upright');
  assert.strictEqual(legacy?.id, '01-the-fool-upright');

  const reversed = hooks.findCard('01-the-fool-reversed');
  assert.strictEqual(reversed?.orientation, 'reversed');
});
