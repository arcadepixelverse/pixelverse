#!/usr/bin/env node
/**
 * PIXELVERSE pre-launch smoke check.
 *
 * Zero-dependency verification of critical unauthenticated security boundaries
 * against a running backend. Exits non-zero if any check fails.
 *
 * Usage:
 *   node server/scripts/smoke-check.mjs [baseUrl]
 *   BASE_URL=http://localhost:10000 node server/scripts/smoke-check.mjs
 *
 * Default base URL: http://localhost:3000 (override with arg or BASE_URL env).
 */

const BASE_URL = (process.argv[2] || process.env.BASE_URL || 'http://localhost:3000').replace(/\/+$/, '');

const results = [];

function record(name, pass, detail = '') {
  results.push({ name, pass, detail });
  const tag = pass ? 'PASS' : 'FAIL';
  console.log(`[${tag}] ${name}${detail ? ` — ${detail}` : ''}`);
}

async function fetchPath(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    redirect: 'manual',
    signal: AbortSignal.timeout(10000),
    ...options,
  });
  return res;
}

async function main() {
  console.log(`\n=== PIXELVERSE SMOKE CHECK ===`);
  console.log(`Target: ${BASE_URL}\n`);

  // ── 1. Admin diagnostics must reject unauthenticated callers ──────────────
  try {
    const res = await fetchPath('/api/admin/diagnostics');
    const pass = res.status === 401 || res.status === 403;
    record('GET /api/admin/diagnostics rejects unauthenticated (401/403)', pass, `got ${res.status}`);
  } catch (err) {
    record('GET /api/admin/diagnostics rejects unauthenticated (401/403)', false, err.message);
  }

  // ── 2. Game start must reject unauthenticated callers ─────────────────────
  try {
    const res = await fetchPath('/api/games/overclock/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    });
    const pass = res.status === 401;
    record('POST /api/games/overclock/start rejects unauthenticated (401)', pass, `got ${res.status}`);
  } catch (err) {
    record('POST /api/games/overclock/start rejects unauthenticated (401)', false, err.message);
  }

  // ── 3. Leaderboard must reject invalid game IDs ───────────────────────────
  try {
    const res = await fetchPath('/api/leaderboard/invalid-game', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score: 100, playSessionId: 'forged' }),
    });
    // Unauthenticated requests are stopped by requireAuth (401) before gameId
    // validation; an authenticated caller would get 400 INVALID_GAME.
    // Either way the forged score must never be accepted.
    const pass = res.status === 400 || res.status === 401 || res.status === 403;
    record('POST /api/leaderboard/invalid-game rejects invalid game ID', pass, `got ${res.status}`);
  } catch (err) {
    record('POST /api/leaderboard/invalid-game rejects invalid game ID', false, err.message);
  }

  // ── 4. Cache-Control: no-store must be present on API responses ───────────
  try {
    const res = await fetchPath('/api/status');
    const cacheControl = res.headers.get('cache-control') || '';
    const pass = /no-store/i.test(cacheControl);
    record('API responses include Cache-Control: no-store', pass, `got "${cacheControl || 'missing'}"`);
  } catch (err) {
    record('API responses include Cache-Control: no-store', false, err.message);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const failed = results.filter((r) => !r.pass);
  console.log(`\n=== ${results.length - failed.length}/${results.length} checks passed ===`);
  if (failed.length > 0) {
    console.log('FAILED CHECKS:');
    failed.forEach((f) => console.log(`  - ${f.name} (${f.detail})`));
    process.exit(1);
  }
  console.log('All security boundary checks passed.\n');
}

main().catch((err) => {
  console.error('Smoke check crashed:', err);
  process.exit(1);
});
