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
 * A cirurgia é da conta do alerta? Mesmos cortes do relatório (SQL): com procedimento,
 * com anestesista, não suspensa, não continuação (a da tarde herda o caso da manhã — a
 * mesma cirurgia não conta duas vezes, como na cobrança), dentro da janela.
 */
export function casoEntraNaConta(caso, { data } = {}) {
  if (!caso || !temTexto(caso.procedimento)) return false
  if (caso.semAnestesista) return false
  if (caso.statusExtra === 'suspensa' || caso.statusCirurgia === 'suspensa') return false
  if (caso.isContinuacao) return false
  if (!anestesistasDoCaso(caso).length) return false
  return dentroDoInicioDoAlerta(data, turnoDoCasoHorario(caso))
}

/**
 * Minuto (dia operacional) em que a cirurgia vence pelo RELÓGIO. A que "passa para
 * tarde" vence com a tarde; a que passa para a NOITE não vence no dia — se ninguém
 * preencher até a virada, vai para o relatório.
 */
export function prazoDoCaso(caso) {
  const turno = turnoDoCasoHorario(caso)
  if (caso?.statusExtra === 'passa_tarde') {
    return turno === 'matutino' ? FIM_TURNO_MIN.vespertino : VIRADA_DO_DIA_MIN
  }
  return FIM_TURNO_MIN[turno]
}

/** Cirurgia ainda ABERTA: não terminada (suspensa já ficou fora da conta). */
export const casoAberto = (caso) => (caso?.statusCirurgia || 'agendada') !== 'terminada'

/**
 * As pendências do DIA. `escalas` = as escalas carregadas (um hospital cada); só entram
 * as publicadas da data `hoje`. `liberado(escala, turno, parte)` diz se a parte do
 * anestesista foi liberada na fila daquele turno (a página injeta a leitura de
 * `escala.liberacoes`). Devolve um item por CIRURGIA:
 *   { caso, hospital, turno, falta, nomes, motivo: 'turno' | 'liberado', aberta }
 * `aberta` = liberado com a cirurgia ainda aberta — o alerta oferece também "quem
 * assumiu", porque pode ser que a pessoa tenha sido substituída e não esquecido.
 */
export function pendenciasDoDia(escalas, { hoje, agoraMin, liberado = () => false } = {}) {
  const out = []
  for (const escala of escalas || []) {
    if (!escala || escala.status !== 'publicada' || escala.data !== hoje) continue
    if (escala.hospital === 'fds') continue // a linha da fila única não tem cirurgias
    for (const caso of escala.casos || []) {
      if (!casoEntraNaConta(caso, { data: escala.data })) continue
      const falta = faltaHorario(caso)
      if (!falta) continue
      const turno = turnoDoCasoHorario(caso)
      const nomes = anestesistasDoCaso(caso)
      const vencido = agoraMin != null && agoraMin >= prazoDoCaso(caso)
      // a que passa de turno continua com alguém: a liberação de quem começou não a encerra
      const foiLiberado = caso.statusExtra !== 'passa_tarde'
        && nomes.some((p) => liberado(escala, turno, p))
      if (!vencido && !foiLiberado) continue
      out.push({
        caso,
        hospital: escala.hospital,
        turno,
        falta,
        nomes,
        motivo: vencido ? 'turno' : 'liberado',
        aberta: foiLiberado && casoAberto(caso),
      })
    }
  }
  return out
}

/** Minutos de "HH:MM" (sem hora = fim da fila). */
const minutosDe = (hora) => {
  const m = /^(\d{1,2}):(\d{2})/.exec(String(hora || '').trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : 24 * 60
}
const ORDEM_TURNO = { matutino: 0, vespertino: 1 }
const compararItens = (a, b) =>
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
  for (const g of lista) g.itens.sort(compararItens)
  return lista.sort((a, b) =>
    b.itens.length - a.itens.length
    || compararItens(a.itens[0], b.itens[0])
    || String(a.nome).localeCompare(String(b.nome), 'pt-BR'))
}

/**
 * Quantas pílulas de nome cabem numa linha, reservando o "+N" quando sobra alguém.
 * `larguras` = largura de cada pílula; `gap` entre elas; `mais` = largura da "+N".
 */
export function quantasPilulasCabem(larguras, disponivel, { gap = 6, mais = 40 } = {}) {
  const n = larguras.length
  let usado = 0
  for (let i = 0; i < n; i++) {
    const proxima = usado + (i ? gap : 0) + larguras[i]
    const sobraDepois = i < n - 1
    const reserva = sobraDepois ? gap + mais : 0
    // a última pílula não reserva lugar para o "+N": sem ninguém depois, ele não existe
    if (proxima + reserva > disponivel) return i
    usado = proxima
  }
  return n
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
  const recente = (a, b) => String(b.data).localeCompare(String(a.data)) || compararItens(a, b)
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
