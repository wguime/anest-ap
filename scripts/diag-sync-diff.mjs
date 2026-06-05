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

// Taxonomias reais das duas telas
const CATEGORIAS_9 = ['etica','comites','auditorias','relatorios','biblioteca','financeiro','medicamentos','infeccoes','desastres'];
const BIBLIOTECA_SUBCATS = ['modelos','governanca','institucional','assistencial','gestao_pessoas','residencia','financeiro','qualidade','tecnologia_mat','relatorios_gerais','obsoletos'];

const { data } = await supa.from('documentos').select('id, codigo, titulo, categoria, subcategoria, status, deleted_at');

const ADMIN = process.env.ADMIN === '1';
// não-admin: RLS esconde deleted. admin: vê tudo (cliente não filtra deleted_at)
const visiveis = data.filter(d => (ADMIN || !d.deleted_at) && d.status !== 'arquivado');
console.log(`>>> Visão: ${ADMIN ? 'ADMIN (inclui soft-deleted)' : 'não-admin'}`);
console.log(`>>> soft-deleted entre os ativos exibidos: ${visiveis.filter(d=>d.deleted_at).length}`);

// Centro: agrupa por categoria (mostra todos cuja categoria ∈ 9)
const centro = visiveis.filter(d => CATEGORIAS_9.includes(d.categoria));
// Biblioteca: agrupa por subcategoria (mostra só os cuja subcategoria ∈ 11)
const biblio = visiveis.filter(d => BIBLIOTECA_SUBCATS.includes(d.subcategoria));

const centroIds = new Set(centro.map(d=>d.id));
const biblioIds = new Set(biblio.map(d=>d.id));

const soCentro = centro.filter(d => !biblioIds.has(d.id));   // aparece no Centro, some na Biblioteca
const soBiblio = biblio.filter(d => !centroIds.has(d.id));   // aparece na Biblioteca, some no Centro

console.log(`Docs ativos e não-deletados (visíveis a não-admin): ${visiveis.length}`);
console.log(`  Centro de Gestão mostra (categoria ∈ 9): ${centro.length}`);
console.log(`  Biblioteca mostra (subcategoria ∈ 11):   ${biblio.length}`);
console.log(`\n⚠️ No CENTRO mas SOME na BIBLIOTECA: ${soCentro.length}`);
console.log(`⚠️ Na BIBLIOTECA mas SOME no CENTRO: ${soBiblio.length}`);

const subCount = {};
for (const d of soCentro) subCount[d.subcategoria ?? 'NULL'] = (subCount[d.subcategoria ?? 'NULL']||0)+1;
console.log('\n— Os que somem da Biblioteca, por subcategoria:');
for (const [k,v] of Object.entries(subCount).sort((a,b)=>b[1]-a[1])) {
  const inList = BIBLIOTECA_SUBCATS.includes(k) ? '' : ' (fora das 11 da Biblioteca)';
  console.log(`  ${k}: ${v}${inList}`);
}
console.log('\n— Amostra (até 25) que somem da Biblioteca:');
for (const d of soCentro.slice(0,25)) console.log(`  [${d.categoria}/${d.subcategoria ?? 'NULL'}] ${d.codigo} — ${d.titulo}`);

if (soBiblio.length) {
  console.log('\n— Os que somem do Centro:');
  for (const d of soBiblio) console.log(`  [${d.categoria ?? 'NULL'}/${d.subcategoria}] ${d.codigo} — ${d.titulo}`);
}
