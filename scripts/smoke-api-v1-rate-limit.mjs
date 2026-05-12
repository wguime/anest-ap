#!/usr/bin/env node
/**
 * Smoke test standalone: rate-limit 429 do endpoint api-v1.
 *
 * AVISO: rode SOMENTE em staging/dev. NAO em prod (polui rate_limit table real).
 *
 * Pre-req env vars:
 *   - SUPABASE_URL (ex: https://vjzrahruvjffyyqyhjny.supabase.co)
 *   - SUPABASE_ANON_KEY
 *   - API_V1_TEST_TOKEN (token de teste gerado via generate-api-token)
 *
 * Uso:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... API_V1_TEST_TOKEN=... \
 *     node scripts/smoke-api-v1-rate-limit.mjs
 *
 * Asserts:
 *   - Requests 1..50 -> status 200
 *   - Request 51 -> status 429 com header 'Retry-After: 60'
 *
 * Cleanup manual (opcional, service-role required):
 *   psql ... -c "DELETE FROM documento_api_rate_limit WHERE endpoint='api-v1' AND ip='<seu-ip>'"
 *
 * NAO automatizado no smoke principal (scripts/smoke-api-v1.mjs) porque polui DB.
 */

const required = ['SUPABASE_URL', 'SUPABASE_ANON_KEY', 'API_V1_TEST_TOKEN'];
const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.error(`Missing env: ${missing.join(', ')}`);
  process.exit(1);
}

const { SUPABASE_URL, API_V1_TEST_TOKEN } = process.env;
const url = `${SUPABASE_URL}/functions/v1/api-v1/v1/docs?limit=1`;

let pass = 0;
let fail = 0;

for (let i = 1; i <= 51; i++) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${API_V1_TEST_TOKEN}` },
  });

  if (i <= 50) {
    if (res.status === 200) {
      pass++;
      console.log(`[${i}/51] 200 OK`);
    } else {
      fail++;
      console.error(`[${i}/51] FAIL — expected 200, got ${res.status}`);
    }
  } else {
    const retryAfter = res.headers.get('retry-after');
    if (res.status === 429 && retryAfter === '60') {
      pass++;
      console.log(`[51/51] 429 Retry-After: 60 OK`);
    } else {
      fail++;
      console.error(
        `[51/51] FAIL — expected 429+Retry-After:60, got ${res.status} retry-after=${retryAfter}`,
      );
    }
  }
}

console.log(`\n${pass} passed, ${fail} failed.`);
process.exit(fail === 0 ? 0 : 1);
