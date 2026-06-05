// READ-ONLY: inspeciona FKs que referenciam 'documentos' e conta objetos do bucket.
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

// FKs que apontam para documentos (via RPC exec se existir; senão tenta query direta)
const fkSql = `
select tc.table_name as child_table, kcu.column_name as child_col, rc.delete_rule
from information_schema.table_constraints tc
join information_schema.key_column_usage kcu on tc.constraint_name = kcu.constraint_name
join information_schema.constraint_column_usage ccu on tc.constraint_name = ccu.constraint_name
join information_schema.referential_constraints rc on tc.constraint_name = rc.constraint_name
where tc.constraint_type='FOREIGN KEY' and ccu.table_name='documentos'`;

let fks = null;
for (const fn of ['exec_sql','execute_sql','run_sql']) {
  const { data, error } = await supa.rpc(fn, { query: fkSql }).then(r=>r,()=>({error:'no-rpc'}));
  if (!error && data) { fks = data; break; }
}
if (fks) {
  console.log('FKs referenciando documentos:');
  console.log(JSON.stringify(fks, null, 2));
} else {
  console.log('Sem RPC de SQL arbitrário — testando tabelas relacionadas candidatas por contagem:');
  const candidatas = ['document_versions','documento_versoes','aprovacoes','document_approvals','revisoes','document_reviews','documento_aprovacoes','documento_revisoes','audit_logs','document_audit'];
  for (const t of candidatas) {
    const { count, error } = await supa.from(t).select('*', { count:'exact', head:true });
    if (!error) console.log(`  ${t}: ${count} linhas (EXISTE)`);
  }
}

// Conta objetos no bucket documentos (lista raiz + pastas comuns)
console.log('\nObjetos no bucket documentos (amostragem de pastas):');
for (const prefix of ['', 'migrated', 'biblioteca', 'institucional', 'Documentos', 'Gerenciamento_Desastres', 'Organogramas']) {
  const { data, error } = await supa.storage.from('documentos').list(prefix, { limit: 1000 });
  if (!error) console.log(`  '${prefix || '(raiz)'}': ${data.length} itens`);
}
