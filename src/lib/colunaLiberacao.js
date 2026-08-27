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
import { casoConcluido } from '@/lib/escalaCirurgicaStatus'

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

/**
 * Partículas que se PRENDEM ao sobrenome seguinte — "Dall Magro"/"Dal Piva" são
 * UM sobrenome composto, não prefixo descartável como "de/da/do": cortá-las
 * mudava o nome da pessoa ("Adriano Dall Magro" virava "Adriano Magro" em toda
 * a escala cirúrgica — pedido do dono 31/07).
 */
const PREFIXOS_SOBRENOME = new Set(['dal', 'dall', 'dalla', 'del', 'della', 'di', 'van', 'von'])

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

// NOTA DE LOCAL entre parênteses no fim do nome (dono 31/07): "MATHEUS (CONSULT)"
// no rodapé é o MESMO Matheus, anotado que está no consultório — sem o strip a
// pessoa virava DUAS linhas (a do rodapé, que não casava com nada, + o vínculo
// dela como extra). A nota sai da identidade e vira rótulo de local no card.
export const stripNotaRodape = (s) => String(s || '')
  .replace(/\s*(?:\([^()]*\)|（[^（）]*）)\s*$/, '')
  .trim()
const stripNota = stripNotaRodape

/** Texto da nota entre parênteses no FIM do nome ("MATHEUS (CONSULT)" → "CONSULT"); null sem nota. */
export const notaDoNome = (s) => {
  const m = /(?:\(([^()]*)\)|（([^（）]*)）)\s*$/.exec(String(s || ''))
  return m ? String(m[1] ?? m[2] ?? '').trim() || null : null
}

/** Nota → rótulo exibível ("CONS"/"CONSULT"/"CONSULTÓRIO" → "Consultório"). */
export const rotuloNota = (nota) => {
  if (!nota) return null
  const normalizada = String(nota).normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  if (/^cons/i.test(normalizada)) return 'Consultório'
  return titleCaseNome(nota)
}

/**
 * Divide o campo editável do rodapé sem quebrar vírgulas dentro de notas de local.
 * Ex.: "ANEST A, ANEST B (CONSULT, APOIO), ANEST C" preserva exatamente 3 slots.
 */
export function separarListaRodape(valor) {
  const itens = []
  let atual = ''
  let nivel = 0
  const push = () => {
    const item = atual.trim()
    if (item) itens.push(item)
    atual = ''
  }
  for (const ch of String(valor || '')) {
    if (ch === '(' || ch === '（') nivel += 1
    if ((ch === ')' || ch === '）') && nivel > 0) nivel -= 1
    if ((ch === ',' || ch === '\n' || ch === '\r') && nivel === 0) push()
    else atual += ch
  }
  push()
  return itens
}

/** Normaliza p/ casamento entre anestesista do caso e nome do rodapé (acento/caixa/PED/nota-insensível). */
const norm = (s) =>
  stripNota(stripPed(s))
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
  let i = tokens.length - 1
  for (let j = tokens.length - 1; j >= 1; j--) {
    if (!PARTICULAS.has(tokens[j].toLowerCase())) {
      i = j
      break
    }
  }
  // sobrenome COMPOSTO vem inteiro ("Dall Magro", "Dal Piva") — o prefixo nunca
  // é o primeiro nome (guarda i-1 >= 1)
  while (i - 1 >= 1 && PREFIXOS_SOBRENOME.has(tokens[i - 1].toLowerCase())) i--
  return `${first} ${tokens.slice(i).map(titleCaseToken).join(' ')}`
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
  // Preserva a REFERÊNCIA do caso quando nada muda (dono 19/08, resposta tátil):
  // o update otimista troca só o caso tocado; se este map clonasse todos, o
  // React.memo do CasoCard nunca acertaria e cada toque re-renderizava o quadro
  // inteiro. A função segue pura — o clone só existe quando o valor muda.
  return casos.map((c) => {
    const anestesista = resolvido.get(c) ?? stripPed(c.anestesista)
    return anestesista === c.anestesista ? c : { ...c, anestesista }
  })
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
 * @param {object} [opts]  { hospital, ajudaExterna, resolverUid, assumidas } — ajudaExterna = nomes em AZUL
 *   no rodapé (anestesistas de OUTRO hospital ajudando no dia): vão para o FIM
 *   da lista, pois são os PRIMEIROS a serem liberados (regra do dono 2026-07-15).
 *   resolverUid = (nome) => uid|null (dicionário escala_anestesista_alias): variantes do
 *   mesmo anestesista ("GUILHERME DIDOMENICO" no rodapé, "GUILHERME D." no caso) colapsam
 *   numa linha só — sem isso a variante do caso virava linha EXTRA no fim da lista e
 *   roubava o "próximo a ser liberado" (bug real do piloto, 2026-07-21).
 *   assumidas = { [chaveSlot]: { uid, nome } } (linha_overrides[chave].assumidaPor): o slot
 *   do rodapé TROCA DE IDENTIDADE — exibe quem assumiu, aponta o uid de quem assumiu e
 *   consome o grupo de casos dessa pessoa, que é REMOVIDA dos extras (caso real 30/07:
 *   Giovana assumiu os casos do Maurício na Unimed e virava linha extra "primeira a ser
 *   liberada" em vez de ocupar a posição dele). A chave do slot NÃO muda (marcações já
 *   gravadas continuam valendo) e a ordem do rodapé NUNCA é escrita.
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
 *
 * `linha.noRodape` distingue as duas coisas: true = a linha OCUPA posição na
 * ordem publicada; false = entrou só na exibição (extra, ajuda avulsa,
 * visitante). Regra que fale em posição na fila lê `noRodape`, não o índice.
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
  // VÍNCULO LOCAL nome→uid a partir dos PRÓPRIOS casos (bug 30/07): definir o
  // anestesista pelo seletor grava uid + apelido no caso, mas o RODAPÉ só resolve
  // uid pelo dicionário. Sem o alias lá (vínculo novo, ou o 403 de 29/07 que
  // bloqueava o aprendizado), o MESMO nome virava DUAS chaves — a linha do rodapé
  // ficava vazia na posição dela e os casos da pessoa nasciam como linha EXTRA no
  // fim, o que para quem usa é "definir anestesista mudou a ordem da fila".
  // Os casos são fonte legítima do vínculo: o uid deles veio de um seletor de
  // roster, não de texto. Nome que aponta para 2+ uids é ambíguo e fica de fora
  // (mesma regra do dicionário: 1º nome com >1 candidato nunca casa sozinho).
  const uidLocalPorNome = new Map()
  {
    const ambiguos = new Set()
    for (const c of resolvidos) {
      const uid = c.anestesistaUserId
      const n = norm(String(c.anestesista || '').trim())
      if (!uid || !n || /^\?+$/.test(n) || n.includes('+')) continue
      const atual = uidLocalPorNome.get(n)
      if (atual && atual !== uid) ambiguos.add(n)
      else uidLocalPorNome.set(n, uid)
    }
    for (const n of ambiguos) uidLocalPorNome.delete(n)
  }
  // chave canônica: uid do vínculo (caso já atribuído OU dicionário OU casado nos
  // casos desta escala) > nome normalizado
  const resolveKey = (nome, uidCaso = null) => {
    const n = norm(nome)
    // resolverUid recebe o nome SEM a nota "(CONSULT)" — o dicionário guarda apelidos limpos
    const uid = uidCaso || resolverUid(stripNota(String(nome || ''))) || uidLocalPorNome.get(n) || null
    return { key: uid || n, uid }
  }
  const displayDe = (nome, uid) => (uid && nomeExibicao(uid, nome)) || titleCaseNome(stripNota(String(nome || '')))

  // mapa chave(anestesista) -> { display, tokens:[] }
  const grupos = new Map()
  const ordemEncontro = []
  const incerteza = [] // casos "?" (regra 10)

  // Caso encerrado (Terminada/Suspensa) SAI da linha do anestesista em tempo real
  // (pedido do dono 2026-07-21): sala e cirurgião somem quando encerram. A linha
  // NÃO some nem auto-libera — `teveCasos` distingue "tudo encerrado" (fica ativa,
  // aguardando o plantonista) de "nunca escalado" (liberado por definição).
  // fonte única desde 21/08 — a cópia local aqui era uma das quatro que existiam

  for (const c of resolvidos) {
    const nome = String(c.anestesista || '').trim()
    // Caso "?" explícito (regra 10) OU anestesista literal "?"/"??" OU sem
    // anestesista resolvível (linha órfã sem acima p/ herdar, ou "//" no 1º caso
    // da sala): vira ALERTA no fim da lista com horário/sala/procedimento — o
    // plantonista precisa VER a sala descoberta, nunca sumir em silêncio.
    if (c.semAnestesista || !nome || nome === '//' || /^\?+$/.test(nome)) {
      if (casoConcluido(c)) continue // alerta "?" some quando o caso encerra
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
        grupos.set(key, { display: displayDe(parte, uid), tokens: [], tokenHora: {}, tokenTermino: {}, tokenAndamento: {}, casosAtivos: 0, casoIds: [], salas: [], teveCasos: false, uid: uid || null, nomeOriginal: parte })
        ordemEncontro.push(key)
      }
      const g = grupos.get(key)
      g.teveCasos = true
      if (casoConcluido(c)) continue // encerrado: some da linha (sala/cirurgião saem)
      g.casosAtivos += 1 // p/ a linha de cobertura ("N cirurgias · M com término")
      // ids das cirurgias AINDA ABERTAS da pessoa (dono 24/08): é o que o
      // "Terminei" da fila encerra de uma vez. Só id de verdade — caso ainda sem
      // id (otimista/demo) não tem o que atualizar no servidor.
      if (c.id) g.casoIds.push(c.id)
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
    // ids das cirurgias abertas — alimenta o "Terminei" da linha
    casoIds: g ? [...g.casoIds] : [],
    casosComTermino: g ? Object.keys(g.tokenTermino).length : 0,
    salas: g ? g.salas : [],
    // chave ESTÁVEL p/ marcações (uid do vínculo ou nome normalizado) + nome
    // ORIGINAL do rodapé p/ persistir reordenação — o nome EXIBIDO muda com
    // vínculos/diferenciação e corrompia marcações e rodapé (bug real 2026-07-22).
    // Default NULL de propósito (defeito D12): defaultar para o display fazia um
    // call site esquecido alimentar marcações com um nome que muda — a classe
    // exata do bug de 22/07. Todo call site passa nomeOriginal explícito.
    chave: '',
    uid: null,
    nomeOriginal: null,
    // teve caso hoje (mesmo que todos já encerrados) — NÃO auto-liberar
    teveCasos: !!g?.teveCasos,
    isPlantonista: false,
    isAjuda: false,
    isProximoPlantao: false,
    ajudaIdx: null,
    ajudaFora: false,
    plantaoLabel: null, // "Plantão da tarde"/"Plantão da manhã" — rótulo vem da lib
    assumida: null, // slot assumido: { deNome, deUid } = quem ocupava a posição antes
    notaRodape: null, // nota "(CONSULT)" do rodapé → rótulo de local no card
    isExtra: false, // tem caso mas NÃO está no rodapé (ver aviso do JSDoc)
    // DE ONDE A PESSOA VEIO quando isso é conhecido — slug + rótulo do hospital
    // de origem (derivado do rodapé de lá ou informado à mão). Decide a ordem da
    // cauda E o texto do badge "Ajuda (HRO)"; a view não cruza escalas de novo.
    origemHospital: null,
    origemLabel: null,
    // OCUPA POSIÇÃO NA ORDEM PUBLICADA. É o oposto de "apareceu na tela": a
    // lista de exibição carrega extras, ajudas e visitantes que NÃO estão no
    // rodapé, e toda regra que fala em "os últimos da lista de liberação"
    // (a cauda que nasce liberada, dono 21/08) é sobre a ORDEM, não sobre a
    // tela. Sem este flag a fronteira da cauda se move sozinha quando um
    // visitante com cirurgia entra no fim — foi o caso Vicente/Gabriela de
    // 24/08 na Unimed.
    noRodape: false,
    texto: `${display} — ${g && g.tokens.length ? cirurgioesOrdenados(g).join('/') : '…'}`,
    ...extra,
  })

  // EMPRESTADOS (dono 30/07 — caso TIAGO): o azul no rodapé tem DOIS sentidos e o
  // cruzamento desambigua. Quem tem caso AQUI veio ajudar aqui (bloco do fim).
  // Quem tem caso em OUTRO hospital foi emprestado para lá — e o dono decidiu:
  // MANTÉM a posição de liberação no hospital de origem, com badge de Ajuda e o
  // destino no card. `ajudandoFora` vem da view (cruza as escalas carregadas);
  // aceita uid E nome porque o rodapé pode resolver por qualquer um dos dois.
  const foraKeys = new Set()
  for (const f of opts.ajudandoFora || []) {
    if (f?.uid) foraKeys.add(f.uid)
    const n = norm(f?.nome || '')
    if (n) foraKeys.add(n)
    const { key: k } = resolveKey(f?.nome || '', f?.uid || null)
    if (k) foraKeys.add(k)
  }

  // SLOTS ASSUMIDOS (dono 30/07 — troca declarada executada): lookup pela chave
  // do slot, com fallback pelo nome do rodapé e pelo uid — a chave gravada pode
  // ter vindo do dicionário enquanto a derivada aqui veio de uidLocalPorNome
  // (ou vice-versa; após a transferência os casos deixam de ensinar o nome antigo).
  const assumidas = opts.assumidas || null
  const assumidaDe = (key, nomeRodape, uid) => {
    if (!assumidas) return null
    const a = assumidas[key] || assumidas[norm(nomeRodape)] || (uid && assumidas[uid]) || null
    return a && (a.uid || a.nome) ? a : null
  }
  // Quem assumiu um slot é removido dos extras/azuis-avulsos por este set — NÃO
  // por `usados`: no swap dentro do MESMO hospital os dois slots trocam de
  // identidade entre si, e marcar a pessoa em `usados` pularia o slot dela.
  const consumidos = new Set()
  // Dono de slot assumido que AINDA tem casos aqui (ex.: republicação re-importou
  // os casos no nome antigo): os casos dele não podem sumir da fila — reaparecem
  // como linha EXTRA (verdade dos dados), sem desfazer a assunção nem mexer na ordem.
  const donosComCasos = new Set()

  const principais = []
  const linhasAjuda = []
  const usados = new Set()
  for (const nomeRodape of ordem) {
    const { key, uid } = resolveKey(nomeRodape)
    if (usados.has(key)) continue // rodapé com variantes do mesmo anestesista → 1 linha
    usados.add(key)
    const asm = assumidaDe(key, nomeRodape, uid)
    let l
    if (asm) {
      const { key: keyAsm, uid: uidAsm } = resolveKey(asm.nome || '', asm.uid || null)
      if (grupos.has(key) && key !== keyAsm) donosComCasos.add(key)
      consumidos.add(keyAsm)
      if (uidAsm) consumidos.add(uidAsm)
      const nAsm = norm(asm.nome || '')
      if (nAsm) consumidos.add(nAsm)
      // emprestado/azul avaliados pela pessoa que ASSUMIU — a linha agora é ela
      // (avaliar pelo antigo dono marcava "Ajuda (destino)" no slot recém-assumido).
      const emprestadoAsm = foraKeys.has(keyAsm) || (nAsm && foraKeys.has(nAsm))
      l = linha(displayDe(asm.nome, uidAsm || asm.uid || null), grupos.get(keyAsm), {
        isAjuda: azuis.has(key) || azuis.has(keyAsm) || emprestadoAsm,
        ajudaFora: emprestadoAsm,
        chave: key, uid: uidAsm || asm.uid || null, nomeOriginal: nomeRodape,
        // deNomeOriginal = nome CRU do rodapé (defeito D8, 07/08): o desfazer
        // casa o dono por normNome, e o display curto ("G. Staub") não bate com
        // o cadastro ("Guilherme Staub") — o desfazer degradava p/ "só posição"
        // por diferença de FORMATO do nome. deNome segue sendo só exibição.
        // `local` = de onde veio quem assumiu, quando ele não estava em escala
        // nenhuma (consultório/folga) — é a resposta de "cadê o titular" na fila
        assumida: { deNome: displayDe(nomeRodape, uid), deNomeOriginal: nomeRodape, deUid: uid || null, motivo: asm.motivo || null, local: asm.local || null },
      })
      // A pessoa acabou de herdar posição + casos: nunca cair em "não escalado"
      // (nasceria liberada e afundaria) mesmo que os casos ainda estejam a caminho.
      l.teveCasos = true
    } else {
      const emprestado = foraKeys.has(key) || foraKeys.has(norm(nomeRodape))
      // AZUL do rodapé SEM caso aqui (dono 31/07 — caso LEONARDO): é gente NOSSA
      // emprestada. O caso dela no destino pode sumir (repasse a um colega de lá)
      // e a posição DAQUI não pode afundar por isso — só desce ao bloco do fim
      // quem tem caso AQUI (veio ajudar aqui, regra do caso TIAGO 30/07).
      const azulSemCasoAqui = azuis.has(key) && !grupos.has(key)
      const notaRodape = rotuloNota(notaDoNome(nomeRodape))
      l = linha(displayDe(nomeRodape, uid), grupos.get(key), {
        isAjuda: azuis.has(key) || emprestado,
        ajudaFora: emprestado || azulSemCasoAqui,
        chave: key, uid: uid || null, nomeOriginal: nomeRodape,
        // "MATHEUS (CONSULT)": a nota diz ONDE a pessoa está — vira o local do
        // card quando a escala não traz sala p/ ela (dono 31/07)
        notaRodape,
      })
      // Nota de local no rodapé é uma posição de trabalho explícita. Mesmo sem
      // caso, a pessoa está escalada naquele local e não pode nascer liberada.
      if (notaRodape) l.teveCasos = true
      // emprestado NÃO desce para o bloco de ajuda: a posição dele é a do rodapé.
      // E tem trabalho — em OUTRO hospital: sem `teveCasos` ele cairia em "não
      // escalado" e nasceria liberado, afundando para o fim (mesma armadilha dos
      // cards noturnos, 24/07). A liberação dele continua sendo decidida AQUI.
      if (emprestado || azulSemCasoAqui) l.teveCasos = true
    }
    // veio da ORDEM publicada (ou da ordem derivada dos casos, quando o
    // hospital publica sem rodapé) — vale mesmo indo para o bloco do fim
    l.noRodape = true
    ;(l.isAjuda && !l.ajudaFora ? linhasAjuda : principais).push(l)
  }
  // azuis listados só em ajudaExterna (fora do rodapé) também entram ao fim
  for (const nomeAzul of opts.ajudaExterna || []) {
    const { key, uid } = resolveKey(nomeAzul)
    if (!key || usados.has(key) || consumidos.has(key)) continue
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
  // preservando ordem de encontro (são da escala do hospital). Quem ASSUMIU um
  // slot já está representado nele — vir também como extra duplicaria a pessoa
  // (e no fim da fila, que era exatamente o bug que a assunção corrige).
  const extras = []
  for (const key of ordemEncontro) {
    if ((usados.has(key) && !donosComCasos.has(key)) || consumidos.has(key)) continue
    const g = grupos.get(key)
    if (g.uid && consumidos.has(g.uid)) continue
    // dono de slot assumido reaparecendo com casos próprios: a chave do slot já
    // está em uso na linha assumida — namespace evita chave duplicada (React
    // omitia/duplicava linhas com a mesma chave, bug real da fase noturna).
    const chaveExtra = donosComCasos.has(key) ? `${key}#casos` : key
    extras.push(linha(g.display, g, { chave: chaveExtra, uid: g.uid || null, nomeOriginal: g.nomeOriginal, isExtra: true }))
  }
  // Plantonista = 1º nome NÃO-AZUL: com o azul-sem-caso mantendo a posição
  // (31/07), um emprestado que abre o rodapé ficaria com o selo de plantonista
  // de um hospital onde ele nem está — o selo pula para o 1º dos nossos.
  const linhaPlantonista = principais.find((l) => !l.isAjuda) || principais[0]
  if (linhaPlantonista) linhaPlantonista.isPlantonista = true
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
    // SEM guard de teveCasos/isAjuda (dono 31/07: "todos os plantões de
    // contraturno contenham o badge"): quem fecha o rodapé leva o selo MESMO sem
    // caso hoje — em 31/07 nem ADRIANO (HRO) nem ALEXANDRE D (Unimed) mostravam
    // o selo porque estavam sem casos. Sem casos a linha continua nascendo
    // liberada (naoEscalado), só que no fim e identificada.
    //
    // EXCEÇÃO: o PLANTONISTA do turno atual (defeito D11, 07/08). Quando o único
    // nome nosso do rodapé é também o último (o resto é ajuda de fora), a mesma
    // pessoa levava os DOIS selos e era MOVIDA para o fim — e o fim libera
    // primeiro: o plantonista viraria o primeiro a sair. Segurar o plantão do
    // hospital prevalece; a pessoa mantém os dois selos e fica no topo.
    if (i >= 0 && !de[i].isPlantonista) {
      de[i].isProximoPlantao = true
      de[i].plantaoLabel = PLANTAO_LABEL[opts.turno]
      proximoPlantao = de.splice(i, 1)[0]
    } else if (i >= 0) {
      de[i].isProximoPlantao = true
      de[i].plantaoLabel = PLANTAO_LABEL[opts.turno]
    }
  }

  // VISITANTES DE OUTRO HOSPITAL (dono 31/07): quem está AQUI de ajuda vinda de
  // outro hospital sai PRIMEIRO — e entre eles vale a ORDEM DE LIBERAÇÃO do
  // rodapé de ORIGEM (quem sairia antes lá, sai antes aqui), não a ordem do
  // array de ajuda nem a de encontro dos casos. `rodapeOutros` vem da view
  // (rodapés das outras escalas carregadas): `{ nome, uid, hospital, rodapeIdx }`
  // — `hospital` é o SLUG ('materno'/'hro'/'unimed'), usado no nível de origem
  // abaixo; sem ele o Materno perde a precedência e vira "outro hospital".
  const origemIdx = new Map()
  const origemHosp = new Map()
  const origemLabel = new Map()
  for (const r of opts.rodapeOutros || []) {
    if (r?.rodapeIdx == null) continue
    const { key, uid } = resolveKey(r.nome || '', r.uid || null)
    for (const k of [key, uid]) {
      if (!k || origemIdx.has(k)) continue
      origemIdx.set(k, r.rodapeIdx)
      origemHosp.set(k, r.hospital || null)
      origemLabel.set(k, r.hospitalLabel || null)
    }
  }
  const porChave = (mapa, l) => mapa.get(l.chave)
    ?? (l.uid != null ? mapa.get(l.uid) : undefined)
    ?? mapa.get(norm(l.nomeOriginal || ''))
    ?? null
  // ORIGEM INFORMADA À MÃO (dono 27/08): `{ [chave]: { hospital, label } }`, vindo
  // de `linha_overrides[turno:chave].origem`. Existe porque o MATERNO costuma não
  // ter escala publicada — quem veio de lá não está em rodapé nenhum e não há de
  // onde derivar a origem. A marca VENCE a derivada: é declaração humana sobre
  // uma pessoa que a estrutura não consegue enxergar.
  const manual = opts.origemManual || {}
  const marcaDe = (l) => manual[l.chave] || (l.uid != null ? manual[l.uid] : null) || null
  const hospOrigem = (l) => marcaDe(l)?.hospital || porChave(origemHosp, l) || null
  const idxOrigem = (l) => {
    const m = marcaDe(l)
    const derivado = porChave(origemIdx, l)
    if (!m) return derivado
    // marcada como sendo do MESMO hospital em que ela já aparece: a posição real
    // de lá continua valendo. De outro hospital (ou de nenhum): sem ordem própria
    // — cai em 0 e o sort estável preserva a ordem em que já estava.
    return (porChave(origemHosp, l) === m.hospital && derivado != null) ? derivado : 0
  }
  // extra com origem conhecida é visitante → sai dos extras e entra no bloco do fim
  const extrasLocais = []
  const visitantesExtras = []
  for (const l of extras) (idxOrigem(l) != null ? visitantesExtras : extrasLocais).push(l)
  // ORDEM DA CAUDA (dono 27/08): "sempre os primeiros a irem embora são os
  // plantões do contraturno, após os anestesistas que estariam escalados no
  // materno, e após os anestesistas de outro hospital, sempre respeitando a
  // ordem de liberação do hospital de origem".
  //
  // A lista corre de cima para baixo e o FIM libera primeiro, então "sai antes"
  // = "mais embaixo" = comparador MAIOR. O plantão do contraturno já fecha a
  // lista por fora deste sort (`proximoPlantao`, regra de 29/07); aqui ficam os
  // dois níveis seguintes: Materno abaixo dos demais hospitais, e dentro de cada
  // hospital o índice do rodapé de ORIGEM ascendente (índice maior lá = sai
  // antes lá = mais embaixo aqui).
  const MATERNO = 'materno'
  const nivelOrigem = (l) => (hospOrigem(l) === MATERNO ? 1 : 0)
  const fimAjuda = [...linhasAjuda, ...visitantesExtras]
  fimAjuda.sort((a, b) => {
    const ia = idxOrigem(a)
    const ib = idxOrigem(b)
    if (ia != null && ib != null) {
      const na = nivelOrigem(a)
      const nb = nivelOrigem(b)
      if (na !== nb) return na - nb // Materno mais embaixo: sai antes dos outros hospitais
      return ia - ib
    }
    if (ia != null) return 1
    if (ib != null) return -1
    return 0 // sem origem: mantém a ordem já resolvida (array de ajuda) — sort é estável
  })
  // ordem derivada da origem → sem setas de reordenar (o array de ajuda não manda
  // mais aqui); e visitante com origem conhecida está TRABALHANDO (veio de fora
  // p/ isso) — mesmo sem caso restante (repasse) não nasce "não escalado"/liberado.
  for (const l of fimAjuda) {
    if (idxOrigem(l) == null) continue
    l.ajudaIdx = null
    l.teveCasos = true
  }
  // DE ONDE VEIO, na própria linha — FONTE ÚNICA do badge "Ajuda (HRO)". A view
  // cruzava as escalas de novo para escrever esse rótulo, e com a marca manual
  // passariam a existir dois caminhos para a mesma frase: dois lugares divergem
  // no primeiro ajuste. Quem decide a ORDEM decide o RÓTULO.
  // ⚠️ a condição é TER ORIGEM, não ter o slug do hospital: `hospital` é opcional
  // em `rodapeOutros` (sem ele vale a regra de 31/07, só o índice) e gatear pelo
  // slug deixava sem rótulo justamente a chamada que só manda nome + índice.
  for (const l of [...principais, ...extrasLocais, ...fimAjuda, ...(proximoPlantao ? [proximoPlantao] : [])]) {
    const m = marcaDe(l)
    if (!m && idxOrigem(l) == null) continue
    l.origemHospital = hospOrigem(l)
    l.origemLabel = m?.label || porChave(origemLabel, l) || null
  }

  const linhas = [...principais, ...extrasLocais, ...fimAjuda, ...(proximoPlantao ? [proximoPlantao] : [])]

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
    // plantonista = 1º nome NÃO-azul do rodapé (azul é ajuda de outro hospital;
    // com o azul-sem-caso mantendo posição desde 31/07, o 1º principal pode ser azul)
    plantonista: linhaPlantonista ? linhaPlantonista.anestesista : null,
  }
}
