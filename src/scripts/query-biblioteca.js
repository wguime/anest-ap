#!/usr/bin/env node
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');
const envVars = {};
readFileSync(resolve(projectRoot, '.env.local'), 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([^#=][^=]*)=(.*)$/);
  if (m) envVars[m[1].trim()] = m[2].trim();
});
const { SignJWT } = await import('jose');
const { createClient } = await import('@supabase/supabase-js');
const sk = new TextEncoder().encode(envVars.SUPABASE_JWT_SECRET);
const jwt = await new SignJWT({iss:'supabase',ref:'vjzrahruvjffyyqyhjny',role:'service_role',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600}).setProtectedHeader({alg:'HS256',typ:'JWT'}).sign(sk);
const sb = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY, {auth:{persistSession:false},global:{headers:{Authorization:`Bearer ${jwt}`}}});

const {data} = await sb.from('documentos').select('id, titulo, tipo, subcategoria, rop_area, status').eq('categoria','biblioteca').order('tipo').order('titulo');

// Group by tipo + status
const byTipo = {};
data.forEach(d => {
  const key = `${d.tipo} (${d.status})`;
  if (!byTipo[key]) byTipo[key] = [];
  byTipo[key].push(d);
});
console.log(`=== Biblioteca docs by tipo+status (${data.length} total) ===\n`);
for (const [k, docs] of Object.entries(byTipo).sort()) {
  console.log(`${k}: ${docs.length}`);
  docs.forEach(d => console.log(`  ${d.id.substring(0,25)}... | ${d.titulo.substring(0,55)} | sub=${d.subcategoria} | rop=${d.rop_area}`));
}

// Subcategoria distribution
console.log('\n=== By subcategoria ===');
const bySub = {};
data.forEach(d => { bySub[d.subcategoria || 'null'] = (bySub[d.subcategoria || 'null'] || 0) + 1; });
for (const [k, v] of Object.entries(bySub).sort()) console.log(`  ${k}: ${v}`);

// Duplicates check
console.log('\n=== Potential duplicates (same titulo, both active) ===');
const activeDocs = data.filter(d => d.status === 'ativo');
const titleMap = {};
activeDocs.forEach(d => {
  const key = d.titulo.toLowerCase().trim();
  if (!titleMap[key]) titleMap[key] = [];
  titleMap[key].push(d);
});
for (const [title, docs] of Object.entries(titleMap)) {
  if (docs.length > 1) {
    console.log(`  "${docs[0].titulo}" (${docs.length} copies):`);
    docs.forEach(d => console.log(`    ${d.id} | tipo=${d.tipo} | sub=${d.subcategoria}`));
  }
}
