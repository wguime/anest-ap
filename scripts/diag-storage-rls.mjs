import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
readFileSync(resolve(__dirname,'..','.env.local'),'utf8').split('\n').forEach(l=>{const m=l.match(/^([^#=][^=]*)=(.*)$/);if(m)env[m[1].trim()]=m[2].trim();});
const mkJwt = (role, sub) => new SignJWT({iss:'supabase',ref:'vjzrahruvjffyyqyhjny',role,...(sub?{sub}:{}),iat:(Date.now()/1000|0),exp:(Date.now()/1000|0)+3600}).setProtectedHeader({alg:'HS256',typ:'JWT'}).sign(new TextEncoder().encode(env.SUPABASE_JWT_SECRET));

const svc = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth:{persistSession:false,autoRefreshToken:false}, global:{headers:{Authorization:`Bearer ${await mkJwt('service_role')}`}},
});

// 1) Policies de storage.objects
const { data: pol, error } = await svc.rpc('exec_sql', {}).then(()=>({}),()=>({})); // ignora se não existir
const { data: policies } = await svc.from('pg_policies').select('*').eq('tablename','objects').then(r=>r, ()=>({data:null}));
console.log('— Policies storage.objects (via pg_policies):', policies ? policies.length : 'sem acesso direto');
if (policies) for (const p of policies) console.log(`  [${p.cmd}] ${p.policyname} :: ${(p.qual||'').slice(0,200)}`);

// 2) Pega um doc migrado e um doc institucional p/ comparar
const { data: docs } = await svc.from('documentos').select('codigo,storage_path').not('storage_path','is',null).limit(400);
const mig = docs.find(d => d.storage_path?.startsWith('migrated/'));
const inst = docs.find(d => d.storage_path && !d.storage_path.startsWith('migrated/'));
console.log('\nAmostra:', { migrated: mig?.storage_path, outro: inst?.storage_path?.slice(0,50) });

// 3) Tenta assinar como usuário AUTENTICADO (igual ao app)
const authJwt = await mkJwt('authenticated', 'diagnostic-firebase-uid');
const asUser = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth:{persistSession:false,autoRefreshToken:false}, global:{headers:{Authorization:`Bearer ${authJwt}`}},
});
for (const [label, path] of [['migrated', mig?.storage_path], ['outro', inst?.storage_path]]) {
  if (!path) continue;
  const { data, error } = await asUser.storage.from('documentos').createSignedUrl(path, 60);
  console.log(`\n[authenticated] sign ${label}: ${error ? 'ERRO → '+error.message : 'OK ✓'}`);
}
