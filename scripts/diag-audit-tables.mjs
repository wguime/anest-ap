import { readFileSync } from 'fs'; import { resolve, dirname } from 'path'; import { fileURLToPath } from 'url';
import { SignJWT } from 'jose'; import { createClient } from '@supabase/supabase-js';
const __dirname = dirname(fileURLToPath(import.meta.url)); const env = {};
readFileSync(resolve(__dirname,'..','.env.local'),'utf8').split('\n').forEach(l=>{const m=l.match(/^([^#=][^=]*)=(.*)$/);if(m)env[m[1].trim()]=m[2].trim();});
const supa = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth:{persistSession:false,autoRefreshToken:false}, global:{headers:{Authorization:`Bearer ${await new SignJWT({iss:'supabase',ref:'vjzrahruvjffyyqyhjny',role:'service_role',iat:(Date.now()/1000|0),exp:(Date.now()/1000|0)+3600}).setProtectedHeader({alg:'HS256',typ:'JWT'}).sign(new TextEncoder().encode(env.SUPABASE_JWT_SECRET))}`}} });
for (const t of ['documento_changelog','documento_aprovacoes','documento_revisoes']) {
  const { count, error } = await supa.from(t).select('*',{count:'exact',head:true});
  console.log(`  ${t}: ${error ? 'ERRO/'+error.code : count + ' linhas'}`);
}
const { data } = await supa.from('documento_changelog').select('action').limit(2000);
if (data) { const by={}; for(const r of data) by[r.action]=(by[r.action]||0)+1; console.log('  actions:', JSON.stringify(by)); }
