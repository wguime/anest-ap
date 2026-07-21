#!/usr/bin/env node
/**
 * smoke-prod.mjs — Tier-1 smoke de produção, disparado pelo hook PostToolUse
 * (.claude/settings.json) após qualquer `firebase deploy`. Zero tokens e zero
 * credenciais de app.
 *
 * Checa: (1) hosting no ar com #root; (2) bundle JS referenciado e contendo o
 * host do Supabase — pega a regressão real "supabaseUrl is required" (build de
 * worktree sem .env → tela branca); (3) idade do deploy da edge
 * parse-escala-cirurgica (informativo, exige PAT no .env.local).
 *
 * Tier 2 (login E2E + gate) é sob demanda: /escala-cirurgica smoke.
 * Exit 0 = PASS, 1 = FAIL.
 */
const BASE = process.env.SMOKE_BASE_URL || 'https://anest-ap.web.app';
const SUPA_HOST = 'vjzrahruvjffyyqyhjny.supabase.co';

let fail = 0;
const ok = (m) => console.log(`✓ ${m}`);
const bad = (m) => { console.log(`✗ ${m}`); fail = 1; };

try {
  const r = await fetch(`${BASE}/`, { cache: 'no-store' });
  if (!r.ok) {
    bad(`GET / -> HTTP ${r.status}`);
  } else {
    const html = await r.text();
    if (html.includes('id="root"')) ok('index.html no ar com #root');
    else bad('index.html sem #root');
    const m = html.match(/src="(\/assets\/[^"]+\.js)"/);
    if (!m) {
      bad('nenhum bundle JS referenciado no index.html');
    } else {
      const rb = await fetch(`${BASE}${m[1]}`, { cache: 'no-store' });
      if (!rb.ok) {
        bad(`GET ${m[1]} -> HTTP ${rb.status}`);
      } else {
        const js = await rb.text();
        if (js.includes(SUPA_HOST)) ok(`bundle ok (${Math.round(js.length / 1024)} kB, host Supabase embutido)`);
        else bad(`bundle SEM host Supabase (${SUPA_HOST}) — build sem .env? Risco de tela branca`);
      }
    }
  }
} catch (e) {
  bad(`fetch produção falhou: ${e.message}`);
}

try {
  const { execFileSync } = await import('node:child_process');
  const root = new URL('..', import.meta.url).pathname;
  const out = execFileSync('node', ['scripts/diag-edge-fn-config.mjs', 'parse-escala-cirurgica'], {
    cwd: root, encoding: 'utf8', timeout: 15000,
  });
  console.log(`ℹ edge: ${out.trim()}`);
} catch {
  console.log('ℹ edge check pulado (sem PAT/offline) — cobre-se via /escala-cirurgica status');
}

console.log(fail ? 'SMOKE PÓS-DEPLOY: FAIL' : 'SMOKE PÓS-DEPLOY: PASS');
process.exit(fail);
