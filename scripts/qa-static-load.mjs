const baseUrl = process.env.QA_BASE_URL || 'http://127.0.0.1:8000';
const parsedBaseUrl = new URL(baseUrl);
const isProduction = parsedBaseUrl.hostname === 'aquastock-pro.pages.dev';
const isLocal = ['localhost', '127.0.0.1', '::1'].includes(parsedBaseUrl.hostname);

if (!isLocal && process.env.QA_ALLOW_REMOTE !== '1') {
  throw new Error('Target non-lokal ditolak. Gunakan QA_ALLOW_REMOTE=1 hanya untuk staging yang Anda kuasai.');
}
if (isProduction && process.env.QA_ALLOW_PRODUCTION_LOAD !== '1') {
  throw new Error('Uji beban produksi memerlukan QA_ALLOW_PRODUCTION_LOAD=1 dan persetujuan eksplisit.');
}

const requestsPerPath = 8;
const concurrency = 4;
const paths = [
  '/login/',
  '/manifest.json',
  '/sw.js',
  '/assets/js/components/barcode-scanner.js',
  '/assets/js/vendor/html5-qrcode.min.js'
];
const jobs = paths.flatMap(route => Array.from({ length: requestsPerPath }, () => route));
const results = [];
let nextJob = 0;

async function worker() {
  while (nextJob < jobs.length) {
    const route = jobs[nextJob++];
    const started = performance.now();
    try {
      const response = await fetch(new URL(route, baseUrl), {
        signal: AbortSignal.timeout(10000),
        cache: 'no-store'
      });
      const body = await response.arrayBuffer();
      results.push({
        route,
        status: response.status,
        durationMs: performance.now() - started,
        bytes: body.byteLength
      });
    } catch (error) {
      results.push({ route, error: error.message, durationMs: performance.now() - started });
    }
  }
}

const startedAt = performance.now();
await Promise.all(Array.from({ length: concurrency }, worker));
const elapsedMs = performance.now() - startedAt;
const durations = results.map(result => result.durationMs).sort((a, b) => a - b);
const p95Index = Math.max(0, Math.ceil(durations.length * 0.95) - 1);
const failures = results.filter(result => result.error || result.status < 200 || result.status >= 400);
const totalBytes = results.reduce((sum, result) => sum + (result.bytes || 0), 0);

console.log(JSON.stringify({
  baseUrl,
  testType: 'static-http-smoke',
  requestCount: results.length,
  concurrency,
  elapsedMs: Math.round(elapsedMs),
  requestsPerSecond: Number((results.length / (elapsedMs / 1000)).toFixed(2)),
  p50Ms: Math.round(durations[Math.floor(durations.length * 0.5)] || 0),
  p95Ms: Math.round(durations[p95Index] || 0),
  transferredKB: Number((totalBytes / 1024).toFixed(1)),
  failures
}, null, 2));

if (failures.length > 0) process.exitCode = 1;
