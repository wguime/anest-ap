// Diagnóstico read-only: documentos e anexos de comunicados com URL quebrada/ausente.
// Consome .env.local internamente (não imprime secrets). Imprime apenas dados
// institucionais e host/path de URLs (query string removida p/ não vazar token).
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const envVars = {};
const envPath = resolve(projectRoot, '.env.local');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim();
  });
}

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY;
const JWT_SECRET = envVars.SUPABASE_JWT_SECRET;

const jwt = await new SignJWT({
  iss: 'supabase', ref: 'vjzrahruvjffyyqyhjny', role: 'service_role',
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
}).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).sign(new TextEncoder().encode(JWT_SECRET));

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${jwt}` } },
});

// Remove query string (token) — só mostra origem/caminho
const safeUrl = (u) => {
  if (!u || u === '#') return String(u);
  try { const x = new URL(u); return `${x.host}${x.pathname}`; } catch { return '(url inválida)'; }
};
const classifyUrl = (u) => {
  if (!u || u === '#') return 'AUSENTE';
  if (/firebasestorage\.googleapis\.com|\.appspot\.com/.test(u)) return 'FIREBASE_MORTA';
  if (/^https?:\/\//.test(u)) return 'EXTERNA_HTTP';
  return 'OUTRA';
};

// ---------- DOCUMENTOS ----------
const { data: docs, error: e1 } = await supa
  .from('documentos')
  .select('id, codigo, titulo, status, storage_path, arquivo_url');
if (e1) { console.error('ERR documentos', e1); process.exit(1); }

const isTest = (d) => !d.codigo || /^SMOKE/i.test(d.codigo) || /smoke|teste/i.test(d.titulo || '');

// Testa abertura REAL de cada documento.
// fonte: 'supabase' (storage_path → signed url) ou 'url' (arquivo_url direto).
async function probe(d) {
  if (d.storage_path) {
    const { data: s, error: se } = await supa.storage.from('documentos').createSignedUrl(d.storage_path, 120);
    if (se || !s?.signedUrl) return { fonte: 'supabase', ok: false, motivo: se?.message || 'sign falhou' };
    try {
      const r = await fetch(s.signedUrl, { method: 'HEAD' });
      return { fonte: 'supabase', ok: r.ok, motivo: r.ok ? '' : `HTTP ${r.status}` };
    } catch (err) { return { fonte: 'supabase', ok: false, motivo: 'fetch fail' }; }
  }
  if (!d.arquivo_url || d.arquivo_url === '#') return { fonte: 'url', ok: false, motivo: 'sem url' };
  try {
    const r = await fetch(d.arquivo_url, { method: 'HEAD' });
    // storage.googleapis.com direto pode dar 200 mesmo em erro? checa status
    return { fonte: 'url', ok: r.ok, motivo: r.ok ? '' : `HTTP ${r.status}` };
  } catch (err) { return { fonte: 'url', ok: false, motivo: 'fetch fail' }; }
}

const reais = docs.filter(d => !isTest(d));
const testes = docs.filter(isTest);

// roda em lotes de 8
const results = [];
for (let i = 0; i < reais.length; i += 8) {
  const batch = reais.slice(i, i + 8);
  const r = await Promise.all(batch.map(async d => ({ d, ...(await probe(d)) })));
  results.push(...r);
}

const abre = results.filter(r => r.ok);
const naoAbre = results.filter(r => !r.ok);

console.log('═══════════ DOCUMENTOS (Gestão Documental) ═══════════');
console.log(`TOTAL na tabela: ${docs.length}  (reais: ${reais.length} | artefatos teste/SMOKE: ${testes.length})`);
console.log(`  ✅ ABREM:     ${abre.length}`);
console.log(`  ⚠️ NÃO ABREM: ${naoAbre.length}`);
const byFonte = (arr, f) => arr.filter(r => r.fonte === f).length;
console.log(`     (abrem via Supabase signed: ${byFonte(abre,'supabase')} | via URL Firebase/GCS: ${byFonte(abre,'url')})`);

if (naoAbre.length) {
  console.log(`\n--- DOCUMENTOS QUE NÃO ABREM (${naoAbre.length}) ---`);
  for (const { d, fonte, motivo } of naoAbre.sort((a,b)=>(a.d.codigo||'').localeCompare(b.d.codigo||''))) {
    const loc = d.storage_path ? `path=${d.storage_path}` : `url=${safeUrl(d.arquivo_url)}`;
    console.log(`  [${d.status}] ${d.codigo || '(sem cód)'} — ${d.titulo} | fonte=${fonte} motivo="${motivo}" | ${loc} | id=${d.id}`);
  }
}
if (testes.length) {
  console.log(`\n--- Artefatos de teste/SMOKE ignorados (${testes.length}) ---`);
  for (const d of testes) console.log(`  ${d.codigo || '(null)'} — ${d.titulo} | id=${d.id}`);
}

// Análise de remediação: dos que NÃO abrem, quais têm arquivo_url Firebase que funciona?
console.log('\n═══════════ REMEDIAÇÃO: fallback dos que não abrem ═══════════');
const motivos = {};
for (const r of naoAbre) {
  const k = /Invalid key/.test(r.motivo) ? 'invalid_key' : /Object not found/.test(r.motivo) ? 'object_not_found' : /sem url/.test(r.motivo) ? 'sem_url' : 'outro';
  motivos[k] = (motivos[k] || 0) + 1;
}
console.log('Por motivo:', JSON.stringify(motivos));

let comFallback = 0, semFallback = 0;
const fallbackList = [];
for (let i = 0; i < naoAbre.length; i += 8) {
  const batch = naoAbre.slice(i, i + 8);
  await Promise.all(batch.map(async ({ d }) => {
    if (d.arquivo_url && d.arquivo_url !== '#' && /^https?:/.test(d.arquivo_url)) {
      try {
        const r = await fetch(d.arquivo_url, { method: 'HEAD' });
        if (r.ok) { comFallback++; fallbackList.push(d.codigo); return; }
      } catch {}
    }
    semFallback++;
  }));
}
console.log(`Têm arquivo_url Firebase que ABRE (fix rápido = limpar storage_path): ${comFallback}`);
if (fallbackList.length) console.log('  →', fallbackList.sort().join(', '));
console.log(`SEM fallback (arquivo realmente ausente, precisa re-upload): ${semFallback}`);

// ---------- COMUNICADOS ----------
const { data: coms, error: e2 } = await supa
  .from('comunicados')
  .select('id, titulo, status, anexos');
if (e2) { console.error('ERR comunicados', e2); }
else {
  let totalAnexos = 0; const byState = {}; const broken = [];
  for (const c of coms) {
    const anexos = Array.isArray(c.anexos) ? c.anexos : [];
    for (const a of anexos) {
      totalAnexos++;
      let st;
      if (!a.url || a.url === '#') st = 'AUSENTE';
      else if (/firebasestorage\.googleapis\.com|\.appspot\.com/.test(a.url)) st = 'FIREBASE';
      else if (/supabase\.co\/storage/.test(a.url)) st = 'SUPABASE';
      else st = 'OUTRA';
      byState[st] = (byState[st] || 0) + 1;
      if (st === 'AUSENTE') broken.push({ com: c.titulo, status: c.status, nome: a.nome });
    }
  }
  console.log('\n═══════════ COMUNICADOS (anexos) ═══════════');
  console.log(`Comunicados: ${coms.length} | Anexos totais: ${totalAnexos}`);
  for (const [k, v] of Object.entries(byState).sort()) console.log(`  ${k}: ${v}`);
  if (broken.length) {
    console.log(`\n--- Anexos AUSENTES/# (${broken.length}) ---`);
    for (const b of broken) console.log(`  [${b.status}] "${b.com}" → ${b.nome}`);
  }
  // Verifica Firebase: faz HEAD numa amostra p/ ver se bucket Firebase ainda responde
  const fbSample = [];
  for (const c of coms) for (const a of (Array.isArray(c.anexos) ? c.anexos : []))
    if (a.url && /firebasestorage/.test(a.url) && fbSample.length < 15) fbSample.push(a);
  if (fbSample.length) {
    console.log(`\n--- HEAD em amostra Firebase (${fbSample.length}) ---`);
    let fok = 0, fbad = 0;
    for (const a of fbSample) {
      try { const r = await fetch(a.url, { method: 'HEAD' }); r.ok ? fok++ : fbad++; }
      catch { fbad++; }
    }
    console.log(`  respondem=${fok}  falham=${fbad}`);
  }
}
console.log('\n✓ diagnóstico concluído');
