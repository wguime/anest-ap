#!/usr/bin/env node

/**
 * Fix Documents & Upload Comunicado Attachments
 *
 * 1. Move medicamentos/infeccoes → biblioteca (PARTE 1.1)
 * 2. Fix document tipos for migrated docs (PARTE 1.3)
 * 3. Fix comunicado link (PARTE 2.4)
 * 4. Upload comunicado attachments to Supabase Storage (PARTE 2.2)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import { resolve, dirname, extname, basename } from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

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
// PARTE 1.1: Move medicamentos/infeccoes → biblioteca
// ============================================================================

console.log('=== PARTE 1.1: Moving medicamentos/infeccoes → biblioteca ===\n');

// Move medicamentos → biblioteca
const { data: medDocs, error: medErr } = await supabase
  .from('documentos')
  .update({ categoria: 'biblioteca', rop_area: 'Uso de Medicamentos' })
  .eq('categoria', 'medicamentos')
  .select('id, titulo, subcategoria');

if (medErr) {
  console.error('Error moving medicamentos:', medErr.message);
} else {
  console.log(`Medicamentos → biblioteca: ${medDocs?.length || 0} docs updated`);
  medDocs?.forEach(d => console.log(`  - ${d.id}: ${d.titulo}`));
}

// Move infeccoes → biblioteca
const { data: infDocs, error: infErr } = await supabase
  .from('documentos')
  .update({ categoria: 'biblioteca', rop_area: 'Prevenção de Infecções' })
  .eq('categoria', 'infeccoes')
  .select('id, titulo, subcategoria');

if (infErr) {
  console.error('Error moving infeccoes:', infErr.message);
} else {
  console.log(`Infeccoes → biblioteca: ${infDocs?.length || 0} docs updated`);
  infDocs?.forEach(d => console.log(`  - ${d.id}: ${d.titulo}`));
}

// ============================================================================
// PARTE 1.3: Fix tipos for migrated documents
// ============================================================================

console.log('\n=== PARTE 1.3: Fixing document tipos ===\n');

// subcategoria → tipo mapping
const tipoFixes = {
  // Medicamentos docs that should be 'manual'
  doc_lista_abreviaturas: 'manual',
  // Medicamentos docs that should be 'formulario'
  conciliacao_admissao: 'formulario',
  conciliacao_transferencia: 'formulario',
  conciliacao_alta: 'formulario',
  // Infeccoes docs that should be 'formulario'
  checklist_cirurgia: 'formulario',
};

for (const [subcategoria, tipo] of Object.entries(tipoFixes)) {
  const { data, error } = await supabase
    .from('documentos')
    .update({ tipo })
    .eq('subcategoria', subcategoria)
    .select('id, titulo');

  if (error) {
    console.error(`Error fixing tipo for ${subcategoria}:`, error.message);
  } else if (data?.length) {
    console.log(`${subcategoria} → tipo='${tipo}': ${data.length} doc(s)`);
  }
}

// ============================================================================
// Verify current state
// ============================================================================

console.log('\n=== Verification: Document counts by category ===\n');

const { data: allDocs } = await supabase
  .from('documentos')
  .select('categoria');

if (allDocs) {
  const counts = {};
  allDocs.forEach(d => {
    counts[d.categoria] = (counts[d.categoria] || 0) + 1;
  });
  for (const [cat, count] of Object.entries(counts).sort()) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log(`  TOTAL: ${allDocs.length}`);
}

// ============================================================================
// PARTE 2.4: Fix comunicado link
// ============================================================================

console.log('\n=== PARTE 2.4: Fixing comunicado link ===\n');

const { data: linkFix, error: linkErr } = await supabase
  .from('comunicados')
  .update({ link: 'https://unimedchapeco.medportal.com.br/login' })
  .eq('id', 'com-3msoUJeY')
  .select('id, titulo');

if (linkErr) {
  console.error('Error fixing link:', linkErr.message);
} else if (linkFix?.length) {
  console.log(`Fixed link for: ${linkFix[0].titulo} (${linkFix[0].id})`);
} else {
  console.log('Comunicado com-3msoUJeY not found (may have different ID)');
}

// ============================================================================
// PARTE 2.2: Upload comunicado attachments to Supabase Storage
// ============================================================================

console.log('\n=== PARTE 2.2: Uploading comunicado attachments ===\n');

const COMUNICADOS_DIR = resolve(__dirname, '../../../../App/Comunicados');

// Mapping: local filename → comunicado ID
const attachmentMap = [
  { file: '25.10 Bate mapa.pdf',                              comId: 'com-7XYZbtsO' },
  { file: '25.10 Bate mapa.png',                              comId: 'com-7XYZbtsO' },
  { file: '25.10 Confra Anest.png',                           comId: 'com-MNnZXwjU' },
  { file: '25.10 Confra-Anest.pdf',                           comId: 'com-MNnZXwjU' },
  { file: '25.10 Lidocaína .pdf',                             comId: 'com-vaCrAuDO' },
  { file: '25.10 medicaçao consultório.pdf',                  comId: 'com-8bF6Tj4O' },
  { file: '25.11 Treinamento Robótica e infecção .JPG',       comId: 'com-7VwfNGJL' },
  { file: 'Tutorial acesso nova UNI.pdf',                     comId: 'com-EAKOL4DB' },
];

// MIME type helper
function getMimeType(filename) {
  const ext = extname(filename).toLowerCase();
  const types = {
    '.pdf': 'application/pdf',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
  };
  return types[ext] || 'application/octet-stream';
}

// Group attachments by comunicado ID
const byComId = {};
for (const item of attachmentMap) {
  if (!byComId[item.comId]) byComId[item.comId] = [];
  byComId[item.comId].push(item.file);
}

// First verify comunicados exist
const comIds = Object.keys(byComId);
const { data: existingComs } = await supabase
  .from('comunicados')
  .select('id, titulo, anexos')
  .in('id', comIds);

const existingMap = new Map();
existingComs?.forEach(c => existingMap.set(c.id, c));

console.log(`Found ${existingMap.size} of ${comIds.length} comunicados in DB\n`);

// Upload files and update records
for (const [comId, files] of Object.entries(byComId)) {
  const com = existingMap.get(comId);
  if (!com) {
    console.log(`SKIP ${comId}: not found in DB`);
    continue;
  }

  console.log(`${comId} (${com.titulo}):`);
  const anexos = [];

  for (const filename of files) {
    const filePath = resolve(COMUNICADOS_DIR, filename);
    if (!existsSync(filePath)) {
      console.log(`  SKIP: ${filename} not found locally`);
      continue;
    }

    const fileData = readFileSync(filePath);
    const fileSize = statSync(filePath).size;
    const mimeType = getMimeType(filename);
    const storagePath = `comunicados/${comId}/${filename}`;

    // Upload to Supabase Storage
    const { error: uploadErr } = await supabase.storage
      .from('comunicados')
      .upload(storagePath, fileData, {
        contentType: mimeType,
        upsert: true,
      });

    if (uploadErr) {
      // Try creating the bucket first if it doesn't exist
      if (uploadErr.message?.includes('not found') || uploadErr.statusCode === '404') {
        console.log('  Creating comunicados bucket...');
        await supabase.storage.createBucket('comunicados', { public: true });
        // Retry upload
        const { error: retryErr } = await supabase.storage
          .from('comunicados')
          .upload(storagePath, fileData, {
            contentType: mimeType,
            upsert: true,
          });
        if (retryErr) {
          console.log(`  ERROR uploading ${filename}: ${retryErr.message}`);
          continue;
        }
      } else {
        console.log(`  ERROR uploading ${filename}: ${uploadErr.message}`);
        continue;
      }
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('comunicados')
      .getPublicUrl(storagePath);

    anexos.push({
      nome: filename,
      url: urlData?.publicUrl || storagePath,
      tamanho: fileSize,
      tipo: mimeType,
    });

    console.log(`  Uploaded: ${filename} (${(fileSize / 1024).toFixed(0)}KB)`);
  }

  // Update comunicado record with anexos
  if (anexos.length > 0) {
    const { error: updateErr } = await supabase
      .from('comunicados')
      .update({ anexos })
      .eq('id', comId);

    if (updateErr) {
      console.log(`  ERROR updating anexos for ${comId}: ${updateErr.message}`);
    } else {
      console.log(`  Updated record with ${anexos.length} anexo(s)`);
    }
  }
}

// ============================================================================
// Final Summary
// ============================================================================

console.log('\n=== Final Comunicado Summary ===\n');

const { data: finalComs } = await supabase
  .from('comunicados')
  .select('id, titulo, link, anexos')
  .order('created_at', { ascending: false });

if (finalComs) {
  for (const c of finalComs) {
    const anexoCount = Array.isArray(c.anexos) ? c.anexos.length : 0;
    const linkStr = c.link ? ' [link]' : '';
    console.log(`  ${c.id}: ${c.titulo}${linkStr} (${anexoCount} anexos)`);
  }
}

console.log('\nDone!');
process.exit(0);
