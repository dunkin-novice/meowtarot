#!/usr/bin/env node

const DEFAULT_URLS = {
  working: 'https://cdn.meowtarot.com/assets/meow-v2/00-back.webp',
  suspect: 'https://cdn.meowtarot.com/assets/meow-v2/01-the-fool-upright.webp',
  background: 'https://cdn.meowtarot.com/backgrounds/bg-000.webp',
};

const IMPORTANT_HEADERS = [
  'content-type',
  'content-length',
  'cache-control',
  'access-control-allow-origin',
  'access-control-allow-methods',
  'access-control-allow-headers',
  'cross-origin-resource-policy',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'timing-allow-origin',
  'accept-ranges',
  'cf-ray',
  'server',
  'cf-cache-status',
  'cf-mitigated',
  'x-frame-options',
];

function parseArgs(argv) {
  const out = { ...DEFAULT_URLS };
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const [key, valueFromEq] = arg.slice(2).split('=');
    const value = valueFromEq ?? argv[i + 1];
    if (!value) continue;
    if (valueFromEq == null) i += 1;
    if (key in out) out[key] = value;
  }
  return out;
}

function pickHeaders(headers) {
  const result = {};
  IMPORTANT_HEADERS.forEach((header) => {
    const value = headers.get(header);
    if (value != null) result[header] = value;
  });
  return result;
}

async function request(method, url) {
  const init = {
    method,
    redirect: 'follow',
    headers: method === 'GET' ? { Range: 'bytes=0-1023' } : {},
  };

  try {
    const response = await fetch(url, init);
    const sampleBytes = method === 'GET' ? (await response.arrayBuffer()).byteLength : 0;
    return {
      ok: true,
      method,
      url,
      finalUrl: response.url,
      status: response.status,
      statusText: response.statusText,
      redirected: response.redirected,
      type: response.type,
      sampleBytes,
      headers: pickHeaders(response.headers),
    };
  } catch (error) {
    return {
      ok: false,
      method,
      url,
      error: error?.message || String(error),
      cause: error?.cause?.code || null,
    };
  }
}

function printResult(label, result) {
  console.log(`\n=== ${label} ${result.method} ===`);
  if (!result.ok) {
    console.log(`request_error: ${result.error}`);
    if (result.cause) console.log(`cause: ${result.cause}`);
    return;
  }
  console.log(`status: ${result.status} ${result.statusText}`);
  console.log(`final_url: ${result.finalUrl}`);
  console.log(`redirected: ${result.redirected}`);
  console.log(`response_type: ${result.type}`);
  if (result.method === 'GET') console.log(`sample_bytes: ${result.sampleBytes}`);
  IMPORTANT_HEADERS.forEach((key) => {
    if (key in result.headers) {
      console.log(`${key}: ${result.headers[key]}`);
    }
  });
}

function printDiff(baselineLabel, baseline, label, candidate) {
  console.log(`\n--- header diff: ${baselineLabel} vs ${label} (HEAD) ---`);
  if (!baseline.ok || !candidate.ok) {
    console.log('diff unavailable (one request failed)');
    return;
  }
  const keys = new Set([...IMPORTANT_HEADERS, 'status']);
  for (const key of keys) {
    const left = key === 'status' ? String(baseline.status) : (baseline.headers[key] ?? '<missing>');
    const right = key === 'status' ? String(candidate.status) : (candidate.headers[key] ?? '<missing>');
    if (left !== right) {
      console.log(`${key}:`);
      console.log(`  ${baselineLabel}: ${left}`);
      console.log(`  ${label}: ${right}`);
    }
  }
}

async function main() {
  const urls = parseArgs(process.argv);
  const entries = Object.entries(urls);
  const results = {};

  for (const [label, url] of entries) {
    const head = await request('HEAD', url);
    const get = await request('GET', url);
    results[label] = { head, get };
    printResult(label, head);
    printResult(label, get);
  }

  const baseline = results.working?.head;
  if (baseline) {
    for (const [label] of entries) {
      if (label === 'working') continue;
      printDiff('working', baseline, label, results[label].head);
    }
  }

  const allRequests = Object.values(results).flatMap((entry) => [entry.head, entry.get]);
  const anySuccess = allRequests.some((entry) => entry?.ok === true);
  if (!anySuccess) {
    const causes = [...new Set(allRequests.map((entry) => entry?.cause).filter(Boolean))];
    console.log('\n[non-fatal] No CDN requests succeeded in this environment.');
    if (causes.length) {
      console.log(`[non-fatal] Observed network causes: ${causes.join(', ')}`);
    }
    console.log('[non-fatal] This script exits 0 so CI remains green while preserving evidence output.');
  }
}

main().catch((error) => {
  console.error('[non-fatal] debug-cdn-headers encountered an unexpected error:', error?.message || String(error));
  process.exitCode = 0;
});
