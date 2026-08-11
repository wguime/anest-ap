#!/usr/bin/env node
/**
 * Exige teste de regressão quando o código da escala cirúrgica muda.
 *
 * Por que só a escala: é o módulo onde a mesma classe de bug voltou várias
 * vezes. O tema "isolar por turno" foi corrigido três vezes em dois dias
 * (c5967f1 04/08, dd3e7cd 05/08, c2a11e2 05/08) e a única das três que foi sem
 * teste — c2a11e2 — é a que reapareceu em produção no dia seguinte. Correção
 * sem teste não fica corrigida: o próximo refactor a desfaz sem ninguém ver.
 *
 * Não é uma métrica de cobertura. A regra é grosseira de propósito — mexeu na
 * escala, encoste em algum teste da escala — porque o objetivo é criar o hábito
 * de escrever o caso que reproduz o bug, não perseguir percentual.
 *
 * Uso:  node scripts/check-regressao-escala.mjs <base_ref> <head_ref>
 * Saída: 0 quando passa ou quando há dispensa explícita; 1 quando falta teste.
 */
import { execFileSync } from 'child_process'

const [, , baseRef, headRef = 'HEAD'] = process.argv

/** Marcador de dispensa: precisa dizer o PORQUÊ, para ficar auditável no log. */
const DISPENSA = /\[sem-teste:[^\]]+\]/i

// Código que responde pela escala. Mudança aqui pede teste.
const FONTE = [
  /^src\/pages\/escala-cirurgica\//,
  /^src\/contexts\/EscalaCirurgicaContext\.jsx$/,
  /^src\/services\/supabaseEscalaCirurgicaService\.js$/,
  /^src\/services\/supabaseEscalaAnestesistaService\.js$/,
  /^src\/hooks\/useRosterAnestesistas\.js$/,
  /^src\/lib\/(colunaLiberacao|plantaoNoturno|excelEscala|escalaCirurgica[A-Za-z]*)\.js$/,
  /^src\/components\/escala-cirurgica\//,
]

// Teste que conta como cobertura da escala (unitário, de página ou e2e).
// A lista é por NOME de arquivo e tem ponto cego: em 11/08 o gate reprovou um
// commit que trazia `aplicarAtribuicoes.test.js` e
// `definirAnestesistaAssumirPosicao.test.jsx` — testes 100% da escala cujos
// nomes não continham nenhuma das palavras. Ao criar teste de escala com nome
// novo, ou use uma destas palavras, ou acrescente-a aqui.
const TESTE = [
  /^src\/__tests__\/.*(escala|liberac|troca|coluna|plantao|cirurg|roster|anestesista|atribuic|rodape)/i,
  /^e2e\/escala-/i,
]

const casa = (arquivo, padroes) => padroes.some((p) => p.test(arquivo))

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim()

if (!baseRef) {
  console.error('Uso: check-regressao-escala.mjs <base_ref> [head_ref]')
  process.exit(2)
}

// Push inicial / branch nova: o "antes" vem zerado e não há o que comparar.
if (/^0{40}$/.test(baseRef)) {
  console.log('Sem base de comparação (branch nova) — nada a verificar.')
  process.exit(0)
}

let arquivos = []
try {
  arquivos = git('diff', '--name-only', `${baseRef}...${headRef}`).split('\n').filter(Boolean)
} catch (err) {
  // Base inalcançável (fetch raso, rebase, force-push): avisa e libera. Barrar o
  // merge por causa da topologia do git puniria quem não fez nada errado.
  console.log(`Não foi possível comparar ${baseRef}...${headRef} — verificação pulada.`)
  console.log(String(err?.message || err).split('\n')[0])
  process.exit(0)
}

const tocouFonte = arquivos.filter((a) => casa(a, FONTE))
const tocouTeste = arquivos.filter((a) => casa(a, TESTE))

if (!tocouFonte.length) {
  console.log('Nenhum arquivo da escala cirúrgica mudou — nada a verificar.')
  process.exit(0)
}
if (tocouTeste.length) {
  console.log(`✓ ${tocouFonte.length} arquivo(s) da escala com ${tocouTeste.length} teste(s) junto:`)
  tocouTeste.forEach((t) => console.log(`    ${t}`))
  process.exit(0)
}

const mensagens = git('log', '--format=%B', `${baseRef}...${headRef}`)
const dispensa = mensagens.match(DISPENSA)
if (dispensa) {
  console.log(`✓ Dispensa explícita: ${dispensa[0]}`)
  process.exit(0)
}

console.error('')
console.error('✗ Mudança na escala cirúrgica sem teste de regressão.')
console.error('')
console.error('  Arquivos alterados:')
tocouFonte.forEach((f) => console.error(`    ${f}`))
console.error('')
console.error('  Acrescente um teste que REPRODUZA o bug (falha antes da correção,')
console.error('  passa depois). Sem ele, o próximo refactor desfaz a correção sem')
console.error('  ninguém perceber — foi assim que o isolamento de trocas por turno')
console.error('  voltou a quebrar em produção um dia depois de corrigido.')
console.error('')
console.error('  Se esta mudança genuinamente não pede teste (só comentário, texto')
console.error('  ou estilo), diga o motivo na mensagem do commit:')
console.error('')
console.error('      [sem-teste: só ajuste de texto do aviso]')
console.error('')
process.exit(1)
