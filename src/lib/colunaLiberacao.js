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
  ho: 'HO', // abreviado NAS LIBERAÇÕES (2026-07-22; no board a sala sai por extenso)
  imagem: 'Imagem',
  consultorio: 'Consultório',
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

/**
 * Grafia clínica (pedido do dono 2026-07-21): texto TODO EM CAIXA ALTA vira
 * "Primeira maiúscula, resto minúsculo", preservando siglas curtas em caps
 * (AMIU, EDA, J — palavras ≤4 caracteres). Texto que já tem minúsculas fica
 * como veio (respeita a digitação da fonte).
 */
export function fraseClinica(s) {
  const t = String(s || '').trim()
  if (!t || /[a-zà-ú]/.test(t)) return t
  return t
    .split(/\s+/)
    .map((w, i) => {
      const low = w.toLocaleLowerCase('pt-BR')
      if (PARTICULAS.has(low)) return i === 0 ? titleCaseToken(low) : low // "DOS" não é sigla
      if (/^[A-ZÀ-Ü0-9./+-]{1,4}$/.test(w) && /[A-ZÀ-Ü]/.test(w)) return w // sigla curta (AMIU, EDA, J)
      return i === 0 ? titleCaseToken(low) : low
    })
    .join(' ')
}

/**
 * Remove o prefixo de PEDIDO do nome do anestesista. "PED"/"PED."/"Ped." antes do
 * nome = um PEDIDO para aquele anestesista específico (regra do dono 24/07:
 * "Ped. Janaína" é para a Janaína). O anestesista é o nome que vem DEPOIS.
 * O caractere após "ped" tem de ser "." ou espaço p/ não estragar "Pedro".
 */
const stripPed = (s) => String(s || '').replace(/^\s*ped[.\s]\s*/i, '').trim()

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

/** Só o primeiro nome (salas com 2 anestesistas na Completa). "GUILHERME MELO" → "Guilherme". */
export const primeiroNome = (s) => {
  const t = String(s || '').trim().split(/\s+/).filter(Boolean)
  return t.length ? titleCaseToken(t[0]) : ''
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
  } else if (String(caso.procedimento || '').trim()) {
    // Sem cirurgião mas com procedimento (ex.: "acréscimo AMIU"): mostra o
    // procedimento no card do anestesista (pedido do dono 2026-07-21).
    base = fraseClinica(caso.procedimento)
  }
  // Sem cirurgião mas num bloco nomeado → mostra o LOCAL (Consultório, Exames, Hemodinâmica...)
  // para que todo anestesista escalado apareça com onde está, em vez de "…".
  if (!base) return BLOCO_LABEL[bloco] || null
  const label = BLOCO_LABEL[bloco]
  // procedimento que é o próprio bloco ("CONSULTÓRIO AJUDA" no bloco Consultório):
  // mostra SÓ o rótulo, sem duplicar (pedido do dono 2026-07-22)
  if (label && norm(base).startsWith(norm(label))) return label
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
/**
 * Ordem de liberação DERIVADA dos casos, para escala publicada SEM rodapé — é o
 * caso normal do Materno, cujo mapa não traz a lista vermelha (por isso não
 * aparecia plantonista nenhum: nem no card da Home, nem nesta aba).
 *
 * Critério (regra do dono 27/07): dentro do TURNO exibido, o plantonista é quem
 * tem MAIS CIRURGIAS; empate desempata por quem termina mais tarde (é quem fica
 * por último). A lista já chega filtrada pelo turno, então "o anestesista
 * escalado no turno referente" sai naturalmente: de manhã concorre quem opera
 * de manhã, à tarde quem opera à tarde.
 *
 * É derivação de EXIBIÇÃO — nunca é escrita de volta na ordem_liberacao
 * (reescrever o rodapé automaticamente corrompeu a escala em 22/07). Havendo
 * rodapé, ele é soberano e isto nem roda.
 */
export function ordemDerivadaDosCasos(casos) {
  const porPessoa = new Map()
  for (const c of resolverAnestesistas(casos || [])) {
    if (c.semAnestesista) continue
    const nome = String(c.anestesista || '').trim()
    if (!nome || nome === '//' || /^\?+$/.test(nome)) continue
    for (const parte of nome.split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean)) {
      const chave = norm(parte)
      const hora = String(c.hora || '').trim()
      const e = porPessoa.get(chave) || { nome: parte, n: 0, ultima: '' }
      e.n += 1
      if (hora > e.ultima) e.ultima = hora
      porPessoa.set(chave, e)
    }
  }
  return [...porPessoa.values()]
    .sort((a, b) => (b.n - a.n) || (b.ultima || '').localeCompare(a.ultima || ''))
    .map((x) => x.nome)
}

/**
 * ⚠️ `linhas` é ordem de EXIBIÇÃO, NÃO o rodapé: carrega extras (`isExtra` — quem
 * tem caso sem estar na ordem publicada), as ajudas e o plantão-da-tarde no fim.
 * NUNCA use `linhas` como fonte para gravar `ordem_liberacao` — foi assim que a
 * substituição de posição passou a injetar nomes e reordenar o rodapé (bug 29/07).
 * Para escrever a ordem, parta SEMPRE do rodapé do turno.
 */
export function gerarColunaLiberacao(casos, ordemRodape = [], opts = {}) {
  const resolvidos = resolverAnestesistas(casos || [])
  // Sem rodapé (Materno), deriva dos casos p/ existir plantonista e ordem.
  const ordem = ordemRodape?.length ? ordemRodape : ordemDerivadaDosCasos(casos)
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

  // Caso encerrado (Terminada/Suspensa) SAI da linha do anestesista em tempo real
  // (pedido do dono 2026-07-21): sala e cirurgião somem quando encerram. A linha
  // NÃO some nem auto-libera — `teveCasos` distingue "tudo encerrado" (fica ativa,
  // aguardando o plantonista) de "nunca escalado" (liberado por definição).
  const concluido = (c) =>
    c.statusCirurgia === 'terminada' || c.statusCirurgia === 'suspensa' || c.statusExtra === 'suspensa'

  for (const c of resolvidos) {
    const nome = String(c.anestesista || '').trim()
    // Caso "?" explícito (regra 10) OU anestesista literal "?"/"??" OU sem
    // anestesista resolvível (linha órfã sem acima p/ herdar, ou "//" no 1º caso
    // da sala): vira ALERTA no fim da lista com horário/sala/procedimento — o
    // plantonista precisa VER a sala descoberta, nunca sumir em silêncio.
    if (c.semAnestesista || !nome || nome === '//' || /^\?+$/.test(nome)) {
      if (concluido(c)) continue // alerta "?" some quando o caso encerra
      const cir = nomeCirurgiaoCurto(c.cirurgiao) || BLOCO_LABEL[c.bloco] || 'Imagem'
      const ctx = [BLOCO_LABEL[c.bloco] || opts.hospital, c.hora].filter(Boolean).join(' ')
      incerteza.push({
        // id do caso: a aba Liberações define o anestesista direto pelo alerta
        // (pedido do dono 26/07) — sem ele o alerta era só leitura.
        id: c.id || null,
        cirurgiao: cir,
        hora: String(c.hora || '').trim(),
        sala: String(c.sala || '').trim(),
        procedimento: fraseClinica(c.procedimento),
        contexto: ctx,
        texto: `${cir} — (${ctx}) ?`,
      })
      continue
    }
    // DOIS anestesistas na mesma sala ("Roberta + Fernando", pedido do dono 23/07):
    // o caso conta para AMBOS → cada um aparece na SUA posição do rodapé, com a
    // sala e o cirurgião. Um único nome segue o caminho normal (com o uid do caso).
    const partes = nome.split(/\s*\+\s*/).map((s) => s.trim()).filter(Boolean)
    const umSo = partes.length === 1
    for (const parte of partes) {
      const { key, uid } = resolveKey(parte, umSo ? (c.anestesistaUserId || null) : null)
      if (!grupos.has(key)) {
        grupos.set(key, { display: displayDe(parte, uid), tokens: [], tokenHora: {}, tokenTermino: {}, tokenAndamento: {}, casosAtivos: 0, salas: [], teveCasos: false, uid: uid || null, nomeOriginal: parte })
        ordemEncontro.push(key)
      }
      const g = grupos.get(key)
      g.teveCasos = true
      if (concluido(c)) continue // encerrado: some da linha (sala/cirurgião saem)
      g.casosAtivos += 1 // p/ a linha de cobertura ("N cirurgias · M com término")
      const tok = tokenCirurgiao(c)
      if (tok) {
        // A cirurgia EM ANDAMENTO é a única que pode mostrar contagem regressiva
        // (pesquisa + decisão do dono 29/07): é assim que quadro de centro
        // cirúrgico funciona, e é o que impede o número de UMA cirurgia de ser
        // lido como o total da PESSOA. Basta um caso iniciado no token.
        if ((c.statusCirurgia || 'agendada') === 'iniciada') g.tokenAndamento[tok] = true
        if (!g.tokens.includes(tok)) g.tokens.push(tok) // dedup (regra 15)
        // guarda a MENOR hora do token p/ ordenar os cirurgiões por horário (pedido 24/07)
        const h = String(c.hora || '').trim()
        if (h && (!g.tokenHora[tok] || h < g.tokenHora[tok])) g.tokenHora[tok] = h
        // TÉRMINO PREVISTO DA CIRURGIA (dono 29/07) — o mais PRÓXIMO entre os casos
        // que caem no mesmo token (é o próximo a terminar, que é o que interessa a
        // quem olha a fila). Some com o caso encerrado, junto com o token.
        const t = String(c.terminoPrevisto || '').trim()
        if (t && (!g.tokenTermino[tok] || t < g.tokenTermino[tok])) g.tokenTermino[tok] = t
      }
      const sala = String(c.sala || '').trim()
      if (sala && !g.salas.includes(sala)) g.salas.push(sala) // onde o anestesista está escalado
    }
  }

  // alertas "?" em ordem de horário (pedido do dono 2026-07-21; sem hora → fim)
  incerteza.sort((a, b) => (a.hora || '99:99').localeCompare(b.hora || '99:99'))

  // ordena pelo rodapé (regra 1); nomes do rodapé sem casos viram "Nome — ..."
  // O 1º nome do rodapé (não-azul) é o PLANTONISTA (último a ir embora); a
  // liberação corre de baixo para cima. Nomes em AZUL (ajuda de outro hospital)
  // vão para o FIM — são os primeiros a serem liberados.
  const azuis = new Set((opts.ajudaExterna || []).map((n) => resolveKey(n).key).filter(Boolean))
  // Cirurgiões EM ORDEM DE HORÁRIO (pedido do dono 24/07); sem hora → fim.
  const cirurgioesOrdenados = (g) =>
    g ? [...g.tokens].sort((a, b) => (g.tokenHora[a] || '99:99').localeCompare(g.tokenHora[b] || '99:99')) : []
  const linha = (display, g, extra = {}) => ({
    anestesista: display,
    cirurgioes: cirurgioesOrdenados(g),
    // término previsto POR CIRURGIÃO exibido (dono 29/07): { [token]: "HH:MM" }.
    // É o tempo de UMA CIRURGIA — o total da pessoa é outro número, manual e
    // independente (linha_overrides[chave].termino), e nunca a soma destes.
    tokenTermino: g ? { ...g.tokenTermino } : {},
    // qual token está EM ANDAMENTO: só ele conta o tempo regressivo na fila
    tokenAndamento: g ? { ...g.tokenAndamento } : {},
    // COBERTURA (dono 29/07): quantas cirurgias ativas a pessoa tem e quantas já
    // têm término informado. Sem isto, "~45min" numa pessoa com 3 cirurgias não
    // diz se o quadro está completo — e informação faltando parecia informação.
    casosAtivos: g ? g.casosAtivos : 0,
    casosComTermino: g ? Object.keys(g.tokenTermino).length : 0,
    salas: g ? g.salas : [],
    // chave ESTÁVEL p/ marcações (uid do vínculo ou nome normalizado) + nome
    // ORIGINAL do rodapé p/ persistir reordenação — o nome EXIBIDO muda com
    // vínculos/diferenciação e corrompia marcações e rodapé (bug real 2026-07-22)
    chave: '',
    uid: null,
    nomeOriginal: display,
    // teve caso hoje (mesmo que todos já encerrados) — NÃO auto-liberar
    teveCasos: !!g?.teveCasos,
    isPlantonista: false,
    isAjuda: false,
    isProximoPlantao: false,
    ajudaIdx: null,
    plantaoLabel: null, // "Plantão da tarde"/"Plantão da manhã" — rótulo vem da lib
    isExtra: false, // tem caso mas NÃO está no rodapé (ver aviso do JSDoc)
    texto: `${display} — ${g && g.tokens.length ? cirurgioesOrdenados(g).join('/') : '…'}`,
    ...extra,
  })

  const principais = []
  const linhasAjuda = []
  const usados = new Set()
  for (const nomeRodape of ordem) {
    const { key, uid } = resolveKey(nomeRodape)
    if (usados.has(key)) continue // rodapé com variantes do mesmo anestesista → 1 linha
    usados.add(key)
    const l = linha(displayDe(nomeRodape, uid), grupos.get(key), { isAjuda: azuis.has(key), chave: key, uid: uid || null, nomeOriginal: nomeRodape })
    ;(l.isAjuda ? linhasAjuda : principais).push(l)
  }
  // azuis listados só em ajudaExterna (fora do rodapé) também entram ao fim
  for (const nomeAzul of opts.ajudaExterna || []) {
    const { key, uid } = resolveKey(nomeAzul)
    if (!key || usados.has(key)) continue
    usados.add(key)
    linhasAjuda.push(linha(displayDe(nomeAzul, uid), grupos.get(key), { isAjuda: true, chave: key, uid: uid || null, nomeOriginal: nomeAzul }))
  }
  // ORDEM DO BLOCO DE AJUDA = ordem do array `ajudaExterna` (não a posição no
  // rodapé). Antes, ajuda que TAMBÉM estava no rodapé era empilhada na ordem do
  // rodapé, e só a ajuda de fora dele seguia o array — então reordenar o array não
  // movia nada na tela para o caso comum. Como a ordem manual do bloco (decisão do
  // dono 30/07) é persistida justamente reordenando este array, ele precisa ser a
  // fonte. Nome fora do array vai ao fim, preservando a ordem de entrada.
  const posAjuda = new Map()
  ;(opts.ajudaExterna || []).forEach((n, i) => {
    const { key } = resolveKey(n)
    if (key && !posAjuda.has(key)) posAjuda.set(key, i)
  })
  linhasAjuda.sort((a, b) => (posAjuda.get(a.chave) ?? Infinity) - (posAjuda.get(b.chave) ?? Infinity))
  // `ajudaIdx` = posição da linha NO ARRAY `ajudaExterna`. A view usa isto para
  // reordenar o bloco sem ter que re-resolver nome→chave (e sem inventar índice a
  // partir da ordem exibida, que difere do array quando alguém foi promovido a
  // plantão do contraturno).
  for (const l of linhasAjuda) {
    const i = posAjuda.get(l.chave)
    if (i != null) l.ajudaIdx = i
  }

  // anestesistas presentes nos casos mas ausentes do rodapé → antes dos azuis,
  // preservando ordem de encontro (são da escala do hospital)
  const extras = []
  for (const key of ordemEncontro) {
    if (usados.has(key)) continue
    const g = grupos.get(key)
    extras.push(linha(g.display, g, { chave: key, uid: g.uid || null, nomeOriginal: g.nomeOriginal, isExtra: true }))
  }
  if (principais.length) principais[0].isPlantonista = true
  // PLANTÃO DO TURNO SEGUINTE (regra do dono 2026-07-29): o ÚLTIMO nome da escala
  // do hospital, quando está escalado, é o plantonista do próximo turno — e sai
  // PRIMEIRO, antes até das ajudas, para descansar. Como a liberação corre de
  // baixo p/ cima, ele vai para o FIM da lista.
  //
  // Vale nos DOIS turnos (ampliação do dono na tarde de 29/07): quem pega o
  // plantão da MANHÃ seguinte e está escalado à tarde sai primeiro pela mesma
  // razão. O que muda é só o rótulo, e ele vem daqui — a view não deve derivar
  // o texto de novo (dois lugares divergem no primeiro ajuste).
  //
  // Isto NÃO disputa com os P1–P4 da fase noturna: aqueles vêm do card Plantões,
  // assumem o TOPO da lista e têm regra própria (P1/P2 fora da fila do "próximo").
  // O plantão do turno seguinte é outra coisa e continua no fim.
  //
  // O ÚLTIMO NOME DO RODAPÉ VALE MESMO ESTANDO EM AZUL (correção 30/07): a regra é
  // posicional — quem fecha o rodapé pega o plantão do contraturno — e ser ajuda de
  // outro hospital não muda isso. Antes o azul era desviado para `linhasAjuda` antes
  // desta conta, então o cálculo caía no último nome NÃO-azul e rotulava a pessoa
  // errada: no HRO de 30/07 o rodapé terminava em FERNANDO (azul) e o app marcou a
  // JANAÍNA como "Plantão da tarde". Por isso a decisão é tomada sobre o RODAPÉ, não
  // sobre a lista já separada. Quem é os dois carrega os DOIS selos.
  const PLANTAO_LABEL = { matutino: 'Plantão da tarde', vespertino: 'Plantão da manhã' }
  let proximoPlantao = null
  const chavesRodape = []
  for (const nomeRodape of ordem) {
    const { key } = resolveKey(nomeRodape)
    if (key && !chavesRodape.includes(key)) chavesRodape.push(key)
  }
  const chaveUltima = chavesRodape[chavesRodape.length - 1] || null
  if (PLANTAO_LABEL[opts.turno] && chavesRodape.length > 1 && chaveUltima) {
    const de = principais.some((l) => l.chave === chaveUltima) ? principais : linhasAjuda
    const i = de.findIndex((l) => l.chave === chaveUltima)
    // `teveCasos` OU `isAjuda` (correção 30/07): o guard original existia para não
    // rotular nome de rodapé que não está trabalhando — esse nasce liberado. Mas
    // quem é AJUDA está trabalhando, só não AQUI: no HRO de 30/07 o Fernando
    // fechava o rodapé, era ajuda e tinha 0 casos no HRO (os casos dele são da
    // Unimed), então o guard engolia o badge de quem de fato pega o contraturno.
    if (i >= 0 && (de[i].teveCasos || de[i].isAjuda)) {
      de[i].isProximoPlantao = true
      de[i].plantaoLabel = PLANTAO_LABEL[opts.turno]
      proximoPlantao = de.splice(i, 1)[0]
    }
  }
  const linhas = [...principais, ...extras, ...linhasAjuda, ...(proximoPlantao ? [proximoPlantao] : [])]

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
