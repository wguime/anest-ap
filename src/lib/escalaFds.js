/**
 * Escala Cirúrgica — modo FIM DE SEMANA (fila de liberação ÚNICA).
 *
 * No sáb/dom o grupo opera com UMA fila de liberação por turno cobrindo todos
 * os hospitais (documento "ESCALA DE FINAL DE SEMANA"): grade P1–P4 em 3 faixas
 * (7-13 / 13-19 / 19-07) × 4 colunas (Unimed, HRO, retaguarda 1, retaguarda 2),
 * lista numerada P5+ por período e a linha "ordem do primeiro ao último a ser
 * liberado". A fila vive numa linha pseudo-hospital 'fds' de `escala_cirurgica`
 * (uma por data), reusando ordem_liberacao/liberacoes/linha_overrides; os CASOS
 * continuam por hospital.
 *
 * ⚠️ SENTIDO DA ORDEM: o documento escreve "primeiro→último a ser LIBERADO";
 * o rodapé do app é a convenção INVERSA (1ª posição = sai por último; a
 * liberação corre de baixo p/ cima). A inversão acontece UMA vez, na fronteira
 * (publicação da conferência, `rodapeDeOrdemDoc`) — nunca em leitura: um flag
 * de sentido exigiria ramificar todos os leitores do rodapé e um esquecimento
 * inverteria a fila clínica em silêncio.
 *
 * Pn→pessoa (`posicoes`) normalmente vale o fim de semana INTEIRO (dono 15/08:
 * o número acompanha a pessoa; divergência entre dias = troca pessoal, exceção
 * editável na conferência). O que muda por período é a lista de ESCALAÇÃO
 * (quem está disponível e em que ordem).
 */
import { ehDiaUtil, candidatosNome } from '@/lib/plantaoNoturno'

/** Pseudo-hospital da linha que guarda a fila única do dia. */
export const FDS_HOSPITAL = 'fds'

export const FAIXAS_FDS = ['7-13', '13-19', '19-07']

/** Faixa da grade que corresponde a cada turno publicável. */
export const FDS_TURNO_FAIXA = { matutino: '7-13', vespertino: '13-19' }

/** Papéis da faixa noturna (19-07): cols 1–2 fixas no hospital, 3–4 chamada. */
export const FDS_NOITE_PAPEL = {
  unimed: 'Plantão Unimed',
  hro: 'Plantão HRO',
  ret1: 'Retaguarda 1ª chamada',
  ret2: 'Retaguarda 2ª chamada',
}

const normPadrao = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toUpperCase()

/**
 * Fim de semana = sábado/domingo. FERIADO em dia de semana segue a regra de
 * dia útil (decisão existente do plantão noturno — fonte única `ehDiaUtil`).
 */
export function ehFimDeSemana(dataIso) {
  if (!dataIso) return false
  return !ehDiaUtil(dataIso)
}

/**
 * Faixa da grade em vigor num minuto do dia. 19:00–06:59 é a noturna: a
 * madrugada pertence à faixa 19-07 iniciada na VÉSPERA (mesmo recorte do
 * `chavePlantaoDoDia` do Pega Plantão — quem consome antes das 7h deve buscar
 * a grade do dia anterior).
 */
export function faixaFdsAtual(agoraMin) {
  const m = Number(agoraMin)
  if (!Number.isFinite(m)) return null
  if (m >= 19 * 60 || m < 7 * 60) return '19-07'
  if (m < 13 * 60) return '7-13'
  return '13-19'
}

/** Normaliza um código de posição do documento: "p09"/"P09" → "P9". */
export function normalizarPn(token) {
  const m = String(token || '').trim().toUpperCase().match(/^P0*(\d+)$/)
  return m ? `P${Number(m[1])}` : null
}

/**
 * Índice chave→Pn a partir do mapeamento Pn→pessoa. Mesmo matching multi-chave
 * do selo noturno de dia útil (uid do vínculo quando resolve; senão variantes
 * de `candidatosNome` normalizadas) — nunca casa por nome exibido.
 */
function construirIndicePn(posicoes, opts = {}) {
  const resolverUid = typeof opts.resolverUid === 'function' ? opts.resolverUid : () => null
  const normalizar = typeof opts.normalizar === 'function' ? opts.normalizar : normPadrao
  const porChave = new Map()
  const ambiguas = new Set() // chave que apontaria p/ 2 posições sai do índice
  for (const [codigo, nomeBruto] of Object.entries(posicoes || {})) {
    const pn = normalizarPn(codigo)
    const nome = String(nomeBruto || '').trim()
    if (!pn || !nome) continue
    const uid = resolverUid(nome)
    const chaves = [uid, ...candidatosNome(nome).map(normalizar)].filter(Boolean)
    for (const chave of chaves) {
      if (ambiguas.has(chave)) continue
      if (porChave.has(chave) && porChave.get(chave) !== pn) {
        porChave.delete(chave)
        ambiguas.add(chave)
        continue
      }
      porChave.set(chave, pn)
    }
  }
  const normaliza = normalizar
  return {
    tamanho: porChave.size,
    deLinha(l) {
      for (const k of [l?.chave, l?.uid, normaliza(l?.nomeOriginal || ''), normaliza(l?.anestesista || '')]) {
        if (k && porChave.has(k)) return porChave.get(k)
      }
      return null
    },
    deNome(nome) {
      const uid = resolverUid(nome)
      if (uid && porChave.has(uid)) return porChave.get(uid)
      // Nome composto NÃO casa por token solto: "JOAO RICARDO" (substituto da
      // noite de domingo, sem posição) herdaria o Pn do "JOAO HENRIQUE" pelo
      // "JOAO" — a mesma classe de ambiguidade que bloqueia publicação por
      // primeiro nome. Token solto só vale quando o próprio nome é um token.
      const tokens = String(nome || '').trim().split(/\s+/).filter(Boolean)
      const composto = tokens.length > 1
      for (const k of candidatosNome(nome).map(normaliza)) {
        if (!k) continue
        if (composto && !k.includes(' ')) continue
        if (porChave.has(k)) return porChave.get(k)
      }
      return null
    },
  }
}

/**
 * Selo Pn (P1–P12) em cada linha da fila única, conforme a posição da pessoa
 * na ordem da escala (pedido do dono 15/08). Mesmo campo `selo` dos cards
 * noturnos de dia útil — a view já sabe exibi-lo. Linha sem posição (ajuda
 * avulsa) fica sem selo.
 */
export function marcarSelosFds(linhas, posicoes, opts = {}) {
  const lista = linhas || []
  const indice = construirIndicePn(posicoes, opts)
  if (!lista.length || !indice.tamanho) return lista
  return lista.map((l) => {
    if (l.selo) return l // card noturno já veio com o selo da fusão
    const selo = indice.deLinha(l)
    return selo ? { ...l, selo } : l
  })
}

/** Quem está FISICAMENTE de plantão em Unimed/HRO numa faixa da grade. */
export function plantonistasFaixaFds(grade, faixa) {
  const linha = grade?.[faixa] || {}
  const unimed = String(linha.unimed || '').trim() || null
  const hro = String(linha.hro || '').trim() || null
  return { unimed, hro }
}

/**
 * Cards da fase noturna do FDS — SÓ os 4 plantões da faixa 19-07 da grade
 * IMPORTADA (nunca ORDEM_NOTURNA/useEscalaDia, que são conhecimento de dia
 * útil). Cols 1–2 são FIXAS no hospital → `foraDaFila: true` (fora do
 * "próximo a ser liberado", equivalente FDS do P1/P2); cols 3–4 são a ordem
 * de chamada (col3 antes de col4 ⇒ col4 libera primeiro — a lista segue a
 * convenção do rodapé, liberação de baixo p/ cima). Saída no formato de
 * `linhasNoturnas` (consumida por `fundirLinhasNoturnas`).
 */
export function linhasNoturnasFds(grade, posicoes = {}, opts = {}) {
  const faixa = grade?.['19-07'] || {}
  const indice = construirIndicePn(posicoes, opts)
  const linhas = []
  for (const col of ['unimed', 'hro', 'ret1', 'ret2']) {
    const nome = String(faixa[col] || '').trim()
    if (!nome) continue
    const fixo = col === 'unimed' || col === 'hro'
    linhas.push({
      setor: indice.deNome(nome), // selo Pn quando a pessoa tem posição; null é ok
      nome,
      papel: FDS_NOITE_PAPEL[col],
      // isPlantonista fica FALSE de propósito: o papel ("Plantão Unimed/HRO")
      // já diz o posto com mais informação que o badge genérico — e dois
      // "Plantonista" na mesma lista diriam menos que "qual hospital".
      isPlantonista: false,
      foraDaFila: fixo,
      col,
    })
  }
  return linhas
}

/**
 * Sugestão de rodapé quando o documento NÃO traz a linha de liberação do turno
 * (decisão do dono 15/08: sugerir + ajustar). Como o rodapé é escrito em ordem
 * de ESCALAÇÃO (1ª posição = sai por último), a sugestão é a própria ordem de
 * escalação: plantões da faixa (col1, col2) → lista numerada do período →
 * retaguarda (col3, col4). O "inverso da escalação com os plantões por último"
 * na direção de liberação é reverse(E) — e reverse(reverse(E)) = E.
 * Dedupe por nome normalizado (1ª ocorrência vence).
 */
export function sugerirRodapeFds({ grade, posicoes, escalacao } = {}, turno) {
  const faixa = FDS_TURNO_FAIXA[turno]
  if (!faixa) return []
  const linha = grade?.[faixa] || {}
  const numerados = (escalacao?.[turno] || [])
    .map((pn) => posicoes?.[normalizarPn(pn)] || null)
  const bruto = [linha.unimed, linha.hro, ...numerados, linha.ret1, linha.ret2]
  const vistos = new Set()
  const ordem = []
  for (const n of bruto) {
    const nome = String(n || '').trim()
    if (!nome) continue
    const chave = normPadrao(nome)
    if (vistos.has(chave)) continue
    vistos.add(chave)
    ordem.push(nome)
  }
  return ordem
}

/**
 * Fronteira documento→rodapé: converte a linha "ordem do primeiro ao último a
 * ser LIBERADO" (tokens Pn ou nomes) na ordem do RODAPÉ (invertida). Pn sem
 * dono no mapeamento vai para `semDono` — a conferência bloqueia a publicação
 * (regra da casa: nunca chutar identidade).
 */
export function rodapeDeOrdemDoc(ordemDoc, posicoes = {}) {
  const nomes = []
  const semDono = []
  for (const token of ordemDoc || []) {
    const bruto = String(token || '').trim()
    if (!bruto) continue
    const pn = normalizarPn(bruto)
    if (pn) {
      const nome = String(posicoes?.[pn] || '').trim()
      if (nome) nomes.push(nome)
      else semDono.push(pn)
    } else {
      nomes.push(bruto)
    }
  }
  return { rodape: [...nomes].reverse(), semDono }
}

/**
 * Normaliza a resposta da edge (modo 'fds') no modelo da conferência.
 * Contrato da edge, por dia detectado no documento:
 *   { data: 'YYYY-MM-DD',
 *     plantoes: { P1..P4: nome },            // linha rotulada da grade (sáb)
 *     grade: { '7-13'|'13-19'|'19-07': { unimed, hro, ret1, ret2 } },
 *     listas: { matutino|vespertino: [{ n, nome }] },
 *     ordemLiberacaoDoc: { matutino|vespertino: ['P4','P09',...|nomes] } }
 * + { ignorados: ['PLANTÃO MATERNO: ...'] } no topo (funcionárias NUNCA viram
 * posição/linha — decisão do dono 15/08; a lista é só informativa).
 *
 * opts.posicoesBase: mapeamento Pn→pessoa herdado (domingo nasce com o do
 * sábado — o vínculo nº→pessoa normalmente vale o FDS inteiro).
 */
export function normalizarParseFds(resposta, opts = {}) {
  const avisos = []
  const dias = []
  for (const diaBruto of resposta?.dias || []) {
    const data = String(diaBruto?.data || '').trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
      avisos.push(`Dia com data inválida ignorado: "${diaBruto?.data}"`)
      continue
    }
    if (!ehFimDeSemana(data)) {
      avisos.push(`${data} não é sábado/domingo — dia ignorado`)
      continue
    }
    const grade = {}
    for (const faixa of FAIXAS_FDS) {
      const l = diaBruto?.grade?.[faixa] || {}
      grade[faixa] = {
        unimed: String(l.unimed || '').trim(),
        hro: String(l.hro || '').trim(),
        ret1: String(l.ret1 || '').trim(),
        ret2: String(l.ret2 || '').trim(),
      }
    }
    const posicoes = {}
    const adotar = (codigo, nome, origem) => {
      const pn = normalizarPn(codigo)
      const nm = String(nome || '').trim()
      if (!pn || !nm) return
      if (posicoes[pn] && normPadrao(posicoes[pn]) !== normPadrao(nm)) {
        avisos.push(`${data}: ${pn} aparece como "${posicoes[pn]}" e "${nm}" (${origem}) — confira`)
        return // primeira ocorrência vence; divergência é para o humano decidir
      }
      posicoes[pn] = posicoes[pn] || nm
    }
    for (const [codigo, nome] of Object.entries(diaBruto?.plantoes || {})) adotar(codigo, nome, 'grade')
    const escalacao = { matutino: [], vespertino: [] }
    for (const turno of ['matutino', 'vespertino']) {
      for (const item of diaBruto?.listas?.[turno] || []) {
        const pn = normalizarPn(`P${item?.n}`)
        if (!pn) continue
        adotar(pn, item?.nome, `lista ${turno}`)
        if (!escalacao[turno].includes(pn)) escalacao[turno].push(pn)
      }
    }
    // Herança preenche só LACUNAS: o dado do próprio dia vence (troca pessoal,
    // caso Thayna dom 7º) — herdado nunca gera aviso de conflito.
    for (const [codigo, nomeBruto] of Object.entries(opts.posicoesBase || {})) {
      const pn = normalizarPn(codigo)
      const nm = String(nomeBruto || '').trim()
      if (pn && nm && !posicoes[pn]) posicoes[pn] = nm
    }
    const ordemDoc = { matutino: [], vespertino: [] }
    for (const turno of ['matutino', 'vespertino']) {
      ordemDoc[turno] = (diaBruto?.ordemLiberacaoDoc?.[turno] || [])
        .map((t) => normalizarPn(t) || String(t || '').trim())
        .filter(Boolean)
    }
    dias.push({ data, grade, posicoes, escalacao, ordemDoc })
  }
  // dia posterior herda o mapeamento do anterior (domingo nasce do sábado)
  dias.sort((a, b) => a.data.localeCompare(b.data))
  for (let i = 1; i < dias.length; i++) {
    for (const [pn, nome] of Object.entries(dias[i - 1].posicoes)) {
      if (!dias[i].posicoes[pn]) dias[i].posicoes[pn] = nome
    }
  }
  return { dias, ignorados: (resposta?.ignorados || []).map((s) => String(s || '')), avisos }
}
