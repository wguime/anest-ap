#!/usr/bin/env node
/**
 * Seed ROPs from mock — Sprint 1 Wave 1.6 T1.6.2
 *
 * Lê src/data/rops-data.js (7295 LOC mock) e insere em rop_areas/_subdivisoes/_questions
 * via Supabase Management API. Idempotente via ON CONFLICT.
 *
 * Usage:
 *   node scripts/seed-rops-from-mock.mjs             # dry-run (default)
 *   node scripts/seed-rops-from-mock.mjs --apply     # aplica em produção
 *   node scripts/seed-rops-from-mock.mjs --verify    # só conta rows pós-seed
 *
 * Env (.env.local):
 *   SUPABASE_ACCESS_TOKEN     — PAT sbp_...
 *   VITE_SUPABASE_PROJECT_REF — default vjzrahruvjffyyqyhjny
 *
 * Mapping de cor mock (#hex) → category_token DS (alinhado a T1.6.8):
 *   cultura-seguranca    #9C27B0 → category-purple
 *   comunicacao          #10b981 → category-teal
 *   uso-medicamentos     #2196F3 → category-blue
 *   vida-profissional    #4CAF50 → category-green
 *   prevencao-infeccoes  #FF9800 → category-orange
 *   avaliacao-riscos     #00BCD4 → category-cyan
 */
import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

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
  process.env.VITE_SUPABASE_PROJECT_REF ||
  env.VITE_SUPABASE_PROJECT_REF ||
  'vjzrahruvjffyyqyhjny';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const VERIFY = args.includes('--verify');
const DRY = !APPLY && !VERIFY;

if ((APPLY || VERIFY) && !PAT) {
  console.error('❌ Missing SUPABASE_ACCESS_TOKEN em .env.local');
  process.exit(1);
}

const COLOR_TO_TOKEN = {
  'cultura-seguranca': 'category-purple',
  'comunicacao': 'category-teal',
  'uso-medicamentos': 'category-blue',
  'vida-profissional': 'category-green',
  'prevencao-infeccoes': 'category-orange',
  'avaliacao-riscos': 'category-cyan',
};

function sqlEscape(s) {
  if (s === null || s === undefined) return 'NULL';
  return "'" + String(s).replace(/'/g, "''") + "'";
}
function sqlJsonb(obj) {
  return "'" + JSON.stringify(obj).replace(/'/g, "''") + "'::jsonb";
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
  console.log(`🔍 Verificando contagens no projeto ${REF}...`);
  const r = await mgmtPost(
    `select 'areas' as kind, count(*)::int as n from public.rop_areas
     union all select 'subdivisoes', count(*)::int from public.rop_subdivisoes
     union all select 'questions', count(*)::int from public.rop_questions
     order by kind;`
  );
  if (!r.ok) {
    console.error(`❌ ${r.status}: ${JSON.stringify(r.body).slice(0, 400)}`);
    process.exit(1);
  }
  console.log('\nContagem atual:');
  (r.body || []).forEach((row) => console.log(`  ${row.kind.padEnd(14)} ${row.n}`));
  process.exit(0);
}

// Dynamic import do mock
const ropsDataPath = pathToFileURL(resolve(projectRoot, 'src/data/rops-data.js')).href;
const mod = await import(ropsDataPath);
const ropsData = mod.default || mod.ropsData;

if (!ropsData || typeof ropsData !== 'object') {
  console.error('❌ rops-data.js não exportou objeto esperado');
  process.exit(1);
}

const stmts = [];
const counters = { areas: 0, subdivisoes: 0, questions: 0 };
let areaOrder = 0;

for (const [areaSlug, areaObj] of Object.entries(ropsData)) {
  const token = COLOR_TO_TOKEN[areaSlug];
  if (!token) {
    console.error(`❌ Sem category_token mapeado para area "${areaSlug}". Atualize COLOR_TO_TOKEN.`);
    process.exit(1);
  }
  counters.areas++;
  areaOrder++;

  stmts.push(`-- AREA ${counters.areas}/${Object.keys(ropsData).length}: ${areaSlug}`);
  stmts.push(
    `insert into public.rop_areas (slug, title, category_token, icon, display_order, is_active) values
       (${sqlEscape(areaSlug)}, ${sqlEscape(areaObj.title)}, ${sqlEscape(token)}, ${sqlEscape(areaObj.icon || null)}, ${areaOrder}, true)
     on conflict (slug) do update set
       title = excluded.title,
       category_token = excluded.category_token,
       icon = excluded.icon,
       display_order = excluded.display_order,
       updated_at = now();`
  );

  let subOrder = 0;
  for (const [subSlug, subObj] of Object.entries(areaObj.subdivisoes || {})) {
    counters.subdivisoes++;
    subOrder++;

    stmts.push(
      `insert into public.rop_subdivisoes (area_id, slug, title, audio_url, display_order, is_active)
       select id, ${sqlEscape(subSlug)}, ${sqlEscape(subObj.title)}, ${sqlEscape(subObj.audioFile || null)}, ${subOrder}, true
         from public.rop_areas where slug = ${sqlEscape(areaSlug)}
       on conflict (area_id, slug) do update set
         title = excluded.title,
         audio_url = excluded.audio_url,
         display_order = excluded.display_order,
         updated_at = now();`
    );

    let qOrder = 0;
    for (const q of subObj.questions || []) {
      counters.questions++;
      qOrder++;
      const qKey = `${subSlug}-q${String(qOrder).padStart(2, '0')}`;

      stmts.push(
        `insert into public.rop_questions
           (subdivisao_id, question_key, version_num, is_current, question_text, options, correct_answer_index, explanation)
         select s.id, ${sqlEscape(qKey)}, 1, true,
                ${sqlEscape(q.question)},
                ${sqlJsonb(q.options)},
                ${q.correctAnswer},
                ${sqlEscape(q.explanation || null)}
           from public.rop_subdivisoes s
           join public.rop_areas a on a.id = s.area_id
          where a.slug = ${sqlEscape(areaSlug)}
            and s.slug = ${sqlEscape(subSlug)}
         on conflict (subdivisao_id, question_key, version_num) do nothing;`
      );
    }
  }
}

console.log('\n📊 Seed plan:');
console.log(`   ${counters.areas} áreas`);
console.log(`   ${counters.subdivisoes} subdivisões`);
console.log(`   ${counters.questions} questões`);
console.log(`   ${stmts.length} SQL statements\n`);

if (DRY) {
  console.log('🔍 DRY-RUN (default) — nenhum INSERT executado.\n');
  console.log('Preview do primeiro INSERT de questão:');
  const firstQuestionStmt = stmts.find((s) => s.startsWith('insert into public.rop_questions'));
  if (firstQuestionStmt) console.log(firstQuestionStmt.slice(0, 400) + '...\n');
  console.log('Re-run com --apply para executar.');
  console.log('Após --apply, use --verify para conferir contagens.');
  process.exit(0);
}

// APPLY: divide em chunks para evitar timeout / payload size
const CHUNK_LINES = 1500;
const chunks = [];
for (let i = 0; i < stmts.length; i += CHUNK_LINES) {
  chunks.push(stmts.slice(i, i + CHUNK_LINES).join('\n'));
}

console.log(`🚀 Aplicando em ${chunks.length} chunk(s) ao projeto ${REF}...`);

let chunkIdx = 0;
for (const chunk of chunks) {
  chunkIdx++;
  console.log(`  Chunk ${chunkIdx}/${chunks.length} (${chunk.length} chars)...`);
  const r = await mgmtPost(chunk);
  if (!r.ok) {
    console.error(`❌ Chunk ${chunkIdx} falhou: ${r.status}`);
    const preview =
      typeof r.body === 'string'
        ? r.body.slice(0, 800)
        : JSON.stringify(r.body, null, 2).slice(0, 800);
    console.error(preview);
    process.exit(1);
  }
}

console.log(`\n✅ Seed aplicado com sucesso.`);
console.log(`   ${counters.areas} áreas · ${counters.subdivisoes} subdivisões · ${counters.questions} questões`);
console.log(`\nValide com: node scripts/seed-rops-from-mock.mjs --verify`);
