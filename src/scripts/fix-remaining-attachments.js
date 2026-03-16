#!/usr/bin/env node

/**
 * Fix remaining 3 comunicado attachments with special characters in filenames
 */

import { readFileSync, existsSync, statSync } from 'fs';
import { resolve, dirname, extname } from 'path';
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
const serviceJWT = await new SignJWT({
  iss: 'supabase', ref: 'vjzrahruvjffyyqyhjny', role: 'service_role',
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
}).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).sign(secretKey);

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${serviceJWT}` } },
});

const COMUNICADOS_DIR = resolve(__dirname, '../../../../App/Comunicados');

function sanitizeFilename(name) {
  return name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove accents
    .replace(/\s+/g, '-') // spaces to hyphens
    .replace(/[^a-zA-Z0-9._-]/g, '') // remove other special chars
    .replace(/-+/g, '-'); // collapse multiple hyphens
}

function getMimeType(filename) {
  const ext = extname(filename).toLowerCase();
  return { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' }[ext] || 'application/octet-stream';
}

// Files that failed due to special chars
const fixes = [
  { localFile: '25.10 Lidocaína .pdf',                        comId: 'com-vaCrAuDO' },
  { localFile: '25.10 medicaçao consultório.pdf',              comId: 'com-8bF6Tj4O' },
  { localFile: '25.11 Treinamento Robótica e infecção .JPG',   comId: 'com-7VwfNGJL' },
];

for (const { localFile, comId } of fixes) {
  const filePath = resolve(COMUNICADOS_DIR, localFile);
  if (!existsSync(filePath)) {
    console.log(`SKIP: ${localFile} not found`);
    continue;
  }

  const sanitized = sanitizeFilename(localFile);
  const fileData = readFileSync(filePath);
  const fileSize = statSync(filePath).size;
  const mimeType = getMimeType(localFile);
  const storagePath = `comunicados/${comId}/${sanitized}`;

  console.log(`Uploading: ${localFile} → ${sanitized}`);

  const { error: uploadErr } = await supabase.storage
    .from('comunicados')
    .upload(storagePath, fileData, { contentType: mimeType, upsert: true });

  if (uploadErr) {
    console.log(`  ERROR: ${uploadErr.message}`);
    continue;
  }

  const { data: urlData } = supabase.storage.from('comunicados').getPublicUrl(storagePath);

  const anexo = {
    nome: localFile, // keep original name for display
    url: urlData?.publicUrl || storagePath,
    tamanho: fileSize,
    tipo: mimeType,
  };

  // Get existing anexos and merge
  const { data: com } = await supabase.from('comunicados').select('anexos').eq('id', comId).single();
  const existingAnexos = Array.isArray(com?.anexos) ? com.anexos : [];
  existingAnexos.push(anexo);

  const { error: updateErr } = await supabase
    .from('comunicados')
    .update({ anexos: existingAnexos })
    .eq('id', comId);

  if (updateErr) {
    console.log(`  ERROR updating: ${updateErr.message}`);
  } else {
    console.log(`  OK: ${(fileSize / 1024).toFixed(0)}KB uploaded, record updated`);
  }
}

// Verify final state
console.log('\n=== Final Comunicado Attachment Status ===\n');
const { data: allComs } = await supabase
  .from('comunicados')
  .select('id, titulo, anexos')
  .order('created_at', { ascending: false });

for (const c of allComs || []) {
  const count = Array.isArray(c.anexos) ? c.anexos.length : 0;
  const names = count > 0 ? c.anexos.map(a => a.nome).join(', ') : '-';
  console.log(`  ${c.id}: ${c.titulo} (${count} anexos)`);
  if (count > 0) console.log(`    Files: ${names}`);
}

console.log('\nDone!');
