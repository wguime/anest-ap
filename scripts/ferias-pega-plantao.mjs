#!/usr/bin/env node
/**
 * Férias registradas no Pega Plantão para um período — apoio à conferência da
 * ordem de liberação pela escala numérica (regra: quem está de férias sai da
 * lista, preservando a ordem relativa dos demais).
 *
 * Reproduz o fluxo do app (mesmo padrão de scripts/diag-pegaplantao-401.mjs):
 * login Firebase do usuário e2e → ID token → POST pegaplantao-proxy
 * `/api/v1/plantoes?filtro.dataInicio=…&filtro.dataFim=…` → filtra Setor ~ férias.
 * Imprime SÓ nomes e datas (nunca tokens, senhas ou o corpo bruto).
 *
 * Uso: node scripts/ferias-pega-plantao.mjs <AAAA-MM-DD> [<AAAA-MM-DD fim>] [--json]
 * Env consumido internamente: .env.local (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
 * e ~/.anest-e2e.env (E2E_USER_EMAIL, E2E_USER_PASSWORD).
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { homedir } from 'os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');
function loadEnv(path) {
  const out = {};
  if (!existsSync(path)) return out;
  readFileSync(path, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) out[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
  return out;
}
const env = { ...loadEnv(resolve(projectRoot, '.env.local')), ...loadEnv(resolve(homedir(), '.anest-e2e.env')) };
const API_KEY = 'AIzaSyDhFmRaMrLxKAlylqEZqXQtp3737ggJsGw'; // chave web pública (src/config/firebase.js)
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;
const EMAIL = env.E2E_USER_EMAIL;
const PASSWORD = env.E2E_USER_PASSWORD;
for (const [k, v] of Object.entries({ SUPABASE_URL, ANON, EMAIL, PASSWORD })) {
  if (!v) { console.error(`❌ falta ${k} no ambiente`); process.exit(1); }
}

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const asJson = process.argv.includes('--json');
const ini = args[0];
const fim = args[1] || ini;
if (!/^\d{4}-\d{2}-\d{2}$/.test(ini || '') || !/^\d{4}-\d{2}-\d{2}$/.test(fim)) {
  console.error('Uso: node scripts/ferias-pega-plantao.mjs <AAAA-MM-DD> [<AAAA-MM-DD fim>] [--json]');
  process.exit(2);
}

const loginRes = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
});
if (!loginRes.ok) { console.error(`❌ login Firebase falhou: ${loginRes.status}`); process.exit(1); }
const { idToken } = await loginRes.json();

const endpoint = `/api/v1/plantoes?filtro.dataInicio=${ini}T00:00:00&filtro.dataFim=${fim}T23:59:59`;
const res = await fetch(`${SUPABASE_URL}/functions/v1/pegaplantao-proxy`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${idToken}`, 'Content-Type': 'application/json', apikey: ANON },
  body: JSON.stringify({ endpoint, method: 'GET' }),
});
if (!res.ok) { console.error(`❌ proxy ${res.status}`); process.exit(1); }
const data = await res.json();
const lista = Array.isArray(data) ? data : (data?.data || data?.items || []);
const ferias = lista
  .filter((p) => p?.Setor && /f[ée]rias/i.test(p.Setor))
  .map((p) => ({ nome: String(p.ProfDePlantao || p.ProfFixo || '').trim(), inicio: String(p.Inicio || '').slice(0, 10), fim: String(p.Fim || p.Termino || '').slice(0, 10), setor: p.Setor }))
  .filter((r) => r.nome)
  .sort((a, b) => a.inicio.localeCompare(b.inicio) || a.nome.localeCompare(b.nome));
if (asJson) { console.log(JSON.stringify({ periodo: { ini, fim }, total: lista.length, ferias }, null, 1)); }
else {
  console.log(`plantões no período: ${lista.length} · registros de férias: ${ferias.length}`);
  const seen = new Set();
  for (const r of ferias) { const k = `${r.inicio}|${r.nome}`; if (seen.has(k)) continue; seen.add(k); console.log(`  ${r.inicio}${r.fim && r.fim !== r.inicio ? '→' + r.fim : ''}  ${r.nome}  [${r.setor}]`); }
}
