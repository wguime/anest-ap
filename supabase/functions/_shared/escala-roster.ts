/**
 * O roster do grupo como VOCABULÁRIO da leitura (Onda 4, item 4.7).
 *
 * O modelo lia a coluna do anestesista com vocabulário aberto: qualquer
 * sequência de letras servia. Daí saem os dois erros mais teimosos:
 *   - "GUILHERME M ELO" — o kerning da letra pequena parte o sobrenome no meio;
 *   - nome inventado onde a célula traz uma marca de repetição ("//" → "Tiago").
 * A correção existia só no fim da linha, na conferência, pelo dicionário de
 * apelidos. Mandando a lista de nomes do grupo junto com a imagem, ela passa a
 * agir na leitura.
 *
 * ⚠️ VOCABULÁRIO FECHADO NÃO PODE FECHAR DEMAIS. Quem ajuda vindo de outro
 * hospital pode legitimamente não estar na lista, e forçar o nome dele para o
 * mais parecido do grupo trocaria a pessoa — erro pior que o original. Por isso
 * o nome que não casa é PRESERVADO como veio, e o casamento aqui só aceita
 * candidato ÚNICO: dois nomes do roster igualmente parecidos = não casa.
 *
 * `foraDoRoster` é RESULTADO, não pergunta: sai daqui, do casamento, e não do
 * modelo. Perguntar custaria mais uma propriedade opcional no schema, e esse
 * orçamento é o que decide se a saída volta a dobrar de tamanho.
 *
 * LGPD: são nomes de anestesistas do grupo, que já trafegam dentro da própria
 * imagem da escala. Nenhum dado de paciente entra nesta lista.
 */

const norm = (s: unknown) =>
  String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').trim().toUpperCase()

/** Sem acento, sem pontuação e SEM espaço: "GUILHERME M ELO" → "GUILHERMEMELO". */
const compacto = (s: unknown) => norm(s).replace(/[^A-Z0-9]/g, '')

/** Primeiro nome normalizado, sem o prefixo "Ped." de pedido. */
const primeiro = (s: unknown) => norm(s).replace(/^PED[.\s]+/, '').split(/\s+/)[0] || ''

/**
 * Nomes que vão no prompt: sem repetição, ordenados, no máximo 150.
 *
 * ⚠️ O TETO NÃO PODE CORTAR O GRUPO. O primeiro corte foi em 60 e o dicionário
 * de apelidos tem 102 entradas: metade do alfabeto ficaria de fora, e um apelido
 * ausente da lista é pior que lista nenhuma — o modelo passaria a tratar a
 * pessoa como "fora do roster". 150 dá folga sobre o grupo real e ainda protege
 * de uma lista absurda vinda de um cliente adulterado.
 */
export function prepararRoster(nomes: unknown): string[] {
  if (!Array.isArray(nomes)) return []
  const vistos = new Set<string>()
  const out: string[] = []
  for (const n of nomes) {
    const nome = String(n ?? '').trim().slice(0, 150)
    if (!nome || !/\p{L}/u.test(nome)) continue
    const chave = compacto(nome)
    if (!chave || vistos.has(chave)) continue
    vistos.add(chave)
    out.push(nome)
  }
  // ordem estável: o roster entra no bloco CACHEADO do system, e uma lista que
  // muda de ordem a cada chamada invalidaria o cache sem mudar nada de fato
  return out.sort((a, b) => a.localeCompare(b, 'pt-BR')).slice(0, 150)
}

/**
 * Nome canônico do roster para o que a leitura devolveu, ou '' quando não dá
 * para decidir. Três passadas, todas exigindo candidato único:
 *   1. igual desconsiderando acento, pontuação e ESPAÇO INTERNO
 *      ("GUILHERME M ELO" → "GUILHERME MELO");
 *   2. o lido é o começo do canônico, ou vice-versa ("JOAO H" → "JOAO HENRIQUE");
 *   3. mesmo primeiro nome, quando só uma pessoa do grupo tem esse primeiro nome
 *      (é a regra que a conferência já usa; com dois "JOÃO" no grupo, não casa —
 *      nome ambíguo é nulo).
 */
export function casarComRoster(nomeLido: unknown, roster: string[]): string {
  const alvo = compacto(nomeLido)
  if (!alvo || !Array.isArray(roster) || roster.length === 0) return ''

  const exatos = roster.filter((r) => compacto(r) === alvo)
  if (exatos.length === 1) return exatos[0]
  if (exatos.length > 1) return ''

  const prefixos = roster.filter((r) => {
    const c = compacto(r)
    return c.length >= 4 && alvo.length >= 4 && (c.startsWith(alvo) || alvo.startsWith(c))
  })
  if (prefixos.length === 1) return prefixos[0]
  if (prefixos.length > 1) return ''

  const p = primeiro(nomeLido)
  if (!p) return ''
  const porPrimeiro = roster.filter((r) => primeiro(r) === p)
  return porPrimeiro.length === 1 ? porPrimeiro[0] : ''
}

export interface CasoComNomeLido extends Record<string, unknown> {
  anestesista?: unknown
  foraDoRoster?: unknown
}

export interface ResultadoRoster<T> {
  casos: T[]
  contagem: Record<string, number>
}

/**
 * Casa o anestesista lido com o roster.
 *
 * Quem casou vira o nome canônico do grupo. Quem NÃO casou continua com o texto
 * que a imagem trazia e ganha `foraDoRoster: true` — é a ajuda de fora, e
 * apagá-la seria repetir o erro que o guardrail de cor acabou de consertar.
 */
export function resolverRoster<T extends CasoComNomeLido>(
  casos: T[], roster: string[],
): ResultadoRoster<T> {
  const contagem: Record<string, number> = {}
  const conta = (k: string) => { contagem[k] = (contagem[k] || 0) + 1 }
  if (!Array.isArray(roster) || roster.length === 0) return { casos: casos || [], contagem }

  const out = (casos || []).map((c) => {
    const atual = String(c.anestesista ?? '').trim()
    if (!atual || atual === '//' || atual === '?') return c
    const canonico = casarComRoster(atual, roster)
    if (!canonico) { conta('foraDoRoster'); return { ...c, foraDoRoster: true } }
    if (canonico !== atual) { conta('rosterCorrigido'); return { ...c, anestesista: canonico } }
    return c
  })
  return { casos: out, contagem }
}
