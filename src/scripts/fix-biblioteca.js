#!/usr/bin/env node

/**
 * Fix Biblioteca Documents in Supabase
 *
 * 1. Move misplaced docs from biblioteca to comites (desastres/organograma)
 * 2. Fix tipo values for remaining biblioteca docs
 * 3. Archive duplicates (keep non-legacy or most recent)
 * 4. Set rop_area for docs missing it
 * 5. Final verification summary
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

// ============================================================================
// Load environment variables
// ============================================================================

const envPath = resolve(projectRoot, '.env.local');
const envVars = {};
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim();
  });
}

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY;
const JWT_SECRET = envVars.SUPABASE_JWT_SECRET;

if (!SUPABASE_URL || !JWT_SECRET || !ANON_KEY) {
  console.error('ERRO: Missing VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY or SUPABASE_JWT_SECRET');
  process.exit(1);
}

// ============================================================================
// Supabase setup with service_role JWT
// ============================================================================

const { SignJWT } = await import('jose');
const { createClient } = await import('@supabase/supabase-js');

const secretKey = new TextEncoder().encode(JWT_SECRET);
const serviceJWT = await new SignJWT({
  iss: 'supabase',
  ref: 'vjzrahruvjffyyqyhjny',
  role: 'service_role',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
})
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .sign(secretKey);

const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: {
    headers: {
      Authorization: `Bearer ${serviceJWT}`,
    },
  },
});

console.log('Connected to Supabase\n');

// ============================================================================
// Fetch all biblioteca documents
// ============================================================================

const { data: allBiblioteca, error: fetchErr } = await supabase
  .from('documentos')
  .select('id, titulo, tipo, subcategoria, status, rop_area, created_at')
  .eq('categoria', 'biblioteca')
  .order('created_at', { ascending: true });

if (fetchErr) {
  console.error('Error fetching biblioteca docs:', fetchErr.message);
  process.exit(1);
}

console.log(`Total biblioteca docs: ${allBiblioteca.length}\n`);

// ============================================================================
// 1. Move misplaced docs from biblioteca to comites
// ============================================================================

console.log('=== 1. Moving misplaced docs from biblioteca to comites ===\n');

const subcatToComites = {
  desastres_documentos: { tipo: 'desastres', rop_area: 'Comunicação' },
  organograma_documentos: { tipo: 'organograma', rop_area: 'Comunicação' },
};

let movedCount = 0;
for (const doc of allBiblioteca) {
  const mapping = subcatToComites[doc.subcategoria];
  if (mapping) {
    const { error } = await supabase
      .from('documentos')
      .update({ categoria: 'comites', tipo: mapping.tipo, rop_area: mapping.rop_area })
      .eq('id', doc.id);

    if (error) {
      console.log(`  ERROR ${doc.id}: ${error.message}`);
    } else {
      console.log(`  Moved to comites: ${doc.id} "${doc.titulo}" -> tipo='${mapping.tipo}', rop_area='${mapping.rop_area}'`);
      movedCount++;
    }
  }
}

console.log(`\nMoved ${movedCount} docs to comites\n`);

// ============================================================================
// 2. Fix tipo values for remaining biblioteca docs
// ============================================================================

console.log('=== 2. Fixing tipo values for remaining biblioteca docs ===\n');

// Refetch remaining biblioteca docs after moves
const { data: remaining, error: refetchErr } = await supabase
  .from('documentos')
  .select('id, titulo, tipo, subcategoria, status, rop_area, created_at')
  .eq('categoria', 'biblioteca')
  .order('created_at', { ascending: true });

if (refetchErr) {
  console.error('Error refetching:', refetchErr.message);
  process.exit(1);
}

console.log(`Remaining biblioteca docs: ${remaining.length}\n`);

function detectTipo(titulo) {
  const t = titulo || '';

  // tipo='politica' — titulos starting with Politica/Política or specific policy doc
  if (/^Pol[ií]tica/i.test(t)) return 'politica';
  if (/Prevenção de violência no ambiente de trabalho/i.test(t)) return 'politica';

  // tipo='termo'
  if (/Termo de Consentimento/i.test(t)) return 'termo';

  // tipo='relatorio'
  if (/Relatório/i.test(t)) return 'relatorio';
  if (/Auditoria Farmac[eê]utica/i.test(t)) return 'relatorio';
  if (/Auditoria Descarte/i.test(t)) return 'relatorio';

  // tipo='protocolo' — many patterns
  const protocoloPatterns = [
    /Manejo/i, /Prevenção/i, /Protocolo/i, /Profilaxia/i,
    /Recuperação/i, /Sedação/i, /Identificação/i, /Normotermia/i,
    /MEWS/i, /Deterioração/i, /Náusea/i, /Vômito/i,
    /Intoxicação/i, /Heparina/i, /TEV/i, /Glicemia/i,
    /Medicamentos de Alta Vigil[aâ]ncia/i, /Higiene das Mãos/i,
    /Alergia/i, /Broncoaspiração/i, /Antibioticoprofilaxia/i,
    /SAVA/i, /Anestesia_Cardiovascular/i,
  ];
  for (const pattern of protocoloPatterns) {
    if (pattern.test(t)) return 'protocolo';
  }

  // tipo='manual'
  // Exclude "Manual de Gestão e Preparação para Emergências" (should be in comites)
  if (/Manual de Gest[aã]o e Prepara[cç][aã]o para Emerg[eê]ncias/i.test(t)) {
    // This should have been moved to comites, but if it's still here, mark as manual for now
    return 'manual';
  }
  if (/Abrevia[cç][aã]o/i.test(t)) return 'manual';
  if (/Jejum/i.test(t)) return 'manual';
  if (/Manual/i.test(t)) return 'manual';
  if (/Carteira_Nacional/i.test(t)) return 'manual';

  // Fallback: no match
  return null;
}

let tipoFixCount = 0;
const unmatched = [];

for (const doc of remaining) {
  let newTipo = null;

  // Fix uppercase Protocolo -> protocolo
  if (doc.tipo === 'Protocolo') {
    newTipo = 'protocolo';
  }

  // Detect tipo from titulo
  const detected = detectTipo(doc.titulo);

  if (detected) {
    newTipo = detected;
  } else if (doc.tipo === 'Documento' || !doc.tipo) {
    // Fallback for 'Documento' or null tipo
    newTipo = 'protocolo';
  }

  if (newTipo && newTipo !== doc.tipo) {
    const { error } = await supabase
      .from('documentos')
      .update({ tipo: newTipo })
      .eq('id', doc.id);

    if (error) {
      console.log(`  ERROR ${doc.id}: ${error.message}`);
    } else {
      console.log(`  ${doc.id}: tipo='${doc.tipo}' -> '${newTipo}' ("${doc.titulo}")`);
      tipoFixCount++;
    }
  } else if (!newTipo && !detected) {
    unmatched.push(doc);
  }
}

console.log(`\nTipo fixes applied: ${tipoFixCount}`);
if (unmatched.length) {
  console.log(`\nUnmatched docs (kept current tipo):`);
  unmatched.forEach(d => console.log(`  ${d.id}: tipo='${d.tipo}' "${d.titulo}"`));
}

// ============================================================================
// 3. Archive duplicates
// ============================================================================

console.log('\n=== 3. Archiving duplicates ===\n');

// Refetch all active biblioteca docs
const { data: activeDocs, error: activeErr } = await supabase
  .from('documentos')
  .select('id, titulo, tipo, subcategoria, status, created_at')
  .eq('categoria', 'biblioteca')
  .eq('status', 'ativo')
  .order('created_at', { ascending: false }); // newest first

if (activeErr) {
  console.error('Error fetching active docs:', activeErr.message);
  process.exit(1);
}

// Group by titulo (case-insensitive)
const byTitulo = {};
for (const doc of activeDocs) {
  const key = (doc.titulo || '').toLowerCase().trim();
  if (!byTitulo[key]) byTitulo[key] = [];
  byTitulo[key].push(doc);
}

let archivedCount = 0;
for (const [titulo, docs] of Object.entries(byTitulo)) {
  if (docs.length <= 1) continue;

  // Determine which to keep:
  // Prefer non-legacy (id NOT starting with 'doc-legacy-')
  const nonLegacy = docs.filter(d => !d.id.startsWith('doc-legacy-'));
  const legacy = docs.filter(d => d.id.startsWith('doc-legacy-'));

  let keep;
  if (nonLegacy.length > 0 && legacy.length > 0) {
    // Keep the non-legacy one (first = most recent due to sort)
    keep = nonLegacy[0];
  } else {
    // All are same type — keep the most recently created (first in sorted list)
    keep = docs[0];
  }

  // Archive the rest
  for (const doc of docs) {
    if (doc.id === keep.id) continue;

    const { error } = await supabase
      .from('documentos')
      .update({ status: 'arquivado' })
      .eq('id', doc.id);

    if (error) {
      console.log(`  ERROR archiving ${doc.id}: ${error.message}`);
    } else {
      console.log(`  Archived: ${doc.id} "${doc.titulo}" (kept ${keep.id})`);
      archivedCount++;
    }
  }
}

console.log(`\nArchived ${archivedCount} duplicates`);

// ============================================================================
// 4. Set rop_area for docs missing it
// ============================================================================

console.log('\n=== 4. Setting rop_area for docs missing it ===\n');

// Refetch biblioteca docs with null rop_area
const { data: noRopDocs, error: noRopErr } = await supabase
  .from('documentos')
  .select('id, titulo, subcategoria, rop_area')
  .eq('categoria', 'biblioteca')
  .is('rop_area', null);

if (noRopErr) {
  console.error('Error fetching docs without rop_area:', noRopErr.message);
  process.exit(1);
}

console.log(`Docs missing rop_area: ${noRopDocs.length}\n`);

function detectRopArea(subcategoria) {
  const s = subcategoria || '';

  // subcategoria containing 'protocolo_'
  if (s.includes('protocolo_')) return 'Prevenção de Infecções';

  // Specific medication-related subcategorias
  const usoMedicamentos = [
    'doc_mav', 'doc_heparina', 'doc_intoxicacao',
    'doc_manejo_glicemia', 'doc_narcoticos', 'doc_eletrolitos',
    'doc_lista_abreviaturas',
  ];
  if (usoMedicamentos.includes(s)) return 'Uso de Medicamentos';

  // biblioteca_documentos
  if (s === 'biblioteca_documentos') return 'Vida Profissional';

  // reuniao_documentos
  if (s === 'reuniao_documentos') return 'Vida Profissional';

  // null or empty subcategoria
  if (!s) return 'Vida Profissional';

  // Default fallback
  return 'Vida Profissional';
}

let ropAreaCount = 0;
for (const doc of noRopDocs) {
  const ropArea = detectRopArea(doc.subcategoria);

  const { error } = await supabase
    .from('documentos')
    .update({ rop_area: ropArea })
    .eq('id', doc.id);

  if (error) {
    console.log(`  ERROR ${doc.id}: ${error.message}`);
  } else {
    console.log(`  ${doc.id}: rop_area='${ropArea}' (subcategoria='${doc.subcategoria}') "${doc.titulo}"`);
    ropAreaCount++;
  }
}

console.log(`\nSet rop_area for ${ropAreaCount} docs`);

// ============================================================================
// 5. Final verification
// ============================================================================

console.log('\n=== 5. Final Verification ===\n');

const { data: finalDocs, error: finalErr } = await supabase
  .from('documentos')
  .select('id, titulo, tipo, status, subcategoria, rop_area')
  .eq('categoria', 'biblioteca')
  .order('tipo')
  .order('status');

if (finalErr) {
  console.error('Error fetching final state:', finalErr.message);
  process.exit(1);
}

// Group by tipo and status
const summary = {};
for (const doc of finalDocs || []) {
  const key = `${doc.tipo || '(null)'} [${doc.status}]`;
  if (!summary[key]) summary[key] = [];
  summary[key].push(doc);
}

for (const [key, docs] of Object.entries(summary).sort()) {
  console.log(`  ${key}: ${docs.length}`);
  docs.forEach(d => console.log(`    - ${d.id}: "${d.titulo}" (rop_area=${d.rop_area || 'null'})`));
}

const totalFinal = finalDocs?.length || 0;
const activeCountFinal = finalDocs?.filter(d => d.status === 'ativo').length || 0;
const archivedCountFinal = finalDocs?.filter(d => d.status === 'arquivado').length || 0;

console.log(`\nTotal biblioteca docs: ${totalFinal}`);
console.log(`  Active: ${activeCountFinal}`);
console.log(`  Archived: ${archivedCountFinal}`);

console.log('\nDone!');
process.exit(0);
