import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
readFileSync(resolve(__dirname,'..','.env.local'),'utf8').split('\n').forEach(l=>{const m=l.match(/^([^#=][^=]*)=(.*)$/);if(m)env[m[1].trim()]=m[2].trim();});
const supa = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth:{persistSession:false,autoRefreshToken:false},
  global:{headers:{Authorization:`Bearer ${await new SignJWT({iss:'supabase',ref:'vjzrahruvjffyyqyhjny',role:'service_role',iat:(Date.now()/1000|0),exp:(Date.now()/1000|0)+3600}).setProtectedHeader({alg:'HS256',typ:'JWT'}).sign(new TextEncoder().encode(env.SUPABASE_JWT_SECRET))}`}},
});
const { data, error: qerr } = await supa.from('documentos')
  .select('id, codigo, titulo, status, storage_path, arquivo_url')
  .ilike('titulo', '%omunica%');
if (qerr) { console.error('QUERY ERROR:', qerr); process.exit(1); }
for (const d of data) {
  console.log(`\n${d.codigo} [${d.status}] — ${d.titulo}`);
  console.log(`  storage_path: ${d.storage_path}`);
  console.log(`  arquivo_url:  ${d.arquivo_url ? d.arquivo_url.slice(0,60)+'…' : null}`);
  console.log(`  versoes: ${Array.isArray(d.versoes) ? d.versoes.length+' versão(ões)' : typeof d.versoes}`);
  if (Array.isArray(d.versoes)) d.versoes.forEach((v,i)=>console.log(`    v[${i}]: arquivoURL=${v.arquivoURL ?? v.arquivo_url ?? '∅'} storagePath=${v.storagePath ?? v.storage_path ?? '∅'}`));
  if (d.storage_path) {
    const { data:s, error } = await supa.storage.from('documentos').createSignedUrl(d.storage_path, 60);
    if (error) { console.log(`  signedURL: ERRO ${error.message}`); }
    else { const r = await fetch(s.signedUrl,{method:'HEAD'}); console.log(`  signedURL HEAD: ${r.status} ${r.ok?'✓ ABRE':'✗'}`); }
  }
}
