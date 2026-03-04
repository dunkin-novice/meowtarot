import assert from 'node:assert/strict';
import test from 'node:test';
import http from 'node:http';
import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

function getMimeType(filePath) {
  if (filePath.endsWith('.json')) return 'application/json; charset=utf-8';
  if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
  if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
  if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
  if (filePath.endsWith('.webp')) return 'image/webp';
  return 'application/octet-stream';
}

function createStaticServer(rootDir) {
  return http.createServer(async (req, res) => {
    try {
      const requestUrl = new URL(req.url || '/', 'http://127.0.0.1');
      const pathname = decodeURIComponent(requestUrl.pathname);
      const normalized = path.normalize(path.join(rootDir, pathname));
      if (!normalized.startsWith(rootDir)) {
        res.statusCode = 403;
        res.end('Forbidden');
        return;
      }
      const file = await readFile(normalized);
      res.statusCode = 200;
      res.setHeader('Content-Type', getMimeType(normalized));
      res.end(file);
    } catch {
      res.statusCode = 404;
      res.end('Not found');
    }
  });
}

test('cards.json is accessible from /data/cards.json and includes cards', async () => {
  const server = createStaticServer(repoRoot);
  await new Promise((resolve) => server.listen(5005, '127.0.0.1', resolve));

  try {
    const response = await fetch('http://127.0.0.1:5005/data/cards.json');
    assert.equal(response.status, 200, 'Expected /data/cards.json to return HTTP 200');

    const body = await response.text();
    let parsed;
    assert.doesNotThrow(() => {
      parsed = JSON.parse(body);
    }, 'Expected cards.json body to be valid JSON');

    const cards = Array.isArray(parsed) ? parsed : parsed?.cards;
    assert.ok(Array.isArray(cards), 'Expected cards.json to be an array or { cards: [...] }');
    assert.ok(cards.length > 0, 'Expected cards array length > 0');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
