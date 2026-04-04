import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const cardsJsonPath = path.join(__dirname, '../data/cards.json');
const cardsJson = JSON.parse(fs.readFileSync(cardsJsonPath, 'utf8'));
const cards = Array.isArray(cardsJson) ? cardsJson : cardsJson.cards;

function createStorage(initial = {}) {
  const store = new Map(Object.entries(initial));
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

async function importDataModule() {
  const moduleUrl = `${pathToFileURL(path.join(__dirname, '../js/data.js')).href}?t=${Date.now()}-${Math.random()}`;
  return import(moduleUrl);
}

test('loadTarotData rejects stale cache and refetches full deck', async () => {
  const staleCache = JSON.stringify({
    version: '2024-10-01',
    data: [{ id: 'maj-00' }, { id: 'maj-01' }],
  });
  global.localStorage = createStorage({ meowtarot_cards_full: staleCache });
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    return {
      ok: true,
      json: async () => ({ cards }),
    };
  };

  const data = await importDataModule();
  const loaded = await data.loadTarotData();

  assert.strictEqual(fetchCalls, 1);
  assert.ok(Array.isArray(loaded));
  assert.ok(loaded.length >= 120);
  assert.ok(loaded.some((card) => card.id === '33-page-of-wands-upright'));
});

test('loadTarotData accepts valid canonical cache without refetch', async () => {
  const validCache = JSON.stringify({
    version: '2024-10-01',
    data: cards,
  });
  global.localStorage = createStorage({ meowtarot_cards_full: validCache });
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    return {
      ok: true,
      json: async () => ({ cards }),
    };
  };

  const data = await importDataModule();
  const loaded = await data.loadTarotData();

  assert.strictEqual(fetchCalls, 0);
  assert.ok(Array.isArray(loaded));
  assert.ok(loaded.length >= 120);
  assert.ok(loaded.some((card) => card.id === '33-page-of-wands-reversed'));
});
