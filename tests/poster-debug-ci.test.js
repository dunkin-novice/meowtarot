import test from 'node:test';
import assert from 'node:assert/strict';
import { access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from 'playwright';

const execFileAsync = promisify(execFile);

function parseJsonSteps(raw = '') {
  return String(raw)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => line.startsWith('{"step"'))
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

test('debug poster CI script generates poster artifacts', async (t) => {
  const chromiumPath = chromium.executablePath();
  if (!existsSync(chromiumPath)) {
    t.skip('Playwright Chromium executable missing; run `npx playwright install --with-deps chromium`.');
    return;
  }

  await execFileAsync('node', ['scripts/gen-ci-fixtures.mjs'], {
    timeout: 60_000,
    killSignal: 'SIGTERM',
    env: process.env,
  });

  const { stdout, stderr } = await execFileAsync('node', ['scripts/debug-poster-ci.mjs'], {
    timeout: 120_000,
    killSignal: 'SIGTERM',
    env: {
      ...process.env,
      DEBUG_POSTER_CI_VERBOSE: '0',
      DEBUG_POSTER_CI_PORT: '0',
      USE_LOCAL_ASSETS: '1',
    },
  });

  const output = `${stdout}\n${stderr}`;
  const steps = parseJsonSteps(output);

  assert.ok(
    steps.some((entry) => entry.step === 'img_probe' && entry.kind === 'card' && entry.ok === true && entry.simulated !== true),
    `missing successful real card img_probe step\n${output}`,
  );
  assert.ok(
    steps.some((entry) => entry.step === 'draw_card' && entry.executed === true && entry.simulated !== true),
    `missing real draw_card executed step\n${output}`,
  );

  const artifactWrites = steps.filter((entry) => entry.step === 'artifact_written' && entry.simulated !== true);
  assert.ok(artifactWrites.length >= 3, `expected >=3 real artifact_written steps\n${output}`);

  await access('artifacts/poster-daily-upright.webp');
  await access('artifacts/poster-daily-reversed.webp');
  await access('artifacts/poster-fallback.webp');
});
