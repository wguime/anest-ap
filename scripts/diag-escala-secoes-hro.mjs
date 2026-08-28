/**
 * DIAGNÓSTICO — as seções EXAMES / IMAGEM / HEMODINÂMICA nas escalas do HRO.
 *
 * O dono relatou (27/08) que a leitura "várias vezes não faz a leitura dos
 * locais: Imagem, Exames, hemodinâmica" e que essas seções SEMPRE aparecem no
 * documento. Este script mede o outro lado: em quantas escalas publicadas elas
 * de fato chegaram. A diferença entre "sempre no papel" e "presente no banco" é
 * a taxa de perda da extração.
 *
 * Uso: node scripts/diag-escala-secoes-hro.mjs [dias=60] [hospital=hro]
 * Não escreve nada no banco.
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

const jwt = await new SignJWT({
  iss: 'supabase', ref: 'vjzrahruvjffyyqyhjny', role: 'service_role',
  iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + 3600,
}).setProtectedHeader({ alg: 'HS256', typ: 'JWT' }).sign(new TextEncoder().encode(envVars.SUPABASE_JWT_SECRET));

const supa = createClient(envVars.VITE_SUPABASE_URL, envVars.VITE_SUPABASE_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
  global: { headers: { Authorization: `Bearer ${jwt}` } },
});

const dias = Number(process.argv[2] || 60);
const hospital = process.argv[3] || 'hro';
const desde = new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);

const { data: escalas, error } = await supa
  .from('escala_cirurgica')
  .select('id,data,hospital,status')
  .eq('hospital', hospital)
  .gte('data', desde)
  .order('data', { ascending: true });
if (error) { console.error('ERRO escala_cirurgica:', error.message); process.exit(1); }
if (!escalas?.length) { console.log(`Nenhuma escala de ${hospital} desde ${desde}.`); process.exit(0); }

const { data: casos, error: e2 } = await supa
  .from('escala_cirurgica_caso')
  .select('escala_id,sala,turno,bloco')
  .in('escala_id', escalas.map((e) => e.id));
if (e2) { console.error('ERRO escala_cirurgica_caso:', e2.message); process.exit(1); }

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
const SECOES = {
  Exames: (s, b) => /^EXAME/.test(s) || b === 'exames',
  Imagem: (s, b) => /^IMAGEM/.test(s) || b === 'imagem',
  'Hemodinâmica': (s, b) => /^HEMO/.test(s) || b === 'hemodinamica',
};
const IOSC_EM_SALA_NUMERICA = (s, b) => b === 'iosc' && /^SALA ?\d/.test(s);

const porEscala = new Map(escalas.map((e) => [e.id, { ...e, casos: [] }]));
for (const c of casos || []) porEscala.get(c.escala_id)?.casos.push(c);

// uma LINHA por (data, turno): é a unidade que a secretária importa
const linhas = [];
for (const e of porEscala.values()) {
  for (const turno of ['matutino', 'vespertino']) {
    const doTurno = e.casos.filter((c) => (c.turno || 'matutino') === turno);
    if (!doTurno.length) continue;
    const presente = {};
    for (const [nome, testa] of Object.entries(SECOES)) {
      presente[nome] = doTurno.some((c) => testa(norm(c.sala), String(c.bloco || '').toLowerCase()));
    }
    linhas.push({
      data: e.data,
      turno,
      casos: doTurno.length,
      ...presente,
      ioscTorto: doTurno.filter((c) => IOSC_EM_SALA_NUMERICA(norm(c.sala), String(c.bloco || '').toLowerCase())).length,
    });
  }
}

const n = linhas.length;
const conta = (k) => linhas.filter((l) => l[k]).length;
const pct = (q) => `${q}/${n} (${Math.round((q / n) * 100)}%)`;

console.log(`\n=== ${hospital.toUpperCase()} — ${n} importações (data × turno) desde ${desde} ===\n`);
for (const nome of Object.keys(SECOES)) console.log(`  ${nome.padEnd(14)} presente em ${pct(conta(nome))}`);
const nenhuma = linhas.filter((l) => !l.Exames && !l.Imagem && !l['Hemodinâmica']).length;
const todas = linhas.filter((l) => l.Exames && l.Imagem && l['Hemodinâmica']).length;
console.log(`\n  as TRÊS juntas   ${pct(todas)}`);
console.log(`  NENHUMA das três ${pct(nenhuma)}   <- é o que o aviso de hoje pega`);
const ioscTorto = linhas.filter((l) => l.ioscTorto > 0);
console.log(`  IOSC em "Sala N" ${pct(ioscTorto.length)}   <- corrigido em 27/08 (pelo bloco)\n`);

console.log('  data        turno       casos  Exames  Imagem  Hemo');
for (const l of linhas.slice(-20)) {
  const m = (v) => (v ? '  sim ' : '  --- ');
  console.log(`  ${l.data}  ${l.turno.padEnd(11)} ${String(l.casos).padStart(4)}  ${m(l.Exames)}  ${m(l.Imagem)}  ${m(l['Hemodinâmica'])}`);
}
console.log('');
