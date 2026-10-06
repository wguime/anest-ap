#!/usr/bin/env node
/**
 * Confere o docx da escala das funcionárias com o PRÓPRIO parser do app
 * (src/lib/escalaFuncionariasDocx.js) e grava, por mês, o que vai ser publicado:
 *   escala-YYYY-MM.json            {mes, sobreaviso, hospitais} → `pasta.py publicada`
 *   escala-YYYY-MM.firestore.json  campos prontos do doc escalasFuncionarias/{YYYY-MM}
 *
 * Uso (da raiz do repo):
 *   node .claude/skills/escala/scripts/conferir.mjs "<docx>" <pasta-saida> [--aplicar-sugestoes]
 *
 * O "—" do modelo antigo grudado no nome ("saionara —", "—luciana") é limpo sempre.
 * Nome parecido (Sayonara → Saionara) sai como sugestão e só entra com
 * --aplicar-sugestoes, depois de conferida a lista. Linhas de outro mês (o fim de
 * semana seguinte colado no fim do arquivo) viram um JSON próprio, marcado parcial.
 * Exit 1 = o mês principal tem pendência; não publique sem resolver.
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { createServer } from 'vite';

const UID_DONO = 'pPdKZ75E9zNdPnLz50qisPiHfJw1'; // wguime@yahoo.com.br — quem publica a escala
const [docxPath, outDir] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const aplicarSugestoes = process.argv.includes('--aplicar-sugestoes');
if (!docxPath || !outDir) {
  console.error('uso: conferir.mjs "<docx>" <pasta-saida> [--aplicar-sugestoes]');
  process.exit(2);
}

globalThis.DOMParser = new JSDOM('').window.DOMParser; // extrairLinhasDocx roda no browser
const server = await createServer({
  configFile: 'vite.config.js', logLevel: 'silent',
  server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true, include: [] },
});
const lib = await server.ssrLoadModule('/src/lib/escalaFuncionariasDocx.js');
const { FERIADO_LABELS } = await server.ssrLoadModule('/src/data/plantao2026.js');

const limpa = (c) => c.replace(/[—–]/g, ' ').replace(/\s+/g, ' ').trim() || c;
const linhas = await lib.extrairLinhasDocx(fs.readFileSync(docxPath));
const sugestoes = [];
const porMes = {};
for (const cells of linhas) {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(cells[0] || '');
  if (cells.length < 7 || !m) continue;
  const row = cells.map((c, i) => {
    if (i < 2 || i > 5) return c;
    const t = limpa(c);
    const r = lib.resolverFuncionaria(t);
    if (r?.desconhecido && r.sugestao) {
      sugestoes.push(`${cells[0]} col ${i}: "${r.desconhecido}" → ${r.sugestao.nome}`);
      return aplicarSugestoes ? r.sugestao.nome : t;
    }
    return t;
  });
  (porMes[`${m[3]}-${m[2]}`] ||= []).push(row);
}

const meses = Object.keys(porMes).sort();
const principal = meses.reduce((a, b) => (porMes[b].length > porMes[a].length ? b : a), meses[0]);
console.log(`arquivo: ${path.basename(docxPath)} | meses: ${meses.join(', ')} | principal: ${principal}`);
if (sugestoes.length) {
  console.log(`\nSUGESTÕES de nome (${aplicarSugestoes ? 'APLICADAS' : 'NÃO aplicadas — use --aplicar-sugestoes'}):`);
  for (const s of sugestoes) console.log('  ' + s);
}

fs.mkdirSync(outDir, { recursive: true });
let pendenciaPrincipal = false;
const sv = (v) => (v == null ? { nullValue: null } : { stringValue: v });
for (const mes of meses) {
  const r = lib.parseEscalaFuncionarias(porMes[mes]);
  for (const [k, h] of Object.entries(r.hospitais)) if (FERIADO_LABELS[k]) h.label = FERIADO_LABELS[k];
  const v = lib.validarEscalaFuncionarias(r.sobreaviso, r.hospitais, mes);
  const pend = [...new Map([...r.issues, ...v.issues].map((i) => [`${i.dateKey}|${i.tipo}`, i])).values()];
  const parcial = mes !== principal;
  if (!parcial && pend.length) pendenciaPrincipal = true;

  const nS = Object.keys(r.sobreaviso).length;
  const nH = Object.keys(r.hospitais).length;
  console.log(`\n=== ${mes}${parcial ? ' (PARCIAL — só as linhas que vieram)' : ''} ===`);
  console.log(`  sobreaviso ${nS} dias | hospitais ${nH} dias | pendências ${pend.length}`);
  const tipos = {};
  for (const i of pend) (tipos[i.tipo] ||= []).push(i.dateKey?.slice(8) ?? '-');
  for (const [t, dias] of Object.entries(tipos)) console.log(`  ${t}: ${dias.length > 8 ? `${dias.length} dias` : `dias ${dias.join(', ')}`}`);
  for (const a of [...r.avisos, ...v.avisos].filter((a) => a.tipo !== 'nome-fuzzy')) console.log(`  aviso ${a.dateKey}: ${a.msg}`);
  for (const k of Object.keys(r.sobreaviso).sort()) {
    const h = r.hospitais[k];
    console.log(`  ${k.slice(8)}  ${r.sobreaviso[k].padEnd(9)}${h ? `U=${h.unimed ?? '-'} H=${h.hro ?? '-'} P=${h.plantaoPago ?? '-'}${h.label ? ` [${h.label}]` : ''}` : ''}`);
  }
  for (const k of Object.keys(r.hospitais).filter((k) => !r.sobreaviso[k]).sort()) {
    const h = r.hospitais[k];
    console.log(`  ${k.slice(8)}  (sem sobreaviso) U=${h.unimed ?? '-'} H=${h.hro ?? '-'} P=${h.plantaoPago ?? '-'}${h.label ? ` [${h.label}]` : ''}`);
  }

  const dados = { mes, sobreaviso: r.sobreaviso, hospitais: r.hospitais };
  fs.writeFileSync(path.join(outDir, `escala-${mes}.json`), JSON.stringify(dados, null, 1));
  const fields = {
    mes: sv(mes),
    sobreaviso: { mapValue: { fields: Object.fromEntries(Object.entries(r.sobreaviso).sort().map(([k, id]) => [k, sv(id)])) } },
    hospitais: { mapValue: { fields: Object.fromEntries(Object.entries(r.hospitais).sort().map(([k, h]) => [k, { mapValue: { fields: {
      unimed: sv(h.unimed), hro: sv(h.hro), plantaoPago: sv(h.plantaoPago), label: sv(h.label),
    } } }])) } },
    fonte: sv('import-docx'),
    arquivoNome: sv(path.basename(docxPath)),
    totais: { mapValue: { fields: { sobreaviso: { integerValue: String(nS) }, hospitais: { integerValue: String(nH) } } } },
    updatedBy: sv(UID_DONO),
  };
  fs.writeFileSync(path.join(outDir, `escala-${mes}.firestore.json`), JSON.stringify(fields));
}
console.log(`\nJSONs em ${outDir} (updatedAt fica de fora: use a hora real da publicação)`);
await server.close(); // só no fim: o import('jszip') do extrairLinhasDocx passa pelo server
process.exit(pendenciaPrincipal ? 1 : 0);
