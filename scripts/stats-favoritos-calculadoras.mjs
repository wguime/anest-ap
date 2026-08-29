/**
 * Read-only: quais calculadoras as pessoas marcaram como favoritas.
 *
 * O app NÃO registra uso por calculadora (`trackFeatureUse` existe no hook e
 * nenhum componente o chama), então favorito é o único sinal por calculadora
 * que existe hoje. É um sinal fraco — é opt-in, e a maioria nunca marca nada —
 * mas é medição, não impressão.
 *
 * Segue o padrão de `diag-drift-papel-firestore.mjs`: usa o refresh token da
 * CLI do Firebase já autenticada na máquina. Nenhum segredo passa por stdout.
 *
 * Uso: node scripts/stats-favoritos-calculadoras.mjs
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { homedir } from 'os';

const PROJECT_ID = 'anest-ap';
const FIREBASE_CLI_CLIENT_ID = '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com';
const FIREBASE_CLI_CLIENT_SECRET = 'j9iVZfS8kkCEFUPaAeJV0sAi';

const store = resolve(homedir(), '.config/configstore/firebase-tools.json');
const refreshToken = JSON.parse(readFileSync(store, 'utf8'))?.tokens?.refresh_token;
const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    client_id: FIREBASE_CLI_CLIENT_ID,
    client_secret: FIREBASE_CLI_CLIENT_SECRET,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  }),
}).then((r) => r.json());
const token = tokenRes.access_token;
if (!token) {
  console.error('OAuth falhou:', tokenRes.error_description || tokenRes.error);
  process.exit(1);
}

const FS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

let pageToken = '';
let totalPerfis = 0;
let comFavoritos = 0;
const contagem = {};

do {
  const url = `${FS_BASE}/userProfiles?pageSize=300${pageToken ? `&pageToken=${pageToken}` : ''}`;
  const page = await fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
  if (page.error) {
    console.error('Firestore:', page.error.message);
    process.exit(1);
  }
  for (const d of page.documents || []) {
    totalPerfis += 1;
    const favs = d.fields?.calculatorFavorites?.arrayValue?.values || [];
    if (favs.length > 0) comFavoritos += 1;
    for (const v of favs) {
      const id = v.stringValue;
      if (id) contagem[id] = (contagem[id] || 0) + 1;
    }
  }
  pageToken = page.nextPageToken || '';
} while (pageToken);

console.log(`Perfis lidos: ${totalPerfis}`);
console.log(`Perfis com ao menos um favorito: ${comFavoritos} (${((comFavoritos / totalPerfis) * 100).toFixed(1)}%)`);
console.log(`Calculadoras distintas favoritadas: ${Object.keys(contagem).length}\n`);

const ordenado = Object.entries(contagem).sort((a, b) => b[1] - a[1]);
if (ordenado.length === 0) {
  console.log('Nenhum favorito marcado por ninguém.');
} else {
  console.log('Favoritadas (id → quantas pessoas):');
  ordenado.forEach(([id, n]) => console.log(`  ${id.padEnd(30)}${n}`));
}

console.log('\n⚠️ Favorito NÃO é uso. Mede intenção declarada de quem se deu ao trabalho');
console.log('   de marcar; o silêncio das demais não prova desuso.');
