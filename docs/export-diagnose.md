# Export diagnosis helper

Use this together with `SELFTEST_JSON` and the exporter function to quickly pick the primary failure class (A–F) and suggest the minimal exporter options.

## diagnoseSelfTest(selfTest)
- Input: the parsed `SELFTEST_JSON` object.
- Output: `{ cause: 'A' | 'B' | 'C' | 'D' | 'E' | 'F', evidence: string[] }`.
- Logic: prefers hidden/missing target → CORS risk → font/image waits → CSS risk → size risk → fallback.

```js
import { diagnoseSelfTest, exporterPatch } from './export-diagnose.js';

const diag = diagnoseSelfTest(selfTest);
console.log('Primary cause', diag.cause, 'Evidence:', diag.evidence);

const patch = exporterPatch(selfTest.library);
console.log('Exporter options to try', patch);
```

## Exporter patch templates
- `exporterPatch('html2canvas')` returns `{ library: 'html2canvas', options: { useCORS: true, allowTaint: false, logging: false, backgroundColor: null, scale: Math.min(2, devicePixelRatio) } }`.
- Default is `{ library: 'html-to-image', options: { useCORS: true, allowTaint: false, cacheBust: true, pixelRatio: Math.min(2, devicePixelRatio) } }`.

## Quick workflow
1. Run `runExportSelfTest` in the page and copy the `SELFTEST_JSON` line.
2. Parse the JSON (e.g., `const selfTest = JSON.parse(lineAfterColon);`).
3. Call `diagnoseSelfTest(selfTest)` to pick the primary cause and gather evidence strings.
4. Call `exporterPatch(selfTest.library)` to grab suggested exporter options to paste into your exporter.
