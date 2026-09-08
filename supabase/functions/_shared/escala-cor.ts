/**
 * A cor do mapa vira DADO (Onda 4, item 4.3).
 *
 * No mapa da escala a cor não é enfeite, é a informação:
 *   vermelho = a ordem de liberação (sagrada, posição por posição)
 *   azul     = anestesista de OUTRO hospital ajudando neste dia
 *   amarelo  = a pessoa está escalada em dois locais DE PROPÓSITO (a marcação
 *              existe para avisá-la — não é erro nem ambiguidade)
 *   roxo     = cirurgião, no IOSC
 *
 * Até aqui a cor só existia como instrução de texto no prompt e nunca voltava no
 * JSON, com duas consequências medidas:
 *
 * 1. O azul só era pedido NO RODAPÉ. Quando ele aparecia no CORPO — o bloco
 *    Exames da Unimed traz anestesista azul —, o nome não estava em
 *    `ajudaExterna`, e aí o guardrail anti-alucinação APAGAVA a pessoa do caso,
 *    por "não estar no rodapé". O guardrail existe para matar nome inventado e
 *    estava matando dado bom (incidente 30/07: a Unimed publicou sem ajuda
 *    nenhuma).
 * 2. O amarelo virava suspeita de erro na conferência, quando é o contrário:
 *    é uma decisão deliberada de quem monta o mapa.
 *
 * Agora a cor volta por caso e por nome do rodapé, e a regra passa a ser uma só:
 * **azul em QUALQUER lugar é ajuda**. O guardrail deixa de apagar quem veio azul.
 */

/** Cores que o mapa usa. '' = preto/padrão. */
export type Cor = '' | 'preto' | 'vermelho' | 'azul' | 'amarelo' | 'roxo'

export const CORES: Cor[] = ['', 'preto', 'vermelho', 'azul', 'amarelo', 'roxo']

const norm = (s: unknown) =>
  String(s ?? '').normalize('NFD').replace(/\p{M}/gu, '').trim().toUpperCase()

export const corValida = (v: unknown): Cor =>
  (CORES as string[]).includes(norm(v).toLowerCase()) ? (norm(v).toLowerCase() as Cor) : ''

/**
 * Primeiro nome NORMALIZADO — a chave de comparação entre caso e rodapé.
 * "JOAO H." e "JOAO HENRIQUE" colapsam em "JOAO"; o prefixo "Ped." sai.
 */
export function primeiroNomeNorm(s: unknown): string {
  return norm(s).replace(/^PED[.\s]+/, '').split(/\s+/)[0] || ''
}

export interface EntradaRodape {
  nome: string
  cor: Cor
}

/**
 * Aceita o contrato NOVO (`rodape: [{nome, cor}]`) e o antigo
 * (`ordemLiberacao: string[]` + `ajudaExterna: string[]`). O antigo continua
 * atendido porque o modo FDS e qualquer resposta em cache anterior ao schema
 * novo ainda falam nele.
 */
export function lerRodape(parsed: Record<string, unknown>): EntradaRodape[] {
  if (Array.isArray(parsed?.rodape)) {
    return (parsed.rodape as Record<string, unknown>[])
      .map((r) => ({ nome: String(r?.nome ?? '').trim(), cor: corValida(r?.cor) }))
      .filter((r) => r.nome)
  }
  const ordem = Array.isArray(parsed?.ordemLiberacao) ? parsed.ordemLiberacao : []
  const ajuda = new Set(
    (Array.isArray(parsed?.ajudaExterna) ? parsed.ajudaExterna : [])
      .map((s: unknown) => primeiroNomeNorm(s)).filter(Boolean),
  )
  return (ordem as unknown[])
    .map((s) => String(s ?? '').trim())
    .filter(Boolean)
    .map((nome) => ({ nome, cor: (ajuda.has(primeiroNomeNorm(nome)) ? 'azul' : '') as Cor }))
}

export interface CasoComCor extends Record<string, unknown> {
  anestesista?: unknown
  cor?: unknown
  repeticao?: unknown
}

/**
 * Normaliza a cor e mantém o "//" que a conferência sabe herdar.
 *
 * ⚠️ O "//" VOLTOU A SER TEXTO NO PRÓPRIO CAMPO `anestesista` (08/09). O contrato
 * chegou a trocá-lo por um booleano `repeticao`, e o resultado medido foi que o
 * modelo simplesmente NÃO emitia o booleano (campo opcional é campo pulado): a
 * marca de repetição sumia e a linha ficava sem anestesista nenhum — 20 de 35
 * casos numa foto da Unimed, 180 de 348 no corpus inteiro. A justificativa
 * original ("pedir um nome onde há uma marca é como '//' virou Tiago") não se
 * sustenta: "//" é a marca copiada literalmente, não um nome inventado; quem
 * ataca invenção é o roster do item 4.7. O booleano continua ACEITO aqui, para
 * uma resposta guardada no cache antes desta correção.
 */
export function aplicarCorNosCasos<T extends CasoComCor>(casos: T[]): T[] {
  return (casos || []).map((c) => {
    const anestesista = c.repeticao === true && !String(c.anestesista ?? '').trim()
      ? '//'
      : String(c.anestesista ?? '').trim()
    return {
      ...c,
      anestesista,
      cor: corValida(c.cor),
    }
  })
}

export interface RodapeDerivado {
  ordemLiberacao: string[]
  ajudaExterna: string[]
}

/**
 * `ordemLiberacao` e `ajudaExterna` no formato que o cliente já consome,
 * DERIVADOS do rodapé colorido mais o azul que aparecer no corpo.
 *
 * A ordem é preservada literalmente, incluindo a anotação entre parênteses
 * ("ANEST B (CONSULTORIO)" é uma entrada só, entre os mesmos vizinhos): a ordem
 * de liberação é a ordem, e mexer nela é mexer em quem vai embora primeiro.
 */
export function derivarRodape(rodape: EntradaRodape[], casos: CasoComCor[]): RodapeDerivado {
  const ordemLiberacao = rodape.map((r) => r.nome)
  const ajuda: string[] = []
  const vistos = new Set<string>()
  const juntar = (nome: string) => {
    const chave = primeiroNomeNorm(nome)
    if (!chave || vistos.has(chave)) return
    vistos.add(chave)
    ajuda.push(nome)
  }
  for (const r of rodape) if (r.cor === 'azul') juntar(r.nome)
  // AZUL NO CORPO também é ajuda (incidente 30/07: o bloco Exames da Unimed
  // traz anestesista azul e ele não estava no rodapé, então virava "alucinação")
  for (const c of casos || []) {
    const nome = String(c.anestesista ?? '').trim()
    if (!nome || nome === '//') continue
    if (corValida(c.cor) === 'azul') juntar(nome)
  }
  return { ordemLiberacao, ajudaExterna: ajuda }
}

/**
 * GUARDRAIL anti-alucinação, agora ciente da cor.
 *
 * O rodapé lista todos os anestesistas do dia, então um caso com nome que não
 * está lá é quase sempre invenção da leitura ("//" lido como "Tiago", 07/2026).
 * Apagar é melhor que deixar um nome errado — mas NUNCA quando a célula veio
 * AZUL: azul é ajuda de outro hospital e a pessoa pode legitimamente não estar
 * no rodapé daqui. Era exatamente esse caso que o guardrail apagava.
 */
export function blanquearForaDoRodape<T extends CasoComCor>(
  casos: T[], ordem: string[], ajuda: string[],
): { casos: T[]; apagados: number } {
  const rodape = new Set([...ordem, ...ajuda].map(primeiroNomeNorm).filter(Boolean))
  if (rodape.size === 0) return { casos, apagados: 0 }
  let apagados = 0
  const out = casos.map((c) => {
    const a = String(c.anestesista ?? '').trim()
    if (!a || a === '//') return c
    if (rodape.has(primeiroNomeNorm(a))) return c
    if (corValida(c.cor) === 'azul') return c // ajuda: não é alucinação
    apagados++
    // a flag vai junto com o texto apagado: '' sem `semAnestesista` herdaria o
    // vizinho de sala na conferência e o caso seria absorvido em silêncio — o
    // oposto do que este guardrail promete ("visível p/ o plantonista cobrir")
    return { ...c, anestesista: '', semAnestesista: true }
  })
  return { casos: out, apagados }
}
