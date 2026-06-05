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

const CANON = ['etica','comites','auditorias','relatorios','biblioteca','financeiro','medicamentos','infeccoes','desastres'];

const { data, error } = await supa.from('documentos')
  .select('id, codigo, titulo, categoria, subcategoria, status, deleted_at');
if (error) { console.error(error); process.exit(1); }

const cat = {}, sub = {}, st = {};
let deleted = 0, nullCat = 0;
const offCanon = [];
for (const d of data) {
  cat[d.categoria ?? 'NULL'] = (cat[d.categoria ?? 'NULL']||0)+1;
  sub[d.subcategoria ?? 'NULL'] = (sub[d.subcategoria ?? 'NULL']||0)+1;
  st[d.status ?? 'NULL'] = (st[d.status ?? 'NULL']||0)+1;
  if (d.deleted_at) deleted++;
  if (!d.categoria) nullCat++;
  if (!CANON.includes(d.categoria)) offCanon.push(d);
}

console.log(`TOTAL linhas: ${data.length}`);
console.log(`soft-deleted (deleted_at != null): ${deleted}`);
console.log('\n— categoria (count):');
for (const [k,v] of Object.entries(cat).sort((a,b)=>b[1]-a[1])) {
  const mark = CANON.includes(k) ? '' : '  ⚠️ FORA DAS 9 → descartado no contexto';
  console.log(`  ${k}: ${v}${mark}`);
}
console.log('\n— status (count):');
for (const [k,v] of Object.entries(st).sort((a,b)=>b[1]-a[1])) console.log(`  ${k}: ${v}`);
console.log('\n— subcategoria (count):');
for (const [k,v] of Object.entries(sub).sort((a,b)=>b[1]-a[1])) console.log(`  ${k}: ${v}`);

if (offCanon.length) {
  console.log(`\n⚠️ DOCS COM categoria FORA DAS 9 (${offCanon.length}) — somem de Biblioteca E Centro:`);
  for (const d of offCanon) console.log(`  [${d.status}] cat=${d.categoria ?? 'NULL'} sub=${d.subcategoria ?? 'NULL'} | ${d.codigo} — ${d.titulo} | id=${d.id}`);
}
