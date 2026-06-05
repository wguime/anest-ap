// READ-ONLY: verifica genuinidade dos arquivos Firebase dos docs quebrados e
// agrupa duplicatas. NÃO altera nada. Saída = plano de migração.
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
const supa = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${await new SignJWT({
    iss: 'supabase', ref: 'vjzrahruvjffyyqyhjny', role: 'service_role',
    iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+3600,
  }).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).sign(new TextEncoder().encode(envVars.SUPABASE_JWT_SECRET))}` } },
});

const isTest = (d) => !d.codigo || /^SMOKE/i.test(d.codigo) || /smoke|teste/i.test(d.titulo || '');

const { data: docs } = await supa.from('documentos')
  .select('id, codigo, titulo, status, categoria, subcategoria, storage_path, arquivo_url, arquivo_nome, created_at');

// Abertura REAL, replicando a lógica do viewer (useDocumentDetail):
// se storage_path existe, depende SÓ da signed url (NÃO cai no arquivo_url);
// se não existe storage_path, depende do arquivo_url.
async function opens(d) {
  if (d.storage_path) {
    const { data: s, error } = await supa.storage.from('documentos').createSignedUrl(d.storage_path, 60);
    if (error || !s?.signedUrl) return false;
    try { const r = await fetch(s.signedUrl, { method: 'HEAD' }); return r.ok; } catch { return false; }
  }
  if (!d.arquivo_url || d.arquivo_url === '#' || !/^https?:/.test(d.arquivo_url)) return false;
  try { const r = await fetch(d.arquivo_url, { method: 'HEAD' }); return r.ok; } catch { return false; }
}

const reais = docs.filter(d => !isTest(d));
for (let i = 0; i < reais.length; i += 8) {
  const batch = reais.slice(i, i + 8);
  const flags = await Promise.all(batch.map(opens));
  batch.forEach((d, j) => { d._opens = flags[j]; });
}
const broken = reais.filter(d => !d._opens);

// Verifica genuinidade do arquivo_url (Firebase) — content-type + tamanho
console.log('═══════ VERIFICAÇÃO DE GENUINIDADE (Firebase) ═══════');
const verified = [], noFallback = [];
for (let i = 0; i < broken.length; i += 8) {
  const batch = broken.slice(i, i + 8);
  await Promise.all(batch.map(async d => {
    const u = d.arquivo_url;
    if (!u || u === '#' || !/^https?:/.test(u)) { noFallback.push(d); return; }
    try {
      const r = await fetch(u, { method: 'HEAD' });
      const ct = r.headers.get('content-type') || '';
      const len = Number(r.headers.get('content-length') || r.headers.get('x-goog-stored-content-length') || 0);
      if (r.ok && len > 0) d._file = { ct, len }; else { noFallback.push(d); return; }
      verified.push(d);
    } catch { noFallback.push(d); }
  }));
}
const fmtKB = n => `${(n/1024).toFixed(0)}KB`;
const ctCount = {};
for (const d of verified) { const k = d._file.ct.split(';')[0]; ctCount[k] = (ctCount[k]||0)+1; }
console.log(`Verificados genuínos (HTTP 200 + tamanho>0): ${verified.length}/${broken.length}`);
console.log('  content-types:', JSON.stringify(ctCount));
const tiny = verified.filter(d => d._file.len < 5000);
if (tiny.length) { console.log(`  ⚠️ suspeitos <5KB (${tiny.length}):`); tiny.forEach(d=>console.log(`    ${d.codigo} ${fmtKB(d._file.len)} ${d._file.ct}`)); }
if (noFallback.length) {
  console.log(`\nSEM arquivo genuíno (${noFallback.length}):`);
  noFallback.forEach(d => console.log(`  ${d.codigo || '(null)'} — ${d.titulo} | url=${d.arquivo_url ? 'http(falhou)' : 'null'} | id=${d.id}`));
}

// ─────── CLUSTERS (todos os docs reais) ───────
// chave = mesmo arquivo lógico (filename sem prefixo timestamp, normalizado)
const norm = (s) => (s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase()
  .replace(/[^a-z0-9]+/g,' ').trim();
const keyOf = (d) => {
  const base = (d.storage_path || d.arquivo_nome || d.titulo || '').split('/').pop();
  return norm(base.replace(/^\d{10,}_/,'')) || norm(d.titulo);
};
const clusters = {};
for (const d of reais) { const k = keyOf(d); (clusters[k] ||= []).push(d); }

// Classificação por cluster
const brokenWithOpenTwin = [];   // quebrado mas há gêmeo que abre → candidato a DELETE
const brokenMustMigrate = [];    // quebrado e nenhum gêmeo abre → MIGRAR
for (const arr of Object.values(clusters)) {
  const anyOpen = arr.some(d => d._opens);
  for (const d of arr) {
    if (d._opens) continue;
    if (anyOpen) brokenWithOpenTwin.push(d); else brokenMustMigrate.push(d);
  }
}

console.log('\n═══════ DUPLICATAS (clusters com >1 linha) ═══════');
const dupes = Object.entries(clusters).filter(([,arr]) => arr.length > 1);
console.log(`Clusters duplicados: ${dupes.length}`);
for (const [k, arr] of dupes.sort((a,b)=>b[1].length-a[1].length)) {
  const nOpen = arr.filter(d=>d._opens).length;
  console.log(`\n  «${k}» ×${arr.length}  (abrem: ${nOpen}/${arr.length})`);
  for (const d of arr.sort((a,b)=>(a.created_at||'').localeCompare(b.created_at||'')))
    console.log(`    ${d._opens?'✓ABRE ':'✗quebra'} [${d.status}] ${d.codigo} | cat=${d.categoria}/${d.subcategoria||'-'} | ${(d.created_at||'?').slice(0,10)} | id=${d.id}`);
}

console.log(`\n═══════ RESUMO DO PLANO ═══════`);
console.log(`Docs reais: ${reais.length} | abrem: ${reais.filter(d=>d._opens).length} | NÃO abrem: ${broken.length}`);
console.log(`\nDos que NÃO abrem (${broken.length}):`);
console.log(`  A) MIGRAR (quebrado, sem gêmeo funcional, arquivo Firebase genuíno): ${brokenMustMigrate.filter(d=>verified.includes(d)).length}`);
console.log(`  B) REDUNDANTE (quebrado, mas existe gêmeo que JÁ abre → candidato a deletar): ${brokenWithOpenTwin.length}`);
console.log(`  C) ÓRFÃO (sem arquivo nenhum): ${noFallback.length}`);

console.log(`\n--- A) MIGRAR (${brokenMustMigrate.filter(d=>verified.includes(d)).length}) ---`);
for (const d of brokenMustMigrate.filter(d=>verified.includes(d)).sort((a,b)=>(a.codigo||'').localeCompare(b.codigo||'')))
  console.log(`  ${d.codigo} — ${d.titulo} | ${d._file?fmtKB(d._file.len):''} ${d._file?.ct||''} | id=${d.id}`);

console.log(`\n--- B) REDUNDANTE — quebrado com gêmeo que abre (${brokenWithOpenTwin.length}) ---`);
for (const d of brokenWithOpenTwin.sort((a,b)=>(a.codigo||'').localeCompare(b.codigo||''))) {
  const twin = clusters[keyOf(d)].find(x => x._opens);
  console.log(`  ${d.codigo} [${d.status}] → gêmeo que abre: ${twin?.codigo} [${twin?.status}] | id=${d.id}`);
}

console.log(`\n--- C) ÓRFÃOS (${noFallback.length}) ---`);
for (const d of noFallback) console.log(`  ${d.codigo} — ${d.titulo} | id=${d.id}`);

console.log('\n✓ análise concluída (nada foi alterado)');
