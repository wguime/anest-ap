/**
 * DIAGNÓSTICO — de onde saíram as ajudas de um dia.
 *
 * Imprime, para cada hospital do dia, a ordem de liberação publicada por turno,
 * o array `ajuda_externa` e os anestesistas com caso. É o insumo para conferir a
 * regra do dono (31/07, reafirmada em 27/08): ajuda que está na escala de outro
 * hospital libera na ORDEM DE LIBERAÇÃO DE LÁ.
 *
 * Uso: node scripts/diag-escala-ajudas.mjs [AAAA-MM-DD]
 * Sem argumento, usa a data de hoje. Não escreve nada no banco.
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

const dia = process.argv[2] || new Date().toISOString().slice(0, 10);

const { data: escalas, error } = await supa
  .from('escala_cirurgica')
  .select('id,data,hospital,status,ordem_liberacao,ajuda_externa')
  .eq('data', dia);
if (error) { console.error('ERRO escala_cirurgica:', error.message); process.exit(1); }
if (!escalas?.length) { console.log(`Nenhuma escala publicada em ${dia}.`); process.exit(0); }

const { data: casos, error: e2 } = await supa
  .from('escala_cirurgica_caso')
  .select('*')
  .in('escala_id', escalas.map((e) => e.id))
  .order('sala', { ascending: true })
  .order('ordem', { ascending: true });
if (e2) { console.error('ERRO escala_cirurgica_caso:', e2.message); process.exit(1); }

// --json <hospital>: fixture fiel para reproduzir a fila em teste
const jsonDe = process.argv.includes('--json') ? process.argv[process.argv.indexOf('--json') + 1] : null;
if (jsonDe) {
  const alvo = escalas.find((e) => e.hospital === jsonDe);
  if (!alvo) { console.error(`hospital "${jsonDe}" não tem escala em ${dia}`); process.exit(1); }
  console.log(JSON.stringify({
    hospital: alvo.hospital,
    ordemLiberacao: alvo.ordem_liberacao,
    ajudaExterna: alvo.ajuda_externa,
    // camelCase, sem campo de paciente (LGPD: o diagnóstico é da FILA, não do caso)
    casos: (casos || []).filter((c) => c.escala_id === alvo.id).map((c) => Object.fromEntries(
      Object.entries(c)
        .filter(([k]) => !/paciente|idade|procedimento|convenio|escala_id|created|updated/.test(k))
        .map(([k, v]) => [k.replace(/_([a-z])/g, (_, ch) => ch.toUpperCase()), v]),
    )),
    rodapesOutros: escalas.filter((e) => e.hospital !== alvo.hospital)
      .map((e) => ({ hospital: e.hospital, ordemLiberacao: e.ordem_liberacao })),
  }, null, 2));
  process.exit(0);
}

if (process.argv.includes('--alias')) {
  const { data: alias, error: e3 } = await supa
    .from('escala_anestesista_alias').select('apelido,user_id');
  if (e3) { console.error('ERRO alias:', e3.message); process.exit(1); }
  const alvo = process.argv[process.argv.indexOf('--alias') + 1];
  const filtro = alvo && !alvo.startsWith('--') ? alvo.toUpperCase() : null;
  for (const a of alias || []) {
    if (!filtro || String(a.apelido).toUpperCase().includes(filtro)) console.log(`  ${a.apelido} -> ${a.user_id ? 'uid' : '(sem uid)'}`);
  }
  process.exit(0);
}

console.log(`\n===== ESCALAS DE ${dia} =====`);
for (const e of escalas) {
  console.log(`\n--- ${e.hospital.toUpperCase()} (${e.status}) ---`);
  for (const turno of ['matutino', 'vespertino']) {
    const ordem = Array.isArray(e.ordem_liberacao) ? (turno === 'matutino' ? e.ordem_liberacao : [])
      : (e.ordem_liberacao?.[turno] || []);
    const ajuda = Array.isArray(e.ajuda_externa) ? (turno === 'matutino' ? e.ajuda_externa : [])
      : (e.ajuda_externa?.[turno] || []);
    if (!ordem.length && !ajuda.length) continue;
    console.log(`  [${turno}] ordem de liberação (1º = plantonista, último = sai 1º):`);
    ordem.forEach((n, i) => console.log(`      ${i + 1}. ${n}${ajuda.some((a) => String(a).toUpperCase() === String(n).toUpperCase()) ? '   <-- marcado AJUDA' : ''}`));
    console.log(`  [${turno}] ajuda_externa (ordem do array = ordem da fila hoje): ${JSON.stringify(ajuda)}`);
    const doTurno = (casos || []).filter((c) => c.escala_id === e.id
      && (c.turno ? c.turno === turno : (turno === 'matutino' ? (c.hora || '07:00') < '13:00' : (c.hora || '07:00') >= '13:00')));
    const porAnest = new Map();
    for (const c of doTurno) {
      const k = c.anestesista || '(sem anestesista)';
      if (!porAnest.has(k)) porAnest.set(k, []);
      porAnest.get(k).push(`${c.sala}${c.hora ? ` ${c.hora}` : ''}`);
    }
    if (porAnest.size) {
      console.log(`  [${turno}] com caso aqui:`);
      for (const [nome, salas] of porAnest) {
        const noRodape = ordem.some((n) => String(n).toUpperCase().includes(String(nome).toUpperCase().split(/\s|\+/)[0]));
        console.log(`      ${nome} — ${salas.join(', ')}${noRodape ? '' : '   <-- FORA do rodapé daqui'}`);
      }
    }
  }
}
console.log('');
