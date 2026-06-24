#!/usr/bin/env node
/**
 * Extrai os códigos TUSS da Unimed dos dois xlsx referenciais para um JSON único
 * consumido por scripts/seed-unimed-tuss.mjs.
 *
 * Fontes (em "Tabela Unimed/", pasta não versionada):
 *   - HM_Lista Referencial_versao 2025.05_01.12.2025.xlsx   (Honorários Médicos/cirúrgicos)
 *   - SADT_Lista Referencial_Versão 2026.02_01.03.2026.xlsx (SADT diagnóstico/terapia)
 *
 * Abas lidas em cada arquivo: "Cobertos" (cobertura=coberto) e "Sem Cobertura".
 * Dedup: se um código existe em HM e SADT, HM vence (só HM traz colunas de anestesia).
 * Para linhas SADT com indicador anestésico mas sem valor, o valor é calculado da letra.
 *
 * Uso:
 *   node scripts/extract-tuss-from-xlsx.mjs            # gera o JSON (default OUT)
 *   node scripts/extract-tuss-from-xlsx.mjs --stats    # só imprime estatísticas
 *   node scripts/extract-tuss-from-xlsx.mjs <src_dir> <out_json>
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import xlsx from 'xlsx';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const STATS = process.argv.includes('--stats');

const SRC_DIR = args[0] || resolve(projectRoot, 'Tabela Unimed');
const OUT = args[1] || resolve(SRC_DIR, 'unimed-tuss-extract.json');

const FILES = [
  { lista: 'HM', file: 'HM_Lista Referencial_versao 2025.05_01.12.2025.xlsx' },
  { lista: 'SADT', file: 'SADT_Lista Referencial_Versão 2026.02_01.03.2026.xlsx' },
];

// Indicador anestésico (letra) → R$ na tabela Intercâmbio Nacional (UTM × 1,17), tabela oficial 4.1
// das Instruções Gerais v2026.03. A=128 UTM → 149,76 (a planilha HM 2025.05 trazia 150 legado).
const INDICADOR_VALOR = {
  A: 149.76, B: 175.5, C: 210.6, D: 257.4, E: 292.5, F: 327.6, G: 374.4,
  H: 409.5, I: 468, J: 526.5, K: 585, L: 643.5, M: 702, N: 760.5,
  P: 819, Q: 877.5, R: 994.5, S: 1111.5, T: 1345.5, U: 1521, V: 1755,
  W: 1989, X: 2263.95, Y: 2784.6, Z: 3123.9,
};

const norm = (s) =>
  String(s ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

function findCol(header, predicate) {
  for (let j = 0; j < header.length; j++) {
    if (predicate(norm(header[j]), j)) return j;
  }
  return -1;
}

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function round2(n) {
  return n == null ? null : Math.round(n * 100) / 100;
}

function extractSheet(ws, lista, cobertura) {
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, raw: true, defval: null });
  // header = primeira linha com col[3] === "Descrição"
  let h = rows.findIndex((r) => r && norm(r[3]) === 'descricao');
  if (h < 0) h = 1;
  const header = rows[h];

  // codigo/descricao são estáveis nos índices 2/3 em todas as 4 abas
  const idx = {
    codigo: 2,
    descricao: 3,
    valorCirurgiao: findCol(header, (s) => s.includes('honorario medico') || s.includes('honorarios medicos')),
    indicador: findCol(header, (s) => s.startsWith('indicador anest')),
    valorAnestesista: findCol(header, (s) => s.includes('honorario do anestesista')),
    porteCirurgico: findCol(header, (s) => s === 'porte'),
    porteAnestesico: findCol(header, (s) => s.includes('porte anestesico')),
    numeroAuxiliares: findCol(header, (s) => s.includes('numero de auxiliares')),
    classificacao: findCol(header, (s) => s.includes('classificacao')),
    documentacao: findCol(header, (s) => s.includes('documentacao')),
  };

  const out = [];
  for (let i = h + 1; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const codigo = r[idx.codigo];
    if (codigo == null) continue;
    let cod = String(codigo).trim();
    // Hygiene: em ~30 linhas (sem cobertura) col2 traz o código prefixado pela tabela TISS
    // ("22"+código), enquanto col0 traz o código limpo. Prefere col0 nesse caso.
    if (/^\d{10}$/.test(cod) && cod.startsWith('22') && r[0] != null) {
      const col0 = String(r[0]).trim();
      if (/^\d{6,9}$/.test(col0) && cod === '22' + col0) cod = col0;
    }
    if (!/^\d{6,10}$/.test(cod)) continue; // só linhas de procedimento (TUSS numérico)

    const indicador =
      idx.indicador >= 0 && r[idx.indicador] != null
        ? String(r[idx.indicador]).trim().toUpperCase()
        : null;
    const indicadorOk = indicador && INDICADOR_VALOR[indicador] != null ? indicador : null;

    let valorAnest = idx.valorAnestesista >= 0 ? num(r[idx.valorAnestesista]) : null;
    if (valorAnest == null && indicadorOk) valorAnest = INDICADOR_VALOR[indicadorOk];
    // Normaliza o indicador A ao valor oficial v2026.03 (149,76); a planilha HM legada traz 150.
    if (indicadorOk === 'A') valorAnest = INDICADOR_VALOR.A;

    out.push({
      codigo: cod,
      descricao: r[idx.descricao] != null ? String(r[idx.descricao]).trim() : null,
      lista,
      cobertura,
      indicadorAnestesico: indicadorOk,
      valorAnestesista: round2(valorAnest),
      valorCirurgiao: idx.valorCirurgiao >= 0 ? round2(num(r[idx.valorCirurgiao])) : null,
      porteCirurgico:
        idx.porteCirurgico >= 0 && r[idx.porteCirurgico] != null
          ? String(r[idx.porteCirurgico]).trim()
          : null,
      porteAnestesico: idx.porteAnestesico >= 0 ? (num(r[idx.porteAnestesico]) ?? null) : null,
      numeroAuxiliares: idx.numeroAuxiliares >= 0 ? (num(r[idx.numeroAuxiliares]) ?? null) : null,
      classificacao:
        idx.classificacao >= 0 && r[idx.classificacao] != null
          ? String(r[idx.classificacao]).trim()
          : null,
      documentacao:
        idx.documentacao >= 0 && r[idx.documentacao] != null
          ? String(r[idx.documentacao]).trim()
          : null,
    });
  }
  return out;
}

const byCodigo = new Map(); // dedup HM > SADT
const counters = {};

for (const { lista, file } of FILES) {
  const path = resolve(SRC_DIR, file);
  if (!existsSync(path)) {
    console.error(`❌ Arquivo não encontrado: ${path}`);
    process.exit(1);
  }
  const wb = xlsx.read(readFileSync(path), { type: 'buffer' });
  for (const [sheet, cobertura] of [['Cobertos', 'coberto'], ['Sem Cobertura', 'sem_cobertura']]) {
    if (!wb.Sheets[sheet]) continue;
    const rows = extractSheet(wb.Sheets[sheet], lista, cobertura);
    let added = 0;
    for (const row of rows) {
      if (byCodigo.has(row.codigo)) continue; // HM já inseriu → mantém HM
      byCodigo.set(row.codigo, row);
      added++;
    }
    counters[`${lista}/${sheet}`] = { total: rows.length, added };
  }
}

const records = [...byCodigo.values()].sort((a, b) => a.codigo.localeCompare(b.codigo));

console.log('📊 Extração TUSS Unimed:');
for (const [k, v] of Object.entries(counters)) {
  console.log(`   ${k.padEnd(20)} lidos ${String(v.total).padStart(5)} · novos ${String(v.added).padStart(5)}`);
}
console.log(`   TOTAL único: ${records.length}`);
const comInd = records.filter((r) => r.indicadorAnestesico).length;
console.log(`   com indicador anestésico: ${comInd}`);

// sanity-check dos códigos da imagem
for (const c of ['40813185', '40813266', '40812049', '30101921', '31303293', '31602347', '31602355']) {
  const r = byCodigo.get(c);
  console.log(
    `   • ${c}: ${r ? `${r.lista}/${r.cobertura} ind=${r.indicadorAnestesico || '-'} R$${r.valorAnestesista ?? '-'} porteCir=${r.porteCirurgico || '-'} porteAnest=${r.porteAnestesico ?? '-'}` : 'NÃO ENCONTRADO'}`
  );
}

if (STATS) process.exit(0);

writeFileSync(OUT, JSON.stringify(records, null, 0));
console.log(`\n✅ ${records.length} registros → ${OUT}`);
