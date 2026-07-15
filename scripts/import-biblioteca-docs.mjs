#!/usr/bin/env node
/**
 * scripts/import-biblioteca-docs.mjs
 *
 * Importa o acervo institucional (documentos/Doc Anest) para a Biblioteca:
 *   - upload do PDF no bucket Supabase `documentos` (biblioteca/{docId}/v1/...)
 *   - INSERT em `documentos` (categoria=biblioteca, subcategoria/tipo do manifesto)
 *   - INSERT em `documento_versoes` (versão inicial)
 *   - changelog via rpc_log_document_action
 *
 * Fonte: manifest JSON gerado a partir de _INDICE_Publicacao.xlsx (já validado
 * contra a estrutura de pastas). Cada entrada: { path, arquivo, size, titulo,
 * codigo, subcategoria, tipo, origem, tags[], data_publicacao, data_versao,
 * responsavel_* }.
 *
 * Idempotente: pula códigos que já existem em `documentos` (deleted_at IS NULL).
 *
 * Env (.env.local): VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SUPABASE_JWT_SECRET
 * (JWT service_role HS256 — mesmo padrão de migrate-storage-firebase-to-supabase.mjs)
 *
 * Uso:
 *   node scripts/import-biblioteca-docs.mjs --manifest=<path>            # dry-run
 *   node scripts/import-biblioteca-docs.mjs --manifest=<path> --apply
 *   node scripts/import-biblioteca-docs.mjs --manifest=<path> --apply --limit=1
 */
import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const LIMIT = parseInt((args.find((a) => a.startsWith('--limit=')) || '').split('=')[1] || '0', 10) || null;
const MANIFEST = (args.find((a) => a.startsWith('--manifest=')) || '').split('=')[1];

if (!MANIFEST || !existsSync(MANIFEST)) {
  console.error('❌ Passe --manifest=<path do import-manifest.json>');
  process.exit(1);
}

// Dono do acervo — audit trail (admin seed em 001_schema.sql)
const OWNER_UID = 'pPdKZ75E9zNdPnLz50qisPiHfJw1';
const OWNER_EMAIL = 'wguime@yahoo.com.br';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const envVars = {};
const envPath = resolve(projectRoot, '.env.local');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY;
const JWT_SECRET = envVars.SUPABASE_JWT_SECRET;
const SUPABASE_REF = envVars.VITE_SUPABASE_PROJECT_REF || 'vjzrahruvjffyyqyhjny';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !JWT_SECRET) {
  console.error('❌ Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_JWT_SECRET em .env.local');
  process.exit(1);
}

const supaJwt = await new SignJWT({
  iss: 'supabase',
  ref: SUPABASE_REF,
  role: 'service_role',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600 * 2,
})
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .sign(new TextEncoder().encode(JWT_SECRET));

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${supaJwt}` } },
});

// Espelha a sanitização de supabaseDocumentService.uploadFile
function sanitizeName(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9.-]/g, '');
}

const docs = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const batch = LIMIT ? docs.slice(0, LIMIT) : docs;

// Nome do dono para created_by_name
let ownerName = 'Guilherme';
{
  const { data } = await supabase.from('profiles').select('nome').eq('firebase_uid', OWNER_UID).maybeSingle();
  if (data?.nome) ownerName = data.nome;
}

// Códigos já importados (idempotência)
const { data: existing, error: exErr } = await supabase
  .from('documentos')
  .select('codigo')
  .is('deleted_at', null);
if (exErr) {
  console.error('❌ Falha ao consultar documentos existentes:', exErr.message);
  process.exit(1);
}
const existingCodes = new Set((existing || []).map((r) => r.codigo));

console.log(`Modo: ${APPLY ? 'APPLY' : 'DRY-RUN'} | docs no manifesto: ${docs.length} | lote: ${batch.length}`);
console.log(`created_by: ${ownerName} <${OWNER_EMAIL}> (${OWNER_UID})`);
console.log(`já existentes no banco (por codigo): ${batch.filter((d) => existingCodes.has(d.codigo)).length}\n`);

let ok = 0, skipped = 0, failed = 0;
const failures = [];

for (const [i, doc] of batch.entries()) {
  const label = `${doc.codigo} — ${doc.titulo}`;
  if (existingCodes.has(doc.codigo)) {
    console.log(`SKIP  ${label} (codigo já existe)`);
    skipped++;
    continue;
  }
  const docId = `doc-${Date.now()}-${String(i).padStart(3, '0')}`;
  const storagePath = `biblioteca/${docId}/v1/${sanitizeName(doc.arquivo)}`;

  if (!APPLY) {
    console.log(`DRY   ${label}`);
    console.log(`      → ${doc.subcategoria}/${doc.tipo} | storage: ${storagePath}`);
    ok++;
    continue;
  }

  try {
    // 1. Upload
    const buf = readFileSync(doc.path);
    const { error: upErr } = await supabase.storage
      .from('documentos')
      .upload(storagePath, buf, { contentType: 'application/pdf', cacheControl: '3600', upsert: true });
    if (upErr) throw new Error(`upload: ${upErr.message}`);

    // 2. INSERT documentos
    const row = {
      id: docId,
      codigo: doc.codigo,
      titulo: doc.titulo,
      descricao: '',
      tipo: doc.tipo,
      categoria: 'biblioteca',
      subcategoria: doc.subcategoria,
      status: 'ativo',
      versao_atual: 1,
      arquivo_nome: doc.arquivo,
      arquivo_tamanho: doc.size,
      storage_path: storagePath,
      rop_area: 'Padronização',
      qmentum_weight: 0.8,
      tags: doc.tags,
      origem: doc.origem,
      classificacao_acesso: 'interno',
      local_armazenamento: 'Supabase Cloud Storage',
      data_publicacao: doc.data_publicacao,
      data_versao: doc.data_versao,
      responsavel_elaboracao: doc.responsavel_elaboracao,
      responsavel_aprovacao: doc.responsavel_aprovacao,
      responsavel_revisao: doc.responsavel_revisao,
      intervalo_revisao_dias: 365,
      created_by: OWNER_UID,
      created_by_name: ownerName,
      created_by_email: OWNER_EMAIL,
    };
    const { error: insErr } = await supabase.from('documentos').insert(row);
    if (insErr) {
      await supabase.storage.from('documentos').remove([storagePath]);
      throw new Error(`insert documentos: ${insErr.message}`);
    }

    // 3. Versão inicial
    const { error: verErr } = await supabase.from('documento_versoes').insert({
      documento_id: docId,
      versao: 1,
      arquivo_nome: doc.arquivo,
      arquivo_tamanho: doc.size,
      storage_path: storagePath,
      descricao_alteracao: 'Versão inicial',
      motivo_alteracao: 'Importação do acervo institucional vigente',
      status: 'ativo',
      created_by: OWNER_UID,
      created_by_name: ownerName,
    });
    if (verErr) console.warn(`  ⚠ documento_versoes: ${verErr.message}`);

    // 4. Changelog
    const { error: logErr } = await supabase.rpc('rpc_log_document_action', {
      p_documento_id: docId,
      p_action: 'created',
      p_user_id: OWNER_UID,
      p_user_name: ownerName,
      p_user_email: OWNER_EMAIL,
      p_changes: { status: 'ativo', categoria: 'biblioteca', origem: 'import-biblioteca-docs' },
      p_comment: 'Importação em lote do acervo institucional (índice de publicação)',
    });
    if (logErr) console.warn(`  ⚠ changelog: ${logErr.message}`);

    console.log(`OK    ${label} (${docId})`);
    ok++;
  } catch (err) {
    console.error(`FALHA ${label}: ${err.message}`);
    failures.push({ codigo: doc.codigo, erro: err.message });
    failed++;
  }
}

console.log(`\nResumo: ok=${ok} skip=${skipped} falhas=${failed} (modo ${APPLY ? 'APPLY' : 'DRY-RUN'})`);
if (failures.length) {
  console.log(JSON.stringify(failures, null, 1));
  process.exit(1);
}
