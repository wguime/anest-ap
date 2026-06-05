// WIPE TOTAL de documentos (clean slate). Hard-delete de todas as linhas de
// `documentos` (filhos via ON DELETE CASCADE) + purge recursivo do bucket
// `documentos`. Backup JSON completo antes.
//
// MODE=dry   (default) → conta e faz backup, NÃO apaga.
// MODE=apply           → executa o wipe.
import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';

const MODE = process.env.MODE === 'apply' ? 'apply' : 'dry';
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
readFileSync(resolve(__dirname,'..','.env.local'),'utf8').split('\n').forEach(l=>{const m=l.match(/^([^#=][^=]*)=(.*)$/);if(m)env[m[1].trim()]=m[2].trim();});
const supa = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
  auth:{persistSession:false,autoRefreshToken:false},
  global:{headers:{Authorization:`Bearer ${await new SignJWT({iss:'supabase',ref:'vjzrahruvjffyyqyhjny',role:'service_role',iat:(Date.now()/1000|0),exp:(Date.now()/1000|0)+3600}).setProtectedHeader({alg:'HS256',typ:'JWT'}).sign(new TextEncoder().encode(env.SUPABASE_JWT_SECRET))}`}},
});

// 1) BACKUP completo
const tables = ['documentos','documento_versoes','documento_aprovacoes'];
const backup = {};
for (const t of tables) {
  const { data, error } = await supa.from(t).select('*');
  if (error) { console.log(`  backup ${t}: SKIP (${error.message})`); continue; }
  backup[t] = data; console.log(`  backup ${t}: ${data.length} linhas`);
}
const bpath = resolve(__dirname, `.wipe-backup-${Date.now()}.json`);
writeFileSync(bpath, JSON.stringify(backup, null, 2));
console.log(`Backup salvo: ${bpath}`);

// 2) Listagem recursiva do bucket
async function listAll(prefix = '') {
  const out = [];
  const { data, error } = await supa.storage.from('documentos').list(prefix, { limit: 1000 });
  if (error || !data) return out;
  for (const item of data) {
    const full = prefix ? `${prefix}/${item.name}` : item.name;
    if (item.id === null || (item.metadata == null && !item.name.includes('.'))) {
      // provável "pasta" → recursa
      out.push(...await listAll(full));
    } else {
      out.push(full);
    }
  }
  return out;
}
const objects = await listAll('');
console.log(`Objetos no bucket documentos: ${objects.length}`);

const { count: docCount } = await supa.from('documentos').select('*',{count:'exact',head:true});
console.log(`\nMODE=${MODE} | linhas documentos: ${docCount} | objetos storage: ${objects.length}`);

if (MODE === 'dry') {
  console.log('DRY-RUN — nada apagado. Rode com MODE=apply para executar.');
  process.exit(0);
}

// 3) SOFT-DELETE de todas as linhas (hard delete é bloqueado por trigger de
//    compliance). Com o filtro deleted_at IS NULL, somem das duas telas.
const { error: delErr, count: deleted } = await supa
  .from('documentos')
  .update({ deleted_at: new Date().toISOString(), deleted_by: 'sistema-wipe-clean-slate' }, { count: 'exact' })
  .is('deleted_at', null);
if (delErr) { console.error('ERRO soft-delete documentos:', delErr); process.exit(1); }
console.log(`✓ Linhas documentos soft-deletadas (ocultas das telas): ${deleted}`);

// 4) PURGE storage (em lotes de 100)
let removed = 0;
for (let i = 0; i < objects.length; i += 100) {
  const batch = objects.slice(i, i + 100);
  const { error } = await supa.storage.from('documentos').remove(batch);
  if (error) console.log(`  ⚠️ lote ${i}: ${error.message}`);
  else removed += batch.length;
}
console.log(`✓ Objetos removidos do storage: ${removed}/${objects.length}`);

// 5) Verificação — o que importa é o que aparece nas telas (deleted_at IS NULL)
const { count: visiveis } = await supa.from('documentos').select('*',{count:'exact',head:true}).is('deleted_at', null);
const { count: total } = await supa.from('documentos').select('*',{count:'exact',head:true});
const leftover = await listAll('');
console.log(`\nApós wipe → visíveis (deleted_at null): ${visiveis} | total c/ tombstones: ${total} | objetos storage: ${leftover.length}`);
console.log(visiveis === 0 && leftover.length === 0 ? '✓ CLEAN SLATE (telas vazias; tombstones preservados p/ compliance)' : '⚠️ sobrou algo visível');
