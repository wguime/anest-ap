/**
 * Escala Cirúrgica — MAPAS CIRÚRGICOS do fim de semana (dono 2026-08-22).
 *
 * No fim de semana os arquivos chegam TODOS JUNTOS no mesmo dia: o documento
 * "ESCALA DE FINAL DE SEMANA" (posições e filas dos dois dias) mais um mapa
 * cirúrgico por hospital e por dia. Antes, cada mapa só entrava pelo fluxo de
 * dia útil — uma passagem por TURNO, com hospital e data escolhidos à mão.
 *
 * ⚠️ O fluxo de DIA ÚTIL não muda (dono 2026-08-22): lá as escalas são postadas
 * em turnos diferentes porque são disponibilizadas em horas diferentes, e a
 * organização de lá está estabelecida. Nada neste arquivo é chamado por
 * `ImportarEscalaPage`.
 *
 * O que torna a leitura correta é `turnoDoCasoImportado`: o turno passa a sair
 * da FAIXA "MATUTINO"/"VESPERTINO" do próprio documento quando a linha não tem
 * hora. Sem isso, as linhas "AS" (a seguir) — 6 das 15 cirurgias do HRO em
 * 22/08 — herdam o período que estava selecionado no momento do anexo, e o
 * mesmo arquivo nunca produz manhã e tarde corretas numa leitura só.
 */
import { FDS_TURNO_FAIXA } from '@/lib/escalaFds'
import { hospitalPelaEstrutura, decidirHospital } from '@/lib/escalaHospitalEstrutura'

/** Hospitais reais que um mapa pode alimentar (a linha 'fds' não é hospital). */
export const HOSPITAIS_MAPA = ['unimed', 'hro', 'materno']

export const TURNOS_MAPA = ['matutino', 'vespertino']

const texto = (v) => String(v ?? '').trim()
const normNome = (s) => texto(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()

/**
 * Turno da HORA, quando ela existe e é legível. Espelha `turnoDeHora` de
 * pages/escala-cirurgica/utils (mesma fronteira 13h) — repetido aqui de
 * propósito: esta lib é pura e não deve importar da árvore de páginas.
 */
export function turnoDeHoraMapa(hora) {
  const m = /^(\d{1,2})(?::?(\d{2}))?\s*h?$/i.exec(texto(hora))
  if (!m) return null
  const h = Number(m[1])
  const min = m[2] == null ? 0 : Number(m[2])
  if (!Number.isFinite(h) || !Number.isFinite(min) || h > 23 || min > 59) return null
  return h < 13 ? 'matutino' : 'vespertino'
}

/**
 * Turno de um caso recém-importado, em ordem de autoridade:
 *   1. a HORA da linha (é ela que a publicação usa para separar os turnos);
 *   2. a FAIXA do documento (`caso.turno`, vindo da edge com secoesTurno);
 *   3. o turno padrão de quem chama (último recurso).
 *
 * A hora vem antes da faixa porque `selecionarCasosDoTurno` republica por hora:
 * um caso com hora 13:00 carimbado "matutino" sairia da escala da tarde na
 * primeira republicação. Divergência entre os dois é rara e a hora é o dado que
 * o resto do módulo consome.
 */
export function turnoDoCasoImportado(caso, turnoPadrao = 'matutino') {
  const daHora = turnoDeHoraMapa(caso?.hora)
  if (daHora) return daHora
  const daFaixa = texto(caso?.turno)
  if (TURNOS_MAPA.includes(daFaixa)) return daFaixa
  return TURNOS_MAPA.includes(turnoPadrao) ? turnoPadrao : 'matutino'
}

/** Carimba o turno de cada caso do lote (uma leitura serve os dois turnos). */
export function carimbarTurnos(casos, turnoPadrao = 'matutino') {
  return (casos || []).map((c) => ({ ...c, turno: turnoDoCasoImportado(c, turnoPadrao) }))
}

/**
 * A que escala um anexo pertence. O documento se declara: o layout diz o
 * hospital (`hospitalDetectado`) e o cabeçalho diz a data (`dataDetectada` —
 * "22/08/2026 HRO"). Ambos são SUGESTÃO: `confirmar` marca o que a leitura não
 * resolveu, para a tela pedir em vez de escolher sozinha (regra da casa: sugere,
 * nunca troca sozinho).
 *
 * Desde 31/08 (auditoria) o CONTEÚDO vota junto com o layout, como o dia útil
 * faz desde 30/08 (`escalaHospitalEstrutura`) — o FDS tinha ficado só com o
 * layout, e é aqui que a lacuna é mais perigosa: o mapa do HRO de feriado não
 * tem coluna ANEST nem rodapé vermelho (as duas assinaturas do layout) e casa
 * quase palavra por palavra com o Materno. Mesma assimetria de lá: uma marca
 * PREENCHE o que a leitura deixou vazio; são precisas DUAS para contradizer o
 * que ela afirmou — e contradição PERGUNTA (`conflitoHospital`), nunca troca.
 */
export function classificarAnexoMapa(resposta, { sabadoISO, domingoISO, datasAlvo } = {}) {
  const lido = HOSPITAIS_MAPA.includes(texto(resposta?.hospitalDetectado))
    ? texto(resposta.hospitalDetectado)
    : ''
  const { hospital, conflito } = decidirHospital(lido, hospitalPelaEstrutura(resposta))
  const detectada = texto(resposta?.dataDetectada)
  const datas = Array.isArray(datasAlvo) && datasAlvo.length
    ? datasAlvo.filter(Boolean)
    : [sabadoISO, domingoISO].filter(Boolean)
  const doFimDeSemana = datas.includes(detectada)
  return {
    hospital,
    data: doFimDeSemana ? detectada : '',
    // data lida mas de OUTRO fim de semana é informação, não ruído: quem anexa
    // o arquivo do sábado passado precisa saber por que ele não encaixou
    dataForaDoFimDeSemana: detectada && !doFimDeSemana ? detectada : '',
    // layout e conteúdo em contradição: o arquivo pede confirmação, com o que
    // o conteúdo viu — a tela pergunta em vez de escolher
    conflitoHospital: conflito,
    confirmar: [!hospital && 'hospital', !doFimDeSemana && 'data'].filter(Boolean),
  }
}

/** Contagem por turno + o que ainda falta resolver, para a lista de documentos. */
export function resumoMapa(casos) {
  const lista = casos || []
  let matutino = 0
  let vespertino = 0
  let semAnestesista = 0
  for (const c of lista) {
    if (turnoDoCasoImportado(c) === 'vespertino') vespertino += 1
    else matutino += 1
    if (c?.semAnestesista || /^\?*$/.test(texto(c?.anestesista))) semAnestesista += 1
  }
  return { total: lista.length, matutino, vespertino, semAnestesista }
}

/**
 * Quem a GRADE põe naquele hospital naquele turno (dono 2026-08-22: "sugerir
 * pelo posto da grade"). O mapa do HRO de sábado 22/08 veio com a coluna do
 * anestesista VAZIA nas 6 cirurgias da tarde; a tabela de posições diz que das
 * 13–19h o HRO é do Rômulo. A sugestão é exibida como sugestão e o Select
 * continua mandando — a atribuição nunca é gravada sozinha.
 *
 * Retorna o NOME como está na grade (o mesmo texto das posições), ou ''.
 */
export function anestesistaDoPosto(grade, hospital, turno, dataIso = null) {
  const faixa = FDS_TURNO_FAIXA[turno]
  if (!faixa || !grade?.[faixa]) return ''
  // ⚠️ SÓ NA MANHÃ DE SÁBADO (dono 29/08: "quero que somente haja preenchimento
  // automático de informações sobre escalação no sábado de manhã; a partir
  // disso, sempre que os turnos forem trocados limpe as informações, deixe
  // todos livres e os plantões sempre trabalhando").
  //
  // A sugestão de 22/08 preenchia QUALQUER turno do FDS cuja sala viesse sem
  // nome — e é assim que o mapa de fim de semana chega quase sempre. Resultado
  // medido em 29/08: as 5 cirurgias da tarde da Unimed, em 3 salas, saíram
  // todas no nome do posto sem que ninguém tivesse escrito aquilo. O sábado de
  // manhã é o único turno em que a tabela e os mapas chegam JUNTOS e o posto
  // ainda descreve o dia; do meio-dia em diante quem sabe quem está em cada
  // sala é a equipe, não a grade.
  //
  // Sem `dataIso` a sugestão fica DESLIGADA: preencher identidade por engano é
  // pior do que não preencher (é a mesma razão de nunca chutar login).
  if (turno !== 'matutino' || !ehSabado(dataIso)) return ''
  // ret1/ret2 são retaguarda de chamada, não posto de sala: não sugerem ninguém
  const col = hospital === 'unimed' ? 'unimed' : hospital === 'hro' ? 'hro' : ''
  return col ? texto(grade[faixa][col]) : ''
}

/** Sábado no calendário local (meio-dia evita a virada de fuso). */
function ehSabado(dataIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dataIso || ''))) return false
  const d = new Date(`${dataIso}T12:00:00`)
  return !Number.isNaN(d.getTime()) && d.getDay() === 6
}

/**
 * Sugestão de atribuição para os GRUPOS que ficaram sem nome no mapa.
 * Só alcança grupo sem nenhum nome lido — grupo com nome (mesmo por resolver)
 * é dado do documento e a grade não o substitui.
 *
 * @param {Array} grupos       saída de `gruposAnestesista`
 * @param {string} nomePosto   `anestesistaDoPosto(...)`
 * @param {(nome:string)=>string|null} resolverUid  dicionário apelido→login
 * @returns {Object} chave do grupo → { uid, nome, origem: 'grade' }
 */
export function sugerirAtribuicoesDoPosto(grupos, nomePosto, resolverUid) {
  const nome = texto(nomePosto)
  if (!nome) return {}
  const uid = resolverUid ? resolverUid(nome) : null
  if (!uid) return {}   // sem login resolvido não há o que pré-selecionar
  const out = {}
  for (const g of grupos || []) {
    const lido = texto(g?.nome)
    if (lido && lido !== '?' && !/^\?+$/.test(lido)) continue
    out[g.chave] = { uid, nome, origem: 'grade' }
  }
  return out
}

/**
 * Pré-seleção do login para os grupos que TÊM nome lido no mapa, resolvido pelo
 * dicionário de apelidos. É o que a conferência de DIA ÚTIL já fazia
 * (`ImportarEscalaPage`, efeito "Pré-atribui pela resolução do apelido
 * importado") e faltava aqui: o cabeçalho mostrava "MARILIO" e o Select abaixo
 * dizia "— sem anestesista —", que se lê como "o app não entendeu".
 *
 * Não é palpite e por isso não vira "sugestão" na tela: o nome é do documento,
 * o dicionário só diz a qual login ele pertence. Nome que o dicionário não
 * resolve fica de fora — a escolha é humana (regra da casa: nunca chutar
 * identidade).
 *
 * ⚠️ DUPLA ("OSCAR + NATHALIA"): fica de fora de propósito. Um login só não
 * representa duas pessoas, e `aplicarAtribuicoes` preserva o texto com "+"
 * justamente para a fila contar a presença dos dois.
 *
 * @param {Array} grupos                            saída de `gruposAnestesista`
 * @param {(nome:string)=>string|null} resolverUid  dicionário apelido→login
 * @returns {Object} chave do grupo → uid
 */
export function sugerirAtribuicoesLidas(grupos, resolverUid) {
  const out = {}
  if (!resolverUid) return out
  for (const g of grupos || []) {
    const lido = texto(g?.nome)
    if (!lido || lido === '?' || /^\?+$/.test(lido) || lido.includes('+')) continue
    const uid = resolverUid(lido)
    if (uid) out[g.chave] = uid
  }
  return out
}

/**
 * Chave estável de um mapa na lista de documentos: um arquivo por
 * hospital+dia. Reanexar o mesmo par SUBSTITUI (a foto nova manda — mesma regra
 * do rodapé na importação de dia útil), em vez de criar um segundo item que
 * publicaria duas vezes sobre a mesma escala.
 */
export function chaveMapa(hospital, data) {
  return `${texto(hospital) || '?'}|${texto(data) || '?'}`
}

/**
 * Publicações que um lote de mapas gera: uma por (hospital, data, turno) COM
 * casos. Turno sem caso nenhum não é publicado — publicar vazio apagaria o que
 * já estivesse lá (a RPC substitui o turno inteiro).
 */
export function planoPublicacaoMapas(mapas) {
  const out = []
  for (const m of mapas || []) {
    if (!m?.hospital || !m?.data) continue
    for (const turno of TURNOS_MAPA) {
      const casos = (m.casos || []).filter((c) => turnoDoCasoImportado(c) === turno)
      if (casos.length) out.push({ mapaId: m.id, hospital: m.hospital, data: m.data, turno, casos })
    }
  }
  return out
}

/** Nomes distintos lidos no mapa (para o aviso de identidade não resolvida). */
export function nomesDoMapa(casos) {
  const vistos = new Map()
  for (const c of casos || []) {
    const t = texto(c?.anestesista)
    if (!t || t === '//' || /^\?+$/.test(t)) continue
    if (!vistos.has(normNome(t))) vistos.set(normNome(t), t)
  }
  return [...vistos.values()]
}
