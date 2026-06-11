#!/usr/bin/env node
/**
 * Diagnóstico do 401 no pegaplantao-proxy (widget Plantões da Home).
 *
 * Reproduz o fluxo do app: login Firebase (user e2e) → ID token RS256 →
 * POST /functions/v1/pegaplantao-proxy. Imprime APENAS status, claims
 * não-sensíveis (alg, role) e corpo da resposta — NUNCA tokens/senhas.
 *
 * Env consumido internamente (padrão secret-hygiene do projeto):
 *   .env.local            → VITE_FIREBASE_API_KEY, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
 *   ~/.anest-e2e.env      → E2E_USER_EMAIL, E2E_USER_PASSWORD
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
// Firebase web API key é pública (mesma de src/config/firebase.js)
const API_KEY = 'AIzaSyDhFmRaMrLxKAlylqEZqXQtp3737ggJsGw';
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const ANON = env.VITE_SUPABASE_ANON_KEY;
const EMAIL = env.E2E_USER_EMAIL;
const PASSWORD = env.E2E_USER_PASSWORD;

for (const [k, v] of Object.entries({ API_KEY, SUPABASE_URL, ANON, EMAIL, PASSWORD })) {
  if (!v) { console.error(`❌ missing ${k}`); process.exit(1); }
}

// 1. Login Firebase
const loginRes = await fetch(
  `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${API_KEY}`,
  {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, returnSecureToken: true }),
  },
);
if (!loginRes.ok) {
  console.error(`❌ Firebase login failed: ${loginRes.status}`);
  process.exit(1);
}
const { idToken } = await loginRes.json();

// 2. Decodificar header+payload (sem imprimir o token)
const [h, p] = idToken.split('.');
const dec = (s) => JSON.parse(Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString());
const header = dec(h);
const payload = dec(p);
console.log(`token: alg=${header.alg} role=${payload.role ?? '(ausente)'} aud=${payload.aud}`);

// 3. Chamar pegaplantao-proxy como o app faz
async function callProxy(label, bearer) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/pegaplantao-proxy`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
      apikey: ANON,
    },
    body: JSON.stringify({ endpoint: '/api/v1/locais', method: 'GET' }),
  });
  const body = (await res.text()).slice(0, 200);
  console.log(`${label} → ${res.status} ${body}`);
  return res.status;
}

await callProxy('proxy [firebase RS256]', idToken);
await callProxy('proxy [anon HS256]   ', ANON);
