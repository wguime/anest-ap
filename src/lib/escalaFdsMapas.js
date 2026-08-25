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
 */
export function classificarAnexoMapa(resposta, { sabadoISO, domingoISO, datasAlvo } = {}) {
  const hospital = HOSPITAIS_MAPA.includes(texto(resposta?.hospitalDetectado))
    ? texto(resposta.hospitalDetectado)
    : ''
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
export function anestesistaDoPosto(grade, hospital, turno) {
  const faixa = FDS_TURNO_FAIXA[turno]
  if (!faixa || !grade?.[faixa]) return ''
  // ret1/ret2 são retaguarda de chamada, não posto de sala: não sugerem ninguém
  const col = hospital === 'unimed' ? 'unimed' : hospital === 'hro' ? 'hro' : ''
  return col ? texto(grade[faixa][col]) : ''
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
