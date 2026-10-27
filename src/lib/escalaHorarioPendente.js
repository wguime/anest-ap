/**
 * HORÁRIO PENDENTE — alerta público da cirurgia sem início/término (dono 05/10/2026,
 * modelo A escolhido em protótipo `.tmp/alerta-horario-pendente.html`).
 *
 * "há vários anestesistas que não estão preenchendo as informações. quero que crie um
 * alerta em escalas cirurgias marcando o anestesista que não preencheu e que seja
 * público [...] só devem sair quando as informações de início/término forem preenchidas"
 *
 * Decisões do dono na mesma conversa:
 *  - a cirurgia ENTRA no alerta quando o anestesista é LIBERADO na fila ou quando o
 *    turno ACABA (13h a manhã, 19h a tarde), o que vier primeiro;
 *  - SAI só com início E término preenchidos — ou marcada Suspensa (não aconteceu);
 *  - conta a partir da TARDE de 05/10 (`INICIO_ALERTA_HORARIO`);
 *  - dura o DIA operacional (vira às 7h); o que não foi preenchido no dia vai para o
 *    relatório de adesão (RPC `escala_horario_pendente_relatorio`, mesmas regras);
 *  - liberado com cirurgia ainda ABERTA (uma ou mais): o alerta pede os horários OU que
 *    o caso passe para o colega que assumiu — trocado o anestesista, a cirurgia sai do
 *    nome de quem foi liberado e volta a seguir a regra pelo nome novo.
 *
 * Sem push e sem caixa de entrada (a escala parou de notificar em 30/07): é só tela.
 * Puro — sem React, sem Supabase. Identidade (uid/apelido) e "liberado" chegam por
 * função, porque moram em `pages/escala-cirurgica/utils` e na fila.
 */

/** Primeiro turno que conta (dono 05/10: "comece a contar a partir de hoje à tarde"). */
export const INICIO_ALERTA_HORARIO = Object.freeze({ data: '2026-10-05', turno: 'vespertino' })

/** Fim de cada turno em minutos do dia operacional (o relógio da escala: 01:00 = 25:00). */
export const FIM_TURNO_MIN = Object.freeze({ matutino: 13 * 60, vespertino: 19 * 60 })

/** 07:00 do dia seguinte — a virada do dia operacional. Prazo que nunca vence no dia. */
const VIRADA_DO_DIA_MIN = 31 * 60

export const ROTULO_FALTA = Object.freeze({
  ini: 'Falta início',
  ter: 'Falta término',
  ambos: 'Sem horário',
})

const temTexto = (v) => String(v ?? '').trim() !== ''

/** O que falta na cirurgia: 'ini' | 'ter' | 'ambos' | null (completa). */
export function faltaHorario(caso) {
  const ini = temTexto(caso?.inicioReal)
  const ter = temTexto(caso?.terminoReal)
  if (ini && ter) return null
  if (!ini && !ter) return 'ambos'
  return ini ? 'ter' : 'ini'
}

/** Turno do caso: o publicado vence; sem ele, a hora (antes das 13h = manhã). */
export function turnoDoCasoHorario(caso) {
  if (caso?.turno === 'matutino' || caso?.turno === 'vespertino') return caso.turno
  const m = /^(\d{1,2}):(\d{2})/.exec(String(caso?.hora || '').trim())
  if (!m) return 'matutino'
  return Number(m[1]) * 60 + Number(m[2]) < FIM_TURNO_MIN.matutino ? 'matutino' : 'vespertino'
}

/** Dentro da janela que conta (a partir da tarde de 05/10). */
export function dentroDoInicioDoAlerta(data, turno) {
  const d = String(data || '')
  if (!d) return false
  if (d > INICIO_ALERTA_HORARIO.data) return true
  if (d < INICIO_ALERTA_HORARIO.data) return false
  return turno === 'vespertino'
}

/**
 * Partes do anestesista do caso: "A + B" conta para os DOIS; "?" não é pessoa. O uid do
 * caso só vale com um nome só (dupla é `uid: null` por construção — incidente 02/09).
 */
export function anestesistasDoCaso(caso) {
  const partes = String(caso?.anestesista || '')
    .split(/\s*\+\s*/)
    .map((s) => s.trim())
    .filter((s) => s && s !== '//' && !/^\?+$/.test(s))
  const uid = partes.length === 1 ? (caso?.anestesistaUserId || null) : null
  return partes.map((alias) => ({ alias, uid }))
}

/**
 * CONSULTÓRIO NÃO PEDE HORÁRIO (dono 16/10/2026): "consultório tem horário definido —
 * manhã das 7:45 às 11:30 e à tarde das 13:30 às 17:00". O que marca é o PROCEDIMENTO
 * ("CONSULTORIO", "CONSULTÓRIO – AJUDA", "11 CONSULTAS"), não a sala: em 10/2026 uma
 * blefaroplastia foi lançada na sala "Consultório" e essa continua pedindo horário. Em toda a
 * base, todo procedimento com "consult" estava na sala Consultório. Mesmo corte no banco
 * (`escala_caso_trava_liberacao`, relatório e "Seu preenchimento", migration 20261016150000).
 */
export const ehConsultorio = (caso) => /CONSULT/i.test(String(caso?.procedimento || ''))

/**
 * A cirurgia é da conta do alerta? Mesmos cortes do relatório (SQL): com procedimento,
 * com anestesista, não suspensa, não continuação (a da tarde herda o caso da manhã — a
 * mesma cirurgia não conta duas vezes, como na cobrança; a que herda o TÉRMINO entra pelo
 * par, `paresDeContinuacao`), dentro da janela.
 */
export function casoEntraNaConta(caso, { data } = {}) {
  if (!pedeHorario(caso) || caso.isContinuacao) return false
  return dentroDoInicioDoAlerta(data, turnoDoCasoHorario(caso))
}

/** Os cortes da conta sem a continuação e sem a janela: a cirurgia é de alguém e pede horário. */
function pedeHorario(caso) {
  if (!caso || !temTexto(caso.procedimento)) return false
  if (caso.semAnestesista) return false
  if (caso.statusExtra === 'suspensa' || caso.statusCirurgia === 'suspensa') return false
  if (ehConsultorio(caso)) return false
  return anestesistasDoCaso(caso).length > 0
}

/**
 * A CONTINUAÇÃO HERDA O TÉRMINO (dono 27/10, às 19:52). No HRO, a microcirurgia da Sala 1
 * estava com o Guilherme Melo, "Iniciada · Passa para tarde". A escala da tarde pôs a
 * continuação com a Fernanda, que marcou o card dela 13:00→13:32. Mesmo assim, o "Falta
 * término" seguia no nome dele. O dono: "quero que essa herança de não ter marcado o término
 * fique com quem realmente estava com a cirurgia [...] nos casos de continuação o
 * procedimento será 'passado' com a publicação da nova escala".
 *
 * O card da manhã ainda ABERTO e a linha "CONTINUAÇÃO" da tarde são UMA cirurgia em dois
 * cards. Ela tem início quando qualquer um dos cards tem, e término idem. O que faltar é
 * cobrado de quem estava na hora: o início de quem começou (o card da manhã), o término de
 * quem a escala da tarde pôs na continuação. A manhã já Terminada não passa nada adiante:
 * quem marcou disse que a cirurgia acabou ali. Com a MESMA pessoa nos dois cards nada passa:
 * a tela já mostra um card só (`fundirContinuacoesNaOrigem`), e o da manhã segue devendo os
 * dois horários, valendo o que estiver em qualquer um dos cards.
 *
 * O par exige a mesma escala (hospital e dia) e a MESMA SALA. O cirurgião tem de ser
 * compatível: um dos dois em branco, ou ao menos um nome em comum. A foto escreveu "Marcelo
 * Cunha" na tarde e "Marcelo Vieira" na manhã. E o "IOSC" do HRO é um bloco com várias
 * salas, onde cirurgiões sem nome em comum não se casam. Entre vários candidatos vence o
 * de mais nomes em comum, depois o marcado "Passa para tarde", depois o último da sala.
 * O banco forma o mesmo par (`escala_pares_continuacao`, migration 20261027220000).
 */
const NAO_E_NOME = new Set(['DAS', 'DOS', 'DEL'])
export function nomesDoCirurgiao(s) {
  const partes = String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
    .replace(/[^A-Z]+/g, ' ').trim().split(' ')
  return [...new Set(partes.filter((t) => t.length >= 3 && !NAO_E_NOME.has(t)))]
}

const chaveDoCaso = (caso) => caso?.id ?? caso
const salaDoPar = (caso) => String(caso?.sala || '').trim().toUpperCase()
const semAcento = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim()

/**
 * As mesmas pessoas nos dois cards: o login decide quando os dois têm um nome só; senão, os
 * apelidos (sem acento e sem ordem — "A + B" = "B + A"). O banco compara igual.
 */
function mesmaGente(a, b) {
  const pa = anestesistasDoCaso(a)
  const pb = anestesistasDoCaso(b)
  if (pa.length === 1 && pb.length === 1 && pa[0].uid && pb[0].uid) return pa[0].uid === pb[0].uid
  const chave = (ps) => ps.map((p) => semAcento(p.alias)).sort().join('+')
  return chave(pa) === chave(pb)
}

/**
 * Os pares manhã × continuação de UMA escala. `origemDe` vai da continuação (chave = id) ao
 * caso da manhã; `continuacoesDe`, do caso da manhã às continuações dele; `herdeiras` são as
 * continuações com OUTRA pessoa, as que levam o término.
 */
export function paresDeContinuacao(casos) {
  const origemDe = new Map()
  const continuacoesDe = new Map()
  const herdeiras = new Set()
  const lista = (casos || []).filter(Boolean)
  const origens = lista.filter((c) => !c.isContinuacao && turnoDoCasoHorario(c) === 'matutino'
    && casoAberto(c) && pedeHorario(c))
  for (const cont of lista) {
    if (!cont.isContinuacao || turnoDoCasoHorario(cont) !== 'vespertino' || !pedeHorario(cont)) continue
    const nomes = nomesDoCirurgiao(cont.cirurgiao)
    let melhor = null
    let pesoMelhor = null
    for (const o of origens) {
      if (salaDoPar(o) !== salaDoPar(cont)) continue
      const deles = nomesDoCirurgiao(o.cirurgiao)
      const comuns = nomes.filter((t) => deles.includes(t)).length
      if (nomes.length && deles.length && !comuns) continue
      const peso = [comuns, o.statusExtra === 'passa_tarde' ? 1 : 0, o.ordem ?? -Infinity]
      const i = pesoMelhor ? peso.findIndex((v, j) => v !== pesoMelhor[j]) : 0
      const vence = !melhor || (i >= 0 ? peso[i] > pesoMelhor[i] : String(o.id) < String(melhor.id))
      if (vence) { melhor = o; pesoMelhor = peso }
    }
    if (!melhor) continue
    origemDe.set(chaveDoCaso(cont), melhor)
    const k = chaveDoCaso(melhor)
    if (!continuacoesDe.has(k)) continuacoesDe.set(k, [])
    continuacoesDe.get(k).push(cont)
    if (!mesmaGente(melhor, cont)) herdeiras.add(chaveDoCaso(cont))
  }
  return { origemDe, continuacoesDe, herdeiras }
}

/** A continuação que herda o término de um caso da manhã (`pares` = `paresDeContinuacao`). */
export const herdaTermino = (caso, pares) => !!pares?.herdeiras.has(chaveDoCaso(caso))

const faltaDe = (ini, ter) => (ini && ter ? null : !ini && !ter ? 'ambos' : ini ? 'ter' : 'ini')

/**
 * O que falta, contando o par — o horário de qualquer card do par vale para a cirurgia:
 *  - continuação herdeira: só o término; a que é da mesma pessoa não deve nada (quem deve é o
 *    card da manhã, que a tela mostra no lugar dela);
 *  - card da manhã que passou o término adiante: só o início;
 *  - card da manhã com continuação da mesma pessoa: os dois, como sem par.
 * Fora de par vale `faltaHorario`.
 */
export function faltaNoPar(caso, pares) {
  const k = chaveDoCaso(caso)
  const origem = pares?.origemDe.get(k)
  const continuacoes = pares?.continuacoesDe.get(origem ? chaveDoCaso(origem) : k)
  if (!continuacoes) return faltaHorario(caso)
  const juntos = [origem || caso, ...continuacoes]
  const ini = juntos.some((c) => temTexto(c.inicioReal))
  const ter = juntos.some((c) => temTexto(c.terminoReal))
  if (origem) return pares.herdeiras.has(k) && !ter ? 'ter' : null
  if (continuacoes.some((c) => pares.herdeiras.has(chaveDoCaso(c)))) return ini ? null : 'ini'
  return faltaDe(ini, ter)
}

/** 23:00 — a hora em que a noite "zera" a fila (fase noturna). Prazo da tarde em andamento. */
export const PRAZO_TARDE_EM_ANDAMENTO_MIN = 23 * 60

/**
 * Minuto (dia operacional) em que a cirurgia vence pelo RELÓGIO. A que "passa para
 * tarde" vence com a tarde; a que passa para a NOITE não vence no dia — se ninguém
 * preencher até a virada, vai para o relatório.
 *
 * O FIM DO TURNO SÓ COBRA O QUE JÁ DEVIA TER ACONTECIDO (dono 15/10, causa 3 do relatório
 * das 24 pendências: às 19h a faixa marcava o Diego por uma cirurgia agendada para 19:15
 * e por outra iniciada às 16:20, ainda em curso):
 *  - não começou e o horário agendado é no fim do turno ou depois → o fim do turno não
 *    vence; quem cobra é o início vencido (agendada + 30 min), como em qualquer horário;
 *  - à TARDE, já começou e não terminou → tem até as 23h para terminar; sem término
 *    então, entra.
 *  - de MANHÃ, já começou e não terminou → vence com a tarde (19h), como a "Passa para
 *    tarde" (dono 21/10: hernioplastia da Sala 9 do HRO iniciada às 12:25 acendeu "Falta
 *    término" às 13:08 com a cirurgia em curso — ninguém marca "Passa para tarde" no meio
 *    da operação). A liberação segue cobrando na hora.
 */
export function prazoDoCaso(caso) {
  const turno = turnoDoCasoHorario(caso)
  if (caso?.statusExtra === 'passa_tarde') {
    return turno === 'matutino' ? FIM_TURNO_MIN.vespertino : VIRADA_DO_DIA_MIN
  }
  const fim = FIM_TURNO_MIN[turno]
  if (casoAberto(caso)) {
    if (!temTexto(caso.inicioReal)) {
      const hora = minutosHora(caso.hora)
      if (hora != null && hora >= fim) return VIRADA_DO_DIA_MIN
    } else if (turno === 'vespertino') {
      return PRAZO_TARDE_EM_ANDAMENTO_MIN
    } else if (turno === 'matutino') {
      return FIM_TURNO_MIN.vespertino
    }
  }
  return fim
}

/** Cirurgia ainda ABERTA: não terminada (suspensa já ficou fora da conta). */
export const casoAberto = (caso) => (caso?.statusCirurgia || 'agendada') !== 'terminada'

/**
 * INÍCIO VENCIDO (dono 05/10, à tarde, com o quadro na mão: "várias cirurgias já deveriam
 * ter informação de início e não há alerta"): a cirurgia que passou do horário AGENDADO
 * sem início entra no alerta já durante o turno — não espera a liberação nem o fim do
 * turno. Tolerância de 30 min (a escala costuma escorregar alguns minutos).
 *   • marcada ATRASADA: o atraso foi declarado — esta regra pausa (o fim do turno, não).
 *
 * A SALA OCUPADA NÃO COBRA (dono 27/10, medido em outubro): o intervalo real entre o
 * término de uma cirurgia e o início da seguinte na mesma sala tem mediana de 35 min e 75%
 * até 60 min. Com 30 min contados só da hora agendada, 300 alertas do mês acenderam com a
 * cirurgia ainda por começar (107 de 201 "AS"; 193 de 497 com hora, quase sempre atrás de
 * uma sala atrasada). Agora:
 *   • sem hora ("AS", a seguir): término real da anterior da mesma sala + 60 min;
 *   • com hora: o MAIOR entre a hora agendada e o término real da anterior, + 30 min;
 *   • a anterior ainda aberta (agendada/iniciada) segura a sala: a seguinte não é cobrada;
 *   • a anterior fechada sem término ("Terminou · horário depois") conta da hora em que a
 *     marcaram Terminada — o limite superior do término dela.
 * Medido: 300 → 139 alertas falsos no mês.
 */
export const TOLERANCIA_INICIO_MIN = 30
export const TOLERANCIA_INICIO_AS_MIN = 60

const minutosHora = (h) => {
  const m = /^\s*(\d{1,2}):(\d{2})/.exec(String(h ?? ''))
  return m ? Number(m[1]) * 60 + Number(m[2]) : null
}
const minutosDoCarimbo = (iso) => {
  const d = iso ? new Date(iso) : null
  return d && !Number.isNaN(d.getTime()) ? d.getHours() * 60 + d.getMinutes() : null
}

/** Quando a anterior liberou a sala: minuto | null (sem referência) | 'ocupada'. */
function fimDaAnterior(anterior) {
  if (!anterior) return null
  if (anterior.statusExtra === 'suspensa' || anterior.statusCirurgia === 'suspensa') return null
  if (casoAberto(anterior)) return 'ocupada'
  return minutosHora(anterior.terminoReal) ?? minutosDoCarimbo(anterior.statusAtualizadoEm)
}

/** Minuto (dia operacional) a partir do qual o início está vencido; null = sem referência. */
export function prazoInicio(caso, anteriorDaSala = null) {
  if (caso?.statusExtra === 'atrasada' || caso?.statusCirurgia === 'atrasada') return null
  const fim = fimDaAnterior(anteriorDaSala)
  if (fim === 'ocupada') return null
  const hora = minutosHora(caso?.hora)
  if (hora != null) return Math.max(hora, fim ?? hora) + TOLERANCIA_INICIO_MIN
  return fim != null ? fim + TOLERANCIA_INICIO_AS_MIN : null
}

/** A cirurgia imediatamente antes desta na mesma sala e turno (pela ordem publicada). */
function anterioresPorSala(casos) {
  const porSala = new Map()
  for (const c of casos || []) {
    const k = `${String(c.sala || '').trim().toUpperCase()}|${turnoDoCasoHorario(c)}`
    if (!porSala.has(k)) porSala.set(k, [])
    porSala.get(k).push(c)
  }
  const anterior = new Map()
  for (const lista of porSala.values()) {
    lista.sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
    lista.forEach((c, i) => { if (i > 0) anterior.set(c, lista[i - 1]) })
  }
  return anterior
}

/**
 * As pendências do DIA. `escalas` = as escalas carregadas (um hospital cada); só entram
 * as publicadas da data `hoje`. `liberado(escala, turno, parte)` diz se a parte do
 * anestesista foi liberada na fila daquele turno (a página injeta a leitura de
 * `escala.liberacoes`). Devolve um item por CIRURGIA:
 *   { caso, hospital, turno, falta, nomes, motivo: 'turno' | 'liberado' | 'inicio', aberta }
 * `aberta` = liberado com a cirurgia ainda aberta — o alerta oferece também "quem
 * assumiu", porque pode ser que a pessoa tenha sido substituída e não esquecido.
 * `motivo: 'inicio'` = passou do horário agendado sem início: só o início é cobrado
 * (o término ainda não era esperado).
 */
export function pendenciasDoDia(escalas, { hoje, agoraMin, liberado = () => false } = {}) {
  const out = []
  for (const escala of escalas || []) {
    if (!escala || escala.status !== 'publicada' || escala.data !== hoje) continue
    if (escala.hospital === 'fds') continue // a linha da fila única não tem cirurgias
    const anterior = anterioresPorSala(escala.casos)
    const pares = paresDeContinuacao(escala.casos)
    for (const caso of escala.casos || []) {
      // a continuação que herdou o término entra pelo nome de quem a escala da tarde pôs nela
      const herdeira = herdaTermino(caso, pares)
      const conta = herdeira
        ? dentroDoInicioDoAlerta(escala.data, turnoDoCasoHorario(caso))
        : casoEntraNaConta(caso, { data: escala.data })
      if (!conta) continue
      const falta = faltaNoPar(caso, pares)
      if (!falta) continue
      const turno = turnoDoCasoHorario(caso)
      const nomes = anestesistasDoCaso(caso)
      const vencido = agoraMin != null && agoraMin >= prazoDoCaso(caso)
      // a que passa de turno continua com alguém: a liberação de quem começou não a encerra
      const foiLiberado = caso.statusExtra !== 'passa_tarde'
        && nomes.some((p) => liberado(escala, turno, p))
      // da continuação só se cobra o término: a cirurgia já tinha começado de manhã; o início
      // que outro card do par já tem também vale
      const semInicio = !herdeira && (falta === 'ini' || falta === 'ambos')
      const limiteInicio = semInicio ? prazoInicio(caso, anterior.get(caso)) : null
      const inicioVencido = limiteInicio != null && agoraMin != null && agoraMin >= limiteInicio
      if (!vencido && !foiLiberado && !inicioVencido) continue
      const motivo = vencido ? 'turno' : foiLiberado ? 'liberado' : 'inicio'
      out.push({
        caso,
        hospital: escala.hospital,
        turno,
        falta: motivo === 'inicio' ? 'ini' : falta,
        nomes,
        motivo,
        aberta: foiLiberado && casoAberto(caso),
      })
    }
  }
  return out
}

/**
 * ANTES DE LIBERAR (dono 14/10/2026, modelo A de `.tmp/liberar-com-cirurgia-aberta.html`,
 * sem a saída "Liberar sem horário"): "ao liberar algum anestesista e o mesmo tiver casos
 * abertos/cirurgias sem tempos informados [...] que os tempos sejam adicionados antes da
 * liberação ou que os casos sejam transferidos para outro colega". Medido de 06 a 13/10:
 * 54% das liberações de quem operou deixaram cirurgia sem horário, e 97% das liberações
 * são feitas pelo plantonista — é para ele que a folha aparece.
 *
 * `casos` = as cirurgias da PESSOA no turno, abertas e encerradas (`linha.casosTurno`).
 * Devolve só as que travam a liberação: `{ caso, inicio, termino, aberta }` — `inicio`/
 * `termino` dizem o que falta. Mesmos cortes do alerta (`casoEntraNaConta`, sem a janela de
 * datas). A cirurgia que SEGUE com outra pessoa não trava: a que passa para a tarde e a
 * dupla "A + B" ainda aberta — quem fica responde por ela.
 *
 * SÓ A ABERTA TRAVA (dono 27/10, reabre 14/10): 96% das liberações eram feitas por outra
 * pessoa, que não sabe os horários — 177 términos entraram com a hora do toque só para
 * destravar. Agora a folha pede o FATO de cada cirurgia aberta (preencher, "Terminou ·
 * horário depois", passar, não aconteceu); terminada sem horário não segura ninguém e vira
 * pendência de quem operou (aba Minhas). A folha é a mesma para quem libera a si mesmo.
 * O banco recusa o mesmo conjunto (`escala_caso_trava_liberacao`, migration 20261027190000).
 */
export function pendenciasParaLiberar(casos) {
  const out = []
  for (const caso of casos || []) {
    if (!caso || !temTexto(caso.procedimento)) continue
    if (caso.semAnestesista || caso.isContinuacao || ehConsultorio(caso)) continue
    if (caso.statusExtra === 'suspensa' || caso.statusCirurgia === 'suspensa') continue
    if (!casoAberto(caso)) continue
    if (caso.statusExtra === 'passa_tarde' || anestesistasDoCaso(caso).length > 1) continue
    out.push({ caso, inicio: !temTexto(caso.inicioReal), termino: !temTexto(caso.terminoReal), aberta: true })
  }
  return out.sort((a, b) => minutosDe(a.caso.hora) - minutosDe(b.caso.hora) || ((a.caso.ordem ?? 0) - (b.caso.ordem ?? 0)))
}

/**
 * LIBERAR CONFERE O DIA (dono 15/10/2026, causa 1 do relatório das 24 pendências): a folha
 * "Antes de liberar" só olhava o hospital e o turno da fila. Assim o Oscar foi liberado no
 * HRO com 2 cirurgias abertas na Unimed, e Marílio, Leonardo, Raul e Guilherme Xavier foram
 * liberados à tarde com a cirurgia da MANHÃ sem horário.
 *
 * Devolve as pendências da pessoa nos OUTROS lugares do dia — os três hospitais, o turno da
 * liberação e os anteriores (de manhã só a manhã: a cirurgia da tarde ainda não aconteceu) —,
 * com os mesmos cortes de `pendenciasParaLiberar`, cada uma com `hospital` e `turno`.
 * `ehDaPessoa(caso)` decide a identidade; `jaVistos` = ids que a linha da fila já confere.
 * O banco recusa o mesmo conjunto (`rpc_escala_patch_liberacao`, migration 20261015230000).
 */
const TURNOS_ATE = { matutino: ['matutino'], vespertino: ['matutino', 'vespertino'] }

export function pendenciasDoDiaParaLiberar(escalas, { turno, ehDaPessoa, jaVistos = new Set() } = {}) {
  const turnos = TURNOS_ATE[turno]
  if (!turnos || !ehDaPessoa) return []
  const out = []
  for (const escala of escalas || []) {
    if (!escala || escala.status !== 'publicada' || escala.hospital === 'fds') continue
    const casos = (escala.casos || []).filter((c) => c?.id && !jaVistos.has(c.id)
      && turnos.includes(turnoDoCasoHorario(c)) && ehDaPessoa(c))
    for (const p of pendenciasParaLiberar(casos)) {
      out.push({ ...p, hospital: escala.hospital, turno: turnoDoCasoHorario(p.caso) })
    }
  }
  return out
}

/**
 * PENDÊNCIAS QUE FICAM ATÉ SEREM PREENCHIDAS (dono 27/10): a cirurgia que terminou sem
 * horário não some na virada do dia — fica na Minhas de quem operou até ele informar, em
 * qualquer dia e hospital. Nada anterior a `CORTE_PENDENCIAS_MINHAS` entra (não despejar o
 * histórico de ninguém). "Em aberto" é EXATAMENTE a regra da faixa: cada dia passado roda
 * `pendenciasDoDia` com o relógio na virada (31:00), quando todo prazo já venceu — então
 * consultório, SRPA, suspensa, continuação e passa-para-tarde saem pelos mesmos cortes.
 *
 * `escalas` = escalas de dias ANTERIORES a `hoje` (uma por hospital/dia). Devolve os itens
 * de `pendenciasDoDia` com `data`, do dia mais recente para o mais antigo. Cada escala
 * precisa trazer os DOIS cards de um par manhã × continuação, mesmo o que é de outra pessoa:
 * sem o par, o término volta para quem começou.
 */
export const CORTE_PENDENCIAS_MINHAS = '2026-10-27'

export function pendenciasDeDiasAnteriores(escalas, { hoje, desde = CORTE_PENDENCIAS_MINHAS } = {}) {
  const out = []
  for (const escala of escalas || []) {
    const d = String(escala?.data || '')
    if (!d || d < desde || (hoje && d >= hoje)) continue
    for (const item of pendenciasDoDia([escala], { hoje: d, agoraMin: VIRADA_DO_DIA_MIN })) {
      out.push({ ...item, data: d })
    }
  }
  return out.sort((a, b) => b.data.localeCompare(a.data) || compararPendencias(a, b))
}

/** Minutos de "HH:MM" (sem hora = fim da fila). */
const minutosDe = (hora) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hora || '').trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60
}
const ORDEM_TURNO = { matutino: 0, vespertino: 1 }
/** Ordem de leitura das pendências: turno, hora, hospital (a lista pessoal da aba Minhas usa a mesma). */
export const compararPendencias = (a, b) =>
  (ORDEM_TURNO[a.turno] ?? 0) - (ORDEM_TURNO[b.turno] ?? 0)
  || minutosDe(a.caso?.hora) - minutosDe(b.caso?.hora)
  || String(a.hospital).localeCompare(String(b.hospital))

/**
 * Agrupa por anestesista (a dupla aparece nos dois). `chaveDe(parte)` dá a identidade
 * estável (uid, senão o nome normalizado) e `nomeDe(parte)` o nome de exibição.
 * Ordem: quem deve MAIS primeiro; empate → a pendência mais antiga; depois o nome.
 */
export function agruparPorAnestesista(itens, { chaveDe, nomeDe } = {}) {
  const chave = chaveDe || ((p) => p.uid || String(p.alias || '').toUpperCase())
  const nome = nomeDe || ((p) => p.alias)
  const grupos = new Map()
  for (const item of itens || []) {
    for (const parte of item.nomes) {
      const k = chave(parte)
      if (!k) continue
      if (!grupos.has(k)) grupos.set(k, { chave: k, nome: nome(parte), uid: parte.uid || null, itens: [] })
      const g = grupos.get(k)
      if (!g.itens.includes(item)) g.itens.push(item)
    }
  }
  const lista = [...grupos.values()]
  for (const g of lista) g.itens.sort(compararPendencias)
  return lista.sort((a, b) =>
    b.itens.length - a.itens.length
    || compararPendencias(a.itens[0], b.itens[0])
    || String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
}

// ── RELATÓRIO: o que ficou sem horário nos dias encerrados ────────────────────
// (dono 05/10: "se não for preenchido durante o dia, quero que crie um relatório e
// incorpore ao relatório de adesão"; seção escolhida em protótipo — modelo A,
// `.tmp/relatorio-horario-nao-preenchido.html`). Os dados vêm da RPC
// `escala_horario_pendente_relatorio`, que aplica os MESMOS cortes desta lib.

const mais = (iso, dias) => {
  const [a, m, d] = String(iso).split('-').map(Number)
  const dt = new Date(a, m - 1, d + dias)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

/**
 * Monta o relatório a partir do JSON da RPC: por anestesista (quem deixou mais primeiro;
 * empate → o mais recente), com as cirurgias do mais recente para o mais antigo, e os
 * três números — o último dia encerrado, os últimos 7 dias e o período inteiro.
 * `chaveDe`/`nomeDe` como em `agruparPorAnestesista` (a página resolve pelo dicionário).
 */
export function montarRelatorioHorario(dados, { chaveDe, nomeDe } = {}) {
  const desde = dados?.desde || null
  const ate = dados?.ate || null
  const vazio = !desde || !ate || ate < desde
  const itens = vazio ? [] : (dados?.casos || []).map((r) => {
    const caso = {
      id: r.id, sala: r.sala, hora: r.hora, procedimento: r.procedimento, turno: r.turno,
      anestesista: r.anestesista, anestesistaUserId: r.anestesista_user_id || null,
    }
    return { caso, data: r.data, hospital: r.hospital, turno: r.turno, falta: r.falta, nomes: anestesistasDoCaso(caso) }
  })
  const recente = (a, b) => String(b.data).localeCompare(String(a.data)) || compararPendencias(a, b)
  const grupos = agruparPorAnestesista(itens, { chaveDe, nomeDe })
  for (const g of grupos) {
    g.itens.sort(recente)
    g.ultima = g.itens[0]?.data || null
  }
  grupos.sort((a, b) => b.itens.length - a.itens.length
    || String(b.ultima).localeCompare(String(a.ultima))
    || String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
  const semana = ate ? mais(ate, -6) : null
  return {
    desde, ate, vazio,
    total: itens.length,
    ultimoDia: itens.filter((i) => i.data === ate).length,
    seteDias: itens.filter((i) => semana && i.data >= semana).length,
    pessoas: grupos,
  }
}

const DIAS_SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
/** "ontem" | "sex 02/10" — `hojeIso` = a data de hoje (calendário). */
export function rotuloDiaRelatorio(iso, hojeIso) {
  if (!iso) return ''
  if (hojeIso && iso === mais(hojeIso, -1)) return 'ontem'
  const [a, m, d] = String(iso).split('-').map(Number)
  return `${DIAS_SEMANA[new Date(a, m - 1, d).getDay()]} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}`
}
