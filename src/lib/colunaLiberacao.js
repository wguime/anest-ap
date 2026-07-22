/**
 * Geração da coluna de liberação dos anestesistas (puro, testável).
 *
 * Dado o conjunto de casos cirúrgicos JÁ ESTRUTURADOS de um hospital (sala, anestesista,
 * cirurgião, bloco) + a ordem do rodapé da escala, produz a lista
 * "Anestesista — Cirurgião/Cirurgião" usada pelo plantonista para liberar as salas.
 *
 * Implementa as 18 regras da skill "ORGANIZAÇÃO DA COLUNA DE LIBERAÇÃO" como uma
 * transformação determinística sobre dados (não é mais um parser de imagem — a extração
 * por Vision/confirmação já entrega cada caso com cirurgião e anestesista nas posições
 * corretas, inclusive a inversão dos blocos inferiores).
 *
 * Caso (camelCase, como vem do service):
 *   { sala, ordem, hora, anestesista, cirurgiao, bloco, isContinuacao, semAnestesista }
 *   - anestesista: nome de escala; pode ser '//' (herda do caso acima na mesma sala) ou vazio.
 *   - bloco: 'normal' | 'srpa' | 'imagem' | 'hemodinamica' | 'exames' | 'iosc' | 'ho' |
 *            'consultorio' | 'accurata' | 'umanita' | 'materno' | 'simone' | 'ccoluna' | 'mauricio'
 *   - semAnestesista: caso "?" (vai para o fim da lista, separado por linha em branco).
 */

/** Blocos cujo rótulo é acrescentado entre parênteses após o cirurgião (regras 4/6/13). */
export const BLOCO_LABEL = {
  hemodinamica: 'Hemodinamica',
  exames: 'Exames',
  iosc: 'IOSC',
  ho: 'HO',
  imagem: 'Imagem',
  consultorio: 'Consultorio',
  accurata: 'Accurata',
  umanita: 'Umanita',
  materno: 'Materno',
  simone: 'Simone',
  ccoluna: 'C. Coluna',
  mauricio: 'Mauricio',
}

/** Conectivos ignorados ao montar o nome curto do cirurgião. */
const PARTICULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e'])

const titleCaseToken = (s) =>
  s ? s.charAt(0).toLocaleUpperCase('pt-BR') + s.slice(1).toLocaleLowerCase('pt-BR') : s

/** "JOAO HENRIQUE" -> "Joao Henrique"; "guilherme melo" -> "Guilherme Melo" (regra 17). */
export const titleCaseNome = (s) =>
  String(s || '')
    .trim()
    .split(/\s+/)
    .map(titleCaseToken)
    .join(' ')

/** Remove o prefixo "PED " do nome do anestesista (regra 9). */
const stripPed = (s) => String(s || '').replace(/^\s*ped\s+/i, '').trim()

/** Normaliza para casamento entre anestesista do caso e nome do rodapé (acento/caixa/PED-insensível). */
const norm = (s) =>
  stripPed(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()

/**
 * Nome curto do cirurgião: primeiro nome + ÚLTIMO SOBRENOME por extenso
 * (pedido do dono 2026-07-16; antes era só a inicial).
 * "João Rafael de Oliveira Dias" -> "João Dias"; "Eduardo Francisco" -> "Eduardo Francisco";
 * "Rafael" -> "Rafael". Acentos preservados (regra 17).
 */
export function nomeCirurgiaoCurto(full) {
  if (!full) return null
  const tokens = String(full).trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return null
  const first = titleCaseToken(tokens[0])
  if (tokens.length === 1) return first
  // último token significativo (ignora partículas finais soltas)
  let last = tokens[tokens.length - 1]
  for (let i = tokens.length - 1; i >= 1; i--) {
    if (!PARTICULAS.has(tokens[i].toLowerCase())) {
      last = tokens[i]
      break
    }
  }
  return `${first} ${titleCaseToken(last)}`
}

/**
 * Propaga o anestesista pelas linhas seguintes da mesma sala (regra 2: "//" pertence ao
 * anestesista imediatamente acima). Retorna novos casos com `anestesista` resolvido.
 */
export function resolverAnestesistas(casos) {
  const porSala = new Map()
  for (const c of casos) {
    const sala = c.sala || ''
    if (!porSala.has(sala)) porSala.set(sala, [])
    porSala.get(sala).push(c)
  }
  const resolvido = new Map()
  for (const lista of porSala.values()) {
    const ordenada = [...lista].sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    let ultimo = null
    for (const c of ordenada) {
      const raw = String(c.anestesista || '').trim()
      // herda só quando a COLUNA anestesista é "//"/vazia — `isContinuacao` é do
      // procedimento (a linha pode ser continuação e ainda ter anestesista próprio).
      const herdaAcima = raw === '' || raw === '//'
      const anestesista = herdaAcima && !c.semAnestesista ? ultimo : stripPed(raw)
      if (anestesista) ultimo = anestesista
      resolvido.set(c, anestesista)
    }
  }
  return casos.map((c) => ({ ...c, anestesista: resolvido.get(c) ?? stripPed(c.anestesista) }))
}

/** Token de cirurgião para um caso, com sufixo de bloco/SRPA/Continuação/Imagem (regras 4–8,13). */
function tokenCirurgiao(caso) {
  const bloco = caso.bloco || 'normal'
  if (bloco === 'srpa') return 'SRPA' // regra 5
  let base = null
  if (caso.cirurgiao && String(caso.cirurgiao).trim()) {
    // múltiplos cirurgiões numa célula separados por "/" (regra 3)
    base = String(caso.cirurgiao)
      .split('/')
      .map((n) => nomeCirurgiaoCurto(n))
      .filter(Boolean)
      .join('/')
  } else if (caso.isContinuacao) {
    base = 'Continuação' // regra 8
  } else if (bloco === 'imagem') {
    base = 'Imagem' // regra 7
  }
  // Sem cirurgião mas num bloco nomeado → mostra o LOCAL (Consultório, Exames, Hemodinâmica...)
  // para que todo anestesista escalado apareça com onde está, em vez de "…".
  if (!base) return BLOCO_LABEL[bloco] || null
  const label = BLOCO_LABEL[bloco]
  return label && bloco !== 'imagem' ? `${base} (${label})` : base
}

/**
 * Gera a coluna de liberação.
 * @param {Array} casos  casos estruturados do hospital
 * @param {Array<string>} ordemRodape  nomes dos anestesistas na ordem do rodapé
 * @param {object} [opts]  { hospital, ajudaExterna, resolverUid } — ajudaExterna = nomes em AZUL
 *   no rodapé (anestesistas de OUTRO hospital ajudando no dia): vão para o FIM
 *   da lista, pois são os PRIMEIROS a serem liberados (regra do dono 2026-07-15).
 *   resolverUid = (nome) => uid|null (dicionário escala_anestesista_alias): variantes do
 *   mesmo anestesista ("GUILHERME DIDOMENICO" no rodapé, "GUILHERME D." no caso) colapsam
 *   numa linha só — sem isso a variante do caso virava linha EXTRA no fim da lista e
 *   roubava o "próximo a ser liberado" (bug real do piloto, 2026-07-21).
 * @returns {{ linhas: Array<{anestesista, cirurgioes, salas, isPlantonista, isAjuda, texto}>, semAnestesista: Array, texto: string, plantonista: string|null }}
 */
export function gerarColunaLiberacao(casos, ordemRodape = [], opts = {}) {
  const resolvidos = resolverAnestesistas(casos || [])
  const resolverUid = typeof opts.resolverUid === 'function' ? opts.resolverUid : () => null
  // Nome de exibição canônico por uid (a view injeta a política: apelido que é só o
  // primeiro nome ganha o sobrenome diferencial do cadastro — "GUSTAVO" → "Gustavo
  // Biesdorf"; pedido do dono 2026-07-21: nunca exibir só "Gustavo/Marcos/Guilherme").
  const nomeExibicao = typeof opts.nomeExibicao === 'function' ? opts.nomeExibicao : () => null
  // chave canônica: uid do vínculo (caso já atribuído OU dicionário) > nome normalizado
  const resolveKey = (nome, uidCaso = null) => {
    const uid = uidCaso || resolverUid(nome) || null
    return { key: uid || norm(nome), uid }
  }
  const displayDe = (nome, uid) => (uid && nomeExibicao(uid, nome)) || titleCaseNome(nome)

  // mapa chave(anestesista) -> { display, tokens:[] }
  const grupos = new Map()
  const ordemEncontro = []
  const incerteza = [] // casos "?" (regra 10)

  for (const c of resolvidos) {
    const nome = String(c.anestesista || '').trim()
    // Caso "?" explícito (regra 10) OU sem anestesista resolvível (linha órfã sem
    // acima p/ herdar, ou "//" no 1º caso da sala): o plantonista precisa VER a
    // sala descoberta — nunca sumir em silêncio.
    if (c.semAnestesista || !nome || nome === '//') {
      const cir = nomeCirurgiaoCurto(c.cirurgiao) || BLOCO_LABEL[c.bloco] || 'Imagem'
      const ctx = [BLOCO_LABEL[c.bloco] || opts.hospital, c.hora].filter(Boolean).join(' ')
      incerteza.push({ cirurgiao: cir, contexto: ctx, texto: `${cir} — (${ctx}) ?` })
      continue
    }
    const { key, uid } = resolveKey(nome, c.anestesistaUserId || null)
    if (!grupos.has(key)) {
      grupos.set(key, { display: displayDe(nome, uid), tokens: [], salas: [] })
      ordemEncontro.push(key)
    }
    const g = grupos.get(key)
    const tok = tokenCirurgiao(c)
    if (tok && !g.tokens.includes(tok)) g.tokens.push(tok) // dedup (regra 15)
    const sala = String(c.sala || '').trim()
    if (sala && !g.salas.includes(sala)) g.salas.push(sala) // onde o anestesista está escalado
  }

  // ordena pelo rodapé (regra 1); nomes do rodapé sem casos viram "Nome — ..."
  // O 1º nome do rodapé (não-azul) é o PLANTONISTA (último a ir embora); a
  // liberação corre de baixo para cima. Nomes em AZUL (ajuda de outro hospital)
  // vão para o FIM — são os primeiros a serem liberados.
  const azuis = new Set((opts.ajudaExterna || []).map((n) => resolveKey(n).key).filter(Boolean))
  const linha = (display, g, extra = {}) => ({
    anestesista: display,
    cirurgioes: g ? g.tokens : [],
    salas: g ? g.salas : [],
    isPlantonista: false,
    isAjuda: false,
    texto: `${display} — ${g && g.tokens.length ? g.tokens.join('/') : '…'}`,
    ...extra,
  })

  const principais = []
  const linhasAjuda = []
  const usados = new Set()
  for (const nomeRodape of ordemRodape) {
    const { key, uid } = resolveKey(nomeRodape)
    if (usados.has(key)) continue // rodapé com variantes do mesmo anestesista → 1 linha
    usados.add(key)
    const l = linha(displayDe(nomeRodape, uid), grupos.get(key), { isAjuda: azuis.has(key) })
    ;(l.isAjuda ? linhasAjuda : principais).push(l)
  }
  // azuis listados só em ajudaExterna (fora do rodapé) também entram ao fim
  for (const nomeAzul of opts.ajudaExterna || []) {
    const { key, uid } = resolveKey(nomeAzul)
    if (!key || usados.has(key)) continue
    usados.add(key)
    linhasAjuda.push(linha(displayDe(nomeAzul, uid), grupos.get(key), { isAjuda: true }))
  }
  // anestesistas presentes nos casos mas ausentes do rodapé → antes dos azuis,
  // preservando ordem de encontro (são da escala do hospital)
  const extras = []
  for (const key of ordemEncontro) {
    if (usados.has(key)) continue
    const g = grupos.get(key)
    extras.push(linha(g.display, g))
  }
  if (principais.length) principais[0].isPlantonista = true
  const linhas = [...principais, ...extras, ...linhasAjuda]

  // texto final (regra 16/17): linhas + linha em branco + casos "?"
  const blocoPrincipal = linhas.map((l) => l.texto).join('\n')
  const blocoIncerteza = incerteza.map((i) => i.texto).join('\n')
  const texto = blocoIncerteza
    ? `${blocoPrincipal}\n\n${blocoIncerteza}`
    : blocoPrincipal

  return {
    linhas,
    semAnestesista: incerteza,
    texto,
    // plantonista = 1º nome NÃO-azul do rodapé (azul é ajuda de outro hospital)
    plantonista: principais.length ? principais[0].anestesista : null,
  }
}
