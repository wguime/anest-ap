#!/usr/bin/env node
// codigos.mjs — pseudônimos estáveis para o que vai ao repositório (decisão do dono, revisão LGPD de 10/11/2026).
// Anestesista → A01…, residente → R01…, cirurgião → C001… A tabela código → nome mora SÓ em
// .local/escala-aprendizado/codigos.json (fora do git). Pessoa nova ganha o próximo código livre; código nunca muda.
//   node codigos.mjs atualizar            (precisa de DADOS; acrescenta quem ainda não tem código)
//   node codigos.mjs codificar <arquivo…> (troca nomes por códigos, no lugar)
//   node codigos.mjs nomes                (gera em .local/escala-aprendizado/com-nomes/ a versão COM NOMES dos relatórios)
//   node codigos.mjs varrer               (procura nome de profissional nos arquivos versionados da série)
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
const AQUI = path.dirname(fileURLToPath(import.meta.url)); const RAIZ = path.resolve(AQUI, '..', '..', '..')
const DOCS = path.join(RAIZ, 'docs', 'escala-cirurgica-metricas'); const BASE = path.join(RAIZ, '.local', 'escala-aprendizado'); const ARQ = path.join(BASE, 'codigos.json')
const sa = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
export const lerTabela = () => fs.existsSync(ARQ) ? JSON.parse(fs.readFileSync(ARQ, 'utf8')) : { geradoEm: null, anestesistas: {}, residentes: {}, cirurgioes: {} }
const prox = (obj, pref, larg) => { const n = Math.max(0, ...Object.values(obj).map((x) => +x.codigo.slice(pref.length))) + 1; return pref + String(n).padStart(larg, '0') }
export async function atualizar() { const T = lerTabela(); const { casos, cirK, nomeP } = await import('./blocos.mjs'); const { ler } = await import('./comum.mjs'); let novos = 0
  const perfis = ler('perfis').sort((a, b) => sa(a.nome) < sa(b.nome) ? -1 : 1)
  for (const p of perfis) { const alvo = p.role === 'medico-residente' ? T.residentes : T.anestesistas; if (alvo[p.id]) continue; alvo[p.id] = { codigo: p.role === 'medico-residente' ? prox(T.residentes, 'R', 2) : prox(T.anestesistas, 'A', 2), nome: p.nome, curto: nomeP(p.id) }; novos++ }
  const cs = new Set(); for (const c of casos) { const k = cirK(c.hospital, c.cirurgiao); if (k) cs.add(c.hospital + '|' + k) }
  for (const k of [...cs].sort()) { if (T.cirurgioes[k]) continue; T.cirurgioes[k] = { codigo: prox(T.cirurgioes, 'C', 3) }; novos++ }
  T.geradoEm = new Date().toISOString(); fs.mkdirSync(BASE, { recursive: true }); fs.writeFileSync(ARQ, JSON.stringify(T, null, 1)); return { T, novos } }
// ---- nomes → códigos (do mais longo para o mais curto; cirurgião antes de anestesista; primeiro nome só se for de uma pessoa só)
let _regras = null
function regras() { if (_regras) return _regras; const T = lerTabela(); const r = []
  const pess = [...Object.values(T.anestesistas), ...Object.values(T.residentes)]; const prim = {}
  // anestesista do grupo que aparece como "cirurgião" num caso (consultório, dor): vale o código de anestesista
  const doGrupo = new Set(pess.flatMap((p) => [sa(p.nome), sa(p.curto)]))
  for (const [k, v] of Object.entries(T.cirurgioes)) { const nome = k.split('|')[1]; if (doGrupo.has(sa(nome))) continue; if (nome.includes(' ') || nome.endsWith('?')) r.push([nome, v.codigo]) }
  for (const p of pess) { r.push([p.nome, p.codigo]); r.push([p.curto, p.codigo]); const f = p.curto.split(' ')[0]; (prim[f] ||= []).push(p.codigo) }
  for (const [f, cods] of Object.entries(prim)) if (cods.length === 1 && f.length >= 4) r.push([f, cods[0], true])
  // um mesmo nome de cirurgião em dois hospitais: vale o código do primeiro (a tabela guarda os dois)
  const visto = new Map(); for (const [n, c, so1] of r) if (!visto.has(sa(n))) visto.set(sa(n), [n, c, so1])
  // primeiro nome sozinho: nunca dentro de identificador nem depois de "São" (America/Sao_Paulo, São Paulo)
  _regras = [...visto.values()].sort((a, b) => b[0].length - a[0].length).map(([n, c, so1]) => [new RegExp((so1 ? '(?<!S[ãa]o[ _])' : '') + '(?<![\\p{L}\\d_/.])' + esc(n).replace(/ /g, '\\s+') + (n.endsWith('?') ? '' : '(?![\\p{L}\\d_])'), so1 ? 'gu' : 'giu'), c]); return _regras }
export function codificarTexto(s) { let t = String(s); const semAc = (x) => x.normalize('NFD').replace(/[̀-ͯ]/g, '')
  for (const [re, c] of regras()) { t = t.replace(re, c); const re2 = new RegExp(semAc(re.source), re.flags); t = t.replace(re2, c) } return t }
export function decodificarTexto(s) { const T = lerTabela(); const m = new Map(); for (const v of [...Object.values(T.anestesistas), ...Object.values(T.residentes)]) m.set(v.codigo, v.curto); for (const [k, v] of Object.entries(T.cirurgioes)) m.set(v.codigo, k.split('|')[1] + ' (' + k.split('|')[0] + ')')
  return String(s).replace(/(?<![\p{L}\d])(A\d{2}|R\d{2}|C\d{3})(?![\p{L}\d])/gu, (x) => m.get(x) ?? x) }
export const codigoDe = (uid) => { const T = lerTabela(); return T.anestesistas[uid]?.codigo ?? T.residentes[uid]?.codigo ?? null }
const versionados = () => { const l = fs.readdirSync(DOCS).filter((f) => /^2026-W\d\d-aprendizado.*\.(md|sql)$/.test(f) || f === 'regras-escalacao.json').map((f) => path.join(DOCS, f)); const ps = path.join(DOCS, 'placar-semanal'); if (fs.existsSync(ps)) l.push(...fs.readdirSync(ps).map((f) => path.join(ps, f))); l.push(...fs.readdirSync(AQUI).map((f) => path.join(AQUI, f))); return l }
if (process.argv[1] && process.argv[1].endsWith('codigos.mjs')) { const cmd = process.argv[2]
  if (cmd === 'atualizar') { const { T, novos } = await atualizar(); console.log(`códigos: ${Object.keys(T.anestesistas).length} anestesistas, ${Object.keys(T.residentes).length} residentes, ${Object.keys(T.cirurgioes).length} cirurgiões (${novos} novos) → ${ARQ}`) }
  else if (cmd === 'codificar') { for (const f of process.argv.slice(3)) { const a = fs.readFileSync(f, 'utf8'); const b = codificarTexto(a); if (a !== b) { fs.writeFileSync(f, b); console.log('codificado:', path.relative(RAIZ, f)) } } }
  else if (cmd === 'nomes') { const dest = path.join(BASE, 'com-nomes'); for (const f of versionados().filter((x) => /\.(md|json|sql)$/.test(x))) { const rel = path.relative(DOCS, f); const out = path.join(dest, rel); fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, decodificarTexto(fs.readFileSync(f, 'utf8'))); console.log('com nomes:', path.relative(RAIZ, out)) } }
  else if (cmd === 'varrer') { // (a) nome completo ou curto de anestesista/residente; (b) cada palavra do nome deles (4+ letras), menos as que
    // também são palavra comum do texto (IGNORAR); (c) nome de cirurgião com 2+ palavras. Não imprime o nome achado, só onde.
    const T = lerTabela(); const ign = new Set((process.env.IGNORAR || '').split(',').map(sa).filter(Boolean)); const pess = [...Object.values(T.anestesistas), ...Object.values(T.residentes)]
    const frases = new Set(), toks = new Set(); for (const p of pess) { frases.add(sa(p.nome)); frases.add(sa(p.curto)); for (const t of sa(p.nome).replace(/[^A-Z ]/g, ' ').split(' ')) if (t.length >= 4 && !ign.has(t) && !['DOS', 'DAS'].includes(t)) toks.add(t) }
    for (const k of Object.keys(T.cirurgioes)) { const n = sa(k.split('|')[1]).replace(/\?$/, ''); if (n.includes(' ')) frases.add(n) }
    let total = 0; const porArq = {}; for (const f of versionados()) { fs.readFileSync(f, 'utf8').split('\n').forEach((ln, i) => { const L = ' ' + sa(ln).replace(/[^A-Z ]/g, ' ').replace(/\s+/g, ' ') + ' '; const fr = [...frases].some((x) => L.includes(' ' + x + ' ')); const tk = L.trim().split(' ').some((x) => toks.has(x)); if (fr || tk) { total++; const r = path.relative(RAIZ, f); (porArq[r] ||= []).push(i + 1) } }) }
    for (const [f, ls] of Object.entries(porArq)) console.log(`${f}: linhas ${ls.join(', ')}`)
    console.log(`\nvarredura: ${versionados().length} arquivos | ${frases.size} nomes completos e ${toks.size} palavras de nome testados | linhas com ocorrência: ${total}`) }
  else console.log('uso: codigos.mjs atualizar | codificar <arquivos> | nomes | varrer') }
