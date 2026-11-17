#!/usr/bin/env node
/**
 * Copia as libs PURAS da Escala Numérica / Feriados (src/lib + os helpers puros de
 * src/pages/escala-numerica) e o dataset `src/data/escalaNumerica.json` para a Edge
 * Function api-v1 (supabase/functions/api-v1/_lib-numerica/), para as rotas
 * GET /v1/escala-numerica e GET /v1/feriados calcularem com o MESMO código das telas —
 * nunca uma reimplementação que divirja com o tempo.
 *
 * Transformações, e só elas:
 *   - imports `./x`, `./x.js` e `@/lib/x` → `./x.js` (o Deno exige caminho com extensão);
 *   - o JSON vira `escalaNumericaDados.js` com `export default` (sem import de JSON no Deno).
 *
 * Uso:
 *   node scripts/gerar-libs-numerica-api-v1.mjs           # (re)gera os arquivos
 *   node scripts/gerar-libs-numerica-api-v1.mjs --check   # sai 1 se estiverem desatualizados
 *
 * Rodar (e redeployar a api-v1) sempre que mexer numa lib da lista ou quando entrar uma
 * edição NOVA da escala numérica / de feriados (escalaNumerica.json). O teste
 * src/__tests__/functions/apiV1EscalaNumerica.test.js quebra se esquecer.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const RAIZ = resolve(__dirname, '..')
export const DESTINO = resolve(RAIZ, 'supabase/functions/api-v1/_lib-numerica')

/** Fontes copiadas (caminho relativo à raiz). Todas puras: sem I/O, sem React, sem banco. */
export const FONTES_NUMERICA = [
  'src/lib/escalaNumerica.js',
  'src/lib/escalaNumericaVista.js',
  'src/lib/posPlantao.js',
  'src/lib/trocasFeriado.js',
  'src/lib/nomeAcentos.js',
  'src/lib/colunaLiberacao.js', // nomeCirurgiaoCurto/primeiroNome/titleCaseNome (nomeExibicao)
  'src/lib/escalaCirurgicaStatus.js', // dependência de colunaLiberacao
  'src/pages/escala-numerica/nomeExibicao.js',
  'src/pages/escala-numerica/situacao.js',
  'src/pages/escala-numerica/plantonistasFds.js',
  'src/pages/escala-numerica/calendario.js', // listarFeriados (FeriadosPage)
]
export const DATASET = 'src/data/escalaNumerica.json'
export const ARQUIVO_DATASET = 'escalaNumericaDados.js'

const NOMES = new Set(FONTES_NUMERICA.map((f) => basename(f).replace(/\.js$/, '')))

/** Conteúdo gerado para uma fonte. */
export function gerarConteudo(caminho, fonte) {
  const corpo = fonte.replace(/from\s+(['"])(?:\.\/|@\/lib\/)([\w-]+)(?:\.js)?\1/g, (m, q, nome) => {
    if (!NOMES.has(nome)) {
      throw new Error(`${caminho}: importa '${nome}', que não está em FONTES_NUMERICA — adicione-a à lista`)
    }
    return `from ${q}./${nome}.js${q}`
  })
  if (/from\s+['"](?!\.\/[\w-]+\.js['"])/.test(corpo)) {
    throw new Error(`${caminho}: import fora da lista — a lib deixou de ser pura e não roda no Deno`)
  }
  return (
    `// AUTO-GERADO por scripts/gerar-libs-numerica-api-v1.mjs a partir de ${caminho}\n` +
    `// NÃO EDITAR — edite ${caminho} e rode o script.\n` +
    `// deno-lint-ignore-file\n` +
    corpo
  )
}

export function gerarDataset(json) {
  return (
    `// AUTO-GERADO por scripts/gerar-libs-numerica-api-v1.mjs a partir de ${DATASET}\n` +
    `// NÃO EDITAR — edição nova da escala numérica: troque o JSON e rode o script.\n` +
    `// deno-lint-ignore-file\n` +
    `export default ${JSON.stringify(JSON.parse(json))}\n`
  )
}

export function gerarTodos() {
  return [
    ...FONTES_NUMERICA.map((caminho) => ({
      arquivo: basename(caminho),
      conteudo: gerarConteudo(caminho, readFileSync(resolve(RAIZ, caminho), 'utf8')),
    })),
    { arquivo: ARQUIVO_DATASET, conteudo: gerarDataset(readFileSync(resolve(RAIZ, DATASET), 'utf8')) },
  ]
}

const executadoDireto = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (executadoDireto) {
  const check = process.argv.includes('--check')
  const gerados = gerarTodos()
  if (check) {
    const desatualizados = gerados.filter(({ arquivo, conteudo }) => {
      const alvo = resolve(DESTINO, arquivo)
      return !existsSync(alvo) || readFileSync(alvo, 'utf8') !== conteudo
    })
    if (desatualizados.length) {
      console.error(`Desatualizados: ${desatualizados.map((d) => d.arquivo).join(', ')} — rode o script sem --check`)
      process.exit(1)
    }
    console.log(`OK: ${gerados.length} arquivos em dia`)
  } else {
    mkdirSync(DESTINO, { recursive: true })
    for (const { arquivo, conteudo } of gerados) writeFileSync(resolve(DESTINO, arquivo), conteudo)
    console.log(`Gerados ${gerados.length} arquivos em ${DESTINO}`)
  }
}
