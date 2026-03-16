#!/usr/bin/env node
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');
const envVars = {};
readFileSync(resolve(projectRoot, '.env.local'), 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^#=][^=]*)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
});
const { SignJWT } = await import('jose');
const { createClient } = await import('@supabase/supabase-js');
const sk = new TextEncoder().encode(envVars.SUPABASE_JWT_SECRET);
const jwt = await new SignJWT({iss:'supabase',ref:'vjzrahruvjffyyqyhjny',role:'service_role',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600}).setProtectedHeader({alg:'HS256',typ:'JWT'}).sign(sk);
const sb = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY, {auth:{persistSession:false},global:{headers:{Authorization:`Bearer ${jwt}`}}});

// ── Query ALL documents ────────────────────────────────────────────────
const {data, error} = await sb
  .from('documentos')
  .select('id, titulo, tipo, categoria, subcategoria, rop_area, status, arquivo_url, codigo')
  .order('categoria')
  .order('tipo')
  .order('titulo');

if (error) {
  console.error('ERROR querying documentos:', error);
  process.exit(1);
}

const docs = data || [];
const SEP = '='.repeat(90);
const SEP2 = '-'.repeat(90);

// ── 1. Total count ─────────────────────────────────────────────────────
console.log(SEP);
console.log(`  TOTAL DOCUMENTS: ${docs.length}`);
console.log(SEP);

// ── 2. Group by categoria with count ───────────────────────────────────
const byCategoria = {};
docs.forEach(d => {
  const cat = d.categoria || '(null)';
  if (!byCategoria[cat]) byCategoria[cat] = [];
  byCategoria[cat].push(d);
});

console.log('\n' + SEP);
console.log('  DOCUMENTS BY CATEGORIA');
console.log(SEP);
for (const [cat, catDocs] of Object.entries(byCategoria).sort()) {
  console.log(`  ${cat}: ${catDocs.length}`);
}

// ── 3. For each categoria, group by tipo with count ────────────────────
console.log('\n' + SEP);
console.log('  DOCUMENTS BY CATEGORIA > TIPO');
console.log(SEP);
for (const [cat, catDocs] of Object.entries(byCategoria).sort()) {
  console.log(`\n  [${cat}] (${catDocs.length} docs)`);
  const byTipo = {};
  catDocs.forEach(d => {
    const tipo = d.tipo || '(null)';
    if (!byTipo[tipo]) byTipo[tipo] = 0;
    byTipo[tipo]++;
  });
  for (const [tipo, count] of Object.entries(byTipo).sort()) {
    console.log(`    ${tipo}: ${count}`);
  }
}

// ── 4. Full listing per document ───────────────────────────────────────
console.log('\n' + SEP);
console.log('  FULL DOCUMENT LISTING');
console.log(SEP);

for (const [cat, catDocs] of Object.entries(byCategoria).sort()) {
  console.log(`\n  [${ cat }] (${ catDocs.length } docs)`);
  console.log(SEP2);
  console.log(
    '  ' +
    'ID'.padEnd(22) +
    'TITULO'.padEnd(55) +
    'TIPO'.padEnd(20) +
    'STATUS'.padEnd(12) +
    'ROP_AREA'.padEnd(18) +
    'ARQUIVO_URL'
  );
  console.log(SEP2);
  catDocs.forEach(d => {
    const id = (d.id || '').substring(0, 20);
    const titulo = (d.titulo || '').substring(0, 52);
    const tipo = (d.tipo || '').substring(0, 18);
    const status = (d.status || '').substring(0, 10);
    const rop = (d.rop_area || '').substring(0, 16);
    const url = d.arquivo_url ? d.arquivo_url.substring(0, 60) : '(none)';
    console.log(
      '  ' +
      id.padEnd(22) +
      titulo.padEnd(55) +
      tipo.padEnd(20) +
      status.padEnd(12) +
      rop.padEnd(18) +
      url
    );
  });
}

// ── 5. Documents with missing arquivo_url ──────────────────────────────
const missingUrl = docs.filter(d => !d.arquivo_url);
console.log('\n' + SEP);
console.log(`  DOCUMENTS WITH MISSING arquivo_url (${missingUrl.length})`);
console.log(SEP);
if (missingUrl.length === 0) {
  console.log('  (none)');
} else {
  missingUrl.forEach(d => {
    console.log(`  ${(d.id || '').substring(0, 20).padEnd(22)} | ${(d.titulo || '').substring(0, 60).padEnd(62)} | cat=${d.categoria || '(null)'} | tipo=${d.tipo || '(null)'} | status=${d.status || '(null)'}`);
  });
}

// ── 6. Documents with status='arquivado' ───────────────────────────────
const archived = docs.filter(d => d.status === 'arquivado');
console.log('\n' + SEP);
console.log(`  ARCHIVED DOCUMENTS (status='arquivado') (${archived.length})`);
console.log(SEP);
if (archived.length === 0) {
  console.log('  (none)');
} else {
  archived.forEach(d => {
    console.log(`  ${(d.id || '').substring(0, 20).padEnd(22)} | ${(d.titulo || '').substring(0, 60).padEnd(62)} | cat=${d.categoria || '(null)'} | tipo=${d.tipo || '(null)'}`);
  });
}

// ── Summary ────────────────────────────────────────────────────────────
console.log('\n' + SEP);
console.log('  SUMMARY');
console.log(SEP);
console.log(`  Total documents:          ${docs.length}`);
console.log(`  Categories:               ${Object.keys(byCategoria).length}`);
console.log(`  Missing arquivo_url:      ${missingUrl.length}`);
console.log(`  Archived (arquivado):     ${archived.length}`);
console.log(`  Active (ativo):           ${docs.filter(d => d.status === 'ativo').length}`);

// Status distribution
const byStatus = {};
docs.forEach(d => { byStatus[d.status || '(null)'] = (byStatus[d.status || '(null)'] || 0) + 1; });
console.log('\n  Status distribution:');
for (const [s, c] of Object.entries(byStatus).sort()) {
  console.log(`    ${s}: ${c}`);
}

console.log('\n' + SEP);
console.log('  Done.');
console.log(SEP);
