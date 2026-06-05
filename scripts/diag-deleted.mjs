import { readFileSync } from 'fs';
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
const { data } = await supa.from('documentos').select('codigo, titulo, status, deleted_at, deleted_by').not('deleted_at','is',null);
console.log(`Total soft-deleted: ${data.length}`);
const byDay = {}, byWho = {}, byStatus = {};
for (const d of data) {
  byDay[(d.deleted_at||'').slice(0,10)] = (byDay[(d.deleted_at||'').slice(0,10)]||0)+1;
  byWho[d.deleted_by ?? 'NULL'] = (byWho[d.deleted_by ?? 'NULL']||0)+1;
  byStatus[d.status ?? 'NULL'] = (byStatus[d.status ?? 'NULL']||0)+1;
}
console.log('\nPor dia de deleção:'); for (const [k,v] of Object.entries(byDay).sort()) console.log(`  ${k}: ${v}`);
console.log('\nPor deleted_by:'); for (const [k,v] of Object.entries(byWho).sort((a,b)=>b[1]-a[1])) console.log(`  ${k}: ${v}`);
console.log('\nPor status (no momento da deleção):'); for (const [k,v] of Object.entries(byStatus).sort((a,b)=>b[1]-a[1])) console.log(`  ${k}: ${v}`);
console.log('\nAmostra (15):'); for (const d of data.slice(0,15)) console.log(`  [${d.status}] ${d.codigo} — ${d.titulo} | del=${(d.deleted_at||'').slice(0,16)} by=${d.deleted_by??'?'}`);
