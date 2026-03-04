import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

test('debug poster CI script generates poster artifacts', async () => {
  await execFileAsync('node', ['scripts/debug-poster-ci.mjs'], {
    env: {
      ...process.env,
      DEBUG_POSTER_CI_VERBOSE: '0',
    },
  });

  await access('artifacts/poster-daily-upright.webp');
  await access('artifacts/poster-daily-reversed.webp');
  await access('artifacts/poster-fallback.webp');
  assert.ok(true);
});
