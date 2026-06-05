// Limpa o histórico de auditoria (escopo MÍNIMO): documento_changelog (+archive).
// WORM: só service_role pode apagar. Backup antes. MODE=dry (default) | apply.
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

const tables = ['documento_changelog','documento_changelog_archive'];
const backup = {};
for (const t of tables) {
  const { data, error } = await supa.from(t).select('*');
  if (error) { console.log(`  ${t}: SKIP (${error.message})`); continue; }
  backup[t] = data; console.log(`  ${t}: ${data.length} linhas`);
}
const bpath = resolve(__dirname, `.audit-backup-${Date.now()}.json`);
writeFileSync(bpath, JSON.stringify(backup, null, 2));
console.log(`Backup salvo: ${bpath}`);

console.log(`\nMODE=${MODE}`);
if (MODE === 'dry') { console.log('DRY-RUN — nada apagado. Rode com MODE=apply.'); process.exit(0); }

for (const t of tables) {
  if (!backup[t]) continue;
  const { error, count } = await supa.from(t).delete({ count: 'exact' }).not('id','is',null);
  if (error) console.log(`  ⚠️ delete ${t}: ${error.message}`);
  else console.log(`  ✓ ${t} apagada: ${count} linhas`);
}
for (const t of tables) {
  const { count } = await supa.from(t).select('*',{count:'exact',head:true});
  console.log(`  ${t} agora: ${count}`);
}
console.log('✓ histórico de auditoria limpo');
