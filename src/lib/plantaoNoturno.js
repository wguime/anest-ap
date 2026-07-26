/**
 * Fase noturna da aba Liberações (regras do dono 2026-07-22/23/24):
 *
 * SEG–SEX (FERIADO INCLUÍDO — decisão c), válido só para a escala de HOJE:
 *   - 19h–23h ('noite'): cada plantonista noturno vira um CARD da lista, com
 *     selo P1–P4 antes do nome, e a lista VESPERTINA segue abaixo. Ordem por
 *     hospital (pedido do dono 24/07):
 *       HRO     → P1 (plantonista) → P4 → resto da vespertina
 *       Unimed  → P2 (plantonista) → P3 → P4 → resto da vespertina
 *       Materno → P4 (plantonista)
 *   - ≥23h ('zerada'): a lista do dia ZERA e ficam SÓ os plantonistas P1–P4
 *     do hospital (pedido do dono 24/07 — antes o corte era 22h e a tela
 *     ficava vazia; agora os plantões seguem visíveis a noite toda).
 * FDS ou outra data: sempre 'dia' (sem transição).
 *
 * P4 é CORINGA: SEM marcação aparece nos TRÊS hospitais; marcado (tabela
 * escala_plantao_p4_diario, compartilhada em realtime), aparece só no hospital
 * marcado e some dos outros.
 *
 * Fonte dos P1–P4: card Plantões da Home (useEscalaDia/PegaPlantao) — itens
 * { setor: 'P1'..'P4', nome, hora }. Tudo DERIVADO do relógio: nenhuma escrita
 * no banco (reescrever o rodapé automaticamente foi a causa da corrupção 22/07).
 */

export const INICIO_NOTURNO_MIN = 19 * 60
export const ZERA_LIBERACOES_MIN = 23 * 60

/**
 * Dia útil (seg–sex). FERIADO em dia de semana SEGUE a regra — o plantão P1–P4
 * roda igual; só sábado e domingo ficam de fora (serão estruturados depois).
 */
export function ehDiaUtil(dataIso) {
  if (!dataIso) return false
  const wd = new Date(`${dataIso}T12:00:00`).getDay()
  return wd !== 0 && wd !== 6
}

/** Fase da lista: 'dia' | 'noite' | 'zerada'. */
export function faseLiberacoes({ agoraMin, dataEscala, hojeIso }) {
  if (!dataEscala || dataEscala !== hojeIso) return 'dia'
  if (!ehDiaUtil(dataEscala)) return 'dia' // FDS sem transição
  if (agoraMin >= ZERA_LIBERACOES_MIN) return 'zerada'
  if (agoraMin >= INICIO_NOTURNO_MIN) return 'noite'
  return 'dia'
}

/** Extrai { P1..P4: nome } dos plantões do dia (1º nome de cada setor). */
export function plantonistasNoturnos(plantoes) {
  const out = {}
  for (const p of plantoes || []) {
    const setor = String(p?.setor || '').trim().toUpperCase()
    if (/^P[1-4]$/.test(setor) && !out[setor]) {
      const nome = String(p?.nome || '').trim()
      if (nome) out[setor] = nome
    }
  }
  return out
}

/**
 * Candidatos p/ casar o nome do PegaPlantao ("G. Staub", "João Ricardo Moreira",
 * "Dr. Fulano") com o dicionário de vínculos (apelidos + nomes completos).
 * Ordem: nome sem iniciais/honoríficos → primeiro+último → último → primeiro.
 */
export function candidatosNome(nome) {
  const tokens = String(nome || '')
    .replace(/^Dr[a]?\.?\s+/i, '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  const significativos = tokens.filter((t) => !/^[A-Za-zÀ-ü]\.?$/.test(t)) // "G." fora
  const t = significativos.length ? significativos : tokens
  if (!t.length) return []
  const c = new Set([t.join(' ')])
  if (t.length > 1) {
    c.add(`${t[0]} ${t[t.length - 1]}`)
    c.add(t[t.length - 1])
    c.add(t[0])
  }
  return [...c]
}

/** Hospitais onde o P4 (coringa) pode ser marcado. */
export const P4_HOSPITAIS = ['unimed', 'hro', 'materno']

/**
 * Ordem dos plantonistas noturnos por hospital (pedido do dono 24/07). O
 * PRIMEIRO de cada lista é o plantonista daquele hospital — vai no topo e
 * comanda a ordem de liberação depois das 19h.
 */
export const ORDEM_NOTURNA = {
  hro: ['P1', 'P4'],
  unimed: ['P2', 'P3', 'P4'],
  materno: ['P4'],
}

/**
 * Linhas do plantão noturno exibidas na lista do hospital, JÁ NA ORDEM.
 * @param {string} chaveHospital 'unimed' | 'hro' | 'materno'
 * @param {object} noturnos { P1..P4: nome }
 * @param {string|null} p4Hospital hospital marcado do P4; null = aparece nos TRÊS
 */
export function linhasNoturnas(chaveHospital, noturnos, p4Hospital = null) {
  const setores = ORDEM_NOTURNA[chaveHospital] || []
  const linhas = []
  for (const setor of setores) {
    const nome = String(noturnos?.[setor] || '').trim()
    if (!nome) continue
    // coringa marcado em OUTRO hospital: some daqui (pedido do dono 24/07)
    if (setor === 'P4' && p4Hospital && p4Hospital !== chaveHospital) continue
    linhas.push({
      setor,
      nome,
      papel: setor === 'P4' ? 'Coringa' : setor === setores[0] ? 'Plantonista' : 'Plantão noturno',
      // plantonista = o 1º setor do hospital; ausente do plantão → ninguém assume
      isPlantonista: setor === setores[0],
    })
  }
  return linhas
}

/** Plantonista noturno do hospital (quem manda na lista após 19h). */
export function plantonistaNoturnoDe(chaveHospital, noturnos, p4Hospital = null) {
  const linha = linhasNoturnas(chaveHospital, noturnos, p4Hospital).find((l) => l.isPlantonista)
  return linha?.nome || null
}

/** Prefixo da chave de marcação do plantão noturno (ver fundirLinhasNoturnas). */
export const PREFIXO_NOITE = 'noite:'

/**
 * AVISO no turno vespertino (pedido do dono 25/07): quem é P1–P4 hoje à noite já
 * aparece com o selo na lista da tarde — mas SÓ o selo. Posição, cor, liberação
 * e "próximo a ser liberado" seguem a lógica do dia até as 19h, quando
 * fundirLinhasNoturnas assume e move cada um para o posto.
 *
 * Não filtra por hospital: o selo é da PESSOA (ela está numa lista só, e saber
 * que ela entra no plantão hoje é a informação útil), diferente do card noturno.
 *
 * @param {Array} linhas linhas de gerarColunaLiberacao
 * @param {object} noturnos { P1..P4: nome } de plantonistasNoturnos
 * @param {object} opts { resolverUid, normalizar }
 */
export function marcarSelosNoTurno(linhas, noturnos, opts = {}) {
  const lista = linhas || []
  if (!lista.length || !noturnos) return lista
  const resolverUid = typeof opts.resolverUid === 'function' ? opts.resolverUid : () => null
  const normalizar = typeof opts.normalizar === 'function' ? opts.normalizar : (s) => String(s || '').trim().toUpperCase()

  const porChave = new Map()
  for (const setor of ['P1', 'P2', 'P3', 'P4']) {
    const nome = String(noturnos[setor] || '').trim()
    if (!nome) continue
    const chave = resolverUid(nome) || normalizar(nome)
    if (chave && !porChave.has(chave)) porChave.set(chave, setor)
  }
  if (!porChave.size) return lista
  return lista.map((l) => (porChave.has(l.chave) ? { ...l, selo: porChave.get(l.chave) } : l))
}

/**
 * Funde os plantonistas noturnos com a lista de liberações do turno: os cards
 * noturnos vão para o TOPO na ordem do hospital e a lista vespertina segue
 * abaixo, na ordem original.
 *
 * Quem já está na lista vespertina é HOISTADO (mesmo card, mesmo conteúdo do
 * dia) e ganha o selo — nunca duplica. Quem não está vira um card novo com
 * `sintetico: true` (não existe no rodapé: não pode ser reordenado e NUNCA é
 * escrito de volta na ordem_liberacao).
 *
 * A `chave` do card noturno é NAMESPACED com 'noite:' (o `chaveDia` guarda a
 * original): ao virar P1–P4 a pessoa sai da posição em que estava e assume o
 * posto TRABALHANDO, independente de já ter sido liberada no dia (pedido do
 * dono 24/07). Sem o namespace a marcação diurna pintava o card de vermelho;
 * com ele, uma liberação feita À NOITE (P3/P4 seguem a lógica normal) persiste
 * sozinha, sem misturar com o dia.
 *
 * @param {Array} linhas linhas de gerarColunaLiberacao
 * @param {Array} linhasNoite saída de linhasNoturnas
 * @param {object} opts { resolverUid, normalizar, display }
 */
export function fundirLinhasNoturnas(linhas, linhasNoite, opts = {}) {
  const lista = linhas || []
  if (!linhasNoite?.length) return lista
  const resolverUid = typeof opts.resolverUid === 'function' ? opts.resolverUid : () => null
  const normalizar = typeof opts.normalizar === 'function' ? opts.normalizar : (s) => String(s || '').trim().toUpperCase()
  const display = typeof opts.display === 'function' ? opts.display : (nome) => nome

  const porChave = new Map(lista.map((l) => [l.chave, l]))
  const vistos = new Set()
  const topo = []
  for (const n of linhasNoite) {
    const uid = resolverUid(n.nome) || null
    const chave = uid || normalizar(n.nome) || `noturno:${n.setor}`
    if (vistos.has(chave)) continue // mesma pessoa em dois setores → 1 card só
    vistos.add(chave)
    const base = porChave.get(chave)
    // teveCasos: está de plantão AGORA = em sala. Sem isto, o plantonista que
    // aparece no rodapé mas não teve caso no turno cai na regra de "não escalado"
    // (nasce liberado, vermelho) e AFUNDA para o fim da lista, em vez de liderar.
    // isAjuda: false — quem está de plantão NUNCA é ajuda de outro hospital, mesmo
    // que tenha vindo ajudar durante o dia (o badge azul persistia no card noturno).
    const selo = {
      selo: n.setor, papelNoturno: n.papel, isPlantonista: n.isPlantonista,
      // `noturno` distingue o CARD de plantão do simples selo de aviso que a
      // lista vespertina exibe antes das 19h (marcarSelosNoTurno) — só o card
      // troca de posição, ignora o status do dia e usa a chave da noite.
      noturno: true,
      teveCasos: true, isAjuda: false,
      chave: `${PREFIXO_NOITE}${chave}`, chaveDia: chave,
    }
    if (base) { topo.push({ ...base, ...selo }); continue }
    const nome = display(n.nome, uid)
    topo.push({
      anestesista: nome,
      cirurgioes: [],
      salas: [],
      uid,
      nomeOriginal: n.nome,
      sintetico: true,
      texto: `${nome} — ${n.papel}`,
      ...selo,
    })
  }
  // um só "Plantonista" na tela: na fase noturna o badge é do plantonista da noite
  const temPlantonistaNoite = topo.some((l) => l.isPlantonista)
  const resto = lista
    .filter((l) => !vistos.has(l.chave))
    .map((l) => (temPlantonistaNoite && l.isPlantonista ? { ...l, isPlantonista: false } : l))
  return [...topo, ...resto]
}
