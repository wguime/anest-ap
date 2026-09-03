#!/usr/bin/env node
/**
 * Ordem de liberação esperada pela ESCALA NUMÉRICA — apoio à confecção/conferência.
 *
 * Uso: node scripts/ordem-liberacao-numerica.mjs <AAAA-MM-DD> [hro|unimed|materno|todos] [matutino|vespertino|ambos] [--ferias] [--ocupante 05=HUMBERTO]
 *   --ferias  consulta o Pega Plantão (scripts/ferias-pega-plantao.mjs) para a data e exclui quem está de férias.
 *   Sem --ferias a lista sai marcada como pendente de conferência de férias.
 */
import { readFileSync } from 'fs'
import { execFileSync } from 'child_process'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { montarOrdem, formatarOrdem, HOSPITAIS_NUMERICA } from '../src/lib/escalaNumerica.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dados = JSON.parse(readFileSync(resolve(root, 'src/data/escalaNumerica.json'), 'utf8'))
const args = process.argv.slice(2)
const pos = args.filter((a) => !a.startsWith('--'))
const data = pos[0]
if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '')) {
  console.error('Uso: node scripts/ordem-liberacao-numerica.mjs <AAAA-MM-DD> [hospital|todos] [turno|ambos] [--ferias]'); process.exit(2)
}
const hospitais = !pos[1] || pos[1] === 'todos' ? HOSPITAIS_NUMERICA : [pos[1]]
const turnos = !pos[2] || pos[2] === 'ambos' ? ['matutino', 'vespertino'] : [pos[2]]
const ocupantes = {}
args.forEach((a, i) => { if (a === '--ocupante' && args[i + 1]) { const [n, q] = args[i + 1].split('='); ocupantes[n] = q } })
let ferias = null
if (args.includes('--ferias')) {
  const raw = execFileSync('node', [resolve(root, 'scripts/ferias-pega-plantao.mjs'), data, data, '--json'], { encoding: 'utf8' })
  ferias = [...new Set(JSON.parse(raw).ferias.map((f) => f.nome))]
  console.log(`Férias em ${data} (Pega Plantão): ${ferias.length ? ferias.join(' · ') : 'ninguém'}\n`)
}
console.log(`Fonte: ${dados.fonte} · vigência ${dados.vigencia.inicio} → ${dados.vigencia.fim}\n`)
for (const hospital of hospitais) for (const turno of turnos) {
  console.log(formatarOrdem(montarOrdem(dados, { data, hospital, turno, ferias, ocupantes })))
  console.log()
}
