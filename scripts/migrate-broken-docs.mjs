// Migra documentos cujo storage_path está quebrado mas têm arquivo_url Firebase
// genuíno: baixa do Firebase → sobe no bucket 'documentos' com chave saneada →
// atualiza storage_path. Mantém arquivo_url intacto (rollback). Idempotente.
//
// MODE=dry  (default) → só baixa e valida, não escreve.
// MODE=apply           → executa upload + update. Faz backup antes.
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';

const MODE = process.env.MODE === 'apply' ? 'apply' : 'dry';
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
const extFromCT = (ct) => ct.includes('pdf') ? 'pdf' : ct.includes('jpeg') ? 'jpg' : ct.includes('png') ? 'png' : 'bin';

async function pathOpens(d) {
  if (!d.storage_path) return false;
  const { data: s, error } = await supa.storage.from('documentos').createSignedUrl(d.storage_path, 60);
  if (error || !s?.signedUrl) return false;
  try { const r = await fetch(s.signedUrl, { method: 'HEAD' }); return r.ok; } catch { return false; }
}

const { data: docs } = await supa.from('documentos').select('id, codigo, titulo, storage_path, arquivo_url');
const reais = docs.filter(d => !isTest(d));

// Seleciona: storage_path quebrado (ou ausente) E arquivo_url Firebase genuíno.
const candidatos = [];
for (let i = 0; i < reais.length; i += 8) {
  const batch = reais.slice(i, i + 8);
  await Promise.all(batch.map(async d => {
    if (d.storage_path && d.storage_path.startsWith('migrated/')) return; // já migrado
    if (await pathOpens(d)) return; // já abre, não mexe
    const u = d.arquivo_url;
    if (!u || u === '#' || !/^https?:/.test(u)) return; // órfão, pula
    candidatos.push(d);
  }));
}

console.log(`MODE=${MODE} | candidatos a migrar: ${candidatos.length}`);
if (MODE === 'apply') {
  const backup = candidatos.map(d => ({ id: d.id, codigo: d.codigo, old_storage_path: d.storage_path }));
  const bpath = resolve(__dirname, `.migration-backup-${Date.now()}.json`);
  writeFileSync(bpath, JSON.stringify(backup, null, 2));
  console.log(`Backup salvo: ${bpath}`);
}

let ok = 0, fail = 0; const fails = [];
for (const d of candidatos) {
  try {
    const resp = await fetch(d.arquivo_url);
    if (!resp.ok) throw new Error(`download HTTP ${resp.status}`);
    const ct = (resp.headers.get('content-type') || 'application/pdf').split(';')[0];
    const buf = Buffer.from(await resp.arrayBuffer());
    if (buf.length < 100) throw new Error('arquivo vazio');
    const key = `migrated/${d.id}.${extFromCT(ct)}`;

    if (MODE === 'dry') {
      console.log(`  [dry] ${d.codigo} ← ${(buf.length/1024).toFixed(0)}KB ${ct} → ${key}`);
      ok++; continue;
    }

    const up = await supa.storage.from('documentos').upload(key, buf, { contentType: ct, upsert: true });
    if (up.error) throw new Error(`upload: ${up.error.message}`);
    const upd = await supa.from('documentos').update({ storage_path: key }).eq('id', d.id);
    if (upd.error) throw new Error(`update: ${upd.error.message}`);
    // verifica
    const { data: s } = await supa.storage.from('documentos').createSignedUrl(key, 60);
    const v = await fetch(s.signedUrl, { method: 'HEAD' });
    if (!v.ok) throw new Error(`verificação HTTP ${v.status}`);
    console.log(`  ✓ ${d.codigo} → ${key}`);
    ok++;
  } catch (err) {
    console.log(`  ✗ ${d.codigo}: ${err.message}`);
    fails.push(d.codigo); fail++;
  }
}
console.log(`\n${MODE === 'dry' ? 'DRY-RUN' : 'APLICADO'}: ok=${ok} fail=${fail}`);
if (fails.length) console.log('falhas:', fails.join(', '));
