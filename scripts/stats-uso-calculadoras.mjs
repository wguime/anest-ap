/**
 * Estatística de uso do app a partir de `user_activity_log` (Supabase).
 *
 * Segue o mesmo padrão de `check-supabase-counts.mjs`: o script lê o
 * `.env.local` por conta própria e assina o JWT de service_role. Nenhum segredo
 * passa por stdout.
 *
 * ⚠️ O app registra `page_view` (chamado em `App.jsx`) mas NUNCA chama
 * `trackFeatureUse`, então NÃO existe contagem por calculadora individual —
 * só quantas vezes a página de calculadoras foi aberta. Este script reporta o
 * que existe e diz explicitamente o que não existe.
 *
 * Uso: node scripts/stats-uso-calculadoras.mjs
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SignJWT } from 'jose';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
const envVars = {};
const envPath = resolve(projectRoot, '.env.local');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) envVars[m[1].trim()] = m[2].trim();
  });
}

const SUPABASE_URL = envVars.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = envVars.VITE_SUPABASE_ANON_KEY;
const JWT_SECRET = envVars.SUPABASE_JWT_SECRET || envVars.VITE_SUPABASE_JWT_SECRET;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !JWT_SECRET) {
  console.error('Faltam VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY / SUPABASE_JWT_SECRET no .env.local');
  process.exit(1);
}

const jwt = await new SignJWT({
  iss: 'supabase',
  ref: 'vjzrahruvjffyyqyhjny',
  role: 'service_role',
  iat: Math.floor(Date.now() / 1000),
  exp: Math.floor(Date.now() / 1000) + 3600,
})
  .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
  .sign(new TextEncoder().encode(JWT_SECRET));

const supa = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${jwt}` } },
});

// Paginação: o PostgREST devolve no máximo 1000 linhas por requisição.
const PAGINA = 1000;
let linhas = [];
for (let inicio = 0; ; inicio += PAGINA) {
  const { data, error } = await supa
    .from('user_activity_log')
    .select('event_type, event_data, created_at')
    .order('created_at', { ascending: true })
    .range(inicio, inicio + PAGINA - 1);
  if (error) {
    console.error('ERRO:', error.message, error.code || '');
    process.exit(1);
  }
  linhas = linhas.concat(data);
  if (data.length < PAGINA) break;
}

if (linhas.length === 0) {
  console.log('Nenhum evento registrado em user_activity_log.');
  process.exit(0);
}

console.log(`Eventos: ${linhas.length}`);
console.log(`Janela: ${linhas[0].created_at.slice(0, 10)} a ${linhas[linhas.length - 1].created_at.slice(0, 10)}\n`);

const contar = (arr, chave) => {
  const m = {};
  arr.forEach((r) => {
    const k = chave(r) ?? 'desconhecida';
    m[k] = (m[k] || 0) + 1;
  });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
};

console.log('Por tipo de evento:');
contar(linhas, (r) => r.event_type).forEach(([k, v]) => console.log(`  ${String(k).padEnd(20)}${v}`));

const pageViews = linhas.filter((r) => r.event_type === 'page_view');
console.log(`\nPáginas mais abertas (de ${pageViews.length} page_view):`);
contar(pageViews, (r) => r.event_data?.page ?? r.event_data?.pageName)
  .forEach(([k, v]) => console.log(`  ${String(k).padEnd(30)}${v}`));

const featureUse = linhas.filter((r) => r.event_type === 'feature_use');
console.log(`\nfeature_use: ${featureUse.length}`);
if (featureUse.length === 0) {
  console.log('  ⚠️ ZERO — `trackFeatureUse` existe no hook mas nenhum componente o chama.');
  console.log('  Logo NÃO HÁ contagem por calculadora individual. O que existe é a página inteira.');
} else {
  contar(featureUse, (r) => r.event_data?.featureId).forEach(([k, v]) => console.log(`  ${String(k).padEnd(30)}${v}`));
}

const citamCalc = linhas.filter((r) => JSON.stringify(r.event_data || {}).toLowerCase().includes('calc'));
console.log(`\nEventos que citam "calc" no event_data: ${citamCalc.length}`);
if (citamCalc.length > 0) {
  const amostra = [...new Set(citamCalc.map((r) => JSON.stringify(r.event_data)))].slice(0, 5);
  amostra.forEach((a) => console.log(`  ${a}`));
}
