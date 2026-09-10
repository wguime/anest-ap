#!/usr/bin/env node
/**
 * Cria (ou localiza) uma conta compartilhada de HOSPITAL da escala cirúrgica no
 * Firebase Auth e imprime o UID — que é o que Firestore e Supabase precisam.
 *
 * Contexto (dono 2026-09-08): "quero que crie um usuário para funcionárias da
 * unimed, esse usuário deve ter acesso apenas a escala cirúrgica. senha deve ser
 * [a senha combinada]. login pode ser: Unimed (sem necessidade de email, não irão receber
 * nenhum tipo de informação)". O Firebase Auth exige e-mail, então o login
 * `Unimed` vira `unimed@anest.local` — `.local` é reservado pela RFC 6762 e não
 * é roteável, então nenhuma mensagem sai para a internet. A conversão no app
 * mora em `src/utils/loginIdentifier.js`.
 *
 * Em 2026-09-09 veio a segunda: "crie um usuário HRO, Usuário: HRO ... exatamente
 * igual ao acesso para funcionárias da Unimed". Daí o script ser por hospital em
 * vez de fixo na Unimed. O NOME da conta é o hospital e nada mais — o dono pediu
 * que a palavra "funcionária" saísse das duas ("quero apenas Unimed ... e HRO").
 *
 * Por que REST e não firebase-admin: não há service account nem ADC nesta
 * máquina (`applicationDefault()` falha). O endpoint público accounts:signUp é
 * o mesmo que o app usa no cadastro, com a apiKey pública do cliente web.
 *
 * Idempotente: se a conta existir, faz login e devolve o mesmo UID.
 * Segurança: a apiKey vem de `src/config/firebase.js` — ela é a chave PÚBLICA do
 * cliente web (vai no bundle por desenho do Firebase, já está commitada), não um
 * secret. Ainda assim o script nunca imprime chave, senha ou token: só UID e e-mail.
 *
 * ⚠️ Isto cria só a conta do Firebase Auth. Faltam, depois, com o UID impresso:
 *   - Supabase: linha em `authorized_emails` e em `profiles` (role do hospital,
 *     custom_permissions = true, todos os ~94 cards false);
 *   - Firestore: doc `userProfiles/<uid>` com os mesmos campos.
 * O acesso à escala NÃO passa por card — é o gate por papel (`gate.js` + as
 * funções `can_write_escala_cirurgica`/`can_publicar_escala_cirurgica`).
 *
 * Uso:
 *   node scripts/criar-conta-hospital-escala.mjs <unimed|hro> <senha>
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

// Contas de hospital: login digitado = nome do hospital, papel = o dela.
// Conta nova do mesmo tipo é uma linha aqui + uma no `gate.js` + a migration.
const CONTAS = {
  unimed: { login: 'Unimed', nome: 'Unimed', papel: 'func-unimed' },
  hro: { login: 'HRO', nome: 'HRO', papel: 'func-hro' },
};

const CHAVE = String(process.argv[2] || '').toLowerCase();
const CONTA = CONTAS[CHAVE];
if (!CONTA) {
  console.error(`FALHA: hospital inválido — use ${Object.keys(CONTAS).join(' | ')}`);
  console.error('       node scripts/criar-conta-hospital-escala.mjs <unimed|hro> <senha>');
  process.exit(1);
}
const EMAIL = `${CONTA.login.toLowerCase()}@anest.local`;
const NOME = CONTA.nome;

// A senha NÃO mora no repositório — mesmo sendo de conta compartilhada, senha em
// código versionado é senha vazada. Vem por argumento ou ambiente:
//   node scripts/criar-conta-hospital-escala.mjs hro <senha>
//   CONTA_HOSPITAL_SENHA=... node scripts/criar-conta-hospital-escala.mjs hro
const SENHA = process.argv[3] || process.env.CONTA_HOSPITAL_SENHA;
if (!SENHA) {
  console.error('FALHA: informe a senha — node scripts/criar-conta-hospital-escala.mjs <unimed|hro> <senha>');
  console.error('       (ou CONTA_HOSPITAL_SENHA no ambiente). Ela não fica no repositório.');
  process.exit(1);
}

// A config do cliente web vive no fonte (src/config/firebase.js), não no .env
const configPath = resolve(projectRoot, 'src/config/firebase.js');
if (!existsSync(configPath)) {
  console.error('FALHA: src/config/firebase.js não encontrado.');
  process.exit(1);
}
const API_KEY = readFileSync(configPath, 'utf8').match(/apiKey:\s*["']([^"']+)["']/)?.[1];
if (!API_KEY) {
  console.error('FALHA: apiKey não encontrada em src/config/firebase.js.');
  process.exit(1);
}

const IDP = 'https://identitytoolkit.googleapis.com/v1/accounts';

async function post(path, body) {
  const r = await fetch(`${IDP}:${path}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await r.json();
  return { ok: r.ok, json };
}

let idToken;
let uid;

const criado = await post('signUp', { email: EMAIL, password: SENHA, returnSecureToken: true });
if (criado.ok) {
  idToken = criado.json.idToken;
  uid = criado.json.localId;
  console.log(`✅ Conta CRIADA: ${EMAIL}`);
} else if (criado.json?.error?.message?.startsWith('EMAIL_EXISTS')) {
  const login = await post('signInWithPassword', { email: EMAIL, password: SENHA, returnSecureToken: true });
  if (!login.ok) {
    // Não imprimir o corpo inteiro: pode ecoar o payload enviado.
    console.error(`FALHA: conta existe mas a senha não confere (${login.json?.error?.message || 'erro'}).`);
    process.exit(1);
  }
  idToken = login.json.idToken;
  uid = login.json.localId;
  console.log(`ℹ️  Conta JÁ EXISTIA: ${EMAIL}`);
} else {
  console.error(`FALHA ao criar conta: ${criado.json?.error?.message || 'erro desconhecido'}`);
  process.exit(1);
}

// displayName é o que aparece no app (audit trail da escala grava o nome)
const perfil = await post('update', { idToken, displayName: NOME, returnSecureToken: false });
if (!perfil.ok) {
  console.error(`AVISO: displayName não aplicado (${perfil.json?.error?.message || 'erro'}).`);
}

console.log(`UID=${uid}`);
console.log(`EMAIL=${EMAIL}`);
console.log(`NOME=${NOME}`);
console.log(`PAPEL=${CONTA.papel}`);
