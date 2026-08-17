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

/**
 * Turnos do FIM DE SEMANA (dono 15/08, reforço 16/08): a NOITE é um turno
 * PRÓPRIO, com fila de liberação própria — não uma fusão por cima da lista do
 * dia (era o que embaralhava a numeração da manhã na tela às 21h).
 * ⚠️ `noturno` NÃO é turno de CASO (o CHECK do banco só aceita matutino/
 * vespertino): as cirurgias em curso à noite são as da tarde — por isso o card
 * noturno herda o conteúdo do vespertino (`FDS_TURNO_CASOS`).
 */
export const FDS_TURNOS = ['matutino', 'vespertino', 'noturno']
export const FDS_TURNO_LABEL = { matutino: 'Matutino', vespertino: 'Vespertino', noturno: 'Noturno' }

/** Faixa da grade que corresponde a cada turno. */
export const FDS_TURNO_FAIXA = { matutino: '7-13', vespertino: '13-19', noturno: '19-07' }

/** Turno de CASOS que alimenta cada turno da fila (a noite herda a tarde). */
export const FDS_TURNO_CASOS = { matutino: 'matutino', vespertino: 'vespertino', noturno: 'vespertino' }

/**
 * Turno do FDS pelo relógio (dono 15/08: "a ordem de liberações deve mudar
 * automaticamente às 7h, 13h e às 19h conforme escala"). Madrugada (<7h)
 * pertence ao noturno iniciado na véspera.
 */
export function turnoFdsAtual(agoraMin) {
  const faixa = faixaFdsAtual(agoraMin)
  if (faixa === '7-13') return 'matutino'
  if (faixa === '13-19') return 'vespertino'
  return 'noturno'
}

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
 * Sábado do fim de semana ALVO a partir de uma data: sábado → ela mesma;
 * domingo → o sábado da véspera; dia útil → o PRÓXIMO sábado (a secretária
 * importa o documento na sexta para o FDS que vem).
 */
export function sabadoDoFimDeSemana(dataIso) {
  if (!dataIso) return null
  const d = new Date(`${dataIso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return null
  const wd = d.getDay()
  d.setDate(d.getDate() + (wd === 6 ? 0 : wd === 0 ? -1 : 6 - wd))
  const off = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() - off).toISOString().slice(0, 10)
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

/**
 * Resolve nome→uid SEM cair no primeiro nome solto: "JOAO RICARDO" (substituto
 * da noite de domingo) casava com o alias "JOAO" do JOAO HENRIQUE e os dois
 * cards colapsavam num só — a fila da noite saía com 3 nomes em vez de 4
 * (defeito visto em produção 16/08). Nome composto só casa por variante
 * composta; nome de um token só continua valendo por ele mesmo.
 */
export function resolverNomeEstrito(nome, resolverUid) {
  if (typeof resolverUid !== 'function') return null
  const tokens = String(nome || '').trim().split(/\s+/).filter(Boolean)
  const composto = tokens.length > 1
  for (const cand of candidatosNome(nome)) {
    if (composto && !cand.includes(' ')) continue
    const uid = resolverUid(cand)
    if (uid) return uid
  }
  return null
}

/** Quem está FISICAMENTE de plantão em Unimed/HRO numa faixa da grade. */
export function plantonistasFaixaFds(grade, faixa) {
  const linha = grade?.[faixa] || {}
  const unimed = String(linha.unimed || '').trim() || null
  const hro = String(linha.hro || '').trim() || null
  return { unimed, hro }
}

/**
 * Cards do turno NOTURNO do FDS, a partir da faixa 19-07 da grade IMPORTADA
 * (nunca ORDEM_NOTURNA/useEscalaDia, que são conhecimento de dia útil).
 * Cols 1–2 são FIXAS no hospital → `foraDaFila: true` (fora do "próximo a ser
 * liberado", equivalente FDS do P1/P2); cols 3–4 são a ordem de chamada.
 *
 * `opts.ordem` (nomes, convenção do rodapé: 1º sai por ÚLTIMO) é a ordem de
 * liberação DITADA para a noite — pode incluir gente da lista numerada que não
 * aparece na grade. Sem ela, a fila é a própria linha 19-07 da esquerda p/ a
 * direita. Saída no formato de `linhasNoturnas` (lida por `fundirLinhasNoturnas`).
 */
export function linhasNoturnasFds(grade, posicoes = {}, opts = {}) {
  const faixa = grade?.['19-07'] || {}
  const indice = construirIndicePn(posicoes, opts)
  const norm = typeof opts.normalizar === 'function' ? opts.normalizar : normPadrao
  const daGrade = []
  for (const col of ['unimed', 'hro', 'ret1', 'ret2']) {
    const nome = String(faixa[col] || '').trim()
    if (!nome) continue
    const fixo = col === 'unimed' || col === 'hro'
    daGrade.push({
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
  aplicarCoberturaNoite(daGrade, posicoes)

  // ORDEM DITADA (dono 16/08: "sábado à noite P2, P1, P4, P3, P11, P8 e P7 —
  // apenas adicione os P's faltantes"): a fila da noite pode ser MAIOR que a
  // linha 19-07 da grade. Quando `opts.ordem` vem publicada, ela é a fila; a
  // grade continua mandando no que é POSTO (papel "Plantão Unimed/HRO" e o
  // `foraDaFila` que tira os dois do "próximo a ser liberado").
  const ordem = (opts.ordem || []).map((n) => String(n || '').trim()).filter(Boolean)
  if (!ordem.length) return daGrade

  const usados = new Set()
  const daOrdem = []
  for (const nome of ordem) {
    const chave = norm(nome)
    if (!chave || usados.has(chave)) continue
    usados.add(chave)
    const naGrade = daGrade.find((l) => norm(l.nome) === chave)
    // fora da grade = gente da lista numerada que também fica à noite: entra na
    // fila comum (sem posto, dentro do "próximo a ser liberado") com o seu Pn.
    daOrdem.push(naGrade || {
      setor: indice.deNome(nome), nome, papel: null, isPlantonista: false, foraDaFila: false,
    })
  }
  // Quem está FISICAMENTE de plantão e não foi citado na ordem nunca some da
  // tela: entra na frente, que é onde o posto o coloca (sai por último).
  const naoCitados = daGrade.filter((l) => !usados.has(norm(l.nome)))
  return [...naoCitados, ...daOrdem]
}

/**
 * SUBSTITUTO NA VAGA (dom 16/08: JOAO RICARDO cobre a CRISTINA — escrito na cor
 * dela no documento, e o dono leu a noite como "P3, P4, P1, P2"). Sem cor para
 * ler, a atribuição só é feita quando é DETERMINÍSTICA: exatamente um nome sem
 * posição e exatamente uma vaga de P1–P4 não ocupada naquela noite. Com 2+ de
 * qualquer lado, ninguém recebe selo (nunca chutar identidade). Muta as linhas.
 */
function aplicarCoberturaNoite(linhas, posicoes) {
  const semSelo = linhas.filter((l) => !l.setor)
  const usados = new Set(linhas.map((l) => l.setor).filter(Boolean))
  const vagas = ['P1', 'P2', 'P3', 'P4'].filter((pn) => posicoes?.[pn] && !usados.has(pn))
  if (semSelo.length !== 1 || vagas.length !== 1) return
  semSelo[0].setor = vagas[0]
  const dono = String(posicoes[vagas[0]] || '').trim()
  semSelo[0].cobrindo = dono // quem ele está cobrindo
  // o card diz a cobertura no papel — quem lê a fila precisa saber que a vaga é
  // de outra pessoa (o documento marcava isso pela COR)
  if (dono) semSelo[0].papel = `${semSelo[0].papel} · cobre ${dono.split(/\s+/)[0]}`
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
  // NOITE: a fila é a própria linha 19-07 da grade, da esquerda p/ a direita —
  // sem lista numerada (confirmado com o dono 15/08: sáb P2,P1,P4,P3 · dom
  // P3,P4,P1,P2 são exatamente Unimed, HRO, retaguarda 1, retaguarda 2).
  const numerados = turno === 'noturno'
    ? []
    : (escalacao?.[turno] || []).map((pn) => posicoes?.[normalizarPn(pn)] || null)
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
