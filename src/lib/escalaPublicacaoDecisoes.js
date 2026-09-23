/**
 * O que a conferência DECIDIU viaja DENTRO da publicação (Onda 3, item 3.1 da
 * auditoria de 02/09; achados A5, A6, A9).
 *
 * Até 05/09 só `casos`, `ordem_liberacao` e `ajuda_externa` chegavam à RPC. A
 * troca declarada era um patch DEPOIS da publicação, com `.catch(() => {})`;
 * "trabalha nos dois hoje (intencional)" não era gravado em lugar nenhum, e
 * republicar o turno fazia a mesma pergunta travar de novo; e republicar o
 * MESMO turno apagava todo `turno:*` de `linha_overrides` e `liberacoes` —
 * trocaCom, assumidaPor, origem, observação, local e término iam junto com a
 * liberação (foi o que obrigou a remarcar o Eduardo às 13:10 em 20/08).
 *
 * Aqui moram as contas PURAS que a página faz antes de `salvarEscalaTurno`:
 *   - `montarLinhaOverrides`  as decisões que valem NESTA escala, por chave da linha
 *                             (`p_linha_overrides` da RPC — o servidor prefixa o turno
 *                             e carimba por/em);
 *   - `montarPreservacao`     de quem segue na escala, o que a RPC copia do override
 *                             antigo (`p_preservar`). Decisão do dono (05/09): identidade
 *                             e rastro sobrevivem, a liberação zera (regra de 23/07);
 *   - `decisoesPublicadas`    a leitura de volta: o que a escala publicada já sabe, para
 *                             a pergunta não voltar na republicação.
 *
 * A CHAVE é a mesma da fila (`linha.chave` em `gerarColunaLiberacao`): uid do
 * vínculo, senão o nome normalizado — é por ela que `linha_overrides` é lido lá.
 * O dicionário é injetado (`resolver`/`normalizar`), como em
 * `escalaCirurgicaDuplicidades.js`: a lib não conhece o roster.
 */

import { stripNotaRodape } from '@/lib/colunaLiberacao'

/** Campos do override que são IDENTIDADE/RASTRO da linha e sobrevivem à republicação. */
export const CAMPOS_RASTRO = Object.freeze([
  'trocaCom', 'assumidaPor', 'origem', 'observacao', 'local', 'termino', 'duplicidade', 'conferido',
  // "não é ajuda" declarado à mão (14/09) — mesma classe de `origem`
  'semAjuda',
  // "na equipe da Unimed até as 19h" (21/09): veio do recado, não do documento — sobrevive
  // à republicação como `origem`; `turnoProprio` fica de fora porque é recarimbado do quadro
  'naEquipe',
])

/**
 * Fim de cada turno de dia útil — a hora que o selo "Equipe até 13h/19h" mostra.
 * "Até as 13h/19h" no recado é o FIM DO TURNO, nunca horário de saída (dono 17/09).
 */
export const FIM_TURNO = Object.freeze({ matutino: '13:00', vespertino: '19:00' })

const texto = (v) => String(v ?? '').trim()
const upperSimples = (s) => texto(s).toLocaleUpperCase('pt-BR')
/** "//", "?" e a dupla "A + B" não são uma pessoa com chave própria. */
const ehNomeDePessoa = (nome) => {
  const n = texto(nome)
  return !!n && n !== '//' && !/^\?+$/.test(n) && !n.includes('+')
}
const rodapeDoTurnoSeguro = (ordem, turno) => {
  if (Array.isArray(ordem)) return ordem
  return (ordem && ordem[turno]) || []
}

/**
 * Quem está nesta escala — ordem, ajuda e casos — com a chave da linha e as chaves
 * ALTERNATIVAS pelas quais a mesma pessoa pode ter sido gravada antes (o apelido
 * aprendido entre duas publicações troca a chave de nome para uid).
 * @returns Map<chave, { chave, candidatas: string[], posicao: number|null }>
 */
export function linhasPresentes({ ordem = [], ajuda = [], casos = [], resolver, normalizar = upperSimples } = {}) {
  const out = new Map()
  const entrar = (nome, uidCaso, posicao) => {
    if (!ehNomeDePessoa(nome)) return
    // A NOTA do rodapé ("CRISTINA (CONSULT)", "ADRIANO (REUNIAO 11H)") não é identidade: o
    // dicionário guarda apelidos limpos e `gerarColunaLiberacao` resolve o nome SEM ela. Resolver
    // com a nota devolvia null e a linha era chaveada pelo NOME — a fila, chaveada pelo uid, não
    // achava o override e o selo de Troca sumia justo de quem foi para o consultório (dono 22/09).
    const limpo = stripNotaRodape(nome)
    const norm = normalizar(limpo)
    const uid = uidCaso || resolver?.(limpo) || null
    const chave = uid || norm
    if (!chave) return
    const atual = out.get(chave) || { chave, candidatas: [], posicao: null }
    for (const c of [norm, uid]) {
      if (c && c !== chave && !atual.candidatas.includes(c)) atual.candidatas.push(c)
    }
    if (posicao != null && atual.posicao == null) atual.posicao = posicao
    out.set(chave, atual)
  }
  ;(ordem || []).forEach((n, i) => entrar(n, null, i))
  for (const n of ajuda || []) entrar(n, null, null)
  for (const c of casos || []) entrar(texto(c?.anestesista), c?.anestesistaUserId || null, null)
  return out
}

/**
 * `p_preservar` da RPC: de quem segue na escala, os `campos` do override antigo
 * voltam. `null` sem escala publicada ou sem ninguém na nova (nada a preservar —
 * a RPC zera o turno como sempre).
 *
 * `regraLiberacao` existe para o dia em que o dono mudar a regra de 23/07:
 * 'nunca' (padrão, decisão de 05/09) · 'mesma_posicao' (caso Eduardo) · 'na_ordem'.
 */
export function montarPreservacao({
  existente, turno, ordem = [], ajuda = [], casos = [],
  resolver, normalizar = upperSimples, regraLiberacao = 'nunca', campos = CAMPOS_RASTRO,
} = {}) {
  if (!existente) return null
  const presentes = linhasPresentes({ ordem, ajuda, casos, resolver, normalizar })
  if (!presentes.size) return null
  // posição de cada chave (e da grafia) no rodapé PUBLICADO deste turno
  const posAntiga = new Map()
  rodapeDoTurnoSeguro(existente.ordemLiberacao, turno).forEach((n, i) => {
    if (!ehNomeDePessoa(n)) return
    const limpo = stripNotaRodape(n)
    const uid = resolver?.(limpo) || null
    for (const k of [uid, normalizar(limpo)]) if (k && !posAntiga.has(k)) posAntiga.set(k, i)
  })
  const linhas = [...presentes.values()].map((l) => {
    const linha = { chave: l.chave, ...(l.candidatas.length ? { candidatas: l.candidatas } : {}) }
    if (regraLiberacao !== 'nunca') {
      const idx = [l.chave, ...l.candidatas].map((k) => posAntiga.get(k)).find((i) => i != null)
      const estava = idx != null
      const fica = regraLiberacao === 'na_ordem'
        ? estava
        : (estava && l.posicao != null && idx === l.posicao)
      if (fica) linha.liberacao = true
    }
    return linha
  })
  return { campos: [...campos], linhas }
}

/**
 * `p_linha_overrides` da RPC: as decisões da conferência que valem NESTA escala,
 * por chave da linha (sem prefixo de turno).
 *
 * `decisoes` é o mapa de duplicidade do lote (`{ [chave]: { tipo, parceiroUid,
 * parceiroNome, uid, nomeNorm, hospitalVaga? } }`, carimbado por `carimbarDecisao`).
 * A decisão é da PESSOA; o registro é de quem está aqui:
 *   - troca: só na escala onde a vaga obsoleta está (`hospitalVaga`); sem ela,
 *     onde a pessoa aparece (comportamento anterior à âncora explícita);
 *   - intencional: em toda escala onde a pessoa aparece — a pergunta não volta
 *     em nenhuma das duas.
 * `conferidos` é o "está certo, sem cirurgia hoje" ({ [chave]: true | { uid, nomeNorm } }).
 * `tipo: 'reaberta'` é o "Refazer" de uma decisão que veio da escala publicada: grava os
 * campos como `null`, porque só apagar do mapa local deixaria a preservação trazê-la de volta.
 * `carimbo` ({ por, em }) entra DENTRO do trocaCom, como o TrocaSheet grava; o
 * carimbo de fora é do servidor.
 * `tipo: 'equipe'` é o recado "X na equipe da Unimed até as 19h" (dono 21/09): X é membro
 * da equipe DESTE hospital neste turno (não é ajuda, não é troca, não é `turnoProprio`) e o
 * card ganha o selo "Equipe até 13h/19h" — a hora é o fim do `turno`, nunca chutada.
 */
export function montarLinhaOverrides({
  decisoes = {}, conferidos = {}, hospital, ordem = [], ajuda = [], casos = [],
  resolver, normalizar = upperSimples, carimbo = null, excecaoTurno = null, turno = null,
} = {}) {
  const presentes = linhasPresentes({ ordem, ajuda, casos, resolver, normalizar })
  const indice = new Map() // chave OU candidata → chave da linha
  for (const l of presentes.values()) {
    indice.set(l.chave, l.chave)
    for (const c of l.candidatas) if (!indice.has(c)) indice.set(c, l.chave)
  }
  const chaveDaPessoa = (chave, d) => {
    for (const k of [chave, d?.uid, d?.nomeNorm, d?.chave]) if (k && indice.has(k)) return indice.get(k)
    // decisão gravada por nome, dicionário aprendeu o login depois
    const uid = chave ? resolver?.(chave) : null
    return uid && indice.has(uid) ? indice.get(uid) : null
  }
  const out = {}
  const gravar = (chave, patch) => { out[chave] = { ...(out[chave] || {}), ...patch } }
  for (const [chave, d] of Object.entries(decisoes || {})) {
    if (!d || typeof d !== 'object') continue
    const alvo = chaveDaPessoa(chave, d)
    if (!alvo) continue
    if (d.tipo === 'troca' && (d.parceiroUid || d.parceiroNome)) {
      if (d.hospitalVaga && hospital && d.hospitalVaga !== hospital) continue
      gravar(alvo, {
        trocaCom: {
          uid: d.parceiroUid || null, nome: d.parceiroNome || '',
          // duplicidade entre hospitais É o tipo 'entre_hospitais' por definição
          tipo: 'entre_hospitais',
          // ninguém muda de lugar: a escala já saiu trocada e o que falta é o RASTRO.
          // `paresDeclarados` ignora registro de propósito — executá-lo DESFARIA a troca real.
          ...(d.apenasRegistro ? { apenasRegistro: true } : {}),
          // onde o colega está quando não tem posição em escala nenhuma (consultório,
          // sobreaviso…): o TrocaSheet grava o mesmo campo e a fila o exibe
          ...(d.local ? { local: d.local } : {}),
          ...(carimbo || {}),
        },
      })
    } else if (d.tipo === 'intencional') {
      gravar(alvo, { duplicidade: 'intencional' })
    } else if (d.tipo === 'equipe') {
      // só com o turno conhecido: sem ele não há hora, e hora inventada é pior que selo nenhum
      if (FIM_TURNO[turno]) gravar(alvo, { naEquipe: { ate: FIM_TURNO[turno] } })
    } else if (d.tipo === 'reaberta') {
      // "Refazer" numa decisão que veio da ESCALA PUBLICADA. Apagar do mapa local não basta:
      // a preservação copiaria o valor antigo de volta e a resposta antiga voltaria a valer.
      // `null` explícito vence a preservação no merge do servidor (os leitores comparam por
      // valor: `=== 'intencional'`, `=== true`).
      gravar(alvo, { duplicidade: null, conferido: null })
    }
  }
  for (const [chave, v] of Object.entries(conferidos || {})) {
    if (!v) continue
    const alvo = chaveDaPessoa(chave, typeof v === 'object' ? v : null)
    if (alvo) gravar(alvo, { conferido: true })
  }
  // ESCALA ESPECIAL DO DIA (dono 11/09): quem a escala NUMÉRICA traz com jornada
  // própria sai da fila no horário dela em vez de esperar a ordem — a marca que a
  // `LiberacoesView` lê (`turnoProprio`). Quem decide é o DOCUMENTO, e por isso ela
  // é recarimbada a cada publicação: no dia em que o quadro não trouxer mais a
  // pessoa (edição de 2026: depois de 20/11), `excecaoTurnoDoDia` devolve null, a
  // marca deixa de ser gravada e ela volta a seguir a ordem como todo mundo — sem
  // nada a desmarcar à mão. Vale para QUALQUER nome que o quadro traga, não só a
  // Louise: é o chamador que resolve a exceção do dia e passa `{ nome, ate }`.
  if (excecaoTurno?.ate && excecaoTurno?.nome) {
    const alvo = chaveDaPessoa(normalizar(excecaoTurno.nome), { nomeNorm: normalizar(excecaoTurno.nome) })
    if (alvo) gravar(alvo, { turnoProprio: { ate: excecaoTurno.ate } })
  }
  return out
}

/**
 * O que a escala PUBLICADA já sabe deste turno — duplicidade intencional e
 * "conferido", por chave (sem prefixo). É a leitura de volta: a conferência
 * semeia as decisões com isto para a pergunta não voltar na republicação (A6).
 * @returns [{ chave, duplicidade?: 'intencional', conferido?: true }]
 */
export function decisoesPublicadas(linhaOverrides, turno) {
  const out = []
  const prefixo = `${turno}:`
  for (const [raw, ov] of Object.entries(linhaOverrides || {})) {
    if (!String(raw).startsWith(prefixo) || !ov || typeof ov !== 'object') continue
    const chave = String(raw).slice(prefixo.length)
    if (!chave) continue
    const item = { chave }
    if (ov.duplicidade === 'intencional') item.duplicidade = 'intencional'
    if (ov.conferido === true) item.conferido = true
    if (item.duplicidade || item.conferido) out.push(item)
  }
  return out
}
