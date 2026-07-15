#!/usr/bin/env node
// Verifica a importação da Biblioteca: linha no banco + versão + changelog +
// signed URL do PDF respondendo 200 com content-type PDF.
import { createClient } from '@supabase/supabase-js';
import { SignJWT } from 'jose';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const envVars = {};
readFileSync(resolve(__dirname, '..', '.env.local'), 'utf8').split('\n').forEach((line) => {
  const m = line.match(/^([^#=][^=]*)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
});

const jwt = await new SignJWT({
  iss: 'supabase', ref: envVars.VITE_SUPABASE_PROJECT_REF || 'vjzrahruvjffyyqyhjny',
  role: 'service_role', iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 600,
}).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).sign(new TextEncoder().encode(envVars.SUPABASE_JWT_SECRET));

const supabase = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${jwt}` } },
});

const { data: docs, error } = await supabase
  .from('documentos')
  .select('id, codigo, titulo, categoria, subcategoria, tipo, status, storage_path, arquivo_tamanho, created_by_name')
  .eq('categoria', 'biblioteca')
  .is('deleted_at', null)
  .order('subcategoria')
  .order('tipo')
  .order('codigo');
if (error) throw error;

console.log('total biblioteca:', docs.length);
const porGrupo = {};
for (const d of docs) {
  const k = `${d.subcategoria}/${d.tipo}`;
  porGrupo[k] = (porGrupo[k] || 0) + 1;
}
console.log(JSON.stringify(porGrupo, null, 1));

const semArquivo = docs.filter((d) => !d.storage_path || !d.arquivo_tamanho);
console.log('docs sem storage_path/tamanho:', semArquivo.length ? semArquivo.map((d) => d.codigo) : 'nenhum');
console.log('status != ativo:', docs.filter((d) => d.status !== 'ativo').length);

// contagens de versões e changelog
const ids = docs.map((d) => d.id);
const { count: nVer } = await supabase.from('documento_versoes').select('id', { count: 'exact', head: true }).in('documento_id', ids);
const { count: nLog } = await supabase.from('documento_changelog').select('id', { count: 'exact', head: true }).in('documento_id', ids);
console.log('documento_versoes:', nVer, '| documento_changelog:', nLog);

// smoke: signed URL do primeiro e do último doc respondem 200 PDF
for (const d of [docs[0], docs[docs.length - 1]].filter(Boolean)) {
  const { data: signed, error: sErr } = await supabase.storage.from('documentos').createSignedUrl(d.storage_path, 300);
  if (sErr) { console.log('signedUrl ERRO', d.codigo, sErr.message); continue; }
  const r = await fetch(signed.signedUrl, { method: 'GET', headers: { Range: 'bytes=0-3' } });
  const head = Buffer.from(await r.arrayBuffer()).toString('latin1');
  console.log(`pdf ${d.codigo}: HTTP ${r.status} magic="${head}"`);
}
