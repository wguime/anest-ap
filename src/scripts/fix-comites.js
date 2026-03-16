#!/usr/bin/env node

/**
 * Fix Comites Documents in Supabase
 *
 * 1. Set correct tipo for regimento documents (matching COMITE_TIPO_CONFIG keys)
 * 2. Set tipo='desastres' for desastres_documentos
 * 3. Set tipo='organograma' for organograma_documentos
 * 4. Archive duplicates (keep most recent/best version)
 * 5. Move misplaced reuniao_documentos to biblioteca
 * 6. Archive older comites_documentos entries that have newer legacy replacements
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

const envPath = resolve(projectRoot, '.env.local');
const envVars = {};
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim();
  });
}

const { SignJWT } = await import('jose');
const { createClient } = await import('@supabase/supabase-js');

const secretKey = new TextEncoder().encode(envVars.SUPABASE_JWT_SECRET);
const jwt = await new SignJWT({
  iss: 'supabase', ref: 'vjzrahruvjffyyqyhjny', role: 'service_role',
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
}).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).sign(secretKey);

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${jwt}` } },
});

console.log('Connected to Supabase\n');

// ============================================================================
// Fetch all comites documents
// ============================================================================

const { data: allComites, error: fetchErr } = await supabase
  .from('documentos')
  .select('id, titulo, tipo, subcategoria, status, created_at')
  .eq('categoria', 'comites')
  .order('created_at', { ascending: true });

if (fetchErr) {
  console.error('Error fetching:', fetchErr.message);
  process.exit(1);
}

console.log(`Total comites docs: ${allComites.length}\n`);

// ============================================================================
// 1. Fix regimento tipos — map titulo to correct comitê tipo
// ============================================================================

console.log('=== 1. Fixing regimento tipos ===\n');

// Map titulo patterns to COMITE_TIPO_CONFIG tipo keys
const TITULO_TO_TIPO = [
  { pattern: /comit[eê]\s*(de\s+)?escalas/i, tipo: 'escalas' },
  { pattern: /comit[eê]\s*(de\s+)?financeiro/i, tipo: 'financeiro' },
  { pattern: /comit[eê]\s*(de\s+)?gest[aã]o\s*(de\s+)?pessoas/i, tipo: 'gestao_pessoas' },
  { pattern: /comit[eê]\s*(de\s+)?qualidade/i, tipo: 'qualidade' },
  { pattern: /comit[eê]\s*(de\s+)?educa[cç][aã]o/i, tipo: 'educacao' },
  { pattern: /comit[eê]\s*(de\s+)?tecnologia/i, tipo: 'tecnologia' },
  { pattern: /comit[eê]\s*(de\s+)?[eé]tica\s*(e\s+)?conduta/i, tipo: 'etica_conduta' },
  { pattern: /comit[eê]\s*(de\s+)?executivo|executivo\s*(de\s+)?gest[aã]o/i, tipo: 'executivo' },
];

function detectTipo(titulo, subcategoria) {
  const t = titulo.toLowerCase();

  // Check for desastres/organograma first
  if (subcategoria === 'desastres_documentos') return 'desastres';
  if (subcategoria === 'organograma_documentos') return 'organograma';
  if (subcategoria === 'reuniao_documentos') return null; // will be moved

  // Check titulo patterns for comitê type
  for (const { pattern, tipo } of TITULO_TO_TIPO) {
    if (pattern.test(titulo)) return tipo;
  }

  // If it's a generic "Regimento Interno" without comitê name → regimento_interno
  if (/regimento\s*interno/i.test(t) && !TITULO_TO_TIPO.some(({ pattern }) => pattern.test(titulo))) {
    return 'regimento_interno';
  }

  return null; // unknown
}

// Process each doc
const tipoUpdates = [];
const toArchive = [];
const toMoveToLibrary = [];
const unknowns = [];

for (const doc of allComites) {
  const detectedTipo = detectTipo(doc.titulo, doc.subcategoria);

  if (detectedTipo === null && doc.subcategoria === 'reuniao_documentos') {
    toMoveToLibrary.push(doc);
  } else if (detectedTipo) {
    tipoUpdates.push({ ...doc, newTipo: detectedTipo });
  } else {
    unknowns.push(doc);
  }
}

// Apply tipo updates
for (const doc of tipoUpdates) {
  if (doc.tipo !== doc.newTipo) {
    const { error } = await supabase
      .from('documentos')
      .update({ tipo: doc.newTipo })
      .eq('id', doc.id);

    if (error) {
      console.log(`  ERROR ${doc.id}: ${error.message}`);
    } else {
      console.log(`  ${doc.id}: tipo='${doc.newTipo}' ← "${doc.titulo}"`);
    }
  }
}

console.log(`\nTipo updates: ${tipoUpdates.length}`);

// ============================================================================
// 2. Move reuniao_documentos to biblioteca
// ============================================================================

console.log('\n=== 2. Moving reuniao_documentos to biblioteca ===\n');

for (const doc of toMoveToLibrary) {
  const { error } = await supabase
    .from('documentos')
    .update({ categoria: 'biblioteca', tipo: 'protocolo', rop_area: 'Vida Profissional' })
    .eq('id', doc.id);

  if (error) {
    console.log(`  ERROR ${doc.id}: ${error.message}`);
  } else {
    console.log(`  Moved to biblioteca: ${doc.id} "${doc.titulo}"`);
  }
}

// ============================================================================
// 3. Deduplicate — archive older entries for same comitê tipo
// ============================================================================

console.log('\n=== 3. Deduplicating ===\n');

// Refetch after tipo updates
const { data: updatedComites } = await supabase
  .from('documentos')
  .select('id, titulo, tipo, subcategoria, status, created_at')
  .eq('categoria', 'comites')
  .order('created_at', { ascending: false }); // newest first

// Group by tipo, keep newest active, archive rest if same tipo has multiple active
const byTipo = {};
for (const doc of updatedComites || []) {
  if (!byTipo[doc.tipo]) byTipo[doc.tipo] = [];
  byTipo[doc.tipo].push(doc);
}

for (const [tipo, docs] of Object.entries(byTipo)) {
  const active = docs.filter(d => d.status === 'ativo');

  if (tipo === 'desastres') {
    // For desastres: deduplicate by titulo, keep newest
    const byTitle = {};
    for (const d of active) {
      const key = d.titulo.toLowerCase().trim();
      if (!byTitle[key]) byTitle[key] = [];
      byTitle[key].push(d);
    }
    for (const [title, copies] of Object.entries(byTitle)) {
      if (copies.length > 1) {
        // Keep first (newest due to sort), archive rest
        for (let i = 1; i < copies.length; i++) {
          toArchive.push(copies[i]);
        }
      }
    }
  } else if (tipo === 'organograma') {
    // For organograma: keep only 1
    if (active.length > 1) {
      for (let i = 1; i < active.length; i++) {
        toArchive.push(active[i]);
      }
    }
  } else if (['regimento_interno', 'financeiro', 'gestao_pessoas', 'qualidade',
               'educacao', 'escalas', 'tecnologia', 'etica_conduta', 'executivo'].includes(tipo)) {
    // For comitê regimentos: keep newest active, archive others
    if (active.length > 1) {
      for (let i = 1; i < active.length; i++) {
        toArchive.push(active[i]);
      }
    }
  }
}

// Archive duplicates
for (const doc of toArchive) {
  const { error } = await supabase
    .from('documentos')
    .update({ status: 'arquivado' })
    .eq('id', doc.id);

  if (error) {
    console.log(`  ERROR archiving ${doc.id}: ${error.message}`);
  } else {
    console.log(`  Archived: ${doc.id} "${doc.titulo}" (tipo=${doc.tipo})`);
  }
}

console.log(`\nArchived ${toArchive.length} duplicates`);

// ============================================================================
// 4. Set rop_area for all comites docs
// ============================================================================

console.log('\n=== 4. Setting rop_area ===\n');

const { data: ropUpdate, error: ropErr } = await supabase
  .from('documentos')
  .update({ rop_area: 'Comunicação' })
  .eq('categoria', 'comites')
  .is('rop_area', null)
  .select('id');

if (ropErr) {
  console.log(`  ERROR: ${ropErr.message}`);
} else {
  console.log(`  Set rop_area='Comunicação' for ${ropUpdate?.length || 0} docs`);
}

// ============================================================================
// 5. Final verification
// ============================================================================

console.log('\n=== Final State ===\n');

const { data: finalComites } = await supabase
  .from('documentos')
  .select('id, titulo, tipo, status, subcategoria')
  .eq('categoria', 'comites')
  .order('tipo')
  .order('status');

// Group by tipo and status
const summary = {};
for (const doc of finalComites || []) {
  const key = `${doc.tipo} (${doc.status})`;
  if (!summary[key]) summary[key] = [];
  summary[key].push(doc.titulo);
}

for (const [key, titles] of Object.entries(summary).sort()) {
  console.log(`  ${key}: ${titles.length}`);
  titles.forEach(t => console.log(`    - ${t}`));
}

console.log(`\nTotal comites docs: ${finalComites?.length || 0}`);
const activeCount = finalComites?.filter(d => d.status === 'ativo').length || 0;
const archivedCount = finalComites?.filter(d => d.status === 'arquivado').length || 0;
console.log(`  Active: ${activeCount}`);
console.log(`  Archived: ${archivedCount}`);

if (unknowns.length) {
  console.log('\nUnknown tipo docs (not matched):');
  unknowns.forEach(d => console.log(`  ${d.id}: "${d.titulo}" (subcategoria=${d.subcategoria})`));
}

console.log('\nDone!');
