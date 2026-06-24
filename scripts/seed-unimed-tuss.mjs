#!/usr/bin/env node
/**
 * Seed public.unimed_tuss_codigos a partir do JSON gerado por extract-tuss-from-xlsx.mjs.
 * Idempotente via ON CONFLICT (codigo) DO UPDATE. Aplica via Supabase Management API.
 *
 * Uso:
 *   node scripts/extract-tuss-from-xlsx.mjs            # gera o JSON primeiro
 *   node scripts/seed-unimed-tuss.mjs                  # dry-run (default)
 *   node scripts/seed-unimed-tuss.mjs --apply          # aplica em produção
 *   node scripts/seed-unimed-tuss.mjs --verify         # só conta linhas
 *
 * Env (.env.local): SUPABASE_ACCESS_TOKEN (sbp_...), VITE_SUPABASE_PROJECT_REF
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const env = {};
const envPath = resolve(projectRoot, '.env.local');
if (existsSync(envPath)) {
  readFileSync(envPath, 'utf8').split('\n').forEach((line) => {
    const m = line.match(/^([^#=][^=]*)=(.*)$/);
    if (m) env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, '');
  });
}

const PAT = process.env.SUPABASE_ACCESS_TOKEN || env.SUPABASE_ACCESS_TOKEN;
const REF =
  process.env.VITE_SUPABASE_PROJECT_REF || env.VITE_SUPABASE_PROJECT_REF || 'vjzrahruvjffyyqyhjny';

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const VERIFY = argv.includes('--verify');
const DRY = !APPLY && !VERIFY;
// Derivado gerado por extract-tuss-from-xlsx.mjs. Local novo: Tabela Unimed/derivados/;
// mantém fallback para o local antigo (raiz) por compat com extrações anteriores.
const TUSS_DIR = resolve(projectRoot, 'Tabela Unimed');
const JSON_PATH =
  argv.find((a) => !a.startsWith('--')) ||
  [resolve(TUSS_DIR, 'derivados', 'unimed-tuss-extract.json'), resolve(TUSS_DIR, 'unimed-tuss-extract.json')].find(
    (p) => existsSync(p),
  ) ||
  resolve(TUSS_DIR, 'derivados', 'unimed-tuss-extract.json');

if ((APPLY || VERIFY) && !PAT) {
  console.error('❌ Missing SUPABASE_ACCESS_TOKEN em .env.local');
  process.exit(1);
}

async function mgmtPost(sql) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${PAT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { ok: r.ok, status: r.status, body };
}

if (VERIFY) {
  const r = await mgmtPost(
    `select lista, count(*)::int as n,
            count(indicador_anestesico)::int as com_indicador
       from public.unimed_tuss_codigos group by lista order by lista;`
  );
  if (!r.ok) {
    console.error(`❌ ${r.status}: ${JSON.stringify(r.body).slice(0, 400)}`);
    process.exit(1);
  }
  console.log('Contagem por lista:');
  (r.body || []).forEach((row) => console.log(`  ${row.lista.padEnd(6)} total ${String(row.n).padStart(5)} · com indicador ${row.com_indicador}`));
  process.exit(0);
}

if (!existsSync(JSON_PATH)) {
  console.error(`❌ JSON não encontrado: ${JSON_PATH}\n   Rode antes: node scripts/extract-tuss-from-xlsx.mjs`);
  process.exit(1);
}

const records = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
if (!Array.isArray(records) || records.length === 0) {
  console.error('❌ JSON vazio ou inválido');
  process.exit(1);
}

const sqlStr = (s) => (s == null ? 'NULL' : "'" + String(s).replace(/'/g, "''") + "'");
const sqlNum = (n) => (n == null || !Number.isFinite(Number(n)) ? 'NULL' : String(Number(n)));
const sqlInt = (n) => (n == null || !Number.isFinite(Number(n)) ? 'NULL' : String(Math.round(Number(n))));

const COLS =
  '(codigo, descricao, lista, cobertura, indicador_anestesico, valor_anestesista, valor_cirurgiao, porte_cirurgico, porte_anestesico, numero_auxiliares, classificacao, documentacao)';

function tuple(r) {
  return `(${sqlStr(r.codigo)}, ${sqlStr(r.descricao)}, ${sqlStr(r.lista)}, ${sqlStr(r.cobertura)}, ${sqlStr(r.indicadorAnestesico)}, ${sqlNum(r.valorAnestesista)}, ${sqlNum(r.valorCirurgiao)}, ${sqlStr(r.porteCirurgico)}, ${sqlInt(r.porteAnestesico)}, ${sqlInt(r.numeroAuxiliares)}, ${sqlStr(r.classificacao)}, ${sqlStr(r.documentacao)})`;
}

const ON_CONFLICT = `on conflict (codigo) do update set
  descricao = excluded.descricao, lista = excluded.lista, cobertura = excluded.cobertura,
  indicador_anestesico = excluded.indicador_anestesico, valor_anestesista = excluded.valor_anestesista,
  valor_cirurgiao = excluded.valor_cirurgiao, porte_cirurgico = excluded.porte_cirurgico,
  porte_anestesico = excluded.porte_anestesico, numero_auxiliares = excluded.numero_auxiliares,
  classificacao = excluded.classificacao, documentacao = excluded.documentacao, updated_at = now()`;

const ROWS_PER_STMT = 400;
const stmts = [];
for (let i = 0; i < records.length; i += ROWS_PER_STMT) {
  const batch = records.slice(i, i + ROWS_PER_STMT);
  stmts.push(`insert into public.unimed_tuss_codigos ${COLS} values\n${batch.map(tuple).join(',\n')}\n${ON_CONFLICT};`);
}

console.log(`📊 Seed plan: ${records.length} registros em ${stmts.length} statement(s).`);

if (DRY) {
  console.log('🔍 DRY-RUN (default) — nada aplicado.');
  console.log('Preview (primeiras 2 linhas do 1º statement):');
  console.log(stmts[0].slice(0, 600) + '...');
  console.log('\nRe-run com --apply; depois --verify.');
  process.exit(0);
}

console.log(`🚀 Aplicando em ${stmts.length} statement(s) ao projeto ${REF}...`);
let idx = 0;
for (const stmt of stmts) {
  idx++;
  process.stdout.write(`  Statement ${idx}/${stmts.length}...`);
  const r = await mgmtPost(stmt);
  if (!r.ok) {
    console.error(`\n❌ Statement ${idx} falhou: ${r.status}`);
    console.error((typeof r.body === 'string' ? r.body : JSON.stringify(r.body, null, 2)).slice(0, 800));
    process.exit(1);
  }
  process.stdout.write(' ok\n');
}

console.log(`\n✅ Seed aplicado: ${records.length} registros.`);
console.log('Valide com: node scripts/seed-unimed-tuss.mjs --verify');
