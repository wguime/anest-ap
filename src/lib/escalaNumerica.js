/**
 * Escala NUMÉRICA do grupo — referência para montar e CONFERIR a ordem de liberação.
 *
 * Fonte: PDF colorido publicado pelo grupo (uma edição por período; a vigente está em
 * `src/data/escalaNumerica.json`, extraída por `scripts/extrair-escala-numerica.py`).
 * A cor é dado: em cada dia, a letra do cabeçalho (R = Regional/HRO, U = Unimed) diz a
 * qual hospital pertencem os números daquela cor — vermelho e preto ALTERNAM entre HRO
 * e Unimed dia a dia; azul é sempre Materno e verde é consultório. Cinza = feriado, coluna
 * sem validade (há escala própria). O número identifica a PESSOA (legenda), nunca a
 * posição: a ordem é a POSIÇÃO FÍSICA na coluna — manhã de cima para baixo, tarde de
 * baixo para cima. "44 → 01" é uma sequência normal, não se ordena por valor.
 *
 * Entrada compartilhada ("05 HUMBERTO / ROBERTA", "07 ROSE / ALINE"): nos dias úteis o par é a
 * posição, como impresso; na escala de feriados cada um aparece por si; e quando a escala do
 * turno traz só um dos dois, vale o que saiu na escala — a dupla resolveu (dono 03/09).
 *
 * Louise (nº 43): durante a exceção (13h–19h) ela não está na grade; o quadro próprio diz
 * o hospital e a POSIÇÃO em que ela é INSERIDA na ordem da tarde (quem estava ali e os
 * seguintes descem uma casa). Fora da exceção o 43 volta à grade e o quadro cala.
 *
 * Férias (Pega Plantão) saem da lista preservando a ordem relativa dos demais — e a
 * inserção da Louise acontece ANTES da retirada (a posição dela referencia a escala
 * principal). Regras completas: `.claude/rules/escala-numerica.md`.
 *
 * Puro: o dataset entra por parâmetro. Nada aqui grava `ordem_liberacao` — é apoio à
 * confecção e à conferência, o rodapé publicado continua sendo a fonte da fila.
 */

export const HOSPITAIS_NUMERICA = ['hro', 'unimed', 'materno']
export const LABEL_HOSPITAL = { hro: 'HRO', unimed: 'Unimed', materno: 'Materno', consultorio: 'Consultório' }
export const LABEL_TURNO = { matutino: 'Manhã', vespertino: 'Tarde' }
const DIAS = { seg: 'segunda', ter: 'terça', qua: 'quarta', qui: 'quinta', sex: 'sexta' }

/**
 * Nome COMPLETO do cadastro (profiles.nome) de cada entrada da legenda, conferido contra o
 * dicionário de apelidos em 03/09/2026. É o que casa a legenda com o Pega Plantão (que
 * devolve nome completo) sem depender de banco. Entrada compartilhada ("HUMBERTO / ROBERTA")
 * lista os dois. Ao entrar uma escala nova, conferir com `escala_anestesista_alias`.
 */
export const CADASTRO_LEGENDA = {
  VICENTE: ['VICENTE ANTONIO ALVES PONS'], LEANDRO: ['LEANDRO BERNARDES'], RAUL: ['RAUL PERIZZOLO'],
  MELO: ['GUILHERME MELO', 'GUILHERME SOUZA MELO'], HUMBERTO: ['HUMBERTO HEPP'], ROBERTA: ['ROBERTA MARINA GRANDO'],
  'JOAO RICARDO': ['JOAO RICARDO MOREIRA'], ROSE: ['ROSEMARY CURY'], ALINE: ['ALINE BOFF BONFANTE'],
  GIOVANA: ['GIOVANA GOMES NOLL'], MAURICIO: ['MAURICIO MAHALEM BASTOS'], GABRIEL: ['GABRIEL JUAN KETTENHUBER COSTA'],
  COSTA: ['MARCOS CARDOSO COSTA'], 'JOAO HENRIQUE': ['JOAO HENRIQUE SALVAO VANNI'], STAUB: ['GUILHERME JONCK STAUB'],
  PAULO: ['PAULO TONINI'], GUSTAVO: ['GUSTAVO BIESDORF'], KLISMAN: ['KLISMAN DRESCHER HILLESHEIN'],
  JANAINA: ['JANAINA FAVORITO', 'JANAINA SANCHES FAVORITO MORAIS'], KARINE: ['KARINE BEDIN'], FERNANDO: ['FERNANDO HENRIQUE MACHADO'],
  ROMULO: ['ROMULO SANTOS ROXO'], TIAGO: ['TIAGO IOP VIANA'], ADRIANO: ['ADRIANO DALL MAGRO'], EDUARDO: ['EDUARDO SCHMIDT SAVOLDI'],
  CURY: ['MARCOS TADEU CURY'], ERLEI: ['ERLEI PERINI'], RAQUEL: ['RAQUEL SCHNEIDER FELICIANI'], NATHALIA: ['NATHALIA FORNARI FERNANDES'],
  RODNEI: ['RODNEI CABRAL LIMA'], 'ALEXANDRE S': ['ALEXANDRE SCHMIDT'], GARIM: ['GUSTAVO ALMANSA GARIM'], RAFAEL: ['RAFAEL PELISSARO'],
  DIEGO: ['DIEGO BONIATTI RIGOTTI'], DANIELA: ['DANIELA KLEIN REIS'], FERNANDA: ['FERNANDA GUOLLO'], 'ALEXANDRE D': ['ALEXANDRE SILVA DANIELI'],
  MARILIO: ['MARILIO JOSE FLACH'], MATHEUS: ['MATHEUS LEMOS VIEIRA DA CUNHA'], LEONARDO: ['LEONARDO FERRAZZO'], THAYNA: ['THAYNA REGINA SANTOS'],
  GABRIELA: ['GABRIELA CITRON VEDANA'], 'GUILHERME D': ['GUILHERME XAVIER', 'GUILHERME XAVIER DIDOMENICO', 'GUILHERME DIDOMENICO'],
  OSCAR: ['OSCAR MORAIS', 'OSCAR AUGUSTO DE OLIVEIRA MORAIS'], LOUISE: ['LOUISE MACAGNAN WARNAVA'], CRISTINA: ['CRISTINA BERTOL BARBOSA MARCON'],
}

/** Maiúsculas, sem acento, sem pontuação, espaços colapsados. */
export const normNomeNumerica = (s) => String(s || '')
  .normalize('NFD').replace(/\p{M}/gu, '')
  .toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim()

const tokens = (s) => normNomeNumerica(s).split(' ').filter(Boolean)

/** `curto` é subsequência ordenada de `longo` (ou vice-versa) com o MESMO primeiro nome. */
function subsequenciaComPrimeiroNome(a, b) {
  const [curto, longo] = a.length <= b.length ? [a, b] : [b, a]
  if (!curto.length || curto[0] !== longo[0]) return false
  let i = 0
  for (const t of longo) if (t === curto[i]) i += 1
  return i === curto.length
}

/**
 * Casa um nome completo (Pega Plantão / cadastro) com uma entrada da legenda.
 * Primeiro pelo cadastro conhecido (`CADASTRO_LEGENDA`); senão, heurística: mesmo primeiro
 * nome e o resto como subsequência (cobre "Matheus Vieira da Cunha" × "MATHEUS LEMOS VIEIRA
 * DA CUNHA"). Sobrenome sozinho na legenda ("MELO", "COSTA") só casa pelo cadastro.
 */
export function casarNomeComLegenda(nomeLegenda, nomeCompleto) {
  const L = normNomeNumerica(nomeLegenda)
  const C = tokens(nomeCompleto)
  if (!L || !C.length) return false
  for (const cad of CADASTRO_LEGENDA[L] || []) {
    const K = tokens(cad)
    if (K.join('') === C.join('') || subsequenciaComPrimeiroNome(K, C)) return true
  }
  const T = tokens(L)
  if (T.length >= 2 && subsequenciaComPrimeiroNome(T, C)) return true
  if (T.length === 2 && T[1].length === 1 && T[0] === C[0] && C.slice(1).some((t) => t.startsWith(T[1]))) return true
  return false
}

/** Entrada da legenda → lista de nomes (entrada compartilhada rende 2). */
export function nomesDaLegenda(dados, numero) {
  const e = dados?.legenda?.[numero]
  if (!e) return []
  return String(e.nome).split('/').map((s) => s.trim()).filter(Boolean)
}

export function diaNumerico(dados, data) {
  return dados?.dias?.[data] || null
}

function entradaPosicao(dados, e) {
  const nomes = nomesDaLegenda(dados, e.n)
  return { numero: e.n, nome: nomes.join(' / '), nomes, compartilhada: nomes.length > 1, grupo: dados.legenda?.[e.n]?.grupo ?? null }
}

/**
 * Nomes que a escala de FERIADOS imprime sem sobrenome e que casariam com mais de uma pessoa
 * da legenda — resolvidos pelo dono em 03/09/2026 (edição FERIADOS 2026). Edição nova: conferir.
 */
export const APELIDOS_FERIADO = { GUILHERME: 'MELO', JOAO: 'JOAO RICARDO' }

/** Nome impresso na escala de feriados → número da legenda (null quando o nome sozinho é ambíguo). */
export function numeroDaLegenda(dados, nome) {
  // a barra é separador de PESSOAS e precisa sobreviver à normalização (que apaga pontuação)
  const partes = (v) => String(v || '').split('/').map(normNomeNumerica).filter(Boolean)
  const alvo = APELIDOS_FERIADO[normNomeNumerica(nome)] || partes(nome).join(' / ')
  // entrada compartilhada ("HUMBERTO / ROBERTA") responde pelo par inteiro E por cada nome sozinho
  const hits = Object.entries(dados?.legenda || {}).filter(([, e]) => {
    const ps = partes(e.nome)
    return ps.join(' / ') === alvo || ps.includes(alvo)
  })
  return hits.length === 1 ? hits[0][0] : null
}

/**
 * Feriado: a escala própria é uma FILA ÚNICA (todos os hospitais), na ordem impressa —
 * manhã de cima para baixo, tarde invertida (dono 03/09). Louise já vem na lista quando
 * trabalha; ninguém é inserido. Nome sem sobrenome que casa com 2+ pessoas ("GUILHERME",
 * "JOAO") sai sem número e vira pendência de identidade.
 */
export function ordemFeriado(dados, { data, turno }) {
  const f = dados?.feriados?.dias?.[data]
  if (!f) return null
  const pendencias = []
  const base = f.lista.map((impresso) => {
    const numero = numeroDaLegenda(dados, impresso)
    if (!numero) pendencias.push(`Feriado ${data}: "${impresso}" não identifica uma pessoa só na legenda — confirmar quem é.`)
    // nome pelo apelido da legenda quando o impresso é só o primeiro nome ("GUILHERME" → MELO)
    const resolvido = APELIDOS_FERIADO[normNomeNumerica(impresso)]
    const nomes = String(resolvido || impresso).split('/').map((n) => normNomeNumerica(n)).filter(Boolean)
    return { numero, nome: nomes.join(' / '), nomes, compartilhada: nomes.length > 1, grupo: numero ? dados.legenda[numero]?.grupo ?? null : null, ...(resolvido && { impresso: normNomeNumerica(impresso) }) }
  })
  return {
    ok: true, data, hospital: 'todos', turno, filaUnica: true, feriado: f.nome, diaSemana: null, semana: null, corDoHospital: null,
    posicoes: turno === 'vespertino' ? [...base].reverse() : base, consultorio: [], pendencias,
  }
}

/**
 * Ordem-base de um hospital num dia/turno, sem Louise e sem férias.
 * Devolve `{ ok:false, motivo }` para fora da vigência e fim de semana; em feriado devolve a
 * fila única da escala de feriados (ou `motivo:'feriado'` quando ela não está no dataset).
 */
export function ordemBase(dados, { data, hospital, turno }) {
  const dia = diaNumerico(dados, data)
  if (!dia) {
    const fds = /^\d{4}-\d{2}-\d{2}$/.test(data) && [0, 6].includes(new Date(`${data}T12:00:00`).getDay())
    return { ok: false, motivo: fds ? 'fim_de_semana' : 'fora_da_vigencia', data, hospital, turno }
  }
  if (dia.feriado) {
    return ordemFeriado(dados, { data, turno })
      || { ok: false, motivo: 'feriado', data, hospital, turno, aviso: 'Coluna em cinza: feriado tem escala própria e ela não está no dataset — registrar a ausência.' }
  }
  if (!HOSPITAIS_NUMERICA.includes(hospital)) return { ok: false, motivo: 'hospital_invalido', data, hospital, turno }
  const doHospital = dia.coluna.filter((e) => e.hospital === hospital).map((e) => entradaPosicao(dados, e))
  const consultorio = dia.coluna.filter((e) => e.hospital === 'consultorio').map((e) => entradaPosicao(dados, e))
  const posicoes = turno === 'vespertino' ? [...doHospital].reverse() : doHospital
  return {
    ok: true, data, hospital, turno, diaSemana: DIAS[dia.diaSemana] || dia.diaSemana, semana: dia.semana,
    corDoHospital: dia.vermelho === hospital ? 'vermelho' : dia.preto === hospital ? 'preto' : 'azul',
    posicoes, consultorio,
  }
}

/**
 * Insere Louise na ordem da TARDE do hospital indicado pelo quadro dela. Só vespertino,
 * só dentro da vigência do quadro, nunca em coluna cinza. Se o 43 já estiver na grade do
 * dia (regime normal), não insere — inserir duplicaria.
 */
export function inserirLouise(dados, { data, hospital, turno }, posicoes) {
  const pend = []
  const q = dados?.louise?.dias?.[data]
  if (!q || turno !== 'vespertino' || q.hospital !== hospital) return { posicoes, louise: null, pendencias: pend }
  if (q.cinza) return { posicoes, louise: null, pendencias: pend }
  // Ordinal em cinza com a letra colorida (05/11 e 06/11 na edição de 2026): o dono confirmou
  // em 03/09 que o cinza saiu errado na formatação — o quadro vale e a Louise entra normalmente.
  if (posicoes.some((p) => p.numero === '43')) {
    pend.push(`Louise (43) já está na grade de ${data}; o quadro também a posiciona — não inserida para não duplicar.`)
    return { posicoes, louise: null, pendencias: pend }
  }
  const idx = Math.min(Math.max(q.posicao - 1, 0), posicoes.length)
  const louise = { numero: '43', nome: 'LOUISE', nomes: ['LOUISE'], compartilhada: false, grupo: 1, inserida: true }
  const nova = [...posicoes.slice(0, idx), louise, ...posicoes.slice(idx)]
  return { posicoes: nova, louise: { posicao: q.posicao, hospital }, pendencias: pend }
}

/**
 * Retira quem está de férias, preservando a ordem relativa. `ferias` = nomes completos
 * (Pega Plantão) de quem está de férias NO DIA. Entrada compartilhada com um dos dois de
 * férias fica com o outro; com os dois, sai.
 */
export function excluirFerias(posicoes, ferias, { casar = casarNomeComLegenda } = {}) {
  const excluidos = []
  const pendencias = []
  const restantes = []
  for (const p of posicoes) {
    const deFerias = p.nomes.filter((n) => ferias.some((f) => casar(n, f)))
    if (!deFerias.length) { restantes.push(p); continue }
    if (deFerias.length < p.nomes.length) {
      const fica = p.nomes.filter((n) => !deFerias.includes(n))
      restantes.push({ ...p, nome: fica.join(' / '), nomes: fica, compartilhada: fica.length > 1, observacao: `${deFerias.join(' e ')} de férias` })
      continue
    }
    excluidos.push({ numero: p.numero, nome: p.nome, motivo: 'ferias' })
  }
  return { posicoes: restantes, excluidos, pendencias }
}

/**
 * Monta a lista final: ordem-base → Louise → férias, com posição final numerada.
 * `ferias`: array de nomes completos de quem está de férias no dia, ou `null` quando o
 * Pega Plantão NÃO foi consultado (a lista sai marcada como pendente de conferência).
 * `ocupantes`: { '05': 'HUMBERTO' } resolve entradas compartilhadas quando há fonte.
 */
export function montarOrdem(dados, { data, hospital, turno, ferias = null, fonteFerias = 'Pega Plantão', ocupantes = {} }) {
  const base = ordemBase(dados, { data, hospital, turno })
  if (!base.ok) return { ...base, lista: [], consultorio: [], louise: null, excluidos: [], pendencias: [base.aviso].filter(Boolean), feriasConferidas: false }
  const pendencias = [...(base.pendencias || [])]
  // Entrada compartilhada ("05 HUMBERTO / ROBERTA", "07 ROSE / ALINE"): nos dias úteis o PAR é a
  // posição, exatamente como impresso (dono 03/09) — não se escolhe um dos dois. `ocupantes`
  // só existe para quando o dono informar quem está naquele dia.
  let posicoes = base.posicoes.map((p) => {
    if (!p.compartilhada) return p
    const quem = ocupantes[p.numero]
    if (quem && p.nomes.includes(normNomeNumerica(quem))) return { ...p, nome: normNomeNumerica(quem), nomes: [normNomeNumerica(quem)], compartilhada: false }
    return p
  })
  // na fila única do feriado a Louise já está impressa quando trabalha — nada a inserir
  const lou = base.filaUnica ? { posicoes, louise: null, pendencias: [] } : inserirLouise(dados, { data, hospital, turno }, posicoes)
  posicoes = lou.posicoes
  pendencias.push(...lou.pendencias)
  let excluidos = []
  let feriasConferidas = false
  if (Array.isArray(ferias)) {
    const ex = excluirFerias(posicoes, ferias)
    posicoes = ex.posicoes; excluidos = ex.excluidos.map((e) => ({ ...e, fonte: fonteFerias }))
    pendencias.push(...ex.pendencias)
    // quem está de férias e não existe na LEGENDA inteira é identidade por resolver — quem
    // só não está nesta lista está em outro hospital, e isso não é pendência
    const todosDaLegenda = Object.keys(dados.legenda || {}).flatMap((n) => nomesDaLegenda(dados, n))
    for (const f of ferias) {
      if (!todosDaLegenda.some((n) => casarNomeComLegenda(n, f))) pendencias.push(`Férias de "${f}" não casaram com ninguém da legenda — confirmar identidade.`)
    }
    feriasConferidas = true
  } else {
    pendencias.push('Férias NÃO conferidas: o Pega Plantão não foi consultado para este dia.')
  }
  return {
    ...base,
    lista: posicoes.map((p, i) => ({ posicao: i + 1, numero: p.numero, nome: p.nome, ...(p.inserida && { inserida: true }), ...(p.observacao && { observacao: p.observacao }), ...(p.impresso && { impresso: p.impresso }) })),
    louise: lou.louise, excluidos, pendencias, feriasConferidas,
  }
}

const mesmaPessoa = (nome, lido, casar) => normNomeNumerica(nome) === normNomeNumerica(lido) || casar(nome, lido) || casar(lido, nome)

/**
 * Entrada dupla × escala do turno (dono 03/09): quando a escala em anexo traz SÓ UM dos dois
 * nomes de "HUMBERTO / ROBERTA" ou "ROSE / ALINE", a dupla já resolveu quem trabalha — vale o
 * nome que saiu na escala, naquele turno. Com os dois na escala ou nenhum, o par fica como está.
 */
export function aplicarEscalaNasDuplas(lista, rodape, { casar = casarNomeComLegenda } = {}) {
  const resolvidos = []
  const nova = lista.map((p) => {
    const partes = String(p.nome).split(' / ').map((n) => normNomeNumerica(n)).filter(Boolean)
    if (partes.length < 2) return p
    const naEscala = partes.filter((n) => rodape.some((l) => mesmaPessoa(n, l, casar)))
    if (naEscala.length !== 1) return p
    resolvidos.push({ numero: p.numero, par: p.nome, nome: naEscala[0] })
    return { ...p, nome: naEscala[0], par: p.nome, resolvidoPor: 'escala' }
  })
  return { lista: nova, resolvidos }
}

/**
 * Compara a lista esperada com um rodapé lido (Vision/foto): mesma sequência?
 * Devolve o que falta, o que sobra e as trocas de posição — apoio à conferência. As entradas
 * duplas são resolvidas ANTES pelo próprio rodapé (`aplicarEscalaNasDuplas`).
 */
export function compararComRodape(listaEsperada, rodape, { casar = casarNomeComLegenda } = {}) {
  const { lista, resolvidos } = aplicarEscalaNasDuplas(listaEsperada, rodape, { casar })
  const lidos = rodape.map((r) => normNomeNumerica(r))
  const esperados = lista.map((p) => p.nome)
  const posDe = (nome) => lidos.findIndex((l) => mesmaPessoa(nome, l, casar))
  const faltamNoRodape = esperados.filter((n) => posDe(n) < 0)
  const sobramNoRodape = lidos.filter((l) => !esperados.some((n) => mesmaPessoa(n, l, casar)))
  const comuns = esperados.filter((n) => posDe(n) >= 0)
  const ordemLida = comuns.map((n) => posDe(n))
  const foraDeOrdem = comuns.filter((_, i) => i > 0 && ordemLida[i] < ordemLida[i - 1])
  return { iguais: !faltamNoRodape.length && !sobramNoRodape.length && !foraDeOrdem.length, faltamNoRodape, sobramNoRodape, foraDeOrdem, resolvidos, lista }
}

/** Texto do resultado no formato pedido pelo dono (data, turno, hospital, lista, consultório, Louise, exclusões, pendências). */
export function formatarOrdem(r) {
  const out = []
  const cab = `${r.data} · ${LABEL_TURNO[r.turno] || r.turno} · ${LABEL_HOSPITAL[r.hospital] || r.hospital}`
  if (!r.ok) return `${cab}\n  sem lista: ${r.motivo}${r.aviso ? ` — ${r.aviso}` : ''}`
  if (r.filaUnica) out.push(`${r.data} · ${LABEL_TURNO[r.turno] || r.turno} · FERIADO ${r.feriado} — fila única, todos os hospitais`)
  else out.push(`${cab} (${r.diaSemana}, semana ${r.semana}; números em ${r.corDoHospital})`)
  for (const p of r.lista) out.push(`  ${String(p.posicao).padStart(2)}. ${p.numero || '??'} ${p.nome}${p.inserida ? '  ← Louise inserida' : ''}${p.observacao ? `  (${p.observacao})` : ''}`)
  if (r.consultorio.length) out.push(`  consultório: ${r.consultorio.map((c) => `${c.numero} ${c.nome}`).join(' · ')}`)
  if (r.louise) out.push(`  Louise: ${r.louise.posicao}ª posição da tarde (${LABEL_HOSPITAL[r.louise.hospital]})`)
  if (r.excluidos.length) out.push(`  excluídos por férias (${r.excluidos[0].fonte}): ${r.excluidos.map((e) => `${e.numero} ${e.nome}`).join(' · ')}`)
  else if (r.feriasConferidas) out.push('  férias conferidas: ninguém desta lista de férias')
  for (const p of r.pendencias) out.push(`  ⚠ ${p}`)
  return out.join('\n')
}
