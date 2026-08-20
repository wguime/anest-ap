/**
 * Helpers de apresentação da escala cirúrgica (puro, sem React).
 */
import { resolverAnestesistas, nomeCirurgiaoCurto, titleCaseNome, primeiroNome, stripNotaRodape, fraseClinica } from '@/lib/colunaLiberacao'

/** Normaliza nome p/ comparação (acento/caixa/PED-insensível). */
export const normNome = (s) =>
  stripNotaRodape(String(s || ''))
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/^\s*ped[.\s]\s*/i, '') // prefixo de PEDIDO "PED"/"PED."/"Ped." → fica só o nome (24/07)
    .trim()
    .toUpperCase()

/** Casos com anestesista "//" já resolvido (regra 2), p/ exibição e matching. */
export function casosResolvidos(escala) {
  return escala?.casos?.length ? resolverAnestesistas(escala.casos) : []
}

/** Alias do usuário p/ "Minhas escalas": campo escalaAlias, senão 1º nome. */
export function meuAliasDe(user) {
  return (
    user?.escalaAlias ||
    user?.firstName ||
    String(user?.displayName || '').split(/\s+/)[0] ||
    ''
  ).trim()
}

/** Agrupa casos por sala preservando a ordem (Map sala -> casos[]). */
export function agruparPorSala(casos) {
  const grupos = new Map()
  for (const c of casos) {
    const sala = c.sala || '—'
    if (!grupos.has(sala)) grupos.set(sala, [])
    grupos.get(sala).push(c)
  }
  return grupos
}

/**
 * Rank numérico de uma sala para ordenação do board.
 * Salas numéricas pela própria numeração; nomeadas mapeadas por hospital:
 *   HRO: ORTO → 4, CO → 7.  Unimed: C.O (centro obstétrico) → depois das numéricas.
 * Blocos auxiliares (SRPA/EXAMES/IMAGEM/CONSULTÓRIO/HEMO/IOSC) por último.
 */
export function rankSala(sala, hospital) {
  const s = normNome(sala)
  // Ordem canônica (dono, 2026-07-21) p/ Unimed E HRO:
  //   [CO Unimed] → salas numéricas/CC → Hemodinâmica → SRPA → Exames → Imagem →
  //   demais locais em ORDEM ALFABÉTICA (outros hospitais na mesma escala —
  //   o tie-break alfabético do comparador resolve dentro do rank 85).
  if (hospital === 'unimed' || hospital === 'hro') {
    if (hospital === 'unimed') {
      if (/^C\.?\s*O\b/.test(s) || /CENTRO OBSTET/.test(s)) {
        if (/CESAR/.test(s)) return 0
        const n = s.match(/(\d+)/)
        return 1 + (n ? Number(n[1]) / 100 : 0)
      }
      if (/^CC\b/.test(s) || /CENTRO CIRURGICO/.test(s)) {
        const n = s.match(/(\d+)/)
        return 10 + (n ? Number(n[1]) : 0)
      }
    } else {
      // HRO (ordem do dono 2026-07-22): salas numéricas → Bloco M → Hemodinâmica →
      // Exames → Imagem → Braquiterapia → Consultório → demais alfabético
      // (Centro de Coluna, Digimax, Hospital de Olhos, IOSC, Ambulatorial…)
      if (/BLOCO\s*M/.test(s)) {
        const n = s.match(/(\d+)/)
        return 30 + (n ? Number(n[1]) / 100 : 0)
      }
      if (/\bORTO\b/.test(s)) return 14
      if (/\bCO\b/.test(s)) return 17 // CO do HRO = Sala 7
      if (/EMERG/.test(s) && !/\d/.test(s)) return 15 // Emergência sozinha = Sala 5
      if (/HEMO/.test(s)) return 60
      if (/EXAME/.test(s)) return 62
      if (/IMAGEM/.test(s)) return 64
      if (/BRAQUI/.test(s)) return 66
      if (/CONSULT/.test(s)) return 68
      const m = s.match(/(\d+)/)
      if (m) return 10 + Number(m[1])
      return 85
    }
    if (/HEMO/.test(s)) return 60
    if (/SRPA/.test(s)) return 62
    if (/EXAME/.test(s)) return 64
    if (/IMAGEM/.test(s)) return 66
    const m = s.match(/(\d+)/)
    if (m) return 10 + Number(m[1]) // "Sala N"/"CC - Sala N"
    return 85 // demais locais → alfabético
  }
  if (/SRPA|EXAME|IMAGEM|CONSULT|HEMO|IOSC/.test(s)) return 90
  if (/^C\.?\s*O\b/.test(s) || /CENTRO OBSTET/.test(s)) return 80 // C.O após as numéricas
  const m = s.match(/(\d+)/)
  if (m) return Number(m[1])
  return 85
}

/**
 * Normaliza o rótulo de sala da escala Unimed na IMPORTAÇÃO (pedido 2026-07-21):
 * "CENTRO CIRÚRGICO - SALA 1" → "CC - Sala 1"; "CO - CESAREA" → "CO - Cesárea".
 * Rótulos curtos cabem no mobile sem truncar.
 */
export function normalizarSalaUnimed(sala) {
  const raw = String(sala || '').trim()
  const s = normNome(raw)
  if (!s) return raw
  let m = s.match(/CENTRO\s+CIRURGICO.*?(\d+)/) || (/^CC\b/.test(s) ? s.match(/(\d+)/) : null)
  if (m) return `CC - Sala ${m[1]}`
  if (/^C\.?\s*O\b/.test(s) || /CENTRO OBSTET/.test(s)) {
    if (/CESAR/.test(s)) return 'CO - Cesárea'
    const n = s.match(/(\d+)/)
    return n ? `CO - Sala ${n[1]}` : 'CO'
  }
  if (/SRPA/.test(s)) return 'SRPA'
  if (/EXAME/.test(s)) return 'Exames'
  if (/IMAGEM/.test(s)) return 'Imagem'
  if (/HEMO/.test(s)) return 'Hemodinâmica'
  if (/CONSULT/.test(s)) return 'Consultório'
  if (/UMANITA/.test(s)) return 'Umanitá'
  if (/ACCURATA/.test(s)) return 'Accurata'
  return raw
}

/**
 * Sala numérica do HRO = BLOCO A (dono 2026-08-20). O mapa do hospital já traz
 * "BLOCO A" como rótulo de seção na coluna Leito, mas a normalização derrubava o
 * bloco e gravava só "Sala 1" — ao lado de "Bloco M - Sala 1", que é OUTRA sala,
 * em outro bloco, com o MESMO número. Quem lê a escala no celular tinha de saber
 * de cor qual "Sala 1" era qual. Agora todo rótulo numérico nomeia o bloco e a
 * forma curta saiu da lista de escolha.
 *
 * Os dois sufixos do bloco A continuam colados no número (decisão de 20/08 sobre
 * o CO): o bloco entra antes, o sufixo fica.
 */
export const SALA_HRO_CO = 'Bloco A - Sala 7 - CO'
export const SALA_HRO_EMERGENCIA = 'Bloco A - Sala 5 - Emergência'

/** Rótulo canônico de uma sala numérica do bloco A, a partir do número lido. */
const salaBlocoA = (n, s) => {
  if (n === '7') return SALA_HRO_CO // o CO do HRO é a sala 7 (rótulo único, dono 20/08)
  if (n === '5' && /EMERG/.test(s)) return SALA_HRO_EMERGENCIA
  return `Bloco A - Sala ${n}`
}

/**
 * Chave de IDENTIDADE de sala do HRO: "Sala 4" e "Bloco A - Sala 4" são a MESMA
 * sala. O prefixo passou a ser gravado em 20/08 e as ~700 cirurgias publicadas
 * antes disso seguem com o rótulo curto (decisão do dono: não reescrever escala
 * já publicada) — comparar o texto cru partiria a sala em dois blocos no quadro,
 * em duas entradas do seletor e em duas vagas do contrato de urgência.
 *
 * O lookahead protege "Bloco A" sozinho (seção sem número), que não vira ''.
 */
export const chaveSalaHro = (sala) =>
  normNome(sala).replace(/\s+/g, ' ').replace(/^BLOCO ?A\b\s*-?\s*(?=\S)/, '')

/** Mesma chave, escolhida pelo hospital (fora do HRO o rótulo já é único). */
export const chaveSalaEscolha = (hospital, sala) =>
  String(hospital || '').toLowerCase() === 'hro'
    ? chaveSalaHro(sala)
    : normNome(sala).replace(/\s+/g, ' ')

/**
 * Normaliza o rótulo de sala da escala HRO na importação (regras do dono 2026-07-21):
 * numéricas → "Bloco A - Sala N"; "CO" e "Sala 7" → "Bloco A - Sala 7 - CO" (o CO
 * do HRO é a sala 7 — rótulo único, dono 20/08); "HO"/"H.O." → "Hospital de Olhos".
 * Idempotente: o rótulo já canônico volta igual.
 */
export function normalizarSalaHro(sala) {
  const raw = String(sala || '').trim()
  const s = normNome(raw)
  if (!s) return raw
  if (/^H\.?\s*O\.?$/.test(s) || /HOSPITAL DE OLHOS/.test(s)) return 'Hospital de Olhos'
  if (/BLOCO\s*M/.test(s)) {
    const n = s.match(/(\d+)/)
    return n ? `Bloco M - Sala ${n[1]}` : 'Bloco M'
  }
  // Bloco A ANTES das regras numéricas: "Bloco A - Sala 7 - CO" reentra por aqui
  // e precisa sair inteiro (a regra `^SALA 7` não o alcança, e o `${n}` cru
  // devolveria "Bloco A - Sala 7", perdendo o CO).
  if (/BLOCO ?A\b/.test(s)) {
    const n = s.match(/(\d+)/)
    return n ? salaBlocoA(n[1], s) : 'Bloco A'
  }
  if (/^SALA ?\d/.test(s)) return salaBlocoA(s.match(/(\d+)/)[1], s)
  if (/^C\.?\s*O\.?$/.test(s)) return SALA_HRO_CO
  if (/^EMERG/.test(s) && !/\d/.test(s)) return SALA_HRO_EMERGENCIA // Emergência sozinha = Sala 5
  if (/^EXAMES?$/.test(s)) return 'Exames'
  if (/^CONSULT/.test(s)) return 'Consultório'
  if (/^IMAGEM$/.test(s)) return 'Imagem'
  if (/^HEMO/.test(s)) return 'Hemodinâmica'
  if (/BRAQUI/.test(s)) return 'Braquiterapia'
  if (/^IOSC$/.test(s)) return 'IOSC'
  if (/C\.?\s*COLUNA|CENTRO DE COLUNA/.test(s)) return 'Centro de Coluna'
  if (/DIGIMAX/.test(s)) return 'Digimax'
  if (/AMBULATORI/.test(s)) return 'Ambulatorial'
  return raw
}

/**
 * Rótulo de EXIBIÇÃO da sala (pedido 2026-07-21): EXAMES → "Exames",
 * CONSULT./CONSULTORIO → "Consultório", sempre — vale também para escalas já
 * salvas com o rótulo cru (a normalização de importação cobre só as novas).
 */
export function salaExibicao(sala) {
  const s = normNome(sala)
  if (/^EXAMES?$/.test(s)) return 'Exames'
  if (/^CONSULT/.test(s)) return 'Consultório'
  if (/^IMAGEM$/.test(s)) return 'Imagem'
  if (/^HEMO/.test(s)) return 'Hemodinâmica'
  if (/^BRAQUI/.test(s)) return 'Braquiterapia'
  return String(sala || '').trim()
}

/**
 * Rótulo de sala NAS LIBERAÇÕES (2026-07-22): abreviado p/ caber no card —
 * "Hospital de Olhos" → "HO". Demais seguem salaExibicao.
 */
export function salaLiberacao(sala) {
  if (/HOSPITAL DE OLHOS/.test(normNome(sala))) return 'HO'
  return salaExibicao(sala)
}

/**
 * Salas/locais BASE por hospital p/ o dropdown do editor de linha — TODAS as
 * salas selecionáveis mesmo fora da escala do dia (pedido do dono 2026-07-22).
 * O dropdown une isto com as salas do dia + locais aprendidos do histórico
 * (fetchLocaisHospital). Rótulos na forma canônica das normalizações de
 * importação + salas reais já observadas nas escalas publicadas.
 */
export const LOCAIS_BASE = {
  unimed: [
    'CO - Cesárea', 'CO - Sala 1', 'CO - Sala 2', 'CO - Sala 3',
    'CC - Sala 1', 'CC - Sala 2', 'CC - Sala 3', 'CC - Sala 4', 'CC - Sala 5', 'CC - Sala 6', 'CC - Sala 7',
    'Hemodinâmica', 'SRPA', 'Exames', 'Imagem', 'Consultório', 'Umanitá', 'Accurata', 'Ambulatorial',
  ],
  hro: [
    // Numéricas = BLOCO A (dono 20/08): antes a lista tinha "Sala 1" E
    // "Bloco A - Sala 1" — a mesma sala duas vezes, ao lado de "Bloco M - Sala 1",
    // que é outra. A forma curta saiu; `chaveSalaHro` mantém as escalas antigas
    // (que gravaram "Sala 1") apontando para a mesma sala.
    'Bloco A - Sala 1', 'Bloco A - Sala 2', 'Bloco A - Sala 3', 'Bloco A - Sala 4',
    SALA_HRO_EMERGENCIA, 'Bloco A - Sala 6', SALA_HRO_CO, 'Bloco A - Sala 8', 'Bloco A - Sala 9',
    'Bloco M - Sala 1', 'Bloco M - Sala 2', 'Bloco M - Sala 3', 'Bloco M - Sala 4', 'Bloco M', 'Hemodinâmica', 'Exames', 'Imagem', 'Braquiterapia', 'Consultório',
    'IOSC', 'Hospital de Olhos', 'Centro de Coluna', 'Digimax', 'Ambulatorial',
  ],
  materno: ['Sala 1 HC', 'Sala 2 HC', 'Sala 3 HC', 'Centro Obstétrico'],
}

/**
 * CONVÊNIOS que a escala vê, em ordem de frequência real (varredura de produção
 * 20/08 nas 3 escalas: SUS 711 · Unimed Chapecó 344 · Intercâmbio Estadual 265 ·
 * Particular 110+ · Intercâmbio Nacional 86 · SC 71 · BRF 64 · Mercosul 62 · FAS 48).
 *
 * PORQUÊ (dono 20/08): o campo era texto livre e o banco acumulou "Unirmd",
 * "Umimed", "Particulae", "Sua", "sUS" — e cada erro de digitação some do
 * agrupamento por família (`familiaConvenio`) e, no caso do particular, da
 * COBRANÇA (o trigger `fn_convenio_particular` casa o texto). Lista escolhível
 * primeiro, digitação como saída.
 *
 * ⚠️ a grafia daqui é a que vai para o banco: "Particular" precisa continuar
 * casando `^PART(ICULAR)?[^A-Z]*$` (espelho JS+SQL do classificador), e os
 * "Unimed …" precisam começar com UNIMED/INTERCÂMBIO para a família bater.
 */
export const CONVENIOS_BASE = [
  'SUS',
  'Unimed Chapecó - VD',
  'Unimed Intercâmbio Estadual',
  'Unimed Intercâmbio Nacional',
  'Intercâmbio Mercosul - PR/RS',
  'Unimed Fundação',
  'Unimed',
  'Particular',
  'SC Saúde',
  'BRF',
  'FAS',
  'CASSI',
  'GEAP',
]

/**
 * Convênios para o seletor: a lista CANÔNICA primeiro, e depois o que a escala do
 * dia trouxer de diferente.
 *
 * ⚠️ ordem INVERSA à de `salasDoHospital` de propósito: lá a grafia do dia vence
 * porque sala é agrupada por TEXTO (duas grafias = dois blocos no quadro); aqui o
 * agrupamento é por FAMÍLIA (`familiaConvenio`), então nada se perde ao oferecer a
 * grafia limpa primeiro — e a escala de 20/08 trazia "Convênios", "PART" e "SC" no
 * topo, que é exatamente o que a lista existe para parar de propagar.
 */
export function conveniosDaEscala(casos) {
  const vistos = new Set()
  const out = []
  for (const c of [...CONVENIOS_BASE, ...(casos || []).map((x) => x?.convenio)]) {
    const nome = String(c || '').trim()
    if (!nome) continue
    const chave = normConvenio(nome)
    if (!chave || vistos.has(chave)) continue
    vistos.add(chave)
    out.push(nome)
  }
  return out
}

/** Bloco derivado do rótulo de sala normalizado (importação Unimed sem Vision). */
export function blocoDaSalaUnimed(sala) {
  const s = normNome(sala)
  if (/SRPA/.test(s)) return 'srpa'
  if (/EXAME/.test(s)) return 'exames'
  if (/IMAGEM/.test(s)) return 'imagem'
  if (/HEMO/.test(s)) return 'hemodinamica'
  if (/CONSULT/.test(s)) return 'consultorio'
  if (/UMANITA/.test(s)) return 'umanita'
  if (/ACCURATA/.test(s)) return 'accurata'
  return 'normal'
}

/** Comparador de salas por hospital (ordem numérica + mapeamentos). */
export const compararSalas = (hospital) => (a, b) => {
  const d = rankSala(a, hospital) - rankSala(b, hospital)
  return d !== 0 ? d : a.localeCompare(b, 'pt-BR')
}

/**
 * Nome do anestesista IMPORTADO de cada linha, com a herança da escala resolvida
 * (array paralelo a `casos`): "//"/vazia repete a linha de cima DA MESMA SALA —
 * é continuação, não anestesista novo — e, sem nada acima, cai no 1º nome
 * explícito da sala (célula mesclada que a Vision lê na 2ª linha). "?" é nome
 * próprio: a linha está descoberta de propósito e nunca vira base de ninguém.
 */
export function nomesImportados(casos) {
  const lista = casos || []
  const explicito = (c) => {
    if (c.semAnestesista) return '?'
    const t = String(c.anestesista || '').trim()
    if (!t || t === '//') return null
    return /^\?+$/.test(t) ? '?' : t
  }
  const base = new Map()
  for (const c of lista) {
    const sala = c.sala || '—'
    const n = explicito(c)
    if (n && n !== '?' && !base.has(sala)) base.set(sala, n)
  }
  const ultimo = new Map()
  return lista.map((c) => {
    const sala = c.sala || '—'
    const n = explicito(c)
    if (n === '?') return '?'
    if (n) { ultimo.set(sala, n); return n }
    return ultimo.get(sala) || base.get(sala) || ''
  })
}

/**
 * Nome que define o GRUPO de cada linha (array paralelo a `casos`): o carimbo da
 * importação quando existe, senão o nome derivado da própria escala.
 *
 * Linha SEM carimbo (adicionada à mão na conferência) entra no grupo-base da sala
 * em vez de criar um grupo novo: se ela pudesse dividir a sala, a chave dos outros
 * mudaria no meio da conferência e a atribuição já escolhida se perderia em
 * silêncio — a classe do erro JANAINA→Cury.
 */
function nomesDeGrupo(lista) {
  const derivados = nomesImportados(lista)
  const base = new Map()
  for (const c of lista) {
    const n = c.anestesistaImportado
    const sala = c.sala || '—'
    if (n && n !== '?' && !base.has(sala)) base.set(sala, n)
  }
  return lista.map((c, i) => {
    if (c.anestesistaImportado) return c.anestesistaImportado
    const daSala = base.get(c.sala || '—')
    return daSala !== undefined ? daSala : derivados[i]
  })
}

/**
 * Chave do grupo de conferência/atribuição de cada linha (array paralelo a `casos`):
 * a SALA quando ela tem UM anestesista; `sala|NOME` quando tem MAIS DE UM.
 *
 * Pedido do dono 27/07: sala/bloco com vários anestesistas (Exames, IOSC, Umanitá,
 * seções de outros hospitais na mesma escala) é conferido e atribuído POR
 * ANESTESISTA — cada um com o seu cirurgião — em vez de um bloco só. É a mesma
 * regra que a aba Completa já usa (gruposExibicao do BoardView).
 *
 * `anestesistaImportado` (gravado na importação) mantém a chave ESTÁVEL quando a
 * atribuição troca o texto da linha; sem ele o grupo se dissolveria ao atribuir.
 */
export function chavesAnestesista(casos) {
  const lista = casos || []
  const nomes = nomesDeGrupo(lista)
  const porSala = new Map()
  lista.forEach((c, i) => {
    const sala = c.sala || '—'
    if (!porSala.has(sala)) porSala.set(sala, new Set())
    porSala.get(sala).add(normNome(nomes[i]))
  })
  return lista.map((c, i) => {
    const sala = c.sala || '—'
    return porSala.get(sala).size > 1 ? `${sala}|${normNome(nomes[i])}` : sala
  })
}

/**
 * Grupos ordenados da conferência: `{ chave, sala, nome, split, indices }`.
 * `indices` aponta para o array plano de casos (a edição por linha continua
 * operando nele). `nome` é o texto IMPORTADO do grupo ('?' = sem anestesista).
 */
export function gruposAnestesista(casos, hospital) {
  const lista = casos || []
  const chaves = chavesAnestesista(lista)
  const nomes = nomesDeGrupo(lista)
  const grupos = new Map()
  lista.forEach((c, i) => {
    const chave = chaves[i]
    const sala = c.sala || '—'
    if (!grupos.has(chave)) {
      grupos.set(chave, { chave, sala, nome: nomes[i] || '', split: chave !== sala, indices: [] })
    }
    grupos.get(chave).indices.push(i)
  })
  const porSala = compararSalas(hospital)
  return [...grupos.values()].sort((a, b) => {
    const d = porSala(a.sala, b.sala)
    return d !== 0 ? d : a.indices[0] - b.indices[0]
  })
}

/**
 * Aplica a atribuição de anestesistas aos casos na publicação: grava
 * `anestesistaUserId` (login) e o `anestesista` (apelido p/ exibição).
 *
 * ⚠️ CAUSA RAIZ dos erros 23/07 (Exames 3×PAULO, IOSC 3×CURY): a atribuição era
 * POR SALA e sobrescrevia TODAS as linhas — em blocos multi-anestesista
 * (Exames/Umanitá/IOSC/…) cada linha tem o SEU anestesista e os demais "somem"
 * da escala. Desde 27/07 a atribuição é POR GRUPO (`chavesAnestesista`): sala com
 * vários anestesistas vira um grupo por anestesista, então nenhuma atribuição
 * alcança as linhas de outro colega.
 *
 * @param {Array} casos
 * @param {Object} atribuicoes  chave do grupo -> uid (sala, ou `sala|NOME`)
 * @param {(chave:string, uid:string)=>string} apelidoDe  rótulo de exibição
 * @param {(nome:string)=>string|null} [resolverUid]  dicionário apelido→login
 */
export function aplicarAtribuicoes(casos, atribuicoes, apelidoDe, resolverUid = null) {
  const lista = casos || []
  const chaves = chavesAnestesista(lista)
  // nome importado do grupo — "?" NÃO conta (é ausência declarada, não nome).
  const nomeGrupo = {}
  lista.forEach((c, i) => {
    if (c.semAnestesista) return
    const t = String(c.anestesista || '').trim()
    if (t && t !== '//' && !/^\?+$/.test(t) && !nomeGrupo[chaves[i]]) nomeGrupo[chaves[i]] = t
  })
  // Grupo que ficou SEM NINGUÉM (nem atribuição, nem nome importado) vira "?"
  // automaticamente (pedido do dono 26/07): antes saía com o campo em branco e
  // só quem abrisse a sala percebia. Com "?" o cabeçalho da Completa mostra a
  // interrogação e o procedimento entra no alerta das Liberações.
  const grupoSemNinguem = new Set(
    chaves.filter((k) => !atribuicoes?.[k] && !nomeGrupo[k])
  )

  return lista.map((c, i) => {
    const k = chaves[i]
    const t = String(c.anestesista || '').trim()
    // Caso "?" (semAnestesista): ficar SEM anestesista é uma INFORMAÇÃO da escala
    // — a sala está descoberta e o plantonista precisa ver o alerta. A atribuição
    // NUNCA o preenche (bug relatado pelo dono 26/07). Para dar dono a ele, use o
    // seletor do próprio caso (ou do grupo "?") na conferência.
    if (c.semAnestesista || /^\?+$/.test(t)) {
      // texto normalizado p/ "?" como no ramo grupoSemNinguem: um '' com a flag
      // sobrevivia até o banco e a Completa fundia o caso no grupo do colega
      return { ...c, semAnestesista: true, anestesista: t || '?', anestesistaUserId: null }
    }
    // Anestesista escolhido À MÃO no caso (seletor da conferência): a atribuição
    // do grupo não o sobrescreve, mesmo que o nome coincida com o do grupo.
    if (c.anestesistaManual) return { ...c, anestesistaUserId: c.anestesistaUserId || null }
    // Grupo sem ninguém → "?" automático (ver grupoSemNinguem acima)
    if (grupoSemNinguem.has(k)) {
      return { ...c, semAnestesista: true, anestesista: '?', anestesistaUserId: null }
    }
    // SALA DE DOIS ("RAQUEL + GABRIELA", dono 11/08): a dupla é a informação da
    // escala e um login só não a representa — escolher um no seletor apagava a
    // colega e a Completa passava a mostrar uma pessoa onde havia duas. O texto
    // fica como veio; a fila já conta presença dos DOIS (colunaLiberacao separa
    // pelo "+") e nenhuma transferência de caso mexe em sala compartilhada.
    if (t.includes('+')) return { ...c, anestesista: t, anestesistaUserId: null }
    // Atribuição do grupo vence (login escolhido > texto importado, lição 23/07);
    // senão preserva o uid da extração e, por último, tenta o dicionário.
    const nomeReal = t && t !== '//' ? t : ''
    const uid = atribuicoes?.[k]
      || c.anestesistaUserId
      || (resolverUid && nomeReal ? resolverUid(nomeReal) : null)
      || null
    return {
      ...c,
      anestesistaUserId: uid,
      anestesista: atribuicoes?.[k] ? apelidoDe(k, uid) : (c.anestesista || ''),
    }
  })
}

/** Turno de uma hora "HH:MM": matutino (< 13:00) | vespertino. Sem hora → null. */
export function turnoDeHora(hora) {
  const m = /^(\d{1,2})(?::?(\d{2}))?\s*h?$/i.exec(String(hora || '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = m[2] == null ? 0 : Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null
  return h < 13 ? 'matutino' : 'vespertino'
}

/**
 * Uma importação representa UM período, mesmo quando o anexo contém o dia todo
 * (layout habitual do Materno). A hora decide o turno; caso sem hora pertence ao
 * período escolhido, pois blocos como SRPA/Exames não permitem deduzi-lo.
 */
export function selecionarCasosDoTurno(casos, turno) {
  if (turno !== 'matutino' && turno !== 'vespertino') return []
  return (casos || [])
    .map((c) => ({
      ...c,
      // Item sem hora é carimbado no primeiro carregamento. Ao alternar o
      // seletor ele não pode migrar de manhã para tarde (posição SRPA, lote de
      // exames etc.). Em dado bruto sem carimbo, vale o turno escolhido.
      turno: turnoDeHora(c?.hora) || (['matutino', 'vespertino'].includes(c?.turno) ? c.turno : turno),
    }))
    .filter((c) => c.turno === turno)
}

/**
 * Filtra casos pelo turno usando a MESMA classificação da publicação
 * (turnoDoCaso). Antes, caso sem hora aparecia nos DOIS turnos enquanto a
 * publicação o tratava como matutino — o SRPA da manhã vazava para a tarde
 * (bug relatado 26/07). Uma regra só nos dois lugares.
 */
export function filtrarPorTurno(casos, turno) {
  if (!turno) return casos
  return casos.filter((c) => turnoDoCaso(c) === turno)
}

/** Turno corrente pela hora local (default do seletor). */
export function turnoAtual(d = new Date()) {
  return d.getHours() < 13 ? 'matutino' : 'vespertino'
}

// ── Convivência manhã/tarde no MESMO dia (decisão do dono 23/07) ─────────────
// A escala é UMA linha por (data, hospital) e publicar é DELETE+reinsert — por
// isso publicar a tarde apagava a manhã. Solução SEM mudar o schema: publicar
// MESCLA por turno (mantém o outro) e o rodapé vira por-turno {matutino,vespertino}.

/**
 * Turno ÚNICO de um caso p/ PARTICIONAR a escala (merge por turno): pela hora;
 * sem hora → matutino (SRPA/blocos são montados de manhã). Diferente de
 * filtrarPorTurno, que EXIBE os casos sem hora nos dois turnos.
 */
export function turnoDoCaso(c) {
  // turno PUBLICADO vence: caso sem hora (SRPA/Exames/Consultório) não tem como
  // ser deduzido, e adivinhar punha o bloco da manhã na tarde (bug 26/07).
  if (c?.turno === 'matutino' || c?.turno === 'vespertino') return c.turno
  return turnoDeHora(c?.hora) || 'matutino'
}

/**
 * Rodapé (ordem de liberação) do turno. Aceita o formato LEGADO (array = mesma
 * ordem o dia todo, dinheiro dos dois turnos) e o novo ({matutino:[], vespertino:[]}).
 */
export function rodapeDoTurno(ordemLiberacao, turno) {
  if (Array.isArray(ordemLiberacao)) return ordemLiberacao
  return (ordemLiberacao && ordemLiberacao[turno]) || []
}

/** Grava a ordem do TURNO preservando a do outro. Array legado vira o matutino. */
export function mergeRodapeTurno(ordemLiberacao, turno, novaOrdem) {
  const base = Array.isArray(ordemLiberacao)
    ? (ordemLiberacao.length ? { matutino: ordemLiberacao } : {})
    : { ...(ordemLiberacao || {}) }
  return { ...base, [turno]: novaOrdem }
}

/** Combina os casos do OUTRO turno (preservados) com os NOVOS do turno publicado. */
export function mergeCasosPorTurno(existentes, novos, turno) {
  const outro = (existentes || []).filter((c) => turnoDoCaso(c) !== turno)
  return [...outro, ...(novos || [])]
}

/** "2026-06-27" → "27/06/2026". */
export function formatData(iso) {
  if (!iso) return ''
  const [a, m, d] = String(iso).split('-')
  return d && m && a ? `${d}/${m}/${a}` : iso
}

/**
 * Data por extenso para o subtítulo da tela (dono 16/08: a data da escala no
 * lugar de "Fim de semana · Noite", que os botões abaixo já dizem).
 * Ex.: "Domingo, 16 de agosto" · hoje/amanhã ganham prefixo próprio.
 */
export function dataPorExtenso(iso, hojeIso = null) {
  if (!iso) return ''
  const d = new Date(`${iso}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']
  // Curto o bastante para caber no subtítulo do cabeçalho a 375px sem truncar
  // ("Hoje · Domingo, 16 de agosto" cortava em "16 de ago…").
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const corpo = `${DIAS[d.getDay()]}, ${dd}/${mm}`
  if (!hojeIso) return corpo
  if (iso === hojeIso) return `Hoje · ${corpo}`
  const amanha = new Date(`${hojeIso}T12:00:00`)
  amanha.setDate(amanha.getDate() + 1)
  const off = amanha.getTimezoneOffset() * 60000
  const amanhaIso = new Date(amanha.getTime() - off).toISOString().slice(0, 10)
  return iso === amanhaIso ? `Amanhã · ${corpo}` : corpo
}

/** "HH:MM" → minutos do dia; null se inválido/vazio (mesma regex de turnoDeHora). */
export function parseHoraMinutos(hora) {
  const m = /^(\d{1,2}):?(\d{2})?/.exec(String(hora || '').trim())
  if (!m) return null
  const h = Number(m[1])
  const min = m[2] ? Number(m[2]) : 0
  if (!Number.isFinite(h) || h > 23 || min > 59) return null
  return h * 60 + min
}

/** "01:30" → 90 minutos; null se não for duração hh:mm válida. */
export function parseDuracaoMin(t) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

/** Status que encerram o caso p/ fins de estimativa/fechamento de sala. */
export const STATUS_CONCLUIDO = ['terminada', 'suspensa']

/**
 * Caso concluído p/ fins de sala (não conta no cronômetro/fechamento):
 * terminada (principal) OU suspensa — que hoje vive em statusExtra
 * (aceita o valor legado no campo principal p/ demo/dados antigos).
 */
export const casoConcluido = (c) =>
  STATUS_CONCLUIDO.includes(c?.statusCirurgia || 'agendada') || c?.statusExtra === 'suspensa'

/**
 * Observação exibível de um override de linha. A troca saiu do app em 29/07, mas
 * escalas ANTIGAS ainda têm a nota `troca` gravada — ela vira TEXTO de observação
 * (é exatamente o recado que a observação passou a carregar) em vez de sumir ou
 * quebrar o card, e some quando alguém escreve uma observação de verdade.
 * `hospitalLabels` é opcional (mapa slug→rótulo) — sem ele sai o slug cru.
 */
export const observacaoDaLinha = (ov, hospitalLabels = {}) => {
  if (ov?.observacao) return String(ov.observacao)
  const t = ov?.troca
  if (!t?.com) return ''
  return `Troca com ${titleCaseNome(t.com)}${t.hospital ? ` · ${hospitalLabels[t.hospital] || t.hospital}` : ''}`
}

/**
 * VISITANTE PRESERVADO NO REPASSE (dono 31/07 — caso LEONARDO, Cesárea→Tiago):
 * repassar o ÚLTIMO caso de quem veio de OUTRO HOSPITAL apagava a única
 * evidência de presença dele aqui — a linha sumia das Liberações antes de ele
 * ser liberado (e no hospital de origem ele despencava da posição do rodapé
 * pro bloco do fim). Decide, PURO, quem precisa entrar em `ajuda_externa[turno]`
 * (o mesmo campo do toggle manual de ajuda) para a linha sobreviver ao repasse.
 * ⚠️ SÓ vale para quem é comprovadamente de OUTRO hospital (dono 19/08, swap
 * Guilherme⇄Diego): troca entre colegas do MESMO hospital apenas move os
 * procedimentos de sala — ninguém vira "ajuda". A origem é comprovada em
 * `opts.outrasEscalas` (rodapé do turno ou caso do turno em outra escala do
 * dia); sem prova, trata como gente da casa e não grava nada.
 * ⚠️ Todo matching decide por IDENTIDADE (uid do caso ou apelido resolvido
 * pelo dicionário via `opts.resolverUid`), nunca só pela grafia: em 19/08 o
 * caso dizia "GUILHERME M ELO" (texto da Vision, espaço no meio) e o rodapé
 * "GUILHERME MELO" — texto contra texto marcou gente do rodapé como visitante
 * e a linha ganhou badge de Ajuda indevido. A grafia (sem espaços) é fallback
 * para quando não há uid nem resolver.
 * @returns {Array<{nome:string, turno:string}>}
 */
export function ajudasPreservadasNoRepasse(casosAntes, casosDepois, ids, escala, opts = {}) {
  const { resolverUid, outrasEscalas = [] } = opts
  const idSet = ids instanceof Set ? ids : new Set(ids || [])
  const out = []
  const vistos = new Set()
  const chaveNome = (s) => normNome(s).replace(/\s+/g, '')
  for (const c of casosAntes || []) {
    if (!idSet.has(c.id)) continue
    const nome = String(c.anestesista || '').trim()
    const n = chaveNome(nome)
    // "A + B" fica de fora: o repasse desses é por caso e o colega permanece
    if (!n || nome === '//' || /^\?+$/.test(n) || nome.includes('+') || c.semAnestesista) continue
    if (vistos.has(n)) continue
    vistos.add(n)
    const uidCaso = c.anestesistaUserId || resolverUid?.(nome) || null
    const mesmo = (r) => chaveNome(r) === n || (uidCaso != null && resolverUid?.(r) === uidCaso)
    const turno = turnoDoCaso(c)
    // ainda nomeado em algum caso do turno (mesmo terminado)? a linha sobrevive sozinha
    const aindaTem = (casosDepois || []).some((d) => {
      if (turnoDoCaso(d) !== turno) return false
      if (uidCaso && d.anestesistaUserId === uidCaso) return true
      return String(d.anestesista || '').split(/\s*\+\s*/).some((p) => mesmo(p))
    })
    if (aindaTem) continue
    if (rodapeDoTurno(escala?.ordemLiberacao, turno).some(mesmo)) continue
    if (rodapeDoTurno(escala?.ajudaExterna, turno).some(mesmo)) continue // já é ajuda
    // origem em OUTRO hospital do dia: rodapé do turno lá, ou — na falta de
    // rodapé (Materno publica sem nenhum) — caso do MESMO turno em nome dele.
    const deOutroHospital = (outrasEscalas || []).some((e) => {
      if (!e || e === escala) return false
      if (rodapeDoTurno(e.ordemLiberacao, turno).some(mesmo)) return true
      return (e.casos || []).some((d) =>
        turnoDoCaso(d) === turno &&
        ((uidCaso && d.anestesistaUserId === uidCaso) ||
          String(d.anestesista || '').split(/\s*\+\s*/).some((p) => mesmo(p))))
    })
    if (!deOutroHospital) continue // colega da casa: troca só os procedimentos
    out.push({ nome, turno })
  }
  return out
}

/**
 * ESCALADO PRESERVADO NO REPASSE (dono 19/08 — "a pessoa acaba os casos e
 * aparece liberado no meio da escala de liberações"): quem é do RODAPÉ e perde
 * o último caso do turno num repasse fica, aos olhos da fila, idêntico a quem
 * nunca foi escalado — e "não escalado" nasce Liberado. A pessoa trabalhou e a
 * liberação é MANUAL e NA ORDEM: devolve as linhas que precisam do marcador
 * `{ escalado: true }` (o MESMO que o toggle manual grava) para seguirem
 * ativas na própria posição. Quem já tem marcação (liberado de verdade, ou já
 * forçado escalado) fica como está. A chave segue a convenção das marcações:
 * uid do vínculo, senão nome normalizado DO RODAPÉ (não do caso — grafias
 * divergem, caso "GUILHERME M ELO" × rodapé "GUILHERME MELO").
 * @returns {Array<{chave:string, turno:string}>}
 */
export function escaladosPreservadosNoRepasse(casosAntes, casosDepois, ids, escala, opts = {}) {
  const { resolverUid } = opts
  const idSet = ids instanceof Set ? ids : new Set(ids || [])
  const out = []
  const vistos = new Set()
  const chaveNome = (s) => normNome(s).replace(/\s+/g, '')
  for (const c of casosAntes || []) {
    if (!idSet.has(c.id)) continue
    const nome = String(c.anestesista || '').trim()
    const n = chaveNome(nome)
    if (!n || nome === '//' || /^\?+$/.test(n) || nome.includes('+') || c.semAnestesista) continue
    const turno = turnoDoCaso(c)
    if (vistos.has(`${turno}|${n}`)) continue
    vistos.add(`${turno}|${n}`)
    const uidCaso = c.anestesistaUserId || resolverUid?.(nome) || null
    const mesmo = (r) => chaveNome(r) === n || (uidCaso != null && resolverUid?.(r) === uidCaso)
    const aindaTem = (casosDepois || []).some((d) => {
      if (turnoDoCaso(d) !== turno) return false
      if (uidCaso && d.anestesistaUserId === uidCaso) return true
      return String(d.anestesista || '').split(/\s*\+\s*/).some((p) => mesmo(p))
    })
    if (aindaTem) continue
    const noRodape = rodapeDoTurno(escala?.ordemLiberacao, turno).find(mesmo)
    if (noRodape === undefined) continue // fora do rodapé: é o caso do irmão acima (ajuda)
    const chave = resolverUid?.(stripNotaRodape(String(noRodape))) || uidCaso || normNome(noRodape)
    const lib = escala?.liberacoes || {}
    if (lib[`${turno}:${chave}`] !== undefined || lib[chave] !== undefined) continue
    out.push({ chave, turno })
  }
  return out
}

/**
 * Snapshot dos campos de anestesista dos casos — combustível do ROLLBACK da
 * troca. O rollback antigo re-derivava do uid do dono (`{ uid: de.uid }`) e,
 * com dono SEM vínculo (uid null), o service traduzia para `anestesista='?'` +
 * `sem_anestesista=true`: o rollback APAGAVA o anestesista em vez de
 * restaurá-lo (defeito 07/08). O snapshot devolve o que estava lá de fato,
 * inclusive o TEXTO original do caso (ex.: "STAUB", não o nome do roster).
 */
export function snapshotCasos(escala, casoIds = []) {
  const ids = new Set(casoIds || [])
  return (escala?.casos || [])
    .filter((c) => ids.has(c.id))
    .map((c) => ({
      id: c.id,
      anestesista: c.anestesista ?? null,
      anestesistaUserId: c.anestesistaUserId ?? null,
      semAnestesista: !!c.semAnestesista,
    }))
}

/**
 * Lê o override anterior de uma linha pela MESMA cadeia de fallback do
 * setLinhaOverride: chave namespaced → chave crua → nome legado (namespaced e
 * cru). Ler SÓ a chave namespaced criava uma SEGUNDA entrada ao declarar troca
 * sobre um override legado — e o local/observação da entrada antiga sumia da UI
 * (o overrideDe da view acha a scoped primeiro). Devolve também a
 * `chaveEncontrada` para o chamador limpar a entrada legada após migrar.
 */
export function lerOverrideAnterior(overrides, chave, turno, nomesLegados = []) {
  const lo = overrides || {}
  const scoped = turno ? `${turno}:${chave}` : chave
  const candidatos = [scoped, chave]
  for (const nome of (nomesLegados || []).filter(Boolean)) {
    if (nome === chave) continue
    if (turno) candidatos.push(`${turno}:${nome}`)
    candidatos.push(nome)
  }
  for (const k of candidatos) {
    if (lo[k] != null) return { valor: lo[k], chaveEncontrada: k, scoped }
  }
  return { valor: null, chaveEncontrada: null, scoped }
}

/**
 * ESPELHO DO TEMPO TOTAL (dono 30/07): quando a pessoa tem UMA só cirurgia ativa
 * no turno, o término da cirurgia É o horário de saída dela — deixar o término do
 * caso e o cronômetro da linha independentes gerava divergência (caso 18:30,
 * pílula 17:00) sem ninguém saber qual valia. Chamado ao gravar `terminoPrevisto`
 * no detalhe do caso; devolve `{ chave, nome, override }` prontos p/
 * `setLinhaOverride` — override COMPLETO porque gravar parcial apagaria
 * local/cirurgião/observação já ajustados — ou `null` quando o espelho não se
 * aplica: 2+ casos ativos (o total NUNCA é soma de estimativas), sala "A + B",
 * caso sem anestesista, pessoa envolvida em posição assumida (a identidade do
 * slot vive em OUTRA chave — escrever aqui iria para a linha errada) ou valor
 * já igual ao gravado.
 */
export function espelhoTempoTotal(escala, caso, terminoHHMM, { hospitalLabels } = {}) {
  const nomeBruto = String(caso?.anestesista || '').trim()
  if (!caso || caso.semAnestesista || !nomeBruto || nomeBruto === '//'
    || /^\?+$/.test(nomeBruto) || nomeBruto.includes('+')) return null
  const turno = turnoDoCaso(caso)
  // mesma resolução da fila: "//"/vazio herdam por sala DENTRO do turno
  const doTurno = resolverAnestesistas(filtrarPorTurno(escala?.casos || [], turno))
  // vínculo nome→uid pelos PRÓPRIOS casos (regra do uidLocalPorNome da lib:
  // nome que aponta p/ 2+ uids é ambíguo e fica de fora)
  const uidPorNome = new Map()
  {
    const ambiguos = new Set()
    for (const c of doTurno) {
      const uid = c.anestesistaUserId
      const n = normNome(c.anestesista)
      if (!uid || !n || /^\?+$/.test(n) || n.includes('+')) continue
      const atual = uidPorNome.get(n)
      if (atual && atual !== uid) ambiguos.add(n)
      else uidPorNome.set(n, uid)
    }
    for (const n of ambiguos) uidPorNome.delete(n)
  }
  const uid = caso.anestesistaUserId || uidPorNome.get(normNome(nomeBruto)) || null
  const chave = uid || normNome(nomeBruto)
  // posição assumida em qualquer direção → a chave da linha não é a desta pessoa.
  // As chaves do override são namespaced por turno ("matutino:uid") desde a
  // migração 20260805130000, e SÓ o turno DESTE caso interessa — assunção da
  // manhã não bloqueia o espelho da tarde. Comparar a chave CRUA aqui deixava o
  // guard morto (nunca casava) e, pior, a leitura do override lá embaixo voltava
  // vazia: definir o término APAGAVA local/observação da linha (defeito 07/08).
  for (const [k, ov] of Object.entries(escala?.linhaOverrides || {})) {
    const asm = ov?.assumidaPor
    if (!asm) continue
    const sep = k.indexOf(':')
    // chave sem prefixo é legado e vale como matutino (regra da migração)
    const [pref, resto] = sep >= 0 ? [k.slice(0, sep), k.slice(sep + 1)] : ['matutino', k]
    if (pref !== turno) continue
    if (resto === chave) return null // a posição desta pessoa foi assumida por outro
    if ((asm.uid && asm.uid === uid) || (asm.nome && normNome(asm.nome) === normNome(nomeBruto))) return null
  }
  const ativos = doTurno.filter((c) => {
    if (casoConcluido(c) || c.semAnestesista) return false
    const n = String(c.anestesista || '').trim()
    if (!n || /^\?+$/.test(n)) return false
    // sala compartilhada ("A + B") conta para os dois lados
    return n.split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean).some((parte, _i, todas) => {
      const u = (todas.length === 1 ? c.anestesistaUserId : null) || uidPorNome.get(normNome(parte)) || null
      return (u || normNome(parte)) === chave || (uid && u === uid)
    })
  })
  if (ativos.length !== 1) return null
  if (caso.id ? ativos[0].id !== caso.id : normNome(ativos[0].anestesista) !== normNome(nomeBruto)) return null
  // leitura pela MESMA cadeia do setLinhaOverride, turno primeiro: o override
  // vivo mora em `${turno}:${chave}` — ler só a chave crua devolvia null e o
  // override "completo" montado abaixo zerava local/cirurgiões/observação.
  const lo = escala?.linhaOverrides || {}
  const bruto = lo[`${turno}:${chave}`] ?? lo[chave]
    ?? lo[`${turno}:${normNome(nomeBruto)}`] ?? lo[normNome(nomeBruto)]
    ?? lo[nomeBruto]
  const ov = typeof bruto === 'string' ? { local: bruto } : bruto || null
  const termino = terminoHHMM || ''
  if ((ov?.termino || '') === termino) return null // nada a espelhar
  return {
    chave,
    nome: nomeBruto,
    override: {
      local: ov?.local || '',
      cirurgioes: ov?.cirurgioes || '',
      termino,
      observacao: observacaoDaLinha(ov, hospitalLabels),
    },
  }
}

/**
 * Estimativa de término de uma SALA: maior (hora início + tempoEstimado) entre
 * os casos ATIVOS (terminada/suspensa não contam). Sem hora+tempo não contribui.
 * @returns {{ estado:'encerrada' }|{ estado:'estimado', fimMin:number }|null}
 */
export function estimativaTerminoSala(casos, sala) {
  let total = 0
  let ativos = 0
  let fimMax = null
  for (const c of casos || []) {
    if (c.sala !== sala) continue
    total += 1
    if (casoConcluido(c)) continue
    ativos += 1
    const ini = parseHoraMinutos(c.hora)
    const dur = parseDuracaoMin(c.tempoEstimado)
    if (ini == null || dur == null) continue
    const fim = ini + dur
    if (fimMax == null || fim > fimMax) fimMax = fim
  }
  if (total > 0 && ativos === 0) return { estado: 'encerrada' }
  if (fimMax != null) return { estado: 'estimado', fimMin: fimMax }
  return null
}

/** Texto do cronômetro: diferença entre a estimativa e agora (minutos do dia). */
export function formatRestante(fimMin, agoraMin) {
  const diff = fimMin - agoraMin
  const abs = Math.abs(diff)
  const txt = abs >= 60 ? `${Math.floor(abs / 60)}h${String(abs % 60).padStart(2, '0')}` : `${abs}min`
  return diff >= 0 ? `termina em ~${txt}` : `há ${txt} além do previsto`
}

/**
 * Conflitos = mesmo login (anestesista_user_id) em 2 salas com a MESMA hora de
 * início. Uma janela fixa de 90 min gerava falso alerta para a sequência normal
 * do mesmo anestesista em procedimentos/horários diferentes. Sem duração
 * confiável de todos os casos, só o choque exato é objetivo; os demais ficam
 * para conferência humana. Casos sem hora/login/"?" são ignorados.
 * @returns {Array<{userId,nome,sala1,hora1,sala2,hora2}>}
 */
export function detectarConflitos(casos) {
  const eleg = (casos || [])
    .filter((c) => c.anestesistaUserId && !c.semAnestesista && parseHoraMinutos(c.hora) != null)
    .map((c) => ({ ...c, _min: parseHoraMinutos(c.hora) }))
  const out = new Map()
  for (let i = 0; i < eleg.length; i++) {
    for (let j = i + 1; j < eleg.length; j++) {
      const a = eleg[i], b = eleg[j]
      if (a.anestesistaUserId !== b.anestesistaUserId) continue
      if (a.sala === b.sala) continue
      if (a._min !== b._min) continue
      const chave = `${a.anestesistaUserId}|${[a.sala, b.sala].sort().join('|')}`
      if (!out.has(chave)) {
        out.set(chave, {
          userId: a.anestesistaUserId,
          nome: a.anestesista || b.anestesista || '',
          sala1: a.sala, hora1: a.hora, sala2: b.sala, hora2: b.hora,
        })
      }
    }
  }
  return [...out.values()]
}

/**
 * Valida uma troca de sala (uid_a sai de sala_a, uid_b sai de sala_b) — evita
 * o mesmo login em 2 salas no mesmo horário após o swap. Retorna erro (string) ou null.
 */
export function validarConflito(casos, salaA, uidA, salaB, uidB) {
  if (!uidA || !uidB) return 'Ambas as salas precisam de anestesista atribuído.'
  if (uidA === uidB) return 'Não é possível trocar consigo mesmo.'
  if (salaA === salaB) return 'Selecione salas diferentes.'

  const horas = (sala) => new Set((casos || []).filter((c) => c.sala === sala && c.hora).map((c) => c.hora))
  const hB = horas(salaB)
  const conflA = (casos || []).find(
    (c) => c.anestesistaUserId === uidA && c.sala !== salaA && c.sala !== salaB && hB.has(c.hora)
  )
  if (conflA) return `Você já está na sala ${conflA.sala} no mesmo horário da sala alvo.`
  const hA = horas(salaA)
  const conflB = (casos || []).find(
    (c) => c.anestesistaUserId === uidB && c.sala !== salaA && c.sala !== salaB && hA.has(c.hora)
  )
  if (conflB) return `O colega tem casos na sala ${conflB.sala} no mesmo horário da sua sala.`
  return null
}

/**
 * Alvos da troca de responsável (lição 23/07 — "Definir anestesista" sala-inteira
 * ACHATOU o IOSC p/ uma pessoa e dois anestesistas sumiram da escala):
 * modo SALA atinge só os casos NÃO terminados do responsável-BASE (o da sala,
 * incluindo linhas herdadas "//"/vazias); linha com anestesista PRÓPRIO fica de
 * fora — muda pelo detalhe do caso. modo CASO atinge só o caso.
 * @returns {{ alvos: Array, proprios: Array }}
 */
export function alvosTrocaResponsavel(casos, sala, casoUnico = null) {
  if (casoUnico) return { alvos: [casoUnico], proprios: [] }
  // Pedido do dono 24/07: o novo responsável assume TODOS os casos da sala, EXCETO
  // os já TERMINADOS (esses mantêm quem terminou). Sem exclusão por "anestesista
  // próprio" — salas multi-anestesista (IOSC/…) já vêm SPLIT por anestesista no
  // board, então o clique no cabeçalho usa casosAlvo scoped e não passa por aqui.
  const naoTerminado = (c) => (c.statusCirurgia || 'agendada') !== 'terminada'
  const alvos = (casos || []).filter((c) => c.sala === sala && naoTerminado(c))
  return { alvos, proprios: [] }
}

/**
 * TODAS as salas do hospital para escolher ao adicionar um caso (pedido do dono
 * 26/07): antes a lista trazia só as salas que já tinham caso no dia, então uma
 * sala que "abriu" na escala não existia no seletor.
 *
 * As salas EM USO vêm primeiro na deduplicação para a grafia delas vencer a
 * canônica ("SALA 2" da escala em vez de "Sala 2" da base) — grafia diferente
 * criaria uma sala separada no board em vez de juntar no grupo existente. É por
 * isso que a chave é `chaveSalaEscolha` e não o texto: numa escala do HRO
 * publicada antes de 20/08 a sala está gravada "Sala 4", e sem a equivalência o
 * seletor ofereceria "Sala 4" E "Bloco A - Sala 4" para a mesma sala.
 */
export function salasDoHospital(hospital, casos) {
  const emUso = [...agruparPorSala(casos || []).keys()]
  const vistos = new Set()
  const out = []
  for (const s of [...emUso, ...(LOCAIS_BASE[hospital] || [])]) {
    const nome = String(s || '').trim()
    if (!nome || nome === '—') continue
    const chave = chaveSalaEscolha(hospital, nome)
    if (vistos.has(chave)) continue
    vistos.add(chave)
    out.push(nome)
  }
  return out.sort(compararSalas(hospital))
}

/** Anestesista (login+apelido) que cobre uma sala, a partir dos casos. */
/**
 * Nome de exibição de um anestesista: o do CADASTRO quando a identidade resolve,
 * com o texto importado como fallback.
 *
 * FONTE ÚNICA (bug de 29/07): o cabeçalho da sala na Completa e o "Responsável
 * atual" do sheet de definir mostravam O MESMO FATO por dois caminhos — um pelo
 * cadastro (`rosterByUid`), outro pelo texto importado do caso — e divergiam
 * sempre que o texto da escala ≠ nome do cadastro, que é o caso NORMAL
 * ("STAUB" × "Guilherme Staub"). Quem lê vê duas pessoas onde há uma.
 *
 * @param {{uid?: string|null, alias?: string, rosterByUid?: Map}} args
 * @returns {string}
 */
export function nomeAnestesistaExibicao({ uid, alias, rosterByUid } = {}) {
  // "A + B" = sala dividida entre dois de propósito: só os primeiros nomes, e
  // não há um cadastro único a consultar.
  const partes = String(alias || '').split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean)
  if (partes.length > 1) return partes.map(primeiroNome).join(' + ')
  const r = uid && rosterByUid?.get(uid)
  return r?.nome ? nomeCirurgiaoCurto(r.nome) : titleCaseNome(alias)
}

export function anestesistaDaSala(casos, sala) {
  const c = (casos || []).find((x) => x.sala === sala && x.anestesistaUserId)
  return c ? { uid: c.anestesistaUserId, alias: c.anestesista || '' } : { uid: null, alias: '' }
}

/** Salas com anestesista atribuído (uid), únicas — p/ o seletor de troca. */
export function salasComAnestesista(casos) {
  const vistos = new Set()
  const out = []
  for (const c of casos || []) {
    if (c.anestesistaUserId && !vistos.has(c.sala)) { vistos.add(c.sala); out.push({ sala: c.sala, uid: c.anestesistaUserId, alias: c.anestesista || '' }) }
  }
  return out
}

/** Normaliza convênio p/ classificação (acento/caixa; NÃO usa normNome — não tem regra PED). */
const normConvenio = (s) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase()

/**
 * Família do convênio p/ identificação visual rápida no board.
 * "Unimed Regional" e "UNIMED CHAPECÓ" caem na mesma família; texto vazio → null.
 */
/**
 * Rótulo do convênio NO CARD (dono 17/08): tudo que começa com UNIMED aparece só
 * como "Unimed". "Unimed Chapecó - VD" e "Unimed Intercâmbio Estadual" comiam a
 * largura do selo e empurravam o nome do cirurgião para as reticências, e a
 * distinção entre eles não muda nada dentro da sala.
 * ⚠️ É SÓ EXIBIÇÃO: o texto original continua guardado no caso — a família do
 * convênio, o auto-import de cirurgia particular e a conferência dependem dele.
 */
export function convenioExibicao(convenio) {
  const s = normConvenio(convenio)
  if (!s) return ''
  if (/^UNIMED\b/.test(s)) return 'Unimed'
  // GRAFIA DOS OUTROS BADGES (dono 17/08): "PARTICULAR" vira "Particular", como
  // "Iniciada" e "Passa para tarde". `fraseClinica` é a mesma função que trata o
  // procedimento — preserva sigla curta (SUS, BRF, SC, FAS) e não mexe em texto
  // que já veio com minúsculas.
  return fraseClinica(String(convenio).trim())
}

/**
 * Idade NO CARD (dono 17/08): só os anos — "54a 1m 9d" vira "54a". Meses e dias
 * pesam na leitura sem mudar conduta, EXCETO em quem ainda não fez 1 ano, onde
 * são a informação clínica (dose, via aérea) — aí ficam, e o "0a" sai.
 * Formato que não reconheço volta inteiro: melhor um dado estranho na tela do
 * que uma idade inventada.
 */
export function idadeExibicao(idade) {
  const s = String(idade || '').trim()
  if (!s) return ''
  const m = s.match(/^(\d+)\s*a\b/i)
  if (!m) return s
  const anos = Number(m[1])
  if (anos >= 1) return `${anos}a`
  return s.replace(/^0\s*a\s*/i, '').trim() || s
}

export function familiaConvenio(convenio) {
  const s = normConvenio(convenio)
  if (!s) return null
  if (s.includes('INTERCAMB')) return 'intercambio' // antes de UNIMED: "Unimed Intercâmbio" é regime próprio
  if (s.startsWith('UNIMED')) return 'unimed'
  if (/^SUS\b/.test(s)) return 'sus'
  if (s.startsWith('BRF')) return 'brf'
  if (s.startsWith('FAS')) return 'fas'
  if (/^SC\b/.test(s)) return 'sc'
  if (s.startsWith('CASSI')) return 'cassi'
  // PURAMENTE particular: "Part", "PART.", "PARTICULAR..." — composto tipo
  // "PART/SC" é ambíguo (pagador misto, sem como definir qual paciente é
  // particular) e NÃO conta (regra do dono 2026-07-22). "PARTE..." não casa.
  // Espelho do fn_convenio_particular no banco (migration 20260722600000).
  if (/^PART(ICULAR)?[^A-Z]*$/.test(s)) return 'particular'
  return 'outro'
}

// Classes ESTÁTICAS por família — string dinâmica seria purgada pelo Tailwind JIT.
// Tokens category-* (cores não-semânticas, .claude/rules/design-tokens.md); verde/vermelho
// ficam de fora p/ não competir com os status success/warning/destructive do card.
// DARK: pedido do dono (2026-07-16) — badge de convênio uniforme no verde sólido do
// badge success (identificação por cor fica na stripe da borda esquerda).
const BADGE_DARK_VERDE = 'dark:bg-[hsl(var(--badge-success))] dark:text-[hsl(var(--badge-success-foreground))]'
const CONVENIO_CORES = {
  unimed: { stripe: 'border-l-category-teal', badge: `bg-category-teal-bg text-category-teal-fg ${BADGE_DARK_VERDE}` },
  sus: { stripe: 'border-l-category-blue', badge: `bg-category-blue-bg text-category-blue-fg ${BADGE_DARK_VERDE}` },
  particular: { stripe: 'border-l-category-purple', badge: `bg-category-purple-bg text-category-purple-fg ${BADGE_DARK_VERDE}` },
  brf: { stripe: 'border-l-category-orange', badge: `bg-category-orange-bg text-category-orange-fg ${BADGE_DARK_VERDE}` },
  fas: { stripe: 'border-l-category-indigo', badge: `bg-category-indigo-bg text-category-indigo-fg ${BADGE_DARK_VERDE}` },
  sc: { stripe: 'border-l-category-cyan', badge: `bg-category-cyan-bg text-category-cyan-fg ${BADGE_DARK_VERDE}` },
  intercambio: { stripe: 'border-l-category-pink', badge: `bg-category-pink-bg text-category-pink-fg ${BADGE_DARK_VERDE}` },
  // category-red só tem -bg/-fg; o stripe usa o -fg. Vermelho na lateral não compete
  // com status (que é FUNDO amarelo/verde) nem com liberado (outra aba).
  cassi: { stripe: 'border-l-category-red-fg', badge: `bg-category-red-bg text-category-red-fg ${BADGE_DARK_VERDE}` },
  outro: { stripe: 'border-l-border-strong', badge: `border border-border bg-muted/40 text-muted-foreground ${BADGE_DARK_VERDE} dark:border-transparent` },
}

/** Stripe (borda esquerda) + badge do convênio; null se o caso não tem convênio. */
export function corConvenio(convenio) {
  const familia = familiaConvenio(convenio)
  return familia ? { familia, ...CONVENIO_CORES[familia] } : null
}

/** Badge do tipo do caso — ambos em tons de VERMELHO (pedido do dono 2026-07-21):
 *  urgência = vermelho suave (subtle); emergência = vermelho cheio (solid). */
export const tipoBadge = (tipo) =>
  tipo === 'emergencia'
    ? { variant: 'destructive', style: 'solid', label: 'Emergência' }
    : tipo === 'urgencia'
    ? { variant: 'destructive', style: 'subtle', label: 'Urgência' }
    : null

// ── TROCA DECLARADA (dono 30/07) — par declarado + execução de um toque ──────
// A troca antiga (salas/casos livres) foi REMOVIDA duas vezes; isto é outra
// coisa: um PAR de pessoas declarado no dia, badge nos dois lados e, na
// execução, cada uma herda a POSIÇÃO (slot do rodapé, via assumidaPor no
// override — a ordem_liberacao NUNCA é escrita) e os CASOS não-terminados da
// outra no hospital dela. Swap SIMULTÂNEO por decisão do dono (30/07): executar
// de um lado executa o outro junto.

/** Uma pessoa "casa" com um nome de rodapé/caso? (uid do dicionário > nome). */
const pessoaCasaNome = (pessoa, nome, resolverUid, uidLocal) => {
  const n = normNome(nome)
  if (!n) return false
  if (pessoa.uid && resolverUid?.(nome) === pessoa.uid) return true
  if (pessoa.uid && uidLocal?.(n) === pessoa.uid) return true
  return n === normNome(pessoa.nome)
}

/** nome→uid ensinado pelos PRÓPRIOS casos da escala (espelho de uidLocalPorNome da lib). */
const uidLocalDe = (esc) => {
  const mapa = new Map()
  const ambiguos = new Set()
  for (const c of casosResolvidos(esc)) {
    const n = normNome(c.anestesista)
    if (!c.anestesistaUserId || !n || /^\?+$/.test(n) || n.includes('+')) continue
    const atual = mapa.get(n)
    if (atual && atual !== c.anestesistaUserId) ambiguos.add(n)
    else mapa.set(n, c.anestesistaUserId)
  }
  for (const n of ambiguos) mapa.delete(n)
  return (n) => mapa.get(n) || null
}

/** Slot de uma pessoa no rodapé da escala (qualquer turno) — { nome, chave } | null. */
export function localizarSlotRodape(esc, pessoa, resolverUid, turnoSelecionado = null) {
  const uidLocal = uidLocalDe(esc)
  // TURNOS INDEPENDENTES (dono 13/08): manhã e tarde são escalas separadas, com
  // gente e configuração próprias — o app NUNCA cruza uma com a outra. Antes o
  // turno era só preferência de busca e caía no outro quando não achava (D4,
  // 07/08); na prática isso trazia para a tela da tarde a posição que a pessoa
  // tinha de manhã, pedia decisão sobre ela e podia mover casos de um turno que
  // ninguém estava mexendo (Staub e Karine, 13/08). Turno informado = único
  // turno olhado. Sem turno (chamada legada) segue varrendo os dois.
  const turnos = turnoSelecionado ? [turnoSelecionado] : ['matutino', 'vespertino']
  for (const turno of turnos) {
    for (const nome of rodapeDoTurno(esc?.ordemLiberacao, turno)) {
      if (pessoaCasaNome(pessoa, nome, resolverUid, uidLocal)) {
        // chave de ESCRITA do override: uid do dicionário > nome normalizado.
        // NÃO usa o uid ensinado pelos casos: após a transferência os casos param
        // de ensinar o nome antigo e a chave derivada mudaria — a lib lê com
        // fallback por norm(nome), que é estável.
        return { nome, chave: resolverUid?.(nome) || normNome(nome), turno }
      }
    }
  }
  return null
}

/**
 * Onde a pessoa ESTÁ nesta escala: a posição no rodapé ou, na falta dela, as
 * CIRURGIAS dela no turno.
 *
 * O Materno é publicado sem rodapé nenhum (13/08: `ordem_liberacao` vazia nos
 * dois turnos em 17 de 17 escalas) — quem trabalha lá só existe nos casos. Como
 * a troca era ancorada apenas no rodapé, o colega do Materno caía em "não tem
 * posição em jogo" e o swap saía pela metade: a vaga do hospital mudava de dono
 * e as cirurgias do Materno seguiam no nome de quem tinha saído, para arrumar à
 * mão uma a uma. Vale igual para quem tem cirurgia num hospital sem estar no
 * rodapé dele.
 *
 * `semPosicao: true` diz que o slot NÃO veio do rodapé: não há fila para herdar,
 * só as cirurgias — quem exibe precisa falar isso, e `ordem_liberacao` continua
 * intocada nos dois caminhos.
 *
 * @returns {{ nome, chave, turno, semPosicao }|null}
 */
export function localizarSlotEscala(esc, pessoa, resolverUid, turnoSelecionado = null) {
  const noRodape = localizarSlotRodape(esc, pessoa, resolverUid, turnoSelecionado)
  if (noRodape) return { ...noRodape, semPosicao: false }
  const uidLocal = uidLocalDe(esc)
  // mesmo contrato do rodapé: turno informado é o ÚNICO turno olhado
  const turnos = turnoSelecionado ? [turnoSelecionado] : ['matutino', 'vespertino']
  for (const turno of turnos) {
    // só vira lado da troca quando há o que MOVER: quem tem lá apenas cirurgia
    // encerrada ou sala compartilhada não muda de mãos e continua "sem slot"
    if (!casosTransferiveis(esc, pessoa, resolverUid, turno).length) continue
    const meu = filtrarPorTurno(casosResolvidos(esc), turno).find(
      (c) => !c.semAnestesista && pessoaCasaNome(pessoa, c.anestesista, resolverUid, uidLocal)
    )
    if (!meu) continue
    const nome = String(meu.anestesista || '').trim()
    return { nome, chave: resolverUid?.(nome) || pessoa.uid || normNome(nome), turno, semPosicao: true }
  }
  return null
}

/** Ids dos casos TRANSFERÍVEIS de uma pessoa na escala: não-terminados e sem
 *  sala compartilhada ("A + B" levaria o caso inteiro e apagaria o colega).
 *  `turno` (opcional) recorta pelo MESMO critério da exibição: é o que sustenta
 *  a presença por casos (Materno), onde manhã e tarde são pessoas diferentes. */
export function casosTransferiveis(esc, pessoa, resolverUid, turno = null) {
  const uidLocal = uidLocalDe(esc)
  return filtrarPorTurno(casosResolvidos(esc), turno)
    .filter((c) => {
      if (!c.id || c.semAnestesista) return false
      if ((c.statusCirurgia || 'agendada') === 'terminada') return false
      const nome = String(c.anestesista || '').trim()
      if (!nome || nome === '//' || nome.includes('+') || /^\?+$/.test(nome)) return false
      if (c.anestesistaUserId) return c.anestesistaUserId === pessoa.uid
      return pessoaCasaNome(pessoa, nome, resolverUid, uidLocal)
    })
    .map((c) => c.id)
}

/**
 * Plano do swap SIMULTÂNEO da troca declarada: para cada hospital onde um dos
 * dois ocupa slot no rodapé, o OUTRO assume (assumidaPor) e herda os casos
 * transferíveis. Também lista onde limpar o `trocaCom` (o badge some após a
 * execução — decisão do dono 30/07).
 *
 * @param {object} args { escalas: {unimed,hro,materno}, resolverUid, a, b }
 *   a/b = { uid, nome, apelido } (roster). Puro: nada é escrito aqui.
 *   turno = O TURNO, e só ele (dono 13/08: "cada turno tem configurações
 *   diferentes, não vincule o turno da manhã com o da tarde"). Manhã e tarde são
 *   escalas independentes: nenhum lado, caso ou limpeza atravessa a fronteira.
 *   escalaAncora = id da escala DE ONDE a troca foi aberta. `a` entra só com a
 *   posição dela ali — é aquela que está sendo trocada. Sem a âncora, quem
 *   aparece em dois hospitais no mesmo turno arrastava o outro para o sheet:
 *   registrando a troca da Karine no MATERNO surgia um cartão do HRO, onde ela
 *   está no rodapé e tem uma linha de sala "Materno" (a mesma jornada anotada
 *   nos dois quadros) — dono 13/08: "aparece opção no HRO sem que ela esteja lá".
 *   Mesmo princípio que `planoExecucaoDeclarada` já usava para a duplicidade.
 * @returns {{ lados: Array, limparTroca: Array, pendencias: Array }}
 *   pendencias = o que impede o swap de fechar ({ pessoa, motivo:
 *   'sem_slot' | 'sem_uid' }) — o chamador mostra o que falta em vez de
 *   executar meio swap calado.
 */
export function planoExecucaoTroca({ escalas, resolverUid, a, b, turno = null, escalaAncora = null }) {
  const lados = []
  const limparTroca = []
  const comSlot = new Set()
  for (const [hospital, esc] of Object.entries(escalas || {})) {
    if (!esc?.id) continue
    // `a` só na escala de onde a troca foi aberta; `b` onde estiver
    const pares = escalaAncora && esc.id !== escalaAncora ? [[b, a]] : [[a, b], [b, a]]
    for (const [de, para] of pares) {
      const slot = localizarSlotEscala(esc, de, resolverUid, turno)
      if (!slot) continue
      comSlot.add(de)
      lados.push({
        hospital, escalaId: esc.id,
        chaveSlot: slot.chave, nomeSlot: slot.nome,
        // slot achado pelos CASOS (Materno e afins): não há posição na fila para
        // herdar — o lado move só as cirurgias, e o sheet precisa dizer isso.
        ...(slot.semPosicao && { semPosicao: true }),
        de: { uid: de.uid || null, nome: de.nome, apelido: de.apelido || slot.nome },
        para: { uid: para.uid || null, nome: para.nome, apelido: para.apelido },
        // sem uid de quem assume não há como transferir caso (o service escreveria
        // "?"): o lado vale só pela POSIÇÃO; os casos se ajustam pelo Definir.
        ...(slot.turno ? { turno: slot.turno } : (turno ? { turno } : {})),
        // CADA LADO LEVA SÓ OS CASOS DO PRÓPRIO TURNO (incidente 13/08): a
        // Karine trocou a TARDE e o cartão do HRO contava 2 casos — um deles era
        // o Exames das 7h30, de outro turno, que teria mudado de dono na execução.
        casoIds: para.uid ? casosTransferiveis(esc, de, resolverUid, slot.turno || turno || null) : [],
      })
    }
    const uidLocal = uidLocalDe(esc)
    const ehDoPar = (ref, pessoa) => {
      if (!ref) return false
      if (typeof ref === 'string') return ref === pessoa.uid || pessoaCasaNome(pessoa, ref, resolverUid, uidLocal)
      return ref.uid ? ref.uid === pessoa.uid : pessoaCasaNome(pessoa, ref.nome, resolverUid, uidLocal)
    }
    for (const [rawChave, ov] of Object.entries(esc.linhaOverrides || {})) {
      const sep = String(rawChave).indexOf(':')
      const [turnoChave, chave] = sep >= 0
        ? [String(rawChave).slice(0, sep), String(rawChave).slice(sep + 1)]
        : [null, rawChave]
      if (turnoChave && turnoChave !== 'matutino' && turnoChave !== 'vespertino') continue
      // TURNOS INDEPENDENTES: executar a troca da tarde não apaga a declaração
      // da manhã (chave crua legada é matutina pela regra da migração)
      if (turno && (turnoChave || 'matutino') !== turno) continue
      const t = ov?.trocaCom
      if (!t) continue
      const parAB = ehDoPar(chave, a) && ehDoPar(t, b)
      const parBA = ehDoPar(chave, b) && ehDoPar(t, a)
      if (parAB || parBA) {
        // o turno da limpeza é o DA CHAVE achada (chave crua legada fica crua:
        // anexar o turno da tela faria a limpeza mirar uma entrada inexistente)
        limparTroca.push({ hospital, escalaId: esc.id, chave, ...(turnoChave ? { turno: turnoChave } : {}) })
      }
    }
  }
  const pendencias = []
  for (const pessoa of [a, b]) {
    if (!comSlot.has(pessoa)) pendencias.push({ pessoa, motivo: 'sem_slot' })
    else if (!pessoa.uid) pendencias.push({ pessoa, motivo: 'sem_uid' })
  }
  return { lados, limparTroca, pendencias }
}

/**
 * O anestesista deste caso sou eu? (Minhas escalas / destaque "meu" na Completa)
 *
 * DUPLA na mesma cirurgia (dono 11/08): "RAQUEL + GABRIELA" é caso das DUAS e
 * não cabe num uid — comparar o texto inteiro deixava a cirurgia fora da aba
 * Minhas das duas. Caso normal segue pelo uid do vínculo, que é a identidade
 * forte; o apelido só entra quando não há uid (demo/legado) ou quando é dupla.
 *
 * @param {object} caso  { anestesista, anestesistaUserId }
 * @param {object} eu    { uid, alias } — alias = apelido/1º nome do usuário
 */
export function anestesistaDoCasoEh(caso, { uid = null, alias = '' } = {}) {
  const partes = String(caso?.anestesista || '').split(/\s*\+\s*/).map(normNome).filter(Boolean)
  const dupla = partes.length > 1
  if (caso?.anestesistaUserId && !dupla) return !!uid && caso.anestesistaUserId === uid
  const eu = normNome(alias)
  return !!eu && partes.includes(eu)
}

/**
 * Candidatos do roster para um PRIMEIRO NOME sozinho — o detector de nome
 * ambíguo da conferência (dono 11/08).
 *
 * Em 11/08 a sala CO - Cesárea da Unimed foi publicada com o anestesista
 * escrito só "JOAO", e o rodapé daquele dia tinha JOAO HENRIQUE e JOAO RICARDO.
 * O dicionário não resolve primeiro nome com dois donos (é a regra: perguntar,
 * nunca chutar), então os 3 casos ficaram órfãos: viraram uma linha "Joao —
 * Fora do rodapé" e o João que era o dono nasceu liberado por aparecer sem
 * cirurgia. Publicar assim não pode passar em silêncio.
 *
 * Só considera nome de UM token: "JOAO RICARDO" já discrimina, e sobrenome
 * sozinho ("GARIM") é resolvido pelo dicionário como qualquer apelido.
 *
 * @param {string} nome  texto do anestesista como veio da importação
 * @param {Array} roster [{ uid, nome, apelidos }]
 * @returns {Array} pessoas do roster que atendem por esse primeiro nome
 */
export function candidatosPrimeiroNome(nome, roster = []) {
  const alvo = normNome(nome)
  if (!alvo || alvo === '//' || alvo.includes(' ') || alvo.includes('+') || /^\?+$/.test(alvo)) return []
  return (roster || []).filter((p) => {
    const nomes = [p?.nome, ...(p?.apelidos || [])].map(normNome).filter(Boolean)
    return nomes.some((n) => n === alvo || n.startsWith(`${alvo} `))
  })
}

/**
 * Rodapé da conferência linha a linha, na ORDEM em que foi lido (dono 11/08:
 * "difícil de analisar").
 *
 * O rodapé é conferido POSIÇÃO POR POSIÇÃO contra a foto, e cada posição tem
 * três perguntas: quem é, que papel a posição carrega (1º = plantonista, último
 * = plantão do turno seguinte, sai 1º) e se essa pessoa tem cirurgia no lote.
 * Nome do rodapé com ZERO casos é o sinal de que a extração jogou a linha dele
 * para outra pessoa — foi assim que Didomenico e Melo sumiram do IOSC em 23/07.
 *
 * A dupla ("A + B", mesma cirurgia) conta para as DUAS: a cirurgia é das duas,
 * e sem isso a colega apareceria como nome sem caso.
 *
 * @param {string[]} nomes  ordem do rodapé, como está no campo
 * @param {Array} casos     casos do lote em conferência
 * @param {Function} resolverUid  apelido → uid do vínculo (pode devolver null)
 * @param {string[]} ajuda  nomes marcados como ajuda de outro hospital
 * @returns [{ nome, i, papel, casos, ajuda }]
 */
export function resumirRodape(nomes, casos, resolverUid = null, ajuda = []) {
  const conta = new Map()
  const somar = (chave) => { if (chave) conta.set(chave, (conta.get(chave) || 0) + 1) }
  for (const c of casos || []) {
    const bruto = String(c?.anestesista || '').trim()
    if (!bruto || bruto === '//' || /^\?+$/.test(bruto)) continue
    const partes = bruto.split('+').map((p) => p.trim()).filter(Boolean)
    for (const parte of partes) {
      const uid = partes.length === 1 ? (c?.anestesistaUserId || resolverUid?.(parte)) : resolverUid?.(parte)
      somar(uid || normNome(parte))
    }
  }
  const naAjuda = new Set((ajuda || []).map(normNome).filter(Boolean))
  const total = (nomes || []).length
  return (nomes || []).map((nome, i) => {
    const uid = resolverUid?.(nome)
    return {
      nome,
      i,
      papel: i === 0 ? 'plantonista' : (i === total - 1 && total > 1 ? 'sai 1º' : null),
      casos: (uid ? conta.get(uid) : 0) || conta.get(normNome(nome)) || 0,
      ajuda: naAjuda.has(normNome(nome)),
    }
  })
}

/**
 * Pares de troca DECLARADOS (trocaCom vivo) nas escalas carregadas — insumo da
 * convergência da importação (Fase 2): publicar uma escala varre os pares
 * declarados e EXECUTA os que agora fecham (o parceiro que faltava chegou, ou a
 * republicação apagou a execução e ela precisa voltar). Puro; a idempotência da
 * execução (D10) torna o replay barato e seguro.
 * @returns [{ hospital, escalaId, turno, chave, b: { uid, nome }, tipo, motivo }]
 */
export function paresDeclarados(escalas) {
  const out = []
  for (const [hospital, esc] of Object.entries(escalas || {})) {
    if (!esc?.id) continue
    for (const [rawChave, ov] of Object.entries(esc.linhaOverrides || {})) {
      const t = ov?.trocaCom
      if (!t || (!t.uid && !t.nome)) continue
      // REGISTRO de troca já refletida na escala publicada (dono 10/08): é
      // rastro, não pendência. Executá-lo na convergência moveria os dois e
      // DESFARIA a troca real — o caso Rafael⇄Garim de 10/08.
      if (t.apenasRegistro) continue
      const sep = String(rawChave).indexOf(':')
      const [turnoChave, chave] = sep >= 0
        ? [String(rawChave).slice(0, sep), String(rawChave).slice(sep + 1)]
        : [null, rawChave]
      if (turnoChave && turnoChave !== 'matutino' && turnoChave !== 'vespertino') continue
      out.push({
        hospital, escalaId: esc.id, turno: turnoChave, chave,
        b: { uid: t.uid || null, nome: t.nome || '' },
        tipo: t.tipo || null, motivo: t.motivo || null,
      })
    }
  }
  return out
}

/**
 * Plano de execução ANCORADO numa declaração (convergência da importação,
 * Fase 2). Difere do planoExecucaoTroca (que varre TODOS os slots do par nos 3
 * hospitais — correto para o ✏️, onde ninguém está duplicado): aqui a âncora é
 * o slot DECLARANTE. No caso canônico da duplicidade (Didomenico nos DOIS
 * hospitais, "trocou com Paulo"), o varre-tudo também trocaria a posição onde
 * ele VAI FICAR — errado. O certo: a vaga duplicada AQUI vai para o parceiro;
 * o recíproco é só a vaga do PARCEIRO no hospital dele (quando existe).
 * Puro; nada é escrito aqui.
 */
export function planoExecucaoDeclarada({ escalas, resolverUid, par, a, b }) {
  const lados = []
  const pendencias = []
  const escA = Object.values(escalas || {}).find((e) => e?.id === par.escalaId)
  const slotA = escA ? localizarSlotRodape(escA, a, resolverUid, par.turno) : null
  if (!slotA) {
    pendencias.push({ pessoa: a, motivo: 'sem_slot' })
  } else {
    lados.push({
      hospital: par.hospital, escalaId: par.escalaId,
      chaveSlot: slotA.chave, nomeSlot: slotA.nome,
      ...(slotA.turno ? { turno: slotA.turno } : {}),
      de: { uid: a.uid || null, nome: a.nome, apelido: a.apelido || slotA.nome },
      para: { uid: b.uid || null, nome: b.nome, apelido: b.apelido },
      // só os casos DAQUELE turno (13/08) — o outro turno nunca esteve em jogo
      casoIds: b.uid ? casosTransferiveis(escA, a, resolverUid, slotA.turno || par.turno || null) : [],
    })
  }
  // recíproco: a vaga do PARCEIRO no hospital dele (fora da escala declarante) —
  // ou, onde não há rodapé publicado (Materno), as cirurgias dele naquele turno.
  // Sem nada em lugar nenhum = assunção unilateral (colega de fora) — não é pendência.
  for (const [hospital, esc] of Object.entries(escalas || {})) {
    if (!esc?.id || esc.id === par.escalaId) continue
    const slotB = localizarSlotEscala(esc, b, resolverUid, par.turno)
    if (!slotB) continue
    lados.push({
      hospital, escalaId: esc.id,
      chaveSlot: slotB.chave, nomeSlot: slotB.nome,
      ...(slotB.semPosicao && { semPosicao: true }),
      ...(slotB.turno ? { turno: slotB.turno } : {}),
      de: { uid: b.uid || null, nome: b.nome, apelido: b.apelido || slotB.nome },
      para: { uid: a.uid || null, nome: a.nome, apelido: a.apelido },
      casoIds: a.uid ? casosTransferiveis(esc, b, resolverUid, slotB.turno || par.turno || null) : [],
    })
    break
  }
  if (!b.uid) pendencias.push({ pessoa: b, motivo: 'sem_uid' })
  return { lados, pendencias }
}

/**
 * Extrai do histórico de eventos o rastro de SWAPS EXECUTADOS (defeito D1,
 * 07/08). O histórico é AMBÍGUO no eixo de DECLARAÇÃO: executar a troca limpa
 * o `trocaCom` e o trigger registra `troca_desfeita` — igualzinho à desistência
 * do usuário. Derivar par de `troca_declarada`/`troca_desfeita` ressuscitava
 * badge de troca desfeita e oferecia "Executar" de novo, sem saída na UI.
 *
 * Regra: par histórico SÓ nasce de `posicao_assumida` — um swap que aconteceu
 * de fato. O rastro sobrevive ao desfazer e à republicação (intenção do commit
 * 6e99f68: caso encerrado não perde quem o executou), mas é EXIBIÇÃO/telemetria
 * — quem consome marca `historica: true` e nunca oferece ação por ele.
 *
 * @param eventos [{ anestesista: 'turno:chave'|chave, statusPara, detalhe, em }] — já em ordem `em desc`
 * @param turno   'matutino' | 'vespertino' — eventos sem prefixo são matutinos (regra da migração)
 * @returns [{ chave, detalhe }] — no máximo um por chave (o mais recente)
 */
export function estadoTrocasDoHistorico(eventos, turno) {
  const porChave = new Map() // chave nua -> detalhe (1º visto ganha: lista vem desc)
  for (const evento of eventos || []) {
    if (evento?.statusPara !== 'posicao_assumida') continue
    const raw = String(evento.anestesista || '')
    const sep = raw.indexOf(':')
    const [turnoEvento, chave] = sep >= 0
      ? [raw.slice(0, sep), raw.slice(sep + 1)]
      : ['matutino', raw]
    if (turnoEvento !== turno || !chave) continue
    const detalhe = evento.detalhe || {}
    if (!detalhe.uid && !detalhe.nome) continue
    if (!porChave.has(chave)) porChave.set(chave, detalhe)
  }
  return [...porChave.entries()].map(([chave, detalhe]) => ({ chave, detalhe }))
}

/**
 * Plano de DESFAZER a substituição (caminho de erro humano): acha todos os
 * slots com `assumidaPor` envolvendo o par e devolve, por lado, os casos que
 * voltam ao dono original do slot. Dono sem uid resolvível → só limpa o
 * assumidaPor (o chamador avisa que os casos ficam e se ajustam pelo Definir
 * anestesista). O `trocaCom` NÃO é restaurado — se a troca continua de pé,
 * declara-se de novo.
 *
 * SEM parâmetro `turno` (desde o D4, 07/08): o turno de cada lado sai do
 * PREFIXO da chave onde a assunção foi encontrada. Filtrar pelo turno da tela
 * deixava metade de um par manhã↔tarde por desfazer, em silêncio.
 */
/**
 * Casos que o DESFAZER devolve ao dono do slot (incidente 10/08).
 *
 * Antes devolvia TODOS os casos abertos de quem assumiu naquele hospital — sem
 * saber o que a execução tinha de fato movido e sem olhar turno. Numa assunção
 * que não trouxe caso nenhum (posição da manhã, casos da tarde intactos), o
 * desfazer ENTREGOU os casos da tarde da pessoa ao colega: a Raquel perdeu as 3
 * cirurgias da tarde na Unimed e a Nathalia a das 13h no HRO, e as duas viraram
 * "sem casos" no próprio rodapé — a fila inteira do vespertino embaralhou.
 *
 * Agora a execução carimba `assumidaPor.casoIds` (jsonb, sem migration) e o
 * desfazer devolve SÓ esses, e só os que ainda estão com quem assumiu (caso
 * repassado depois no Definir anestesista não volta para o lugar errado).
 * Registro antigo, sem `casoIds`: mantém o comportamento de varrer os casos do
 * assumente, mas LIMITADO AO TURNO do slot — o outro turno nunca foi parte da
 * troca.
 */
function casosParaDevolver(esc, asm, assumidor, resolverUid, turnoChave) {
  const abertos = new Set(casosTransferiveis(esc, assumidor, resolverUid))
  if (Array.isArray(asm?.casoIds)) return asm.casoIds.filter((id) => abertos.has(id))
  if (!turnoChave) return [...abertos]
  const doTurno = new Set(
    casosResolvidos(esc).filter((c) => (c.turno || 'matutino') === turnoChave).map((c) => c.id),
  )
  return [...abertos].filter((id) => doTurno.has(id))
}

/**
 * Onde REMOVER a troca declarada/registrada.
 *
 * ⚠️ A declaração mora em UMA linha só — a de quem declarou — e o badge sai nos
 * DOIS lados (e atravessa hospitais). Desfazer pela linha do COLEGA mandava a
 * limpeza para a chave DELE, que nunca teve `trocaCom`: a escrita ia para o
 * lugar errado, o toast dizia "Troca desfeita" e os dois cards continuavam com o
 * badge (dono 18/08: "após desfazer a troca ela está persistindo"). Quem sabe o
 * endereço é o PAR (escalaId + chave), nunca a linha que está na tela.
 *
 * @returns {{ escala, chave }|null} null = sem par conhecido (o chamador cai no
 *   caminho antigo, pela linha da tela)
 */
export function alvoRemocaoTroca(escalas, par) {
  if (!par?.escalaId || !par?.chave) return null
  const escala = Object.values(escalas || {}).find((e) => e?.id === par.escalaId)
  return escala ? { escala, chave: par.chave } : null
}

export function planoDesfazerTroca({ escalas, resolverUid, a, b, turno = null }) {
  const lados = []
  for (const [hospital, esc] of Object.entries(escalas || {})) {
    if (!esc?.id) continue
    const uidLocal = uidLocalDe(esc)
    for (const [rawChave, ov] of Object.entries(esc.linhaOverrides || {})) {
      const sep = String(rawChave).indexOf(':')
      const [turnoChave, chave] = sep >= 0
        ? [String(rawChave).slice(0, sep), String(rawChave).slice(sep + 1)]
        : [null, rawChave]
      if (turnoChave && turnoChave !== 'matutino' && turnoChave !== 'vespertino') continue
      // TURNOS INDEPENDENTES (dono 13/08): desfazer a troca da tarde não desfaz
      // a da manhã do mesmo par — cada turno tem a sua. Chave crua legada conta
      // como matutina (regra da migração).
      if (turno && (turnoChave || 'matutino') !== turno) continue
      const asm = ov?.assumidaPor
      if (!asm) continue
      const assumidor = [a, b].find((p) => (asm.uid ? asm.uid === p.uid : pessoaCasaNome(p, asm.nome, resolverUid, uidLocal)))
      if (!assumidor) continue
      // dono original do slot = a OUTRA pessoa do par (o slot é dela)
      const dono = assumidor === a ? b : a
      // ⚠️ …a MENOS que o recibo diga outra coisa (18/08). Deduzir o dono só
      // pelo par corrompia quem assumiu DUAS posições no mesmo turno (dois
      // hospitais): desfazer uma troca varria também a outra vaga e a devolvia
      // para a pessoa errada, com as cirurgias dela junto. `assumidaPor.de` é
      // gravado na execução; registro antigo (sem `de`) segue pela dedução.
      if (asm.de && !(asm.de.uid ? asm.de.uid === dono.uid : pessoaCasaNome(dono, asm.de.nome, resolverUid, uidLocal))) continue
      lados.push({
        // chave crua legada fica crua (anexar o turno da tela miraria uma
        // entrada namespaced que não existe)
        hospital, escalaId: esc.id, chaveSlot: chave, ...(turnoChave ? { turno: turnoChave } : {}),
        de: { uid: assumidor.uid, nome: assumidor.nome, apelido: assumidor.apelido },
        para: dono.uid ? { uid: dono.uid, nome: dono.nome, apelido: dono.apelido } : null,
        casoIds: dono.uid ? casosParaDevolver(esc, asm, assumidor, resolverUid, turnoChave) : [],
      })
    }
  }
  return { lados }
}
