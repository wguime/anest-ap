/**
 * DIAGNÓSTICO — assinaturas de leitura errada nas escalas publicadas (60 dias).
 *
 * Auditoria pedida pelo dono em 31/08: medir a taxa de erro de leitura que
 * ninguém reportou. Duas assinaturas mensuráveis sem o documento original:
 *
 *  1. FORA DO RODAPÉ — anestesista com caso que não aparece na ordem de
 *     liberação nem na ajuda do MESMO turno (só quando o rodapé existe). É a
 *     assinatura da linha que saiu para outra pessoa ou do azul não lido
 *     (classe Cristina/Exames 30/07). Mesma comparação de 1º nome da edge
 *     (`blankAnestesistasForaDoRodape`) e da conferência (`casosForaDoRodape`).
 *
 *  2. TURNO × HORA — caso publicado num turno incompatível com a própria hora
 *     (`turnoDeHora`: < 13h = matutino). A publicação filtra por hora, então
 *     um hit aqui veio de edição posterior ou de caminho que não filtra.
 *
 * Uso: node scripts/diag-escala-leitura-60d.mjs [dias]   (default 60)
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

const DIAS = Number(process.argv[2]) || 60;
const desde = new Date(Date.now() - DIAS * 86400000).toISOString().slice(0, 10);

// espelha primeiroNomeNorm da edge + o strip de nota "(CONSULT)" do rodapé
const primeiroNome = (s) => String(s ?? '')
  .replace(/\(.*?\)/g, ' ')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/^\s*ped[.\s]+/i, '')
  .trim().toUpperCase()
  .split(/\s+/)[0] || '';

const rodapeDoTurno = (v, turno) => {
  if (Array.isArray(v)) return v; // formato legado: vale para os dois turnos
  if (v && typeof v === 'object') return Array.isArray(v[turno]) ? v[turno] : [];
  return [];
};

const turnoDeHora = (hora) => {
  const m = /^(\d{1,2})(?::?(\d{2}))?\s*h?$/i.exec(String(hora || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = m[2] == null ? 0 : Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null;
  return h < 13 ? 'matutino' : 'vespertino';
};

const { data: escalas, error } = await supa
  .from('escala_cirurgica')
  .select('id, data, hospital, ordem_liberacao, ajuda_externa, escala_cirurgica_caso(id, sala, hora, turno, anestesista, anestesista_user_id, sem_anestesista, bloco, status_cirurgia)')
  .gte('data', desde)
  .neq('hospital', 'fds')
  .order('data');
if (error) { console.error(error); process.exit(1); }

// Identidade como a conferência resolve: dicionário de apelidos + nome completo
// do cadastro + 1º nome quando tem UM dono só. Sem isso o diagnóstico compara
// texto contra texto e "DIDO" no caso não casa "GUILHERME DIDOMENICO" no rodapé.
const normCompleto = (s) => String(s ?? '')
  .replace(/\(.*?\)/g, ' ')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/^\s*ped[.\s]+/i, '')
  .replace(/\s+/g, ' ')
  .trim().toUpperCase();

const { data: aliases } = await supa.from('escala_anestesista_alias').select('apelido, user_id');
const { data: perfis } = await supa.from('profiles').select('id, nome, conta_duplicada_de');
const porTexto = new Map();
for (const a of aliases || []) porTexto.set(normCompleto(a.apelido), a.user_id);
const porPrimeiro = new Map(); // 1º nome -> Set de uids
for (const p of perfis || []) {
  const n = normCompleto(p.nome);
  if (!n) continue;
  if (!porTexto.has(n)) porTexto.set(n, p.id);
  const pn = n.split(' ')[0];
  if (!porPrimeiro.has(pn)) porPrimeiro.set(pn, new Set());
  porPrimeiro.get(pn).add(p.id);
}
for (const a of aliases || []) {
  const pn = normCompleto(a.apelido).split(' ')[0];
  if (!porPrimeiro.has(pn)) porPrimeiro.set(pn, new Set());
  porPrimeiro.get(pn).add(a.user_id);
}
const canonico = new Map(); // conta secundária -> principal
for (const p of perfis || []) if (p.conta_duplicada_de) canonico.set(p.id, p.conta_duplicada_de);
const canon = (uid) => canonico.get(uid) || uid;
const resolver = (texto) => {
  const n = normCompleto(texto);
  if (!n) return null;
  if (porTexto.has(n)) return canon(porTexto.get(n));
  const uids = porPrimeiro.get(n.split(' ')[0]);
  return uids && new Set([...uids].map(canon)).size === 1 ? canon([...uids][0]) : null;
};

let escalasComRodape = 0;
let totalCasos = 0;
const foraDoRodape = [];
const turnoIncoerente = [];

for (const e of escalas) {
  for (const turno of ['matutino', 'vespertino']) {
    const casos = (e.escala_cirurgica_caso || []).filter((c) => (c.turno || 'matutino') === turno);
    if (!casos.length) continue;
    totalCasos += casos.length;

    for (const c of casos) {
      const t = turnoDeHora(c.hora);
      if (t && t !== turno) turnoIncoerente.push({ data: e.data, hospital: e.hospital, turno, sala: c.sala, hora: c.hora, anestesista: c.anestesista });
    }

    const rodape = rodapeDoTurno(e.ordem_liberacao, turno);
    if (!rodape.length) continue; // sem rodapé (Materno) não há como validar
    escalasComRodape += 1;
    const ajuda = rodapeDoTurno(e.ajuda_externa, turno);
    const noRodape = [...rodape, ...ajuda];
    const nomes = new Set(noRodape.map(primeiroNome).filter(Boolean));
    const uidsRodape = new Set(noRodape.map(resolver).filter(Boolean));

    const fora = new Map();
    for (const c of casos) {
      const bruto = String(c.anestesista || '').trim();
      if (!bruto || bruto === '//' || /^\?+$/.test(bruto) || c.sem_anestesista) continue;
      // dupla "A + B": cada um conta por si
      for (const parte of bruto.split('+')) {
        const pn = primeiroNome(parte);
        if (!pn) continue;
        const uid = (parte === bruto && c.anestesista_user_id ? canon(c.anestesista_user_id) : null) || resolver(parte);
        if (nomes.has(pn)) continue;
        if (uid && uidsRodape.has(uid)) continue;
        fora.set(parte.trim(), (fora.get(parte.trim()) || 0) + 1);
      }
    }
    for (const [nome, n] of fora) {
      foraDoRodape.push({ data: e.data, hospital: e.hospital, turno, nome, casos: n });
    }
  }
}

console.log(`Escalas desde ${desde}: ${escalas.length} · turnos com rodapé: ${escalasComRodape} · casos: ${totalCasos}\n`);
console.log(`FORA DO RODAPÉ (${foraDoRodape.length} pessoas-turno):`);
for (const f of foraDoRodape) console.log(`  ${f.data} ${f.hospital} ${f.turno}: ${f.nome} (${f.casos} caso${f.casos > 1 ? 's' : ''})`);
console.log(`\nTURNO × HORA INCOERENTE (${turnoIncoerente.length} casos):`);
for (const t of turnoIncoerente) console.log(`  ${t.data} ${t.hospital} ${t.turno}: ${t.sala} ${t.hora} · ${t.anestesista}`);
