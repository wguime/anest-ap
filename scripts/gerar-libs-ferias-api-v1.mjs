#!/usr/bin/env node
/**
 * Copia as libs PURAS do Extrato de Férias (src/lib) para a Edge Function
 * api-v1 (supabase/functions/api-v1/_lib-ferias/), para a rota
 * GET /v1/ferias/extrato calcular com o MESMO código da tela — nunca uma
 * reimplementação que divirja com o tempo.
 *
 * A única transformação é nos imports relativos: o Vite resolve
 * `from './extratoFerias'`, o Deno exige a extensão (`'./extratoFerias.js'`).
 *
 * Uso:
 *   node scripts/gerar-libs-ferias-api-v1.mjs           # (re)gera os arquivos
 *   node scripts/gerar-libs-ferias-api-v1.mjs --check   # sai 1 se estiverem desatualizados
 *
 * Rodar sempre que mexer em qualquer lib da lista (inclusive a manutenção
 * ANUAL de feriasSocios.js / feriasFeriados.js). O teste
 * src/__tests__/functions/apiV1FeriasExtrato.test.js quebra se esquecer.
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
export const RAIZ = resolve(__dirname, '..')
export const ORIGEM = resolve(RAIZ, 'src/lib')
export const DESTINO = resolve(RAIZ, 'supabase/functions/api-v1/_lib-ferias')

/** Libs copiadas. Todas puras (sem I/O, sem import de fora de src/lib). */
export const LIBS_FERIAS = [
  'extratoFerias.js',
  'extratoFeriasRegras.js',
  'feriasMovimentacoes.js',
  'feriasSocios.js',
  'feriasFeriados.js',
  'feriasAnalise.js', // penalidade da 7ª vaga — entra no saldo da tela
]

const NOMES = new Set(LIBS_FERIAS.map((f) => f.replace(/\.js$/, '')))

/** Conteúdo gerado para uma lib, a partir do fonte de src/lib. */
export function gerarConteudo(arquivo, fonte) {
  const corpo = fonte.replace(/from\s+(['"])\.\/([\w-]+)\1/g, (m, q, nome) => {
    if (!NOMES.has(nome)) {
      throw new Error(`${arquivo}: importa './${nome}', que não está em LIBS_FERIAS — adicione-a à lista`)
    }
    return `from ${q}./${nome}.js${q}`
  })
  if (/from\s+['"](?!\.\/)/.test(corpo)) {
    throw new Error(`${arquivo}: import não-relativo — a lib deixou de ser pura e não roda no Deno`)
  }
  return (
    `// AUTO-GERADO por scripts/gerar-libs-ferias-api-v1.mjs a partir de src/lib/${arquivo}\n` +
    `// NÃO EDITAR — edite src/lib/${arquivo} e rode o script.\n` +
    `// deno-lint-ignore-file\n` +
    corpo
  )
}

export function gerarTodos() {
  return LIBS_FERIAS.map((arquivo) => ({
    arquivo,
    conteudo: gerarConteudo(arquivo, readFileSync(resolve(ORIGEM, arquivo), 'utf8')),
  }))
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
    console.log(`OK: ${gerados.length} libs em dia`)
  } else {
    mkdirSync(DESTINO, { recursive: true })
    for (const { arquivo, conteudo } of gerados) writeFileSync(resolve(DESTINO, arquivo), conteudo)
    console.log(`Gerados ${gerados.length} arquivos em ${DESTINO}`)
  }
}
